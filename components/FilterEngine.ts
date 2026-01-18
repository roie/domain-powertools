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
  if (filters.matchText) {
    try {
      const regex = new RegExp(filters.matchText, 'i');
      if (!regex.test(sld)) return false;
    } catch (e) {
      // Fallback to simple includes if regex is invalid
      if (!sld.includes(filters.matchText.toLowerCase())) return false;
    }
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

export const sortRows = (
  rows: HTMLTableRowElement[], 
  columnClass: string, 
  direction: 'asc' | 'desc'
): HTMLTableRowElement[] => {
  if (!columnClass) return rows;

  return [...rows].sort((a, b) => {
    const cellA = a.querySelector(`td.${columnClass}`);
    const cellB = b.querySelector(`td.${columnClass}`);

    const valA = cellA?.textContent?.trim() || '';
    const valB = cellB?.textContent?.trim() || '';

    // Attempt to parse as number (remove commas/k/m if necessary, but simple parseFloat is usually enough for basic tables)
    // Some columns might have "2.5k" or "1,000", simple parseFloat stops at commas often or handles them poorly if not cleaned.
    // For EDN, usually just numbers or simple text.
    const numA = parseFloat(valA.replace(/,/g, ''));
    const numB = parseFloat(valB.replace(/,/g, ''));

    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) {
      return direction === 'asc' ? numA - numB : numB - numA;
    }

    return direction === 'asc' 
      ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
      : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
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
