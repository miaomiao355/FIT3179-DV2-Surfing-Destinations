# Australia: A Nation Built Around the Waves

A single-page FIT3179 Data Visualisation 2 story about Australia's surfing calendar, measured Gold Coast–Tweed wave conditions and AusPlay participation estimates. The dashboard uses plain HTML, CSS, JavaScript and Vega-Lite v5. All chart specifications are separate, readable JSON files in charts/.

## Story and final chart idioms

| No. | Question | Visualisation idiom | Main task |
| --- | --- | --- | --- |
| 01 | Where does the national circuit travel? | Equal Earth event point map with state filters and venue selection | Locate mapped event references |
| 02 | Where are state-assigned event entries listed? | Equal Earth choropleth of discrete event counts | Compare calendar totals by state |
| 03 | When are events scheduled? | Gantt-style event timeline | Compare event dates and duration |
| 04 | Where were waves taller on average? | Mercator proportional symbol map; symbol area encodes mean Hs | Locate three monitoring sites and compare mean height |
| 05 | How much did wave heights vary? | Tukey box plots | Compare distributions and outliers |
| 06 | Which direction sectors are most common? | Three aligned horizontal bar small multiples | Compare eight bearing sectors by site |
| 07 | When did daily wave heights rise and fall? | Three calendar heatmaps on one metre scale | Scan within-month patterns |
| 08 | Which height–period combinations occur most often? | Three binned Hs–Tp heatmaps with a shared count scale | Compare paired conditions |
| 09 | Which age groups have the highest participation? | Layered lollipop chart | Compare 2025 participation rates |
| 10 | How do male and female rates compare? | Mirrored butterfly chart | Compare within-population rates |
| 11 | How did participant estimates change from 2024 to 2025? | Indexed slope chart | Compare relative year-on-year change |
| 12 | What share of adult surfing is organised? | 10 × 10 waffle chart | Communicate an approximate part-to-whole share |

The three map idioms are the event point map, state choropleth and regional proportional symbol map. The map symbols in Chart 04 remain at the published reference coordinates; symbol area, not radius, represents mean significant wave height. Its deliberately small markers keep Gold Coast and Palm Beach distinct. Chart 06 uses a shared linear scale to make direction-sector percentages easier to compare than radial lengths.

The project contains twelve chart sections, exceeding the assignment's minimum of ten. The advanced idioms include the three map types, Gantt timeline, box plots, calendar heatmaps, binned heatmaps, butterfly comparison and waffle chart. Small-multiple panels are counted as one chart each.

The Australian state boundary layer is a third-party community GeoJSON copy. Its eight state and territory feature names are checked by the page, but its boundary linework has not been independently validated against an ABS release.

## Run and check locally

1. Open a terminal in the project directory.
2. Start a local HTTP server:

       python -m http.server 8000

   On Windows, py -m http.server 8000 also works when the Python launcher is installed.
3. Open <http://localhost:8000/>. Do not open index.html directly; the page fetches its CSV, GeoJSON and Vega-Lite files.
4. Check all twelve charts, hover tooltips, event-state filters and venue selection. Resize to a narrow mobile width and confirm the page has no horizontal scroll.
5. If a chart does not render, inspect the browser console and confirm the Vega, Vega-Lite and Vega-Embed CDN scripts can load.

The event and wave data, map boundaries and chart specifications are served locally. Vega, Vega-Lite and Vega-Embed load from jsDelivr. No deployment or publishing step is performed by the local test server.

## Project structure

- index.html: story sections, source notes, accessible chart labels and footer attribution.
- css/style.css: responsive layout, typography and shared palette.
- js/main.js: data preparation, map controls and chart initialization.
- charts/: twelve Vega-Lite v5 specifications.
- data/: supplied event, wave and AusPlay data; map geometries; dictionary and geographic licensing notes.

## Source and attribution notes

Chart captions link to Surfing Australia, the Queensland Government, the Australian Sports Commission, FIT3179 map material, Australian state boundaries and NOAA GSHHG. The regional GSHHG licence notice is in data/GSHHG_SOURCE_AND_LICENSE.txt. Generative AI assistance is acknowledged in the page footer.
