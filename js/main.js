// FIT3179 DV2 — Charts 01–03: interactive Vega-Lite v5 event views.
const EVENT_CSV = "data/surfing_australia_events_2026.csv";
const STATE_BOUNDARY_SOURCE =
  "https://cdn.jsdelivr.net/gh/anthwri/GeoJson-Data@master/australian-states.json";
const STATE_NAME_BY_CODE = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory"
};
const DAY_MS = 24 * 60 * 60 * 1000;
let eventDataPromise;
let stateBoundaryPromise;

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

function readEventData() {
  if (!eventDataPromise) {
    eventDataPromise = (async () => {
      const response = await fetch(EVENT_CSV);
      if (!response.ok) throw new Error(`Cannot load the event data (${response.status}).`);
      const csvText = await response.text();
      return window.vega.read(csvText, {type: "csv"});
    })();
  }
  return eventDataPromise;
}

function loadStateBoundaries() {
  if (!stateBoundaryPromise) {
    stateBoundaryPromise = (async () => {
      const response = await fetch(STATE_BOUNDARY_SOURCE, {signal: AbortSignal.timeout(5500)});
      if (!response.ok) throw new Error(`State boundary request failed (HTTP ${response.status}).`);
      const geojson = await response.json();
      if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
        throw new Error("Unexpected state boundary GeoJSON schema.");
      }
      const states = geojson.features.map(feature => feature.properties?.STATE_NAME);
      if (geojson.features.length !== 8 || Object.values(STATE_NAME_BY_CODE).some(name => !states.includes(name))) {
        throw new Error("The boundary data does not contain all eight Australian states and territories.");
      }
      return geojson.features;
    })();
  }
  return stateBoundaryPromise;
}

// A secondary, optional geographic layer. If a network blocks the state dataset,
// the locally packaged country boundary and all seven markers still render.
async function addStateBoundariesWhenAvailable(specification) {
  try {
    const features = await loadStateBoundaries();
    specification.layer.splice(1, 0, {
      name: "australian-state-boundaries",
      data: {values: features},
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
  const states = [...new Set(events.map(event => event.State).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const allStates = ["All", ...states];
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

function showChartError(targetId, message) {
  const target = document.getElementById(targetId);
  target.replaceChildren(makeElement("p", "chart-error", message));
}

async function initializeStateCountMap() {
  try {
    const [events, features, specificationResponse] = await Promise.all([
      readEventData(), loadStateBoundaries(), fetch("charts/chart02_events_by_state.json")
    ]);
    if (!specificationResponse.ok) throw new Error("Cannot load the Chart 02 Vega-Lite specification.");
    const counts = Object.fromEntries(Object.keys(STATE_NAME_BY_CODE).map(code => [code, 0]));
    const nameToCode = Object.fromEntries(Object.entries(STATE_NAME_BY_CODE).map(([code, name]) => [name, code]));
    let assignedEventCount = 0;
    for (const event of events) {
      const stateCode = event.State?.trim();
      if (!stateCode) continue;
      if (!(stateCode in counts)) throw new Error(`Unrecognized event state: ${stateCode}`);
      counts[stateCode] += 1;
      assignedEventCount += 1;
    }

    const joinedFeatures = features.map(feature => {
      const stateName = feature.properties.STATE_NAME;
      const stateCode = nameToCode[stateName];
      if (!stateCode) throw new Error(`No event state code matches boundary ${stateName}.`);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          state_abbr: stateCode,
          event_count: counts[stateCode]
        }
      };
    });
    if (joinedFeatures.reduce((sum, feature) => sum + feature.properties.event_count, 0) !== assignedEventCount) {
      throw new Error("State counts do not reconcile with the state-assigned event rows.");
    }

    document.getElementById("chart02-insight").textContent =
      `New South Wales hosts ${counts.NSW} of the ${assignedEventCount} state-assigned national events.`;
    const specification = await specificationResponse.json();
    specification.data.values = joinedFeatures;
    await window.vegaEmbed("#chart2", specification, {actions: false});
  } catch (error) {
    console.error("Chart 02 could not be rendered:", error);
    showChartError("chart2", "The state count map could not load. Check the boundary source, data path, and browser console.");
  }
}

function prepareTimelineEvents(events) {
  return events.map(event => {
    const startMs = Date.parse(`${event.Start_Date}T00:00:00Z`);
    const endMs = Date.parse(`${event.End_Date}T00:00:00Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      throw new Error(`Invalid event date range for ${event.Event}.`);
    }
    return {
      ...event,
      State_label: event.State?.trim() || "Online / no state",
      Start_label: new Date(`${event.Start_Date}T12:00:00Z`).toLocaleDateString("en-AU", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
      }),
      End_label: new Date(`${event.End_Date}T12:00:00Z`).toLocaleDateString("en-AU", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
      }),
      Start_ms: startMs,
      End_ms: endMs,
      Bar_End_ms: endMs + DAY_MS,
      Duration_days: Math.floor((endMs - startMs) / DAY_MS) + 1
    };
  });
}

async function initializeEventTimeline() {
  try {
    const [events, specificationResponse] = await Promise.all([
      readEventData(), fetch("charts/chart03_event_timeline.json")
    ]);
    if (!specificationResponse.ok) throw new Error("Cannot load the Chart 03 Vega-Lite specification.");
    const specification = await specificationResponse.json();
    specification.data.values = prepareTimelineEvents(events);
    await window.vegaEmbed("#chart3", specification, {actions: false});
  } catch (error) {
    console.error("Chart 03 could not be rendered:", error);
    showChartError("chart3", "The event timeline could not load. Check the event data, chart path, and browser console.");
  }
}

const WAVE_DATA_CSV = "data/wave_january_2026_clean.csv";
const WAVE_STATIONS_JSON = "data/wave_station_locations.json";
const WAVE_PERIOD_START = "2026-01-01";
const WAVE_PERIOD_END = "2026-02-01";
const EXPECTED_WAVE_RECORDS_PER_SITE = 1488;

async function readWaveObservations() {
  const response = await fetch(WAVE_DATA_CSV);
  if (!response.ok) throw new Error(`Cannot load the wave observations (${response.status}).`);
  return window.vega.read(await response.text(), {type: "csv"});
}

function parseWaveMeasurement(value, allowZero) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) return null;
  return number;
}

function calculateWaveSummaries(observations, stations) {
  const stationNames = new Set(stations.map(station => station.Location));
  const sourceNames = new Set(observations.map(row => row.Location));
  if (stations.length !== 3 || stationNames.size !== 3 ||
      [...sourceNames].some(name => !stationNames.has(name)) ||
      [...stationNames].some(name => !sourceNames.has(name))) {
    throw new Error("The wave data and station references must contain the same three locations.");
  }

  const summaries = [];
  const distribution = [];
  const boxStats = [];
  for (const station of stations) {
    const rows = observations.filter(row => row.Location === station.Location &&
      row.Date >= WAVE_PERIOD_START && row.Date < WAVE_PERIOD_END);
    if (rows.length !== EXPECTED_WAVE_RECORDS_PER_SITE) {
      throw new Error(`${station.Location} has ${rows.length} January records; expected ${EXPECTED_WAVE_RECORDS_PER_SITE}.`);
    }

    const hsValues = [];
    const tpValues = [];
    for (const row of rows) {
      const hs = parseWaveMeasurement(row.Hs_m, true);
      const tp = parseWaveMeasurement(row.Tp_s, false);
      if (hs !== null) {
        hsValues.push(hs);
        distribution.push({...row, Hs_m: hs});
      }
      if (tp !== null) tpValues.push(tp);
    }
    if (!hsValues.length || !tpValues.length) {
      throw new Error(`${station.Location} has no valid January Hs or Tp observations.`);
    }

    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    summaries.push({
      ...station,
      Mean_Hs_m: mean(hsValues),
      Mean_Tp_s: mean(tpValues),
      Valid_Hs_records: hsValues.length,
      Valid_Tp_records: tpValues.length,
      Observation_period: "1–31 Jan 2026"
    });

    const sorted = hsValues.slice().sort((a, b) => a - b);
    const quantile = probability => {
      const position = (sorted.length - 1) * probability;
      const lower = Math.floor(position);
      const upper = Math.ceil(position);
      const fraction = position - lower;
      return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
    };
    const q1 = quantile(0.25);
    const median = quantile(0.5);
    const q3 = quantile(0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const withinWhiskers = sorted.filter(value => value >= lowerFence && value <= upperFence);
    boxStats.push({
      Location: station.Location,
      q1,
      median,
      q3,
      iqr,
      lowerWhisker: withinWhiskers[0],
      upperWhisker: withinWhiskers[withinWhiskers.length - 1],
      maximum: sorted[sorted.length - 1],
      outlierCount: sorted.length - withinWhiskers.length
    });
  }
  return {summaries, distribution, boxStats};
}

function renderWaveInsights(summaries, boxStats) {
  const format = (value, digits = 3) => value.toFixed(digits);
  const highestMean = summaries.reduce((best, row) => row.Mean_Hs_m > best.Mean_Hs_m ? row : best);
  document.getElementById("chart04-insight").textContent =
    `${highestMean.Location} recorded the highest January mean Hs (${format(highestMean.Mean_Hs_m)} m), compared with Gold Coast ${format(summaries[0].Mean_Hs_m)} m and Palm Beach ${format(summaries[1].Mean_Hs_m)} m.`;

  const highestMedian = boxStats.reduce((best, row) => row.median > best.median ? row : best);
  const widestSpread = boxStats.reduce((best, row) => row.iqr > best.iqr ? row : best);
  document.getElementById("chart05-insight").textContent = highestMedian.Location === widestSpread.Location
    ? `${highestMedian.Location} had the highest median wave height and widest interquartile range.`
    : `${highestMedian.Location} had the highest median wave height; ${widestSpread.Location} had the widest interquartile range.`;
}

async function initializeWaveCharts() {
  let summaries;
  let distribution;
  let boxStats;
  try {
    const [observations, stationsResponse] = await Promise.all([
      readWaveObservations(),
      fetch(WAVE_STATIONS_JSON)
    ]);
    if (!stationsResponse.ok) throw new Error("Cannot load the verified monitoring-site coordinates.");

    const stations = await stationsResponse.json();
    ({summaries, distribution, boxStats} = calculateWaveSummaries(observations, stations));
    if (distribution.length !== boxStats.reduce((sum, row) => sum +
        summaries.find(site => site.Location === row.Location).Valid_Hs_records, 0)) {
      throw new Error("The valid wave-height observations do not reconcile with the site summaries.");
    }
    renderWaveInsights(summaries, boxStats);
  } catch (error) {
    console.error("Wave chart data could not be prepared:", error);
    showChartError("chart4", "The regional wave map could not be prepared. Check the data paths and browser console.");
    showChartError("chart5", "The wave distribution chart could not be prepared. Check the data paths and browser console.");
    return;
  }

  const results = await Promise.allSettled([
    (async () => {
      const response = await fetch("charts/chart04_wave_sites.json", {cache: "no-store"});
      if (!response.ok) throw new Error("Cannot load the Chart 04 specification.");
      const chart04 = await response.json();
      if (!chart04.data || typeof chart04.data !== "object") {
        throw new Error("The Chart 04 specification has no shared top-level data source.");
      }
      // Data-less layers, including the site labels, inherit these values.
      chart04.data.values = summaries;
      await window.vegaEmbed("#chart4", chart04, {actions: false});
    })(),
    (async () => {
      const response = await fetch("charts/chart05_wave_distribution.json");
      if (!response.ok) throw new Error("Cannot load the Chart 05 specification.");
      const chart05 = await response.json();
      if (!chart05.data || typeof chart05.data !== "object") {
        throw new Error("The Chart 05 specification has no top-level data source.");
      }
      chart05.data.values = distribution;
      await window.vegaEmbed("#chart5", chart05, {actions: false});
    })()
  ]);
  if (results[0].status === "rejected") {
    console.error("Chart 04 could not be rendered:", results[0].reason);
    showChartError("chart4", "The regional wave map could not load. Check the land-boundary service, data path, and browser console.");
  }
  if (results[1].status === "rejected") {
    console.error("Chart 05 could not be rendered:", results[1].reason);
    showChartError("chart5", "The wave distribution chart could not load. Check the event data, chart path, and browser console.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initializeEventMap();
  initializeStateCountMap();
  initializeEventTimeline();
  initializeWaveCharts();
});
