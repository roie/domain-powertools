import { useState, useEffect, useMemo, useRef } from 'react';
import { browser } from 'wxt/browser';
import { FilterState, filterDomain, sortRows, getHeatColor, splitDomain } from './FilterEngine';

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
    filters: { ...DEFAULT_FILTERS, minLength: 5, maxLength: 7, tldFilter: 'com, io, ai', pattern: 'cvcvcv', hyphenSetting: 'none', numberSetting: 'none', statusFilter: 'Available' },
    hiddenColumns: [],
    sortConfig: { column: '', direction: 'asc' },
    heatmapEnabled: false,
    expansionState: { name: true, tld: false, advanced: true, columns: false }
  }
];

const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.501,6.249c0.44,0.335,0.892,0.654,1.361,0.939C7.623,7.764,7.411,8.372,7.221,9h1.927    c0.11-0.322,0.215-0.649,0.34-0.955C10.381,8.454,11.312,8.766,12.267,9h1.927c0.11-0.322,0.215-0.649,0.34-0.955C10.381,8.454,11.312,8.766,12.267,9h7.471c0.967-0.235,1.912-0.554,2.812-0.972    c0.125,0.31,0.229,0.644,0.343,0.972h1.891c-0.189-0.629-0.4-1.235-0.641-1.812c0.471-0.285,0.924-0.604,1.36-0.939    c0.84,0.818,1.572,1.743,2.179,2.751h2.688c-2.604-5.318-8.057-9-14.368-9C9.689,0,4.238,3.682,1.635,9h2.686    C4.929,7.992,5.661,7.065,6.501,6.249z M24.109,5.073c-0.246,0.176-0.493,0.349-0.75,0.509c-0.319-0.587-0.666-1.144-1.041-1.646    C22.95,4.266,23.544,4.651,24.109,5.073z M21.794,6.422c-0.808,0.371-1.64,0.67-2.496,0.88c-0.239-1.728-0.584-3.396-1.075-4.672    C19.605,3.329,20.829,4.655,21.794,6.422z M15.82,2.379c0.061-0.001,0.12-0.008,0.182-0.008s0.121,0.007,0.182,0.008    c0.438,0.717,0.965,2.507,1.354,5.229c-0.509,0.06-1.021,0.098-1.535,0.098c-0.517,0-1.028-0.038-1.535-0.098    C14.855,4.886,15.382,3.096,15.82,2.379z M13.771,2.658c-0.485,1.272-0.827,2.927-1.065,4.645c-0.843-0.206-1.661-0.5-2.453-0.86    C11.214,4.692,12.421,3.366,13.771,2.658z M9.684,3.936C9.31,4.438,8.965,4.996,8.642,5.582C8.386,5.423,8.139,5.25,7.893,5.074    C8.459,4.651,9.052,4.266,9.684,3.936z"
      fill="#009689"
    />
    <path
      d="M25.503,25.752c-0.438-0.336-0.894-0.654-1.36-0.941c0.237-0.574,0.45-1.182,0.641-1.811h-1.891    c-0.109,0.328-0.216,0.66-0.341,0.971c-0.901-0.418-1.848-0.734-2.813-0.971h-7.47c-0.955,0.234-1.885,0.547-2.778,0.955    C9.364,23.648,9.26,23.32,9.149,23H7.223c0.189,0.629,0.401,1.236,0.64,1.812c-0.47,0.285-0.921,0.604-1.361,0.938    C5.663,24.934,4.931,24.008,4.325,23H1.638c2.603,5.316,8.054,9,14.366,9c6.312,0,11.764-3.684,14.367-9h-2.688    C27.075,24.008,26.343,24.934,25.503,25.752z M7.893,26.928c0.246-0.176,0.494-0.35,0.749-0.508    c0.323,0.586,0.668,1.143,1.042,1.645C9.052,27.734,8.459,27.35,7.893,26.928z M10.251,25.559c0.792-0.356,1.61-0.653,2.453-0.858    c0.238,1.719,0.58,3.368,1.065,4.645C12.421,28.635,11.214,27.307,10.251,25.559z M16.184,29.621    c-0.061,0.002-0.12,0.008-0.182,0.008s-0.121-0.006-0.182-0.008c-0.438-0.717-0.966-2.508-1.354-5.229    c0.507-0.06,1.019-0.099,1.535-0.099c0.517,0,1.028,0.039,1.536,0.099C17.146,27.113,16.622,28.904,16.184,29.621z M18.223,29.369    c0.491-1.275,0.836-2.943,1.075-4.672c0.856,0.211,1.688,0.51,2.496,0.881C20.829,27.346,19.605,28.672,18.223,29.369z     M22.318,28.064c0.375-0.504,0.722-1.062,1.041-1.646c0.257,0.16,0.504,0.334,0.75,0.51C23.544,27.35,22.95,27.734,22.318,28.064z"
      fill="#009689"
    />
    <path
      d="M4.795,19.18l0.637-2.236c0.169-0.596,0.299-1.183,0.416-1.977h0.026c0.13,0.78,0.247,1.354,0.403,1.977l0.598,2.236    h1.859l1.95-6.355H8.748l-0.546,2.521c-0.143,0.729-0.273,1.443-0.364,2.171H7.812c-0.13-0.729-0.299-1.441-0.468-2.158    l-0.637-2.534h-1.56l-0.676,2.612c-0.156,0.623-0.338,1.353-0.468,2.08H3.977c-0.104-0.729-0.234-1.431-0.364-2.094l-0.507-2.601    H1.09l1.846,6.357h1.859V19.18z"
      fill="white"
    />
    <path
      d="M18.314,15.344c-0.145,0.729-0.272,1.443-0.362,2.172h-0.027c-0.129-0.729-0.299-1.442-0.467-2.159l-0.64-2.534h-1.56    l-0.676,2.612c-0.156,0.624-0.338,1.353-0.468,2.081h-0.026c-0.104-0.729-0.234-1.432-0.364-2.095l-0.507-2.601h-2.015    l1.846,6.357h1.859l0.637-2.235c0.169-0.599,0.299-1.184,0.416-1.978h0.026c0.13,0.78,0.248,1.354,0.404,1.978l0.598,2.235h1.859    l1.947-6.357h-1.938L18.314,15.344z"
      fill="white"
    />
    <path
      d="M28.43,15.344c-0.144,0.729-0.273,1.443-0.363,2.172h-0.025c-0.129-0.729-0.3-1.442-0.469-2.159l-0.637-2.534h-1.562    l-0.677,2.612c-0.155,0.624-0.338,1.353-0.469,2.081h-0.024c-0.104-0.729-0.233-1.432-0.363-2.095l-0.508-2.601h-2.017    l1.849,6.357h1.856l0.64-2.235c0.168-0.599,0.299-1.184,0.416-1.978h0.024c0.129,0.78,0.246,1.354,0.402,1.978l0.598,2.235h1.859    l1.949-6.357h-1.938L28.43,15.344z"
      fill="white"
    />
  </svg>
);

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
  const [tableVersion, setTableVersion] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);

  // Debounce filters for performance
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedFilters(filters);
    }, 150);
    return () => clearTimeout(timer);
  }, [filters]);

  // Pre-compile Regex for performance
  const compiledRegex = useMemo(() => {
    if (!debouncedFilters.matchText) return null;
    try {
      return new RegExp(debouncedFilters.matchText, 'i');
    } catch (e) {
      return null;
    }
  }, [debouncedFilters.matchText]);

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
  const isScanning = useRef(false);

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
                'dpt_initialized',
                'dpt_enabled'
            ]) as any;
            
            if (res.dpt_filters) setFilters(res.dpt_filters);
            if (res.dpt_enabled !== undefined) setIsEnabled(res.dpt_enabled);
            
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

    const listener = (msg: any, sender: any, sendResponse: any) => {
        if (msg.type === 'DPT_POWER_TOGGLE') setIsEnabled(msg.enabled);
        if (msg.type === 'DPT_STATUS_CHECK') sendResponse({ active: true });
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
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
            dpt_exp_cols: isColumnsExpanded,
            dpt_enabled: isEnabled
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, presets, activePresetName, hiddenColumns, sortConfig, isHeatmapEnabled, isPresetsEnabled, isNameExpanded, isTldExpanded, isAdvancedExpanded, isColumnsExpanded, isEnabled]);

  // --- DOM Detection (Mount & MutationObserver) ---
  useEffect(() => {
    if (!isEnabled) return;
    const scanTable = () => {
        if (isScanning.current) return;
        isScanning.current = true;

        try {
            const tbody = document.querySelector(`${TABLE_SELECTOR} tbody`);
            if (!tbody) {
                isScanning.current = false;
                return;
            }

            const trs = Array.from(tbody.querySelectorAll('tr')) as HTMLTableRowElement[];
            
            // Only update if rows actually changed (prevents loops)
            const rowsChanged = trs.length !== originalRowsRef.current.length || 
                               trs[0] !== originalRowsRef.current[0] ||
                               trs[trs.length-1] !== originalRowsRef.current[originalRowsRef.current.length-1];

            if (!rowsChanged) {
                isScanning.current = false;
                return;
            }

            originalRowsRef.current = trs;

            const headers = document.querySelectorAll(`${TABLE_SELECTOR} thead th`);
        const cols: ColumnDef[] = [];
        headers.forEach((th) => {
          const headClass = Array.from(th.classList).find(c => c.startsWith('head_'));
          const label = th.querySelector('a')?.textContent?.trim() || th.textContent?.trim() || '?';
          
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
                const { tld } = splitDomain(fullDomain);
                if (tld) {
                    tldMap.set(tld, (tldMap.get(tld) || 0) + 1);
                }
            }
            const statusCell = row.querySelector(STATUS_CELL_SELECTOR);
            const statusText = statusCell?.querySelector('a')?.textContent || statusCell?.textContent;
            if (statusText) statusSet.add(statusText.trim());
        });
        setAvailableStatuses(['Any', ...Array.from(statusSet).sort()]);
        setDetectedTlds(Array.from(tldMap.entries()).sort((a, b) => b[1] - a[1]).map(([tld, count]) => ({ tld, count })));
        
        // Trigger a re-render of the table logic
        setTableVersion(v => v + 1);
        } finally {
            isScanning.current = false;
        }
    };

    scanTable();

    // Debounced Observer
    let timeout: NodeJS.Timeout;
    const observer = new MutationObserver((mutations) => {
        // Ignore mutations caused by our own data attributes (prevents infinite loop)
        const isSelfMutation = mutations.every(m => 
            m.type === 'attributes' && 
            (m.attributeName === 'data-dpt-filtered' || m.attributeName === 'data-dpt-heat' || m.attributeName === 'style')
        );
        if (isSelfMutation) return;

        clearTimeout(timeout);
        timeout = setTimeout(scanTable, 150);
    });

    // Observe #content or body to catch table replacements
    const target = document.querySelector('#content') || document.body;
    observer.observe(target, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'id'] // Watch for structural changes
    });

    return () => {
        observer.disconnect();
        clearTimeout(timeout);
    };
  }, []);

  // --- Layout & Table Logic ---
  useEffect(() => {
    if (!isEnabled) {
        document.body.classList.remove('dpt-enabled');
        document.body.style.removeProperty('--dpt-sidebar-width');
        return;
    }
    
    document.body.classList.add('dpt-enabled');
    const width = isCollapsed ? '48px' : '320px';
    document.body.style.setProperty('--dpt-sidebar-width', width);

    return () => {
        document.body.classList.remove('dpt-enabled');
        document.body.style.removeProperty('--dpt-sidebar-width');
    };
  }, [isCollapsed, isEnabled]);

  useEffect(() => {
    const tbody = document.querySelector(`${TABLE_SELECTOR} tbody`);
    if (!tbody || originalRowsRef.current.length === 0) return;

    if (!isEnabled) {
      originalRowsRef.current.forEach(row => {
        row.removeAttribute('data-dpt-filtered');
        row.querySelectorAll('td').forEach(cell => {
          cell.style.removeProperty('--dpt-heat-color');
          cell.removeAttribute('data-dpt-heat');
          cell.style.backgroundColor = '';
        });
      });
      return;
    }

    let rows = [...originalRowsRef.current];
    let count = 0;

    rows.forEach((row) => {
      const domainLink = row.querySelector(DOMAIN_LINK_SELECTOR); 
      const statusCell = row.querySelector(STATUS_CELL_SELECTOR);
      if (!domainLink) return;
      const domainName = domainLink.getAttribute('title')?.trim() || domainLink.textContent?.trim() || '';
      const statusText = statusCell?.querySelector('a')?.textContent?.trim() || statusCell?.textContent?.trim() || '';
      const isVisible = filterDomain(domainName, statusText, { ...debouncedFilters, compiledRegex });
      
      // Use Data Attributes instead of direct style.display
      if (isVisible) {
          row.removeAttribute('data-dpt-filtered');
          count++;
      } else {
          row.setAttribute('data-dpt-filtered', 'true');
      }

      // Apply Heatmap via CSS Variables & Data Attributes
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
          if (!isHeatmapEnabled) {
              cell.style.removeProperty('--dpt-heat-color');
              cell.removeAttribute('data-dpt-heat');
              cell.style.backgroundColor = '';
              return;
          }
          const className = Array.from(cell.classList).find(c => c.startsWith('field_')) as string;
          if (className) {
              const color = getHeatColor(className, cell.textContent?.trim() || '');
              if (color) {
                cell.style.setProperty('--dpt-heat-color', color);
                cell.setAttribute('data-dpt-heat', 'true');
              } else {
                cell.style.removeProperty('--dpt-heat-color');
                cell.removeAttribute('data-dpt-heat');
                cell.style.backgroundColor = '';
              }
          } else {
              cell.style.removeProperty('--dpt-heat-color');
              cell.removeAttribute('data-dpt-heat');
              cell.style.backgroundColor = '';
          }
      });
    });

    setVisibleCount(count);
    if (sortConfig.column) rows = sortRows(rows, sortConfig.column, sortConfig.direction);
    
    // Optimization: Only re-append rows if sorting is active OR if the DOM order is out of sync
    const firstRow = tbody.firstElementChild;
    const shouldReorder = sortConfig.column || (rows.length > 0 && firstRow !== rows[0]);

    if (shouldReorder) {
        const fragment = document.createDocumentFragment();
        rows.forEach(row => fragment.appendChild(row));
        tbody.appendChild(fragment);
    }
  }, [debouncedFilters, sortConfig, isHeatmapEnabled, tableVersion, compiledRegex, isEnabled]);

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
    
    // Core Filter & Heatmap Styles
    const coreStyles = `
      ${TABLE_SELECTOR} tr[data-dpt-filtered="true"] { display: none !important; }
      ${TABLE_SELECTOR} td[data-dpt-heat="true"] { background-color: var(--dpt-heat-color) !important; transition: background-color 0.2s; }
    `;

    // Layout Push Styles
    const layoutStyles = `
      body.dpt-enabled { 
        margin-right: var(--dpt-sidebar-width) !important; 
        transition: margin-right 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      /* Ensure fixed elements on site like navigation bar are also pushed */
      body.dpt-enabled #navigation { 
        right: var(--dpt-sidebar-width) !important; 
        left: auto !important; 
        transition: right 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
    `;

    styleTag.textContent = [hiddenRules, highlightRule, coreStyles, layoutStyles].join('\n');
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

  if (!isEnabled) return null;

  return (
    <div className={`fixed top-0 right-0 h-full bg-slate-900 text-slate-100 shadow-2xl z-[2147483647] border-l border-slate-700 font-sans transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12' : 'w-80'}`}>
      <div className={`flex flex-col h-full ${isCollapsed ? 'hidden' : 'flex'}`}>
        <div className="p-4 flex-shrink-0 bg-slate-900 z-10 border-b border-slate-700">
           <div className="flex justify-between items-center">
            <div onClick={() => setShowSettings(true)} className='cursor-pointer'>
                <Logo />
            </div>
               <div>
                   <h2 className="text-lg font-bold tracking-tight"><span className="text-white">Domain</span> <span className="text-teal-400">Powertools</span></h2>
                   <div className="text-xs text-slate-500">Version 1.0.0</div>
               </div>
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
                     <button onClick={() => setShowSettings(true)} className="hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer" title="Settings">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774a1.125 1.125 0 0 1 .12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.894.15c.542.09.94.56.94 1.109v1.094c0 .55-.398 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738a1.125 1.125 0 0 1-.12 1.45l-.773.773a1.125 1.125 0 0 1-1.45.12l-.737-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 0 1-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.398-.165.71-.505.78-.929l.15-.894Z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                     </button>
                   </div>
                   <button
                     onClick={() => setIsCollapsed(true)}
                     className="p-1.5 text-slate-500 hover:text-teal-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
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
               <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200 mt-3">
                   {isSavingPreset ? (
                       <div className="flex gap-1 w-full"><input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Name" className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" autoFocus onKeyDown={(e) => e.key === 'Enter' && savePreset()}/><button onClick={savePreset} className="text-teal-400 px-1 cursor-pointer hover:text-teal-300 transition-colors">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                       </button><button onClick={() => setIsSavingPreset(false)} className="text-rose-400 px-1 cursor-pointer hover:text-rose-300 transition-colors">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                       </button></div>
                   ) : (
                       <><select value={activePresetName} onChange={(e) => { const p = presets.find(x => x.name === e.target.value); if (p) loadPreset(p); }} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs cursor-pointer outline-none hover:bg-slate-700 transition-colors" title="Load a saved preset to apply its filters, sorting, and column settings"><option value="">Load Preset...</option>{presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select><button onClick={() => setIsSavingPreset(true)} className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs hover:bg-slate-700 hover:text-teal-400 cursor-pointer text-slate-400 transition-colors" title="Save current filters, sorting, and column settings as a new preset">
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
                    <select value={sortConfig.column} onChange={(e) => { setSortConfig(prev => ({ ...prev, column: e.target.value })); setActivePresetName(''); }} className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm cursor-pointer outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" title="Choose a column to sort the table by">
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
                    {sortConfig.column && <button onClick={() => { setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' })); setActivePresetName(''); }} className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-bold cursor-pointer hover:bg-slate-700 text-teal-400 transition-colors" title={`Currently ${sortConfig.direction === 'asc' ? 'ascending' : 'descending'}. Click to toggle.`}>
                        {sortConfig.direction === 'asc' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                        )}
                    </button>}
                </div>
            </div>
            <section className="space-y-4">
                <button onClick={() => setIsNameExpanded(!isNameExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-teal-500 transition-all duration-200" title="Filter domains by name length, text content, prefixes, suffixes, hyphens, and numbers">
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
                        <div className="space-y-1"><label className="text-xs text-slate-400">Length</label><div className="flex gap-2"><input type="number" min="1" max="63" placeholder="Min" value={filters.minLength} onChange={(e) => {
                            let val = e.target.value;
                            if (val !== '') {
                                const n = parseInt(val);
                                if (n < 1) val = '1';
                                else if (n > 63) val = '63';
                            }
                            updateFilter('minLength', val);
                        }} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" title="Minimum domain name length (1-63, excluding TLD)"/><input type="number" min="1" max="63" placeholder="Max" value={filters.maxLength} onChange={(e) => {
                            let val = e.target.value;
                            if (val !== '') {
                                const n = parseInt(val);
                                if (n < 1) val = '1';
                                else if (n > 63) val = '63';
                            }
                            updateFilter('maxLength', val);
                        }} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" title="Maximum domain name length (1-63, excluding TLD)"/></div></div>
                        
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={filters.matchText}
                                onChange={(e) => updateFilter('matchText', e.target.value)}
                                className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
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

                        <div className="flex gap-2"><input type="text" value={filters.startsWith} onChange={(e) => updateFilter('startsWith', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" placeholder="Starts With" title="Show only domains that begin with this text"/><input type="text" value={filters.endsWith} onChange={(e) => updateFilter('endsWith', e.target.value)} className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" placeholder="Ends With" title="Show only domains that end with this text (before the TLD)"/></div>
                        <div className="flex gap-2 pt-1"><div className="w-1/2 space-y-1"><label className="text-xs text-slate-400">Hyphens</label><select value={filters.hyphenSetting} onChange={(e) => updateFilter('hyphenSetting', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-700 transition-colors" title="Filter by number of hyphens in domain name"><option value="any">Any</option><option value="none">None</option><option value="max1">Max 1</option><option value="max2">Max 2</option></select></div><div className="w-1/2 space-y-1"><label className="text-xs text-slate-400">Numbers</label><select value={filters.numberSetting} onChange={(e) => updateFilter('numberSetting', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none cursor-pointer hover:bg-slate-700 transition-colors" title="Filter by digits in domain name"><option value="any">Any</option><option value="none">None</option><option value="max1">Max 1</option><option value="max2">Max 2</option><option value="only">Only</option></select></div></div>
                    </div>
                )}
            </section>
            <section className="space-y-4">
                <button onClick={() => setIsTldExpanded(!isTldExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-teal-500 transition-all duration-200" title="Filter domains by top-level domain extension and availability status">
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
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
                                placeholder="Add TLD (e.g. io)"
                                title="Type a TLD (e.g., 'com' or '.io') and press Enter to filter even if it's not on the current page."
                            />
                            <button onClick={addManualTld} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-400 hover:text-teal-400 hover:border-teal-500 transition-colors cursor-pointer" title="Add TLD to filter">
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
                                        <button key={tld} onClick={() => toggleTld(tld)} className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 ${filters.tldFilter.split(',').map(s => s.trim()).includes(tld) ? 'bg-teal-900/40 border-teal-600 text-teal-400 shadow-sm shadow-teal-900/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
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
                <button onClick={() => setIsColumnsExpanded(!isColumnsExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-teal-500 transition-all duration-200" title="Show or hide table columns to customize your view">
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
                {isColumnsExpanded && (<div className="grid grid-cols-2 gap-2 p-1">{columns.map(col => (<button key={col.className} onClick={() => { 
                    setHiddenColumns(prev => {
                        const next = prev.includes(col.className) ? prev.filter(c => c !== col.className) : [...prev, col.className];
                        // If we are hiding the active sort column, reset sort to default
                        if (sortConfig.column === col.className && !prev.includes(col.className)) {
                            setSortConfig({ column: '', direction: 'asc' });
                        }
                        return next;
                    }); 
                    setActivePresetName(''); 
                }} title={col.tooltip} className={`text-xs py-2 px-2.5 rounded-lg border truncate cursor-pointer transition-all duration-200 ${hiddenColumns.includes(col.className) ? 'bg-rose-900/20 border-rose-800 text-slate-500 line-through' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'}`}>{col.label}</button>))}</div>)}
            </section>
            <section className="space-y-2">
                <button onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)} className="w-full flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border-l-2 border-transparent hover:border-l-teal-500 transition-all duration-200" title="Enable presets, heatmap visualization, and custom pattern matching">
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
                                <div className="w-8 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-500"></div>
                            </div>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group" title="Color-code table cells based on metric values (green=good, red=poor)">
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Enable Heatmap</span>
                            <div className="relative">
                                <input type="checkbox" checked={isHeatmapEnabled} onChange={(e) => setIsHeatmapEnabled(e.target.checked)} className="sr-only peer"/>
                                <div className="w-8 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-500"></div>
                            </div>
                        </label>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400 flex items-center gap-1">
                                Custom Pattern
                                <span className="relative group">
                                    <svg className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    <div className="absolute bottom-full left-0 mb-2 w-44 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-left text-[10px] text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                                        <div className="font-semibold text-white mb-1">Pattern Characters:</div>
                                        <div><span className="text-teal-400 font-mono">c</span> = consonant</div>
                                        <div><span className="text-teal-400 font-mono">v</span> = vowel (a,e,i,o,u)</div>
                                        <div><span className="text-teal-400 font-mono">n</span> = number (0-9)</div>
                                        <div><span className="text-teal-400 font-mono">l</span> = any letter</div>
                                        <div className="mt-1 text-slate-400">Ex: "cvcv" matches "doma"</div>
                                    </div>
                                </span>
                            </label>
                            <input type="text" value={filters.pattern} onChange={(e) => updateFilter('pattern', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" placeholder="e.g. cvcv, cvcc, llnn"/>
                        </div>
                    </div>
                )}
            </section>
        </div>
        <div className="p-4 bg-gradient-to-t from-slate-800 to-slate-800/80 border-t border-slate-700 space-y-3">
             <div className="flex justify-between items-center"><span className="text-xs text-slate-500 font-medium">Results Found</span><span className="text-2xl font-bold text-white tabular-nums drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{visibleCount}</span></div>
             <div className="flex gap-2">
                <button onClick={copyVisible} disabled={!!copyFeedback || visibleCount === 0} className={`flex-1 font-semibold py-2.5 rounded-lg transition-all text-sm ${visibleCount === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' : copyFeedback ? 'bg-teal-700 text-white cursor-pointer shadow-lg shadow-teal-900/30' : 'bg-teal-600 hover:bg-teal-500 text-white active:scale-[0.98] cursor-pointer shadow-lg shadow-teal-900/30'}`} title={visibleCount === 0 ? 'No domains to copy' : 'Copy all visible domain names to clipboard'}>{copyFeedback || 'Copy Visible Domains'}</button>
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
                <section className="border-t border-slate-700 pt-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">About</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Logo />
                            <div>
                                <div className="text-lg font-bold tracking-tight">
                                    <span className="text-white">Domain</span> <span className="text-teal-400">Powertools</span>
                                </div>
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
                            <a href="https://github.com/roie/domain-powertools/issues" target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1">
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
        <div className="flex flex-col items-center gap-3 mt-2">
            <h2 className="text-lg font-bold tracking-tight vertical-text">
            <span className="text-white">Domain</span> <span className="text-teal-400">Powertools</span>
            </h2>
            <div style={{ transform: 'rotate(-90deg)' }}>
                <Logo className="w-6 h-6" />
            </div>
        </div>

        {/* Expand hint icon at bottom - chevron-double-left */}
        <div className="p-2 text-slate-500 hover:text-teal-400 transition-colors">
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
