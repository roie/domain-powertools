import { useState, useEffect, useMemo, useRef } from 'react';
import { browser } from 'wxt/browser';
import { FilterState, filterDomain, sortRows, getHeatColor } from './FilterEngine';

const TABLE_SELECTOR = '#listing table.base1';
const DOMAIN_LINK_SELECTOR = 'td.field_domain a';
const STATUS_CELL_SELECTOR = 'td.field_whois';

interface ColumnDef {
  label: string;
  className: string;
  tooltip: string;
}

interface Preset {
  name: string;
  filters: FilterState;
  hiddenColumns: string[];
  sortConfig: { column: string; direction: 'asc' | 'desc' };
  expansionState: {
    name: boolean;
    tld: boolean;
    advanced: boolean;
    columns: boolean;
  };
}

const DEFAULT_FILTERS: FilterState = {
  matchType: 'all',
  matchText: '',
  startsWith: '',
  endsWith: '',
  blacklist: '',
  minLength: '',
  maxLength: '',
  hyphenSetting: 'any',
  numberSetting: 'any',
  pattern: '',
  tldFilter: '',
  statusFilter: 'Any',
};

export default function Sidebar() {
  // --- Core State ---
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortConfig, setSortConfig] = useState<{ column: string, direction: 'asc' | 'desc' }>({ column: '', direction: 'asc' });
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetName, setActivePresetName] = useState('');
  
  // --- UI & Meta State ---
  const [visibleCount, setVisibleCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>(['Any']);
  const [detectedTlds, setDetectedTlds] = useState<{ tld: string, count: number }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  
  // --- Feature States ---
  const [isHeatmapEnabled, setIsHeatmapEnabled] = useState(false);

  // --- Collapsible UI States ---
  const [isNameExpanded, setIsNameExpanded] = useState(true);
  const [isTldExpanded, setIsTldExpanded] = useState(false);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [isColumnsExpanded, setIsColumnsExpanded] = useState(false);

  // --- Persistence Logic ---
  const isLoaded = useRef(false);
  const originalRowsRef = useRef<HTMLTableRowElement[]>([]);

  // 1. Initial Load (Once on Mount)
  useEffect(() => {
    const loadAll = async () => {
        try {
            if (!browser.storage?.local) {
                isLoaded.current = true;
                return;
            }
            const res = await browser.storage.local.get([
                'dpt_filters', 
                'dpt_presets', 
                'dpt_active_preset', 
                'dpt_hidden_columns', 
                'dpt_sort_config',
                'dpt_heatmap',
                'dpt_exp_name',
                'dpt_exp_tld',
                'dpt_exp_adv',
                'dpt_exp_cols'
            ]) as any;
            
            if (res.dpt_filters) setFilters(res.dpt_filters);
            if (res.dpt_presets) setPresets(res.dpt_presets);
            if (res.dpt_active_preset) setActivePresetName(res.dpt_active_preset);
            if (res.dpt_hidden_columns) setHiddenColumns(res.dpt_hidden_columns);
            if (res.dpt_sort_config) setSortConfig(res.dpt_sort_config);
            if (res.dpt_heatmap !== undefined) setIsHeatmapEnabled(res.dpt_heatmap);
            
            // Expansion States
            if (res.dpt_exp_name !== undefined) setIsNameExpanded(res.dpt_exp_name);
            if (res.dpt_exp_tld !== undefined) setIsTldExpanded(res.dpt_exp_tld);
            if (res.dpt_exp_adv !== undefined) setIsAdvancedExpanded(res.dpt_exp_adv);
            if (res.dpt_exp_cols !== undefined) setIsColumnsExpanded(res.dpt_exp_cols);
            
        } catch (e) {
            console.error("Domain Powertools: Failed to load settings", e);
        } finally {
            // Delay marking as loaded to let React finish its first render cycle
            setTimeout(() => { isLoaded.current = true; }, 200);
        }
    };
    loadAll();
  }, []);

  // 2. Unified Debounced Save
  useEffect(() => {
    if (!isLoaded.current) return;

    const timer = setTimeout(() => {
        browser.storage.local.set({
            dpt_filters: filters,
            dpt_presets: presets,
            dpt_active_preset: activePresetName,
            dpt_hidden_columns: hiddenColumns,
            dpt_sort_config: sortConfig,
            dpt_heatmap: isHeatmapEnabled,
            dpt_exp_name: isNameExpanded,
            dpt_exp_tld: isTldExpanded,
            dpt_exp_adv: isAdvancedExpanded,
            dpt_exp_cols: isColumnsExpanded
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, presets, activePresetName, hiddenColumns, sortConfig, isHeatmapEnabled, isNameExpanded, isTldExpanded, isAdvancedExpanded, isColumnsExpanded]);

  // --- DOM Detection (Mount) ---
  useEffect(() => {
    const tbody = document.querySelector(`${TABLE_SELECTOR} tbody`);
    if (tbody) {
        originalRowsRef.current = Array.from(tbody.querySelectorAll('tr')) as HTMLTableRowElement[];
    }

    const headers = document.querySelectorAll(`${TABLE_SELECTOR} thead th`);
    const cols: ColumnDef[] = [];
    headers.forEach((th) => {
      const headClass = Array.from(th.classList).find(c => c.startsWith('head_'));
      if (!headClass || headClass === 'head_watchlist' || headClass === 'head_domain') return;
      const fieldClass = headClass.replace('head_', 'field_');
      cols.push({
        label: th.querySelector('a')?.textContent?.trim() || th.textContent?.trim() || '?', 
        className: fieldClass, 
        tooltip: th.querySelector('a')?.getAttribute('title') || '' 
      });
    });
    setColumns(cols);

    const rows = originalRowsRef.current;
    const statusSet = new Set<string>();
    const tldMap = new Map<string, number>();
    rows.forEach(row => {
        const domainLink = row.querySelector(DOMAIN_LINK_SELECTOR);
        if (domainLink) {
            const fullDomain = domainLink.getAttribute('title')?.trim() || domainLink.textContent?.trim() || '';
            const parts = fullDomain.split('.');
            if (parts.length > 1) {
                const tld = parts.slice(1).join('.');
                tldMap.set(tld, (tldMap.get(tld) || 0) + 1);
            }
        }
        const statusCell = row.querySelector(STATUS_CELL_SELECTOR);
        const statusText = statusCell?.querySelector('a')?.textContent || statusCell?.textContent;
        if (statusText) statusSet.add(statusText.trim());
    });
    setAvailableStatuses(['Any', ...Array.from(statusSet).sort()]);
    setDetectedTlds(Array.from(tldMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tld, count]) => ({ tld, count })));
  }, []);

  // --- Layout & Table Logic ---
  useEffect(() => {
    document.body.style.transition = 'margin-right 300ms cubic-bezier(0.4, 0, 0.2, 1)';
    document.body.style.marginRight = isCollapsed ? '48px' : '320px';
    return () => { document.body.style.marginRight = ''; };
  }, [isCollapsed]);

  useEffect(() => {
    const tbody = document.querySelector(`${TABLE_SELECTOR} tbody`);
    if (!tbody || originalRowsRef.current.length === 0) return;
    let rows = [...originalRowsRef.current];
    let count = 0;

    rows.forEach((row) => {
      const domainLink = row.querySelector(DOMAIN_LINK_SELECTOR); 
      const statusCell = row.querySelector(STATUS_CELL_SELECTOR);
      if (!domainLink) return;
      const domainName = domainLink.getAttribute('title')?.trim() || domainLink.textContent?.trim() || '';
      const statusText = statusCell?.querySelector('a')?.textContent?.trim() || statusCell?.textContent?.trim() || '';
      const isVisible = filterDomain(domainName, statusText, filters);
      row.style.display = isVisible ? '' : 'none';
      if (isVisible) count++;

      // Apply Heatmap
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
          if (!isHeatmapEnabled) {
              cell.style.backgroundColor = '';
              return;
          }
          const className = Array.from(cell.classList).find(c => c.startsWith('field_')) as string;
          if (className) {
              const color = getHeatColor(className, cell.textContent?.trim() || '');
              cell.style.backgroundColor = color || '';
          }
      });
    });

    setVisibleCount(count);
    if (sortConfig.column) rows = sortRows(rows, sortConfig.column, sortConfig.direction);
    rows.forEach(row => tbody.appendChild(row));
  }, [filters, sortConfig, isHeatmapEnabled]);

  useEffect(() => {
    const styleId = 'domain-powertools-col-styles';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    const hiddenRules = hiddenColumns.map(c => `${TABLE_SELECTOR} th.${c.replace('field_', 'head_')}, ${TABLE_SELECTOR} td.${c} { display: none !important; }`).join('\n');
    let highlightRule = sortConfig.column ? `${TABLE_SELECTOR} td.${sortConfig.column} { border-left: 2px solid rgba(148, 163, 184, 0.4) !important; border-right: 2px solid rgba(148, 163, 184, 0.4) !important; }` : '';
    styleTag.textContent = hiddenRules + '\n' + highlightRule;
  }, [hiddenColumns, sortConfig.column]);

  // --- Handlers ---
  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setActivePresetName('');
  };

  const toggleTld = (tld: string) => {
    const current = filters.tldFilter.split(',').map(s => s.trim()).filter(Boolean);
    const next = current.includes(tld) ? current.filter(t => t !== tld) : [...current, tld];
    updateFilter('tldFilter', next.join(', '));
  };

  const copyVisible = () => {
    const domains: string[] = [];
    document.querySelectorAll(`${TABLE_SELECTOR} tbody tr`).forEach(row => {
      if ((row as HTMLElement).style.display !== 'none') {
        const link = row.querySelector(DOMAIN_LINK_SELECTOR);
        const d = link?.getAttribute('title') || link?.textContent;
        if (d) domains.push(d.trim());
      }
    });
    navigator.clipboard.writeText(domains.join('\n'));
    setCopyFeedback(`Copied ${domains.length}!`);
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = {
        name: newPresetName,
        filters: { ...filters },
        hiddenColumns: [...hiddenColumns],
        sortConfig: { ...sortConfig },
        expansionState: {
            name: isNameExpanded,
            tld: isTldExpanded,
            advanced: isAdvancedExpanded,
            columns: isColumnsExpanded
        }
    };
    setPresets(prev => [...prev, newPreset]);
    setActivePresetName(newPresetName);
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const loadPreset = (p: Preset) => {
    setFilters(p.filters);
    setHiddenColumns(p.hiddenColumns || []);
    setSortConfig(p.sortConfig || { column: '', direction: 'asc' });
    if (p.expansionState) {
        setIsNameExpanded(p.expansionState.name);
        setIsTldExpanded(p.expansionState.tld);
        setIsAdvancedExpanded(p.expansionState.advanced);
        setIsColumnsExpanded(p.expansionState.columns);
    }
    setActivePresetName(p.name);
  };

  const deletePreset = (idx: number) => {
    const name = presets[idx].name;
    setPresets(prev => prev.filter((_, i) => i !== idx));
    if (activePresetName === name) setActivePresetName('');
  };

  const exportPresets = () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'domain-powertools-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target?.result as string);
            if (Array.isArray(imported)) {
                setPresets(prev => [...prev, ...imported]);
                alert('Presets imported!');
            }
        } catch (err) { alert('Invalid file.'); }
    };
    reader.readAsText(file);
  };

  const exportToCSV = () => {
    const tbody = document.querySelector(`${TABLE_SELECTOR} tbody`);
    if (!tbody) return;
    const visibleRows = Array.from(tbody.querySelectorAll('tr')).filter(r => (r as HTMLElement).style.display !== 'none') as HTMLTableRowElement[];
    const exportCols = [{ label: 'Domain', className: 'field_domain' }, ...columns.filter(col => !hiddenColumns.includes(col.className))];
    const csvRows = [exportCols.map(c => '"' + c.label + '"').join(',')];
    
    visibleRows.forEach(row => {
      const rowData = exportCols.map(col => {
        const cell = row.querySelector('td.' + col.className);
        if (!cell) return '""';

        let val = '';
        if (col.className === 'field_domain') {
          const link = cell.querySelector('a');
          val = link?.getAttribute('title') || link?.textContent || '';
        } else { 
          const tempCell = cell.cloneNode(true) as HTMLElement;
          tempCell.querySelectorAll('ul, .kmenucontent, style, script').forEach(el => el.remove());
          val = tempCell.textContent?.trim() || ''; 
        }
        // Properly escape quotes for CSV
        const escapedVal = val.replace(/"/g, '""');
        return '"' + escapedVal + '"';
      });
      csvRows.push(rowData.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'domain_powertools_export_' + new Date().toISOString().split('T')[0] + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`fixed top-0 right-0 h-full bg-slate-900 text-slate-100 shadow-2xl z-[9999] border-l border-slate-700 font-sans transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12' : 'w-80'}`}>
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute top-4 left-0 -ml-4 bg-slate-900 border border-slate-700 text-green-400 p-1 rounded-l w-6 h-8 flex items-center justify-center cursor-pointer transition-colors hover:text-green-300">{isCollapsed ? '«' : '»'}</button>
      <div className={`flex flex-col h-full ${isCollapsed ? 'hidden' : 'flex'}`}>
        <div className="p-4 flex-shrink-0 bg-slate-900 z-10 border-b border-slate-800">
           <div className="flex justify-between items-center mb-3">
               <h2 className="text-lg font-bold text-green-400">Domain Powertools</h2>
               <div className="flex gap-2">
                   <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-white transition-colors cursor-pointer" title="Settings">⚙️</button>
                   <button onClick={() => {
                       setFilters(DEFAULT_FILTERS); 
                       setHiddenColumns([]); 
                       setSortConfig({ column: '', direction: 'asc' }); 
                       setActivePresetName(''); 
                       setIsHeatmapEnabled(false);
                       setIsNameExpanded(true);
                       setIsTldExpanded(false);
                       setIsAdvancedExpanded(false);
                       setIsColumnsExpanded(false);
                   }} className="text-xs text-slate-400 hover:text-white underline cursor-pointer">Reset</button>
               </div>
           </div>
           <div className="flex gap-2">
               {isSavingPreset ? (
                   <div className="flex gap-1 w-full"><input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Name" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none" autoFocus onKeyDown={(e) => e.key === 'Enter' && savePreset()}/><button onClick={savePreset} className="text-green-400 px-1 cursor-pointer">✓</button><button onClick={() => setIsSavingPreset(false)} className="text-red-400 px-1 cursor-pointer">✕</button></div>
               ) : (
                   <><select value={activePresetName} onChange={(e) => { const p = presets.find(x => x.name === e.target.value); if (p) loadPreset(p); }} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs cursor-pointer outline-none hover:bg-slate-750 transition-colors"><option value="">Load Preset...</option>{presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select><button onClick={() => setIsSavingPreset(true)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs hover:bg-slate-700 hover:text-green-400 cursor-pointer text-slate-400 transition-colors" title="Save Preset">💾</button></>
               )}
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Sort By</label>
                <div className="flex gap-2">
                    <select value={sortConfig.column} onChange={(e) => { setSortConfig(prev => ({ ...prev, column: e.target.value })); setActivePresetName(''); }} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm cursor-pointer outline-none focus:border-green-500 transition-colors"><option value="">Default Order</option><option value="field_domain">Domain</option>{columns.filter(col => !hiddenColumns.includes(col.className)).map(col => (<option key={col.className} value={col.className}>{col.label}</option>))}</select>
                    {sortConfig.column && <button onClick={() => { setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' })); setActivePresetName(''); }} className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm font-bold cursor-pointer hover:bg-slate-700 text-green-400 transition-colors">{sortConfig.direction === 'asc' ? '↑' : '↓'}</button>}
                </div>
            </div>
            <section className="space-y-4">
                <button onClick={() => setIsNameExpanded(!isNameExpanded)} className="w-full flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer px-2 py-2 rounded bg-slate-800/30 hover:bg-slate-800 transition-colors"><span>Name & Structure</span><span>{isNameExpanded ? '−' : '+'}</span></button>
                {isNameExpanded && (
                    <div className="space-y-4">
                        <div className="space-y-1"><label className="text-xs text-slate-400">Length</label><div className="flex gap-2"><input type="number" placeholder="Min" value={filters.minLength} onChange={(e) => updateFilter('minLength', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-slate-500"/><input type="number" placeholder="Max" value={filters.maxLength} onChange={(e) => updateFilter('maxLength', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-slate-500"/></div></div>
                        
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={filters.matchText} 
                                onChange={(e) => updateFilter('matchText', e.target.value)} 
                                className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-green-500" 
                                placeholder="Contains"
                            />
                            <input 
                                type="text" 
                                value={filters.blacklist} 
                                onChange={(e) => updateFilter('blacklist', e.target.value)} 
                                className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-red-500" 
                                placeholder="Exclude"
                            />
                        </div>

                        <div className="flex gap-2"><input type="text" value={filters.startsWith} onChange={(e) => updateFilter('startsWith', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-green-500" placeholder="Starts With"/><input type="text" value={filters.endsWith} onChange={(e) => updateFilter('endsWith', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-green-500" placeholder="Ends With"/></div>
                        <div className="flex gap-2 pt-1"><div className="w-1/2 space-y-1"><label className="text-xs text-slate-400">Hyphens</label><select value={filters.hyphenSetting} onChange={(e) => updateFilter('hyphenSetting', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-750 transition-colors"><option value="any">Any</option><option value="none">None</option><option value="max1">Max 1</option><option value="max2">Max 2</option></select></div><div className="w-1/2 space-y-1"><label className="text-xs text-slate-400">Numbers</label><select value={filters.numberSetting} onChange={(e) => updateFilter('numberSetting', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-750 transition-colors"><option value="any">Any</option><option value="none">None</option><option value="max1">Max 1</option><option value="max2">Max 2</option><option value="only">Only</option></select></div></div>
                    </div>
                )}
            </section>
            <section className="space-y-4">
                <button onClick={() => setIsTldExpanded(!isTldExpanded)} className="w-full flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer px-2 py-2 rounded bg-slate-800/30 hover:bg-slate-800 transition-colors"><span>TLD & Status</span><span>{isTldExpanded ? '−' : '+'}</span></button>
                {isTldExpanded && (
                    <div className="space-y-4">
                        {detectedTlds.length > 0 && (<div className="space-y-2"><label className="text-xs text-slate-400">TLDs (Top 10)</label><div className="flex flex-wrap gap-1.5">{detectedTlds.map(({ tld, count }) => (<button key={tld} onClick={() => toggleTld(tld)} className={`px-2 py-1 rounded text-[10px] border cursor-pointer transition-all ${filters.tldFilter.split(',').map(s => s.trim()).includes(tld) ? 'bg-green-900/40 border-green-700 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>.{tld} <span className="opacity-50 ml-1">{count}</span></button>))}</div></div>)}
                        {availableStatuses.length > 2 && (<div className="space-y-1"><label className="text-xs text-slate-400">Status</label><select value={filters.statusFilter} onChange={(e) => updateFilter('statusFilter', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-750 transition-colors">{availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>)}
                    </div>
                )}
            </section>

            <section className="space-y-2">
                <button onClick={() => setIsColumnsExpanded(!isColumnsExpanded)} className="w-full flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer px-2 py-2 rounded bg-slate-800/30 hover:bg-slate-800 transition-colors"><span>Toggle Columns</span><span>{isColumnsExpanded ? '−' : '+'}</span></button>
                {isColumnsExpanded && (<div className="grid grid-cols-2 gap-2 p-1">{columns.map(col => (<button key={col.className} onClick={() => { setHiddenColumns(prev => prev.includes(col.className) ? prev.filter(c => c !== col.className) : [...prev, col.className]); setActivePresetName(''); }} title={col.tooltip} className={`text-[10px] py-1.5 px-2 rounded border truncate cursor-pointer transition-all ${hiddenColumns.includes(col.className) ? 'bg-red-900/20 border-red-900 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>{col.label}</button>))}</div>)}
            </section>
            <section className="space-y-2">
                <button onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)} className="w-full flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer px-2 py-2 rounded bg-slate-800/30 hover:bg-slate-800 transition-colors"><span>Advanced</span><span>{isAdvancedExpanded ? '−' : '+'}</span></button>
                {isAdvancedExpanded && (
                    <div className="space-y-4 pt-2">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Enable Heatmap</span>
                            <div className="relative">
                                <input type="checkbox" checked={isHeatmapEnabled} onChange={(e) => setIsHeatmapEnabled(e.target.checked)} className="sr-only peer"/>
                                <div className="w-8 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                            </div>
                        </label>
                        <div className="space-y-1"><label className="text-xs text-slate-400">Custom Pattern</label><input type="text" value={filters.pattern} onChange={(e) => updateFilter('pattern', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-green-500" placeholder="e.g. cvcv"/></div>
                    </div>
                )}
            </section>
        </div>
        <div className="p-4 bg-slate-800/50 border-t border-slate-800 space-y-3 shadow-lg">
             <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-medium">Results Found</span><span className="text-xl font-bold text-white tabular-nums">{visibleCount}</span></div>
             <div className="flex flex-col gap-2">
                <button onClick={copyVisible} disabled={!!copyFeedback} className={`w-full font-bold py-2 rounded transition-all cursor-pointer shadow-lg text-sm ${copyFeedback ? 'bg-green-700 text-white' : 'bg-green-600 hover:bg-green-500 text-white active:scale-95'}`}>{copyFeedback || 'Copy Visible Domains'}</button>
                <button onClick={exportToCSV} className="w-full font-bold py-2 rounded transition-all cursor-pointer shadow-lg text-sm bg-slate-700 hover:bg-slate-600 text-white active:scale-95 transition-all">Download CSV</button>
             </div>
             <p className="text-[10px] text-slate-500 text-center">Applies to current page only.</p>
        </div>
      </div>
      {showSettings && (
        <div className="absolute inset-0 bg-slate-900 z-50 flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold text-white">Settings</h2><button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">✕</button></div>
            <div className="flex-1 overflow-y-auto space-y-6">
                <section><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Saved Presets</h3>
                    {presets.length === 0 ? <p className="text-sm text-slate-500 italic">None yet.</p> : (
                        <div className="space-y-2">{presets.map((p, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700"><span className="text-sm font-medium">{p.name}</span><button onClick={() => deletePreset(i)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded bg-red-900/20 cursor-pointer transition-colors">Delete</button></div>
                        ))}
</div>
                    )}
                </section>
                <section><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Backup & Restore</h3><div className="flex gap-2"><button onClick={exportPresets} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm py-2 px-4 rounded border border-slate-700 transition-colors cursor-pointer">Export</button><label className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm py-2 px-4 rounded border border-slate-700 text-center cursor-pointer transition-colors">Import<input type="file" accept=".json" onChange={importPresets} className="hidden"/></label></div></section>
            </div>
        </div>
      )}
      <div 
        className={`h-full flex flex-col items-center pt-8 bg-slate-900 ${isCollapsed ? 'block cursor-pointer hover:bg-slate-800 transition-colors' : 'hidden'}`}
        onClick={() => setIsCollapsed(false)}
      >
        <span className="text-green-500 font-bold text-sm vertical-text tracking-widest uppercase opacity-50">Domain Powertools</span>
      </div>
      <style>{`.vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); }`}</style>
    </div>
  );
}
