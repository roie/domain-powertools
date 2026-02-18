export type FilterState = {
  // Text Match
  matchType: 'contains' | 'startsWith' | 'endsWith' | 'all'; // 'all' means use the separate inputs
  matchText: string; // Contains
  startsWith: string;
  endsWith: string;
  blacklist: string; 

  // Structure
  minLength: number | '';
  maxLength: number | '';
  hyphenSetting: 'any' | 'none' | 'max1' | 'max2';
  numberSetting: 'any' | 'none' | 'max1' | 'max2' | 'only';
  
  // Pattern
  pattern: string; 

  // TLD & Status
  tldFilter: string; // Comma separated
  statusFilter: string; 

  // Pre-compiled objects for performance
  compiledRegex?: RegExp | null;
};

export const filterDomain = (
  domainName: string, 
  status: string,     
  filters: FilterState
): boolean => {
  const parts = domainName.toLowerCase().split('.');
  const sld = parts[0]; 
  const tld = parts.slice(1).join('.'); 

  // 1. Length (IMPORTANT: USER REQUESTED THIS FIRST)
  if (filters.minLength !== '' && sld.length < Number(filters.minLength)) return false;
  if (filters.maxLength !== '' && sld.length > Number(filters.maxLength)) return false;

  // 2. Text Match (with Regex Support)
  if (filters.compiledRegex) {
    if (!filters.compiledRegex.test(sld)) return false;
  } else if (filters.matchText) {
    // Fallback if regex failed to compile or wasn't pre-compiled
    if (!sld.includes(filters.matchText.toLowerCase())) return false;
  }
  
  if (filters.startsWith && !sld.startsWith(filters.startsWith.toLowerCase())) return false;
  if (filters.endsWith && !sld.endsWith(filters.endsWith.toLowerCase())) return false;

  // 3. Blacklist (Exclude)
  if (filters.blacklist) {
    const badWords = filters.blacklist.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (badWords.some(word => sld.includes(word))) return false;
  }

  // 4. Hyphens
  const hyphenCount = (sld.match(/-/g) || []).length;
  if (filters.hyphenSetting === 'none' && hyphenCount > 0) return false;
  if (filters.hyphenSetting === 'max1' && hyphenCount > 1) return false;
  if (filters.hyphenSetting === 'max2' && hyphenCount > 2) return false;

  // 5. Numbers
  const numberCount = (sld.match(/[0-9]/g) || []).length;
  if (filters.numberSetting === 'none' && numberCount > 0) return false;
  if (filters.numberSetting === 'max1' && numberCount > 1) return false;
  if (filters.numberSetting === 'max2' && numberCount > 2) return false;
  if (filters.numberSetting === 'only' && numberCount !== sld.length) return false;

  // 6. Pattern
  if (filters.pattern) {
    let sldPattern = '';
    const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
    for (const char of sld) {
      if (/[0-9]/.test(char)) sldPattern += 'n';
      else if (/[a-z]/.test(char)) sldPattern += vowels.has(char) ? 'v' : 'c';
      else sldPattern += '?';
    }
    const target = filters.pattern.toLowerCase();
    if (target.length !== sld.length) return false;
    for (let i = 0; i < target.length; i++) {
        const tChar = target[i];
        const dChar = sldPattern[i];
        if (tChar === 'l') { if (dChar !== 'c' && dChar !== 'v') return false; }
        else if (tChar !== dChar) return false;
    }
  }

  // 7. TLD
  if (filters.tldFilter) {
    const tlds = filters.tldFilter.toLowerCase().split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (tlds.length > 0) {
        // Match if TLD is in the list. Some domains might be .com.au, so we check inclusion or exact.
        // Usually users want exact match on the TLD part.
        if (!tlds.some(t => t === tld || t === '.' + tld)) return false;
    }
  }

  // 8. Status
  if (filters.statusFilter && filters.statusFilter !== 'Any') {
    if (status.toLowerCase() !== filters.statusFilter.toLowerCase()) return false;
  }

  return true;
};

const extractSortValue = (cell: Element | null, columnClass: string = ''): number | string => {
  if (!cell) return 0;

  // 1. Get raw values
  const link = cell.querySelector('a');
  const titleVal = (link?.getAttribute('title') || cell.getAttribute('title') || '').trim();
  const textVal = (cell.textContent || '').trim();

  // 2. Helper: Try to parse a string into a comparable Number (Timestamp or Value)
  // Returns null if it cannot be strictly parsed as a number/date
  const parseValue = (raw: string): number | null => {
      if (!raw) return null;
      const lower = raw.toLowerCase();

      // A. Relative Dates (Today/Yesterday/X days)
      if (lower.startsWith('today')) {
        const timePart = lower.replace('today', '').trim();
        return new Date().setHours(0,0,0,0) + (timePart ? parseInt(timePart.replace(':', '')) : 9999); 
      }
      if (lower.startsWith('yesterday')) {
        const timePart = lower.replace('yesterday', '').trim();
        return new Date(Date.now() - 86400000).setHours(0,0,0,0) + (timePart ? parseInt(timePart.replace(':', '')) : 9999);
      }
      const daysMatch = lower.match(/^(\d+)\s+days?$/);
      if (daysMatch) {
          const daysAgo = parseInt(daysMatch[1]);
          return new Date(Date.now() - (daysAgo * 86400000)).setHours(0,0,0,0);
      }

      // B. Absolute Dates
      // ISO (YYYY-MM-DD) - check start of string
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const date = Date.parse(raw);
        if (!isNaN(date)) return date;
      }
      // European (DD.MM.YYYY)
      if (/^\d{2}\.\d{2}\.\d{4}/.test(raw)) {
          const parts = raw.split('.');
          const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
          if (!isNaN(date)) return date;
      }

      // C. Numeric (with Suffixes)
      const cleanStr = raw.replace(/[, $]/g, '');
      const suffixMatch = cleanStr.match(/^([\d.]+)\s*([kmb])$/i);
      if (suffixMatch) {
        const val = parseFloat(suffixMatch[1]);
        const suf = suffixMatch[2].toLowerCase();
        if (suf === 'k') return val * 1000;
        if (suf === 'm') return val * 1000000;
        if (suf === 'b') return val * 1000000000;
      }

      // D. Strict Number
      // Must be purely numeric (with optional dot/minus)
      if (/^-?[\d,]+(\.\d+)?$/.test(cleanStr)) {
        const num = parseFloat(cleanStr);
        if (!isNaN(num)) return num;
      }

      return null;
  };

  // 3. Strategy Execution
  
  // Case I: Status Columns (Always Text Sort)
  if (columnClass.includes('status') || columnClass.includes('whois')) {
     return textVal.toLowerCase();
  }

  // Case II: Try Parsing Title (High Precision Metrics)
  // e.g. Backlinks title="257,041" vs text="257.0 K" -> Title wins
  const titleParsed = parseValue(titleVal);
  if (titleParsed !== null) return titleParsed;

  // Case III: Try Parsing Text (Fallback for Verbose Titles)
  // e.g. related_cnobi title="2 Related..." (fails parse) vs text="2" (passes) -> Text wins
  // e.g. enddate title="Date is..." (fails parse) vs text="2026-01-27" (passes) -> Text wins
  const textParsed = parseValue(textVal);
  if (textParsed !== null) return textParsed;

  // Case IV: Fallback to String Sort (Default to Text)
  return textVal.toLowerCase() || titleVal.toLowerCase();
};

export const sortRows = (
  rows: HTMLTableRowElement[], 
  columnClass: string, 
  direction: 'asc' | 'desc'
): HTMLTableRowElement[] => {
  if (!columnClass) return rows;

  return [...rows].sort((a, b) => {
    const cellA = a.querySelector(`td.${columnClass}`);
    const cellB = b.querySelector(`td.${columnClass}`);

    const valA = extractSortValue(cellA, columnClass);
    const valB = extractSortValue(cellB, columnClass);

    // Numeric Sort
    if (typeof valA === 'number' && typeof valB === 'number') {
        return direction === 'asc' ? valA - valB : valB - valA;
    }

    // String Sort
    const strA = String(valA);
    const strB = String(valB);
    return direction === 'asc' 
        ? strA.localeCompare(strB) 
        : strB.localeCompare(strA);
  });
};

export const getHeatColor = (className: string, value: string): string | null => {
  const val = parseFloat(value.replace(/,/g, ''));
  if (isNaN(val) || val <= 0) {
    // Special check for Year (WBY/ABY) as they are > 0 but need a baseline
    if (!className.includes('creationdate') && !className.includes('abirth')) return null;
  }

  const green = (opacity: number) => `rgba(16, 185, 129, ${opacity})`;

  // SEO Metrics (TF, CF)
  if (className.includes('majesticseo_tf') || className.includes('majesticseo_cf')) {
    if (val >= 35) return green(0.4);
    if (val >= 20) return green(0.2);
    if (val >= 10) return green(0.1);
  }

  // Backlinks & Pop (BL, DP)
  if (className.includes('field_bl') || className.includes('field_domainpop')) {
    if (val >= 100000) return green(0.4);
    if (val >= 10000) return green(0.2);
    if (val >= 1000) return green(0.1);
  }

  // Length (Lower is better)
  if (className.includes('field_length')) {
    if (val < 4) return green(0.4);
    if (val < 6) return green(0.2);
    if (val < 10) return green(0.1);
  }

  // Age (Creation Date / Archive Birth)
  if (className.includes('field_creationdate') || className.includes('field_abirth')) {
    if (val < 1996) return green(0.4);
    if (val < 2005) return green(0.2);
    if (val < 2015) return green(0.1);
  }

  // Registered TLDs / Related
  if (className.includes('field_statustld_registered') || className.includes('field_related_cnobi')) {
    if (val >= 15) return green(0.4);
    if (val >= 8) return green(0.2);
    if (val >= 3) return green(0.1);
  }

  // Wikipedia (Premium)
  if (className.includes('field_wikipedia_links')) {
    if (val > 0) return green(0.3);
  }

  return null;
};
