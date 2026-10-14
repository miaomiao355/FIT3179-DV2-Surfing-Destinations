# FIT3179 DV2 — Chart 01 update

## Install / test

Copy the files and folders in this ZIP into your existing `Project 2` directory, **merging folders and replacing the listed files**. Do not delete the other charts or data. Back up the original project first.

From `D:\\Y3S1\\FIT3179\\Project 2`, run:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000/` and press `Ctrl+Shift+R`. Keep this terminal open while viewing the page. **Do not commit/push yet.**

### What changed

- `index.html`: Chart 01 now has a clearly scoped event map, a 2026 event list, state filters, and a separate data note; Charts 02–12 remain placeholders.
- `css/style.css`: responsive two-column composition, blue–orange accessible controls and a matching mobile layout.
- `js/main.js`: read the same event CSV, build the event list and counts, link filter buttons/list selections to Vega view signals, and use a safe optional boundary overlay.
- `charts/chart01_event_locations.json`: local Australian land geometry, state abbreviation annotations, **seven** original coordinate locations, hover tooltip, selection and filtering. Vega-Lite **v5**.
- `data/australia_outline.geojson`: Australian land geometry extracted from FIT3179 Week 8 Natural Earth TopoJSON, not hand-drawn.

### Original data preserved

`data/surfing_australia_events_2026.csv` is unchanged: 9 event rows in the file, of which 7 have geographic coordinates (NSW 3, VIC 2, QLD 1, WA 1). The online event and regional Tweed Coast event are **not** plotted as precise markers. Some other coordinates refer to locality/city rather than precise surf breaks; the chart explicitly warns readers of this distinction.

### Geographic data attribution

- **Outline:** Natural Earth admin-0 geometry distributed in the FIT3179 Week 8 studio reference. <https://github.com/FIT3179/Vega-Lite/tree/main/2_symbol_map>
- **State boundary overlay:** Australian states GeoJSON by `anthwri/GeoJson-Data`, loaded at runtime from <https://github.com/anthwri/GeoJson-Data/blob/master/australian-states.json>. The external fetch has a 5.5-second timeout; failure falls back gracefully to local Australian outline and event markers. **The external state-boundary dataset should be compared with ABS authoritative boundaries before final submission if you need formal cartographic accuracy.**
- **National event entries:** Surfing Australia 2026 calendar and the sources recorded in the original CSV.

### Browser checks (important)

1. Map shows Australia and Tasmania at a sensible landscape aspect.
2. If state boundaries load, thin internal borders appear; the corner legend reads “State boundaries shown”. If not, the map should still display and read “Country outline shown”.
3. All seven points appear (some along the eastern coast are naturally near one another).
4. Hovering a point displays a tooltip and turns it orange.
5. Clicking NSW / VIC / QLD / WA filters both the venue list **and map**. “All” resets.
6. Clicking a venue in the right list highlights its point orange, and clicking it again clears the highlight.
7. Open Chrome DevTools → Console and check for errors; if any error appears, share the exact message.
8. Check layout at desktop and mobile width.

**Validation status:** JSON parsed, JavaScript syntax checked, original event counts verified and HTML chart IDs checked. Full Vega-Lite rendering in a networked browser was not available in this sandbox. The final verification must occur in your Chrome browser.
