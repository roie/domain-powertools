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
  heatmapEnabled?: boolean;
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

const DEFAULT_PRESET_LIST: Preset[] = [
  {
    name: "Quick Scan Mode",
    filters: { ...DEFAULT_FILTERS, hyphenSetting: 'none', numberSetting: 'none', statusFilter: 'Available' },
    hiddenColumns: [
      'field_aentries', 'field_majestic_globalrank', 'field_dmoz', 
      'field_statuscom', 'field_statusnet', 'field_statusorg', 'field_statusde', 'field_statusbiz', 'field_statusinfo', 'field_wikipedia_links', 'field_relatedlinks', 'field_changes'
    ],
    sortConfig: { column: '', direction: 'asc' },
    heatmapEnabled: true,
    expansionState: { name: false, tld: false, advanced: true, columns: false }
  },
  {
    name: "Pronounceable Startups",
    filters: { ...DEFAULT_FILTERS, minLength: '5', maxLength: '7', tldFilter: 'com, io, ai', pattern: 'cvcvcv', hyphenSetting: 'none', numberSetting: 'none', statusFilter: 'Available' },
    hiddenColumns: [],
    sortConfig: { column: '', direction: 'asc' },
    heatmapEnabled: false,
    expansionState: { name: true, tld: false, advanced: true, columns: false }
  }
];

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
  const [variedColumnClasses, setVariedColumnClasses] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  
  // --- Feature States ---
  const [isHeatmapEnabled, setIsHeatmapEnabled] = useState(false);
  const [isPresetsEnabled, setIsPresetsEnabled] = useState(false);

  // --- Collapsible UI States ---
  const [isNameExpanded, setIsNameExpanded] = useState(true);
  const [isTldExpanded, setIsTldExpanded] = useState(false);
  const [tldInput, setTldInput] = useState('');
  const [showAllTlds, setShowAllTlds] = useState(false);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [isColumnsExpanded, setIsColumnsExpanded] = useState(false);

  // --- Section Filter Counts ---
  const nameFilterCount = useMemo(() => {
    let count = 0;
    if (filters.matchText) count++;
    if (filters.blacklist) count++;
    if (filters.startsWith) count++;
    if (filters.endsWith) count++;
    if (filters.minLength !== '') count++;
    if (filters.maxLength !== '') count++;
    if (filters.hyphenSetting !== 'any') count++;
    if (filters.numberSetting !== 'any') count++;
    return count;
  }, [filters]);

  const tldFilterCount = useMemo(() => {
    return filters.tldFilter.split(',').map(s => s.trim()).filter(Boolean).length;
  }, [filters.tldFilter]);

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (filters.pattern) count++;
    if (isHeatmapEnabled) count++;
    if (isPresetsEnabled) count++;
    return count;
  }, [filters.pattern, isHeatmapEnabled, isPresetsEnabled]);

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
                'dpt_presets_enabled',
                'dpt_exp_name',
                'dpt_exp_tld',
                'dpt_exp_adv',
                'dpt_exp_cols',
                'dpt_initialized'
            ]) as any;
            
            if (res.dpt_filters) setFilters(res.dpt_filters);
            
            // First Run Logic
            if (!res.dpt_initialized) {
                setPresets(DEFAULT_PRESET_LIST);
                browser.storage.local.set({ dpt_initialized: true, dpt_presets: DEFAULT_PRESET_LIST });
            } else {
                if (res.dpt_presets) setPresets(res.dpt_presets);
            }
            
            if (res.dpt_active_preset) setActivePresetName(res.dpt_active_preset);
            if (res.dpt_hidden_columns) setHiddenColumns(res.dpt_hidden_columns);
            if (res.dpt_sort_config) setSortConfig(res.dpt_sort_config);
            if (res.dpt_heatmap !== undefined) setIsHeatmapEnabled(res.dpt_heatmap);
            if (res.dpt_presets_enabled !== undefined) setIsPresetsEnabled(res.dpt_presets_enabled);
            
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
            dpt_presets_enabled: isPresetsEnabled,
            dpt_exp_name: isNameExpanded,
            dpt_exp_tld: isTldExpanded,
            dpt_exp_adv: isAdvancedExpanded,
            dpt_exp_cols: isColumnsExpanded
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, presets, activePresetName, hiddenColumns, sortConfig, isHeatmapEnabled, isPresetsEnabled, isNameExpanded, isTldExpanded, isAdvancedExpanded, isColumnsExpanded]);

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
      const label = th.querySelector('a')?.textContent?.trim() || th.textContent?.trim() || '?';
      
      // Skip RL (Related Links), watchlist, domain, and non-sortable utility columns
      if (!headClass || headClass === 'head_watchlist' || headClass === 'head_domain' || headClass === 'head_relatedlinks' || label === 'RL') return;
      
      const fieldClass = headClass.replace('head_', 'field_');
      cols.push({
        label, 
        className: fieldClass, 
        tooltip: th.querySelector('a')?.getAttribute('title') || '' 
      });
    });
    setColumns(cols);

    const rows = originalRowsRef.current;
    const statusSet = new Set<string>();
    const tldMap = new Map<string, number>();
    const variedColsSet = new Set<string>();
    
    // Check variation for each column
    cols.forEach(col => {
        const uniqueValues = new Set<string>();
        rows.forEach(row => {
            const val = row.querySelector(`td.${col.className}`)?.textContent?.trim() || '';
            uniqueValues.add(val);
        });
        if (uniqueValues.size > 1) variedColsSet.add(col.className);
    });
    setVariedColumnClasses(Array.from(variedColsSet));

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
    setDetectedTlds(Array.from(tldMap.entries()).sort((a, b) => b[1] - a[1]).map(([tld, count]) => ({ tld, count })));
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
    const fragment = document.createDocumentFragment();
    rows.forEach(row => fragment.appendChild(row));
    tbody.appendChild(fragment);
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
    let highlightRule = sortConfig.column ? `${TABLE_SELECTOR} td.${sortConfig.column} { border-left: 2px solid rgba(148, 163, 184, 0.4) !important; border-right: 2px solid rgba(148, 163, 184, 0.4) !important; background-color: #e8e8e8; }` : '';
    styleTag.textContent = hiddenRules + '\n' + highlightRule;
  }, [hiddenColumns, sortConfig.column]);

  // --- Handlers ---
  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setActivePresetName('');
  };

  const toggleTld = (tld: string) => {
    const target = tld.toLowerCase();
    const current = filters.tldFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const next = current.includes(target) ? current.filter(t => t !== target) : [...current, target];
    updateFilter('tldFilter', next.join(', '));
  };

  const addManualTld = () => {
    const raw = tldInput.trim().toLowerCase();
    if (!raw) return;
    const tld = raw.startsWith('.') ? raw.slice(1) : raw;
    if (!tld) return;

    const current = filters.tldFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!current.includes(tld)) {
      updateFilter('tldFilter', [...current, tld].join(', '));
    }
    setTldInput('');
  };

  const allTldsToDisplay = useMemo(() => {
    const activeTlds = filters.tldFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const activeSet = new Set(activeTlds);
    
    // Start with detected ones
    const combined = [...detectedTlds];
    
    // Add any active ones that aren't in detected
    activeTlds.forEach(tld => {
        if (!combined.find(d => d.tld === tld)) {
            combined.push({ tld, count: 0 });
        }
    });

    // Sort: Active first, then by count desc
    return combined.sort((a, b) => {
        const aActive = activeSet.has(a.tld);
        const bActive = activeSet.has(b.tld);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return b.count - a.count;
    });
  }, [detectedTlds, filters.tldFilter]);

  const copyVisible = async () => {
    const domains: string[] = [];
    document.querySelectorAll(`${TABLE_SELECTOR} tbody tr`).forEach(row => {
      if ((row as HTMLElement).style.display !== 'none') {
        const link = row.querySelector(DOMAIN_LINK_SELECTOR);
        const d = link?.getAttribute('title') || link?.textContent;
        if (d) domains.push(d.trim());
      }
    });
    try {
      await navigator.clipboard.writeText(domains.join('\n'));
      setCopyFeedback(`Copied ${domains.length}!`);
    } catch (e) {
      setCopyFeedback('Copy failed!');
    }
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = {
        name: newPresetName,
        filters: { ...filters },
        hiddenColumns: [...hiddenColumns],
        sortConfig: { ...sortConfig },
        heatmapEnabled: isHeatmapEnabled,
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
    if (p.heatmapEnabled !== undefined) setIsHeatmapEnabled(p.heatmapEnabled);
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
                // Validate preset structure before importing
                const isValidPreset = (p: unknown): p is Preset =>
                    typeof p === 'object' && p !== null &&
                    typeof (p as Preset).name === 'string' &&
                    typeof (p as Preset).filters === 'object' && (p as Preset).filters !== null;

                const validPresets = imported.filter(isValidPreset);
                if (validPresets.length === 0) {
                    alert('No valid presets found in file.');
                    return;
                }
                setPresets(prev => [...prev, ...validPresets]);
                alert(`Imported ${validPresets.length} preset(s)!`);
            } else {
                alert('Invalid file format: expected an array of presets.');
            }
        } catch (err) { alert('Invalid JSON file.'); }
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
    URL.revokeObjectURL(url);
  };

  const resetAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setHiddenColumns([]);
    setSortConfig({ column: '', direction: 'asc' });
    setActivePresetName('');
    setIsNameExpanded(true);
    setIsTldExpanded(false);
    setIsAdvancedExpanded(false);
    setIsColumnsExpanded(false);
  };

  return (
    <div className={`fixed top-0 right-0 h-full bg-slate-900 text-slate-100 shadow-2xl z-[9999] border-l border-slate-700 font-sans transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12' : 'w-80'}`}>
      <div className={`flex flex-col h-full ${isCollapsed ? 'hidden' : 'flex'}`}>
        <div className="p-4 flex-shrink-0 bg-slate-900 z-10 border-b border-slate-700">
           <div className="flex justify-between items-center mb-3">
               <h2 className="text-lg font-bold tracking-tight"><span className="text-white">Domain</span> <span className="text-emerald-400">Powertools</span></h2>
               <div className="flex items-center">
                   <div className="flex items-center gap-1">
                     <button onClick={resetAllFilters}
                       className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                       title="Reset all filters">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round"
                             d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
                         </svg>
                     </button>
                     <button onClick={() => setShowSettings(true)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer" title="Settings">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774a1.125 1.125 0 0 1 .12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.894.15c.542.09.94.56.94 1.109v1.094c0 .55-.398 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738a1.125 1.125 0 0 1-.12 1.45l-.773.773a1.125 1.125 0 0 1-1.45.12l-.737-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 0 1-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.398-.165.71-.505.78-.929l.15-.894Z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                     </button>
                   </div>
                   <button
                     onClick={() => setIsCollapsed(true)}
                     className="p-1.5 ml-3 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                     title="Close sidebar"
                     aria-label="Close sidebar"
                   >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
                     </svg>
                   </button>
               </div>
           </div>
           {isPresetsEnabled && (
               <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                   {isSavingPreset ? (
                       <div className="flex gap-1 w-full"><input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Name" className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" autoFocus onKeyDown={(e) => e.key === 'Enter' && savePreset()}/><button onClick={savePreset} className="text-emerald-400 px-1 cursor-pointer hover:text-emerald-300 transition-colors">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                       </button><button onClick={() => setIsSavingPreset(false)} className="text-rose-400 px-1 cursor-pointer hover:text-rose-300 transition-colors">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                       </button></div>
                   ) : (
                       <><select value={activePresetName} onChange={(e) => { const p = presets.find(x => x.name === e.target.value); if (p) loadPreset(p); }} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs cursor-pointer outline-none hover:bg-slate-700 transition-colors" title="Load a saved preset to apply its filters, sorting, and column settings"><option value="">Load Preset...</option>{presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select><button onClick={() => setIsSavingPreset(true)} className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs hover:bg-slate-700 hover:text-emerald-400 cursor-pointer text-slate-400 transition-colors" title="Save current filters, sorting, and column settings as a new preset">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm7 0v4m-3-4v4m6-4v4"/></svg>
                       </button></>
                   )}
               </div>
           )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 sidebar-scroll">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Sort By</label>
                <div className="flex gap-2">
                    <select value={sortConfig.column} onChange={(e) => { setSortConfig(prev => ({ ...prev, column: e.target.value })); setActivePresetName(''); }} className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" title="Choose a column to sort the table by">
                        <option value="">Default Order</option>
                        <option value="field_domain">Domain</option>
                        {columns.filter(col => !hiddenColumns.includes(col.className)).map(col => {
                            const hasVariation = variedColumnClasses.includes(col.className);
                            const isSelected = sortConfig.column === col.className;
                            if (!hasVariation && !isSelected) return null;
                            return (
                                <option key={col.className} value={col.className}>
                                    {col.label} {!hasVariation && '(no variation)'}
                                </option>
                            );
                        })}
                    </select>
                    {sortConfig.column && <button onClick={() => { setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' })); setActivePresetName(''); }} className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-bold cursor-pointer hover:bg-slate-700 text-emerald-400 transition-colors" title={`Currently ${sortConfig.direction === 'asc' ? 'ascending' : 'descending'}. Click to toggle.`}>
                        {sortConfig.direction === 'asc' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                        )}
                    </button>}
                </div>
            </div>
            <section className="space-y-4">
                <button onClick={() => setIsNameExpanded(!isNameExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-emerald-500 transition-all duration-200" title="Filter domains by name length, text content, prefixes, suffixes, hyphens, and numbers">
                    <span className="flex items-center gap-2">
                        Name & Structure
                        {!isNameExpanded && nameFilterCount > 0 && <span className="text-[10px] text-slate-500 font-normal normal-case">({nameFilterCount} active)</span>}
                    </span>
                    <span>
                    {isNameExpanded ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    )}
                </span></button>
                {isNameExpanded && (
                    <div className="space-y-4">
                        <div className="space-y-1"><label className="text-xs text-slate-400">Length</label><div className="flex gap-2"><input type="number" placeholder="Min" value={filters.minLength} onChange={(e) => updateFilter('minLength', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" title="Minimum domain name length (excluding TLD)"/><input type="number" placeholder="Max" value={filters.maxLength} onChange={(e) => updateFilter('maxLength', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" title="Maximum domain name length (excluding TLD)"/></div></div>
                        
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={filters.matchText}
                                onChange={(e) => updateFilter('matchText', e.target.value)}
                                className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                                placeholder="Contains (regex)"
                                title="Supports regex, e.g., ^tech or (ai|ml)$"
                            />
                            <input
                                type="text"
                                value={filters.blacklist}
                                onChange={(e) => updateFilter('blacklist', e.target.value)}
                                className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                                placeholder="Exclude"
                                title="Comma-separated words to exclude"
                            />
                        </div>

                        <div className="flex gap-2"><input type="text" value={filters.startsWith} onChange={(e) => updateFilter('startsWith', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" placeholder="Starts With" title="Show only domains that begin with this text"/><input type="text" value={filters.endsWith} onChange={(e) => updateFilter('endsWith', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" placeholder="Ends With" title="Show only domains that end with this text (before the TLD)"/></div>
                        <div className="flex gap-2 pt-1"><div className="w-1/2 space-y-1"><label className="text-xs text-slate-400">Hyphens</label><select value={filters.hyphenSetting} onChange={(e) => updateFilter('hyphenSetting', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-700 transition-colors" title="Filter by number of hyphens in domain name"><option value="any">Any</option><option value="none">None</option><option value="max1">Max 1</option><option value="max2">Max 2</option></select></div><div className="w-1/2 space-y-1"><label className="text-xs text-slate-400">Numbers</label><select value={filters.numberSetting} onChange={(e) => updateFilter('numberSetting', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-700 transition-colors" title="Filter by digits in domain name"><option value="any">Any</option><option value="none">None</option><option value="max1">Max 1</option><option value="max2">Max 2</option><option value="only">Only</option></select></div></div>
                    </div>
                )}
            </section>
            <section className="space-y-4">
                <button onClick={() => setIsTldExpanded(!isTldExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-emerald-500 transition-all duration-200" title="Filter domains by top-level domain extension and availability status">
                    <span className="flex items-center gap-2">
                        TLD & Status
                        {!isTldExpanded && (
                            <span className="text-[10px] text-slate-500 font-normal normal-case">
                                ({detectedTlds.length} TLDs{tldFilterCount > 0 ? `, ${tldFilterCount} active` : ''})
                            </span>
                        )}
                    </span>
                    <span>
                    {isTldExpanded ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    )}
                </span></button>
                {isTldExpanded && (
                    <div className="space-y-4">
                         <div className="flex gap-2">
                            <input
                                type="text"
                                value={tldInput}
                                onChange={(e) => setTldInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addManualTld()}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                                placeholder="Add TLD (e.g. io)"
                                title="Type a TLD (e.g., 'com' or '.io') and press Enter to filter even if it's not on the current page."
                            />
                            <button onClick={addManualTld} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-400 hover:text-emerald-400 hover:border-emerald-500 transition-colors cursor-pointer" title="Add TLD to filter">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            </button>
                        </div>
                        {allTldsToDisplay.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Active & Detected TLDs</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {(showAllTlds ? allTldsToDisplay : allTldsToDisplay.slice(0, 10)).map(({ tld, count }) => (
                                        <button key={tld} onClick={() => toggleTld(tld)} className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 ${filters.tldFilter.split(',').map(s => s.trim()).includes(tld) ? 'bg-emerald-900/40 border-emerald-600 text-emerald-400 shadow-sm shadow-emerald-900/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                                            .{tld} <span className="opacity-50 ml-1">{count > 0 ? count : (count === 0 ? '0' : '')}</span>
                                        </button>
                                    ))}
                                </div>
                                {allTldsToDisplay.length > 10 && (
                                    <button 
                                        onClick={() => setShowAllTlds(!showAllTlds)} 
                                        className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer mt-1"
                                    >
                                        {showAllTlds ? 'Show less' : `Show ${allTldsToDisplay.length - 10} more TLDs...`}
                                    </button>
                                )}
                            </div>
                        )}
                        {availableStatuses.length > 2 && (<div className="space-y-1"><label className="text-xs text-slate-400">Status</label><select value={filters.statusFilter} onChange={(e) => updateFilter('statusFilter', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-700 transition-colors" title="Filter by domain availability status">{availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>)}
                    </div>
                )}
            </section>

            <section className="space-y-2">
                <button onClick={() => setIsColumnsExpanded(!isColumnsExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-emerald-500 transition-all duration-200" title="Show or hide table columns to customize your view">
                    <span className="flex items-center gap-2">
                        Toggle Columns
                        {!isColumnsExpanded && hiddenColumns.length > 0 && <span className="text-[10px] text-slate-500 font-normal normal-case">({hiddenColumns.length} hidden)</span>}
                    </span>
                    <span>
                    {isColumnsExpanded ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    )}
                </span></button>
                {isColumnsExpanded && (<div className="grid grid-cols-2 gap-2 p-1">{columns.map(col => (<button key={col.className} onClick={() => { setHiddenColumns(prev => prev.includes(col.className) ? prev.filter(c => c !== col.className) : [...prev, col.className]); setActivePresetName(''); }} title={col.tooltip} className={`text-xs py-2 px-2.5 rounded-lg border truncate cursor-pointer transition-all duration-200 ${hiddenColumns.includes(col.className) ? 'bg-rose-900/20 border-rose-800 text-slate-500 line-through' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'}`}>{col.label}</button>))}</div>)}
            </section>
            <section className="space-y-2">
                <button onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-emerald-500 transition-all duration-200" title="Enable presets, heatmap visualization, and custom pattern matching">
                    <span className="flex items-center gap-2">
                        Advanced
                        {!isAdvancedExpanded && advancedFilterCount > 0 && <span className="text-[10px] text-slate-500 font-normal normal-case">({advancedFilterCount} active)</span>}
                    </span>
                    <span>
                    {isAdvancedExpanded ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    )}
                </span></button>
                {isAdvancedExpanded && (
                    <div className="space-y-4 pt-2">
                        <label className="flex items-center justify-between cursor-pointer group" title="Save and load filter configurations as reusable presets">
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Enable Presets</span>
                            <div className="relative">
                                <input type="checkbox" checked={isPresetsEnabled} onChange={(e) => setIsPresetsEnabled(e.target.checked)} className="sr-only peer"/>
                                <div className="w-8 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </div>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group" title="Color-code table cells based on metric values (green=good, red=poor)">
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Enable Heatmap</span>
                            <div className="relative">
                                <input type="checkbox" checked={isHeatmapEnabled} onChange={(e) => setIsHeatmapEnabled(e.target.checked)} className="sr-only peer"/>
                                <div className="w-8 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </div>
                        </label>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 flex items-center gap-1">
                                Custom Pattern
                                <span className="relative group">
                                    <svg className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    <div className="absolute bottom-full left-0 mb-2 w-44 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-left text-[10px] text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                                        <div className="font-semibold text-white mb-1">Pattern Characters:</div>
                                        <div><span className="text-emerald-400 font-mono">c</span> = consonant</div>
                                        <div><span className="text-emerald-400 font-mono">v</span> = vowel (a,e,i,o,u)</div>
                                        <div><span className="text-emerald-400 font-mono">n</span> = number (0-9)</div>
                                        <div><span className="text-emerald-400 font-mono">l</span> = any letter</div>
                                        <div className="mt-1 text-slate-400">Ex: "cvcv" matches "doma"</div>
                                    </div>
                                </span>
                            </label>
                            <input type="text" value={filters.pattern} onChange={(e) => updateFilter('pattern', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" placeholder="e.g. cvcv, cvcc, llnn"/>
                        </div>
                    </div>
                )}
            </section>
        </div>
        <div className="p-4 bg-gradient-to-t from-slate-800 to-slate-800/80 border-t border-slate-700 space-y-3">
             <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-medium">Results Found</span><span className="text-2xl font-bold text-white tabular-nums drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{visibleCount}</span></div>
             <div className="flex gap-2">
                <button onClick={copyVisible} disabled={!!copyFeedback || visibleCount === 0} className={`flex-1 font-semibold py-2.5 rounded-lg transition-all text-sm ${visibleCount === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' : copyFeedback ? 'bg-emerald-700 text-white cursor-pointer shadow-lg shadow-emerald-900/30' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-900/30'}`} title={visibleCount === 0 ? 'No domains to copy' : 'Copy all visible domain names to clipboard'}>{copyFeedback || 'Copy Visible Domains'}</button>
                <button onClick={exportToCSV} disabled={visibleCount === 0} className={`p-2 rounded transition-all shadow-lg flex items-center justify-center min-w-[40px] ${visibleCount === 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white active:scale-95 cursor-pointer'}`} title={visibleCount === 0 ? 'No data to export' : 'Download visible rows as CSV file'}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </button>
             </div>
             <p className="text-[10px] text-slate-500 text-center">Applies to current page only.</p>
        </div>
      </div>
      {showSettings && (
        <div className="absolute inset-0 bg-slate-900 z-50 flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold text-white">Settings</h2><button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button></div>
            <div className="flex-1 overflow-y-auto space-y-6">
                {isPresetsEnabled && (
                    <>
                        <section><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Saved Presets</h3>
                            {presets.length === 0 ? <p className="text-sm text-slate-500 italic">None yet.</p> : (
                                <div className="space-y-2">{presets.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700"><span className="text-sm font-medium">{p.name}</span><button onClick={() => deletePreset(i)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded-md bg-rose-900/20 cursor-pointer transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button></div>
                                ))}</div>
                            )}
                        </section>
                        <section><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Backup & Restore</h3><div className="flex gap-2"><button onClick={exportPresets} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm py-2 px-4 rounded border border-slate-700 transition-colors cursor-pointer">Export</button><label className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm py-2 px-4 rounded border border-slate-700 text-center cursor-pointer transition-colors">Import<input type="file" accept=".json" onChange={importPresets} className="hidden"/></label></div></section>
                    </>
                )}

                {/* About Section */}
                <section className="border-t border-slate-800 pt-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">About</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-white">Domain Powertools</div>
                                <div className="text-xs text-slate-500">Version 1.0.0</div>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                            Enhances expireddomains.net with advanced filtering, sorting, heatmap visualization, and export capabilities to help you find the perfect expired domain.
                        </p>

                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase">Privacy</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                This extension operates entirely locally. Your filter settings and presets are stored in your browser's local storage. No data is collected, transmitted, or shared with any third parties.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase">Permissions</h4>
                            <ul className="text-xs text-slate-400 space-y-1">
                                <li className="flex gap-2"><span className="text-slate-600">•</span><span><strong className="text-slate-300">expireddomains.net access:</strong> Required to inject the sidebar and filter domains on the page.</span></li>
                                <li className="flex gap-2"><span className="text-slate-600">•</span><span><strong className="text-slate-300">Storage:</strong> Used to save your preferences, presets, and settings locally.</span></li>
                            </ul>
                        </div>

                        <div className="pt-2 flex flex-col gap-2">
                            <a href="https://github.com/roie/domain-powertools/issues" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                Report an Issue / Feedback
                            </a>
                        </div>

                        <p className="text-[10px] text-slate-600 pt-2">
                            Made with care for domain hunters everywhere.
                        </p>
                    </div>
                </section>
            </div>
        </div>
      )}
      <div
        className={`h-full flex flex-col items-center justify-between py-6 bg-slate-900 ${isCollapsed ? 'cursor-pointer hover:bg-slate-800/50 transition-colors' : 'hidden'}`}
        onClick={() => setIsCollapsed(false)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsCollapsed(false)}
        tabIndex={isCollapsed ? 0 : -1}
        role="button"
        aria-label="Expand sidebar"
        title="Click to expand"
      >
        {/* Full vertical branding text - matching expanded header styling */}
        <h2 className="text-lg font-bold tracking-tight vertical-text">
          <span className="text-white">Domain</span> <span className="text-emerald-400">Powertools</span>
        </h2>

        {/* Expand hint icon at bottom - chevron-double-left */}
        <div className="p-2 text-slate-500 hover:text-emerald-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"/>
          </svg>
        </div>
      </div>
      <style>{`
        .vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); }
        .sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgb(51 65 85); border-radius: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgb(71 85 105); }
      `}</style>
    </div>
  );
}
