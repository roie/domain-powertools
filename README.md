# Domain Powertools

A browser extension that enhances [expireddomains.net](https://www.expireddomains.net) with advanced filtering, sorting, heatmap visualization, and export capabilities to help you find the perfect expired domain.

## Features

### Filtering
- **Length Filter** — Set min/max character limits for domain names
- **Text Matching** — Filter by contains, starts with, or ends with (supports regex)
- **Blacklist** — Exclude domains containing specific words
- **Hyphen Control** — Filter by hyphen count (none, max 1, max 2)
- **Number Control** — Filter by digit count or numeric-only domains
- **Custom Patterns** — Match consonant/vowel patterns (e.g., `cvcv` matches "doma")
- **TLD Filter** — Filter by specific extensions (.com, .io, .ai, etc.)
- **Status Filter** — Filter by availability status

### Sorting & Display
- **Column Sorting** — Sort by any column (ascending/descending)
- **Column Toggle** — Show/hide columns to declutter the view
- **Heatmap Mode** — Color-code cells based on metric quality (TF, CF, backlinks, age, etc.)

### Presets
- **Save Presets** — Store filter configurations for reuse
- **Load Presets** — Quickly switch between saved configurations
- **Export/Import** — Backup and share presets as JSON files

### Export
- **Copy Domains** — Copy all visible domain names to clipboard
- **CSV Export** — Download filtered results as a CSV file

## Installation

### Chrome / Chromium-based browsers

1. Download the latest release from [Releases](https://github.com/roie/domain-powertools/releases)
2. Extract the ZIP file
3. Go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the extracted folder

### Firefox

1. Download the Firefox release from [Releases](https://github.com/roie/domain-powertools/releases)
2. Go to `about:addons`
3. Click the gear icon → "Install Add-on From File..."
4. Select the downloaded `.xpi` file

## Usage

1. Navigate to [expireddomains.net](https://www.expireddomains.net)
2. The sidebar appears on the right side of the page
3. Configure your filters and watch the table update in real-time
4. Use presets to save your favorite filter combinations
5. Export results when you find domains you like

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/roie/domain-powertools.git
cd domain-powertools

# Install dependencies
npm install

# Start development server (Chrome)
npm run dev

# Start development server (Firefox)
npm run dev:firefox
```

### Build

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox

# Create ZIP for distribution
npm run zip
npm run zip:firefox
```

## Tech Stack

- [WXT](https://wxt.dev/) — Web Extension Framework
- [React](https://react.dev/) — UI Library
- [TypeScript](https://www.typescriptlang.org/) — Type Safety
- [Tailwind CSS](https://tailwindcss.com/) — Styling

## Privacy

This extension operates **entirely locally**:

- All filter settings and presets are stored in your browser's local storage
- No data is collected, transmitted, or shared with any third parties
- No analytics or tracking of any kind
- Only requires `storage` permission to save your preferences

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Save your preferences, presets, and settings locally |
| Host access (`expireddomains.net`) | Inject the sidebar and filter domains on the page |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Issues & Feedback

Found a bug or have a feature request? [Open an issue](https://github.com/roie/domain-powertools/issues)

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Made with care for domain hunters everywhere.
