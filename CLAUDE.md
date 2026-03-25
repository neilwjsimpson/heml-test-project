# S&P 500 Stock Tracker

## Overview

Single-page stock dashboard built with static HTML, CSS, and vanilla JavaScript.
The app loads companies from `data/sp500.json` and renders market visualizations,
filters, watchlists, portfolio inputs, comparison charts, and a company dashboard.

## Project Structure

- `index.html` — App layout and modal/widget containers
- `script.js` — State management, filtering, rendering, keyboard interactions, widgets
- `style.css` — Theme, layout, cards, modal, widgets, responsive behavior
- `data/sp500.json` — Company dataset (symbol, name, sector, sub-industry, market cap)

## Run Locally

Use any static file server from the project root, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Notes

- TradingView widgets are loaded client-side from `https://s3.tradingview.com`.
- No build step or package manager setup is required for local development.
