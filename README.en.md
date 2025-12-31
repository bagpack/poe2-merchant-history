# PoE2 Merchant History

Chrome extension that stores Path of Exile 2 merchant sales history per league and visualizes it with charts and tables. Data is kept locally for aggregation and comparison.

[日本語README](README.md)

## Key Features

- Fetch and switch league list
- Manual refresh to pull history (adds diffs only, limited to once per minute)
- Daily and currency line charts
- Currency totals summary
- History list (search, pagination, detail modal)
- Export history list to CSV
- Cookie status display (options)

## Setup

1. Open `chrome://extensions/` in Chrome
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select this repository folder

## Usage

1. Click the extension icon to open the tab
2. Select a league
3. Click the "Update" button to fetch history
4. Review history in charts, totals, and list

## Notes

- Requires the `jp.pathofexile.com` login cookie (POESESSID)
- Fetching is limited to once per minute
- Data is stored per league in IndexedDB and kept indefinitely

## Screenshot

![Dashboard](docs/images/dashboard.png)
