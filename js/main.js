// FIT3179 DV2 — Chart 01: an interactive Vega-Lite v5 map.
// All other chart placeholders remain unchanged.
const EVENT_CSV = "data/surfing_australia_events_2026.csv";
const STATE_BOUNDARY_SOURCE =
  "https://cdn.jsdelivr.net/gh/anthwri/GeoJson-Data@master/australian-states.json";

function withValidCoordinates(record) {
  return record.Latitude?.trim() !== "" && record.Longitude?.trim() !== "" &&
    Number.isFinite(Number(record.Latitude)) && Number.isFinite(Number(record.Longitude));
}

function eventDateText(event) {
  const start = new Date(`${event.Start_Date}T12:00:00Z`);
  const end = new Date(`${event.End_Date}T12:00:00Z`);
  const month = start.toLocaleDateString("en-AU", {month: "short", timeZone: "UTC"});
  const endMonth = end.toLocaleDateString("en-AU", {month: "short", timeZone: "UTC"});
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  return month === endMonth ? `${startDay}–${endDay} ${month}` : `${startDay} ${month} – ${endDay} ${endMonth}`;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function readEventData() {
  const response = await fetch(EVENT_CSV);
  if (!response.ok) throw new Error(`Cannot load the event data (${response.status}).`);
  const csvText = await response.text();
  return window.vega.read(csvText, {type: "csv"});
}

// A secondary, optional geographic layer. If a network blocks the state dataset,
// the locally packaged country boundary and all seven markers still render.
async function addStateBoundariesWhenAvailable(specification) {
  try {
    const response = await fetch(STATE_BOUNDARY_SOURCE, {signal: AbortSignal.timeout(5500)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const geojson = await response.json();
    if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features) || geojson.features.length < 6) {
      throw new Error("Unexpected GeoJSON schema");
    }
    specification.layer.splice(1, 0, {
      name: "australian-state-boundaries",
      data: {values: geojson.features},
      mark: {type: "geoshape", fillOpacity: 0, stroke: "#b3c8c6", strokeWidth: 1.05}
    });
    document.getElementById("map-boundary-note").textContent = "State boundaries shown";
  } catch (error) {
    console.warn("Optional state boundaries were unavailable. Base map still works.", error);
    document.getElementById("map-boundary-note").textContent = "Country outline shown";
  }
  return specification;
}

function addFilterButtons(events, onStateChange) {
  const filters = document.getElementById("event-state-filters");
  const allStates = ["All", "NSW", "VIC", "QLD", "WA"];
  const counts = Object.fromEntries(allStates.map(state => [state,
    events.filter(event => state === "All" || event.State === state).length]));
  for (const state of allStates) {
    const button = makeElement("button", "state-pill", `${state} · ${counts[state]}`);
    button.type = "button";
    button.dataset.state = state;
    button.setAttribute("aria-pressed", String(state === "All"));
    button.addEventListener("click", () => onStateChange(state));
    filters.appendChild(button);
  }
}

function renderEventList(events, currentState, chosenEvent, onSelect) {
  const list = document.getElementById("event-list");
  const visible = currentState === "All" ? events : events.filter(event => event.State === currentState);
  list.replaceChildren();
  visible.forEach(event => {
    const item = makeElement("button", "event-row");
    item.type = "button";
    item.setAttribute("aria-pressed", String(chosenEvent === event.Event));
    if (chosenEvent === event.Event) item.classList.add("is-selected");

    const date = makeElement("span", "event-row__date", eventDateText(event));
    const information = makeElement("span", "event-row__information");
    information.appendChild(makeElement("span", "event-row__location", event.Location));
    information.appendChild(makeElement("span", "event-row__name", event.Event));
    const state = makeElement("span", "event-row__state", event.State);
    item.append(date, information, state);
    item.addEventListener("click", () => onSelect(chosenEvent === event.Event ? "" : event.Event));
    list.appendChild(item);
  });
  document.getElementById("event-filter-label").textContent = currentState === "All"
    ? "Explore mapped venues" : `Mapped venues in ${currentState}`;
}

function displayMapFailure(message) {
  const target = document.getElementById("chart1");
  target.replaceChildren(makeElement("p", "map-error", message));
}

async function initializeEventMap() {
  try {
    const [events, specificationResponse] = await Promise.all([
      readEventData(), fetch("charts/chart01_event_locations.json")
    ]);
    if (!specificationResponse.ok) throw new Error("Cannot load the Chart 01 Vega-Lite JSON.");
    const allEvents = events.filter(withValidCoordinates).sort((a, b) => a.Start_Date.localeCompare(b.Start_Date));
    if (!allEvents.length) throw new Error("No mappable event coordinates found.");
    const mappedStateCount = new Set(allEvents.map(event => event.State)).size;
    document.getElementById("mapped-event-count").textContent = String(allEvents.length);
    document.getElementById("mapped-state-count").textContent = String(mappedStateCount);
    document.getElementById("unmapped-event-count").textContent = String(events.length - allEvents.length);

    const specification = await addStateBoundariesWhenAvailable(await specificationResponse.json());
    const {view} = await window.vegaEmbed("#chart1", specification, {actions: false});
    let activeState = "All";
    let chosenEvent = "";
    // Vega-Lite top-level params compile to the named Vega signals below.
    const setSignal = async (name, value) => {
      try { await view.signal(name, value).runAsync(); }
      catch (error) { console.error(`Cannot update map control ${name}`, error); }
    };
    const updateSelection = async eventName => {
      chosenEvent = eventName;
      await setSignal("focus_event", eventName);
      renderEventList(allEvents, activeState, chosenEvent, updateSelection);
    };
    const updateState = async state => {
      activeState = state;
      chosenEvent = "";
      await setSignal("focus_event", "");
      await setSignal("state_filter", state);
      document.querySelectorAll(".state-pill").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.state === state));
      });
      renderEventList(allEvents, state, "", updateSelection);
    };
    addFilterButtons(allEvents, updateState);
    renderEventList(allEvents, activeState, chosenEvent, updateSelection);
  } catch (error) {
    console.error("Chart 01 could not be rendered:", error);
    displayMapFailure("The interactive map could not load. Check the browser console or data paths.");
  }
}

window.addEventListener("DOMContentLoaded", initializeEventMap);
