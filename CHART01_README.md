# Chart 01 — National event locations

Chart 01 is part of the existing twelve-chart dashboard, Australia: A Nation Built Around the Waves. It uses an Equal Earth point map of the seven 2026 Surfing Australia event entries with verifiable locality coordinates.

The map shows venue references, not every beach or exact surf break. The online event and broad Tweed Coast event remain unplotted because the supplied locations do not provide precise coordinates. The map uses the local Australian state boundaries in data/australian-states.geojson and a local Natural Earth country outline. All seven coordinates remain unchanged.

The state pills filter both the point layer and venue list. Selecting a listed venue highlights its map point; selecting it again clears the selection. Hovering a marker shows event, venue, state, dates and category. The JSON specification is charts/chart01_event_locations.json.

## Local review

Start a local HTTP server from the project directory:

    python -m http.server 8000

Open <http://localhost:8000/> and review the first section. Check the local state boundary layer, seven mapped points, the two unplotted entries, state filters, venue selection and hover tooltips at desktop and mobile widths.

## Sources

- National event calendar: Surfing Australia 2026 national calendar, linked in the figure caption.
- Country outline: FIT3179 Week 8 map material, linked in the figure caption.
- State boundaries: anthwri/GeoJson-Data, linked in the figure caption; the local copy avoids a runtime boundary request.
- The state GeoJSON contains all eight expected state and territory names, but its boundary linework has not been independently validated against an ABS release.
- Coordinate notes are retained in data/surfing_australia_events_2026.csv.
