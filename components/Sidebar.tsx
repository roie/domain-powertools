import { useState, useEffect } from "react";

interface ColumnDef {
  label: string;
  className: string;
  tooltip: string;
}

export default function Sidebar() {
  const [filterText, setFilterText] = useState("");
  const [minLength, setMinLength] = useState<number | "">("");
  const [maxLength, setMaxLength] = useState<number | "">("");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [columns, setColumns] = useState<ColumnDef[]>([]);

  // New UI States
  const [copyFeedback, setCopyFeedback] = useState("");
  const [isColumnsExpanded, setIsColumnsExpanded] = useState(false);

  // Detect columns on mount
  useEffect(() => {
    const headers = document.querySelectorAll("table.base1 thead th");
    const detectedCols: ColumnDef[] = [];

    headers.forEach((th) => {
      const classList = Array.from(th.classList);
      const headClass = classList.find((c) => c.startsWith("head_"));

      // Skip if no head class or if it's Domain/Watchlist
      if (
        !headClass ||
        headClass === "head_domain" ||
        headClass === "head_watchlist"
      ) {
        return;
      }

      const fieldClass = headClass.replace("head_", "field_");
      const link = th.querySelector("a");

      // Extract label and tooltip
      let label = link ? link.textContent?.trim() : th.textContent?.trim();
      let tooltip = link ? link.getAttribute("title") : "";

      // Fallback for RL or others that might be direct text
      if (!label) label = "?";
      if (!tooltip) tooltip = label;

      detectedCols.push({
        label: label,
        className: fieldClass,
        tooltip: tooltip || "",
      });
    });

    setColumns(detectedCols);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterText, minLength, maxLength]);

  useEffect(() => {
    applyColumnVisibility();
  }, [hiddenColumns]);

  // Adjust page layout to prevent overlap
  useEffect(() => {
    // Match Tailwind's duration-300 and ease-in-out
    document.body.style.transition =
      "margin-right 300ms cubic-bezier(0.4, 0, 0.2, 1)";

    // w-80 = 20rem = 320px, w-12 = 3rem = 48px
    const sidebarWidth = isCollapsed ? "48px" : "320px";
    document.body.style.marginRight = sidebarWidth;

    return () => {
      document.body.style.marginRight = "";
      document.body.style.transition = "";
    };
  }, [isCollapsed]);

  const toggleColumn = (className: string) => {
    setHiddenColumns((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className],
    );
  };

  const applyColumnVisibility = () => {
    const styleId = "domain-powertools-col-styles";
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    const cssRules = hiddenColumns
      .map((fieldClass) => {
        const headClass = fieldClass.replace("field_", "head_");
        return `table.base1 th.${headClass}, table.base1 td.${fieldClass} { display: none !important; }`;
      })
      .join("\n");

    styleTag.textContent = cssRules;
  };

  const applyFilters = () => {
    const rows = document.querySelectorAll("table.base1 tbody tr");
    let count = 0;

    rows.forEach((row) => {
      const domainCell = row.querySelector("td:first-child a");
      if (!domainCell) return;

      const domainName = domainCell.textContent?.toLowerCase() || "";

      let isVisible = true;

      // Text Filter
      if (filterText) {
        try {
          // Try regex first
          const regex = new RegExp(filterText, "i");
          if (!regex.test(domainName)) isVisible = false;
        } catch (e) {
          // Fallback to simple includes
          if (!domainName.includes(filterText.toLowerCase())) isVisible = false;
        }
      }

      // Length Filter
      if (isVisible) {
        const sld = domainName.split(".")[0];
        if (minLength !== "" && sld.length < Number(minLength))
          isVisible = false;
        if (maxLength !== "" && sld.length > Number(maxLength))
          isVisible = false;
      }

      // Apply visibility
      (row as HTMLElement).style.display = isVisible ? "" : "none";
      if (isVisible) count++;
    });

    setVisibleCount(count);
  };

  const copyVisible = () => {
    const rows = document.querySelectorAll("table.base1 tbody tr");
    const domains: string[] = [];
    rows.forEach((row) => {
      if ((row as HTMLElement).style.display !== "none") {
        const domainCell = row.querySelector("td:first-child a");
        if (domainCell && domainCell.textContent) {
          domains.push(domainCell.textContent);
        }
      }
    });
    navigator.clipboard.writeText(domains.join("\n"));

    // Feedback animation
    setCopyFeedback(`Copied ${domains.length} domains!`);
    setTimeout(() => setCopyFeedback(""), 2500);
  };

  const clearFilters = () => {
    setFilterText("");
    setMinLength("");
    setMaxLength("");
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-slate-900 text-slate-100 shadow-2xl z-[9999] border-l border-slate-700 font-sans transition-all duration-300 ease-in-out ${isCollapsed ? "w-12" : "w-80"}`}
    >
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-4 left-0 -ml-4 bg-slate-900 border border-slate-700 text-green-400 p-1 rounded-l shadow-md hover:text-green-300 focus:outline-none w-6 h-8 flex items-center justify-center transition-colors cursor-pointer"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        style={{ left: 0, marginLeft: -24 }}
      >
        {isCollapsed ? "«" : "»"}
      </button>

      {/* Sidebar Content */}
      <div
        className={`flex flex-col h-full ${isCollapsed ? "hidden" : "flex"}`}
      >
        <div className="p-4 flex-shrink-0 flex justify-between items-center">
          <h2 className="text-xl font-bold text-green-400">
            Domain Powertools
          </h2>
          <button
            onClick={clearFilters}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer transition-colors"
            title="Reset all filters"
          >
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-6">
          {/* Search Section */}
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">
              Regex / Search
            </label>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              placeholder="e.g. ^[a-z]{4}\.com$"
            />
          </div>

          {/* Length Section */}
          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1 text-slate-300">
                Min Len
              </label>
              <input
                type="number"
                value={minLength}
                onChange={(e) =>
                  setMinLength(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1 text-slate-300">
                Max Len
              </label>
              <input
                type="number"
                value={maxLength}
                onChange={(e) =>
                  setMaxLength(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              />
            </div>
          </div>

          {/* Column Toggles Section (Collapsible) */}
          <div className="border border-slate-700 rounded overflow-hidden">
            <button
              onClick={() => setIsColumnsExpanded(!isColumnsExpanded)}
              className="w-full flex justify-between items-center p-3 bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium text-slate-200 cursor-pointer"
            >
              <span>Toggle Columns</span>
              <span
                className={`transform transition-transform ${isColumnsExpanded ? "rotate-180" : ""}`}
              >
                ▼
              </span>
            </button>

            {isColumnsExpanded && (
              <div className="p-3 bg-slate-900 grid grid-cols-2 gap-2 border-t border-slate-700">
                {columns.length > 0 ? (
                  columns.map((col) => (
                    <button
                      key={col.className}
                      onClick={() => toggleColumn(col.className)}
                      title={col.tooltip}
                      className={`text-xs py-1.5 px-2 rounded border truncate transition-all cursor-pointer ${
                        hiddenColumns.includes(col.className)
                          ? "bg-red-900/40 border-red-800 text-slate-500"
                          : "bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      {col.label}
                    </button>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-slate-500 text-center py-2">
                    Loading columns...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Stats & Action */}
          <div className="p-4 bg-slate-800 rounded border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">Visible Domains</p>
            <p className="text-3xl font-bold text-white">{visibleCount}</p>
          </div>

          <button
            onClick={copyVisible}
            disabled={!!copyFeedback}
            className={`w-full font-bold py-2 px-4 rounded transition-all duration-200 flex items-center justify-center cursor-pointer ${
              copyFeedback
                ? "bg-green-700 text-white cursor-default"
                : "bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-900/20"
            }`}
          >
            {copyFeedback ? (
              <span className="flex items-center gap-2">✓ {copyFeedback}</span>
            ) : (
              "Copy Visible"
            )}
          </button>

          <div className="pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">
              Changes apply to current page only.
            </p>
          </div>
        </div>
      </div>

      {/* Collapsed State Icon */}
      <div
        className={`h-full flex flex-col items-center pt-4 ${isCollapsed ? "block" : "hidden"}`}
      >
        <span
          className="text-green-400 font-bold text-lg writing-vertical-rl rotate-180"
          style={{ writingMode: "vertical-rl" }}
        >
          Domain Powertools
        </span>
      </div>
    </div>
  );
}
