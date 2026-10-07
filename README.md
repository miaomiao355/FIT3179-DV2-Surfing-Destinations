# Surfing Destinations

This project is a single-page webpage scaffold for a FIT3179 Data Visualisation 2 story about Australia's surfing destinations. It uses plain HTML, CSS and JavaScript. The chart areas are placeholders; no chart specifications or visualisations have been added yet.

## Project structure

- `index.html` contains the page sections, chart placeholders and Vega CDN scripts.
- `css/style.css` contains the responsive page layout, typography and palette variables.
- `js/main.js` contains a reusable helper for embedding future Vega-Lite specifications.
- `charts/` is reserved for chart work. No chart JSON files are included yet.
- `data/` contains the supplied CSV files.

Charts will be built with Vega-Lite and embedded with Vega-Embed.

## Run locally

Open a terminal in the project root and start a local HTTP server, for example with Python:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000> in a browser. Stop the server with `Ctrl+C` in the terminal.
