// FIT3179 DV2 — Charts 01–03: interactive Vega-Lite v5 event views.
const EVENT_CSV = "data/surfing_australia_events_2026.csv";
const STATE_BOUNDARY_SOURCE = "data/australian-states.geojson";
const CHART02_STATE_BOUNDARY_SOURCE = "data/australian-states.geojson";
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
let chart02StateBoundaryPromise;

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
      const response = await fetch(STATE_BOUNDARY_SOURCE);
      if (!response.ok) throw new Error(`State boundary request failed (HTTP ${response.status}).`);
      const geojson = await response.json();
      if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
        throw new Error("Unexpected state boundary GeoJSON schema.");
      }
      const states = geojson.features.map(feature => feature.properties?.STATE_NAME);
      if (geojson.features.length !== 8 || Object.values(STATE_NAME_BY_CODE).some(name => !states.includes(name))) {
        throw new Error("The local state boundary data does not contain all eight Australian states and territories.");
      }
      return geojson.features;
    })();
  }
  return stateBoundaryPromise;
}

function loadChart02StateBoundaries() {
  if (!chart02StateBoundaryPromise) {
    chart02StateBoundaryPromise = (async () => {
      const response = await fetch(CHART02_STATE_BOUNDARY_SOURCE);
      if (!response.ok) throw new Error(`Chart 02 state boundary request failed (HTTP ${response.status}).`);
      const geojson = await response.json();
      if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
        throw new Error("Unexpected Chart 02 state boundary GeoJSON schema.");
      }
      const states = geojson.features.map(feature => feature.properties?.STATE_NAME);
      if (geojson.features.length !== 8 || Object.values(STATE_NAME_BY_CODE).some(name => !states.includes(name))) {
        throw new Error("Chart 02 boundary data does not contain all eight Australian states and territories.");
      }
      return geojson.features;
    })();
  }
  return chart02StateBoundaryPromise;
}

// A local state boundary layer adds geographic context to the national venue map.
async function addStateBoundariesWhenAvailable(specification, isInset = false) {
  try {
    const features = await loadStateBoundaries();
    specification.layer.splice(1, 0, {
      name: "australian-state-boundaries",
      data: {values: features},
      mark: {type: "geoshape", fill: "#E8DDC8", stroke: "#AAA69B", strokeWidth: isInset ? 0.45 : 0.65, clip: true, interactive: false}
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
    const button = makeElement("button", "state-pill", `${state === "All" ? "All States" : state} · ${counts[state]}`);
    button.type = "button";
    button.dataset.state = state;
    button.setAttribute("aria-pressed", String(state === "All"));
    button.addEventListener("click", () => onStateChange(state));
    filters.appendChild(button);
  }
}

function displayMapFailure(message) {
  const target = document.getElementById("chart1");
  target.replaceChildren(makeElement("p", "map-error", message));
}

async function initializeEventMap() {
  try {
    const [events, specificationResponse] = await Promise.all([
      readEventData(), fetch("charts/chart01_event_locations.json", {cache: "no-store"})
    ]);
    if (!specificationResponse.ok) throw new Error("Cannot load the Chart 01 Vega-Lite JSON.");
    const allEvents = events.filter(withValidCoordinates).sort((a, b) => a.Start_Date.localeCompare(b.Start_Date));
    if (!allEvents.length) throw new Error("No mappable event coordinates found.");

    const specification = await addStateBoundariesWhenAvailable(await specificationResponse.json());
    const {view} = await window.vegaEmbed("#chart1", specification, {actions: false, renderer: "svg"});
    const views = [view];
    try {
      const insetResponse = await fetch("charts/chart01_event_inset.json", {cache: "no-store"});
      if (!insetResponse.ok) throw new Error("Cannot load the Chart 01 detail specification.");
      const insetSpecification = await addStateBoundariesWhenAvailable(await insetResponse.json(), true);
      const inset = await window.vegaEmbed("#chart1-inset", insetSpecification, {actions: false, renderer: "svg"});
      views.push(inset.view);
    } catch (error) {
      console.error("Chart 01 detail map could not render:", error);
      showChartError("chart1-inset", "The coastal detail map could not load.");
    }
    // Recompute each projection's fitted viewport when its panel changes size.
    views.forEach((chartView, index) => {
      const target = document.getElementById(index === 0 ? "chart1" : "chart1-inset");
      let lastWidth = 0, lastHeight = 0;
      const observer = new ResizeObserver(entries => {
        const {width, height} = entries[0].contentRect;
        if (!width || !height || (width === lastWidth && height === lastHeight)) return;
        lastWidth = width; lastHeight = height;
        chartView.resize().runAsync().catch(error => console.error("Chart 01 resize failed:", error));
      });
      observer.observe(target);
    });
    let activeState = "All";
    let chosenEvent = "";
    // Vega-Lite top-level params compile to the named Vega signals below.
    const setSignal = async (name, value) => {
      try { await Promise.all(views.map(chartView => chartView.signal(name, value).runAsync())); }
      catch (error) { console.error(`Cannot update map control ${name}`, error); }
    };
    const updateSelection = async eventName => {
      chosenEvent = eventName;
      await setSignal("focus_event", eventName);
    };
    // Selecting a point updates both views without a separate event list.
    for (const chartView of views) {
      chartView.addEventListener("click", (_event, item) => {
        const name = item?.datum?.Event;
        if (name && allEvents.some(event => event.Event === name &&
            (activeState === "All" || event.State === activeState))) {
          updateSelection(chosenEvent === name ? "" : name);
        }
      });
    }
    const updateState = async state => {
      activeState = state;
      chosenEvent = "";
      await setSignal("focus_event", "");
      await setSignal("state_filter", state);
      document.querySelectorAll(".state-pill").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.state === state));
      });
      document.getElementById("event-filter-label").textContent = state === "All"
        ? "Explore mapped venues" : `Mapped venues in ${state}`;
    };
    addFilterButtons(allEvents, updateState);
  } catch (error) {
    console.error("Chart 01 could not be rendered:", error);
    displayMapFailure("The interactive map could not load. Check the browser console or data paths.");
  }
}

function showChartError(targetId, message) {
  const target = document.getElementById(targetId);
  target.replaceChildren(makeElement("p", "chart-error", message));
}

// Vega container widths can change when the editorial grid reflows.
function observeChartWidth(element, view, label) {
  if (typeof ResizeObserver === "undefined") return;
  let lastWidth = -1, timer;
  const observer = new ResizeObserver(entries => {
    const width = Math.round(entries[0].contentRect.width);
    if (width <= 0 || width === lastWidth) return;
    lastWidth = width;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      view.resize().runAsync().catch(error => console.error(label + " resize failed:", error));
    }, 100);
  });
  observer.observe(element);
}

async function initializeStateCountMap() {
  try {
    const [events, features, specificationResponse] = await Promise.all([
    readEventData(), loadChart02StateBoundaries(), fetch("charts/chart02_events_by_state.json", {cache: "no-store"})
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
      `New South Wales accounts for ${counts.NSW} of the ${assignedEventCount} state-assigned events in Surfing Australia's 2026 national calendar.`;
    const specification = await specificationResponse.json();
    specification.data.values = joinedFeatures;
    const {view} = await window.vegaEmbed("#chart2", specification, {actions: false, renderer: "svg"});
    observeChartWidth(document.getElementById("chart2"), view, "Chart 02");
    const barContainer = document.getElementById("chart02-bars");
    const ranked = Object.entries(counts).filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || STATE_NAME_BY_CODE[a[0]].localeCompare(STATE_NAME_BY_CODE[b[0]]));
    const highestCount = Math.max(...ranked.map(([, count]) => count));
    const colours = specification.encoding.color.scale.range;
    let selectedState = "";
    for (const [code, count] of ranked) {
      const button = makeElement("button", "chart02-bar-row");
      button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", STATE_NAME_BY_CODE[code] + ": " + count + (count === 1 ? " event" : " events") + ". Highlight on map.");
      const label = makeElement("span", "chart02-bar-label", STATE_NAME_BY_CODE[code]);
      const track = makeElement("span", "chart02-bar-track");
      track.setAttribute("aria-hidden", "true");
      const fill = makeElement("span", "chart02-bar-fill");
      fill.style.width = (count / highestCount * 100) + "%";
      fill.style.backgroundColor = colours[count];
      track.appendChild(fill);
      const value = makeElement("span", "chart02-bar-value", String(count));
      button.append(label, track, value);
      button.addEventListener("click", async () => {
        selectedState = selectedState === STATE_NAME_BY_CODE[code] ? "" : STATE_NAME_BY_CODE[code];
        for (const row of barContainer.children) row.setAttribute("aria-pressed", String(row === button && !!selectedState));
        try { await view.signal("selected_state", selectedState).runAsync(); }
        catch (error) { console.error("Could not highlight state on Chart 02:", error); }
      });
      barContainer.appendChild(button);
    }
    const zeroStates = Object.entries(counts).filter(([, count]) => count === 0).map(([code]) => code);
    document.getElementById("chart02-zero-note").textContent = zeroStates.join(", ") + ": no state-assigned events.";
  } catch (error) {
    console.error("Chart 02 could not be rendered:", error);
    showChartError("chart2", "The state count map could not load. Check the boundary source, data path, and browser console.");
  }
}

function wrapCalendarLabel(label, maxCharacters) {
  const lines = [""];
  for (const word of label.split(/\s+/)) {
    const line = lines[lines.length - 1];
    if (line && (line + " " + word).length > maxCharacters) lines.push(word);
    else lines[lines.length - 1] = line ? line + " " + word : word;
  }
  return lines.join("\n");
}

function prepareTimelineEvents(events) {
  return events.map(event => {
    const startMs = Date.parse(event.Start_Date + "T00:00:00Z");
    const endMs = Date.parse(event.End_Date + "T00:00:00Z");
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      throw new Error("Invalid event date range for " + event.Event + ".");
    }
    return {
      ...event,
      Delivery_label: event.Location.trim().toLowerCase() === "online" ? "Online event" : "In-person event",
      Venue_label: event.Location + (event.State?.trim() ? ", " + event.State.trim() : ""),
      Timeline_date: eventDateText(event), Start_ms: startMs, End_ms: endMs,
      Duration_days: (endMs - startMs) / DAY_MS + 1
    };
  });
}

// Each interval is clipped to actual month boundaries. End coordinates are exclusive.
function buildEventCalendar(events, width) {
  const prepared = prepareTimelineEvents(events).sort((a, b) => a.Start_ms - b.Start_ms);
  const months = [], segments = [];
  const maxCharacters = Math.max(14, Math.floor((width - 96) / 7.2));
  let top = 0;
  for (let month = 0; month < 12; month++) {
    const start = Date.UTC(2026, month, 1), next = Date.UTC(2026, month + 1, 1);
    const monthName = new Date(start).toLocaleDateString("en-AU", {month: "short", timeZone: "UTC"});
    const monthEvents = prepared.filter(event => event.Start_ms < next && event.End_ms >= start);
    const monthTop = top;
    if (!monthEvents.length) top += 46;
    for (const event of monthEvents) {
      const segmentStart = Math.max(start, event.Start_ms);
      const segmentEndExclusive = Math.min(next, event.End_ms + DAY_MS);
      const dayStart = new Date(segmentStart).getUTCDate();
      const dayEnd = new Date(segmentEndExclusive - DAY_MS).getUTCDate();
      const segmentDate = (dayStart === dayEnd ? String(dayStart) : dayStart + "–" + dayEnd) + " " + monthName;
      const continuation = event.Start_ms < start ? " (continued)" : event.End_ms >= next ? " (continues)" : "";
      const shortName = event.Event.replace(/^(?:Buildcare )?Australian /, "");
      const label = shortName + " · " + segmentDate + continuation;
      const wrapped = wrapCalendarLabel(label, maxCharacters);
      const lines = wrapped.split("\n").length;
      const barY = top + 8 + lines * 16 + 3;
      segments.push({...event, Month: monthName, SegmentDate: segmentDate,
        DayStart: dayStart, DayEndExclusive: dayEnd + 1,
        LabelY: top + 8, BarY: barY, WrappedLabel: wrapped});
      top += Math.max(52, lines * 16 + 30);
    }
    months.push({Month: monthName, Top: monthTop, Bottom: top, LabelY: monthTop + 8,
      IsEmpty: monthEvents.length === 0});
  }
  return {months, segments, height: top, eventCount: prepared.length};
}

async function initializeEventTimeline() {
  try {
    const [events, response] = await Promise.all([
      readEventData(), fetch("charts/chart03_event_timeline.json", {cache: "no-store"})
    ]);
    if (!response.ok) throw new Error("Cannot load the Chart 03 Vega specification.");
    const template = await response.json();
    const chartElement = document.getElementById("chart3");
    let currentWidth = 0, currentView;
    async function renderTimeline() {
      const width = Math.floor(chartElement.clientWidth) - 8;
      if (width <= 0 || width === currentWidth) return;
      currentWidth = width;
      const calendar = buildEventCalendar(events, width);
      if (calendar.eventCount !== events.length || !calendar.segments.length) throw new Error("The event calendar could not be constructed.");
      const chart = JSON.parse(JSON.stringify(template));
      chart.width = width; chart.height = calendar.height;
      chart.data.find(data => data.name === "months").values = calendar.months;
      chart.data.find(data => data.name === "segments").values = calendar.segments;
      if (currentView) currentView.finalize();
      currentView = (await window.vegaEmbed(chartElement, chart, {actions: false, renderer: "svg"})).view;
    }
    await renderTimeline();
    let resizeTimer;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { renderTimeline().catch(error => console.error("Chart 03 resize failed:", error)); }, 150);
    });
  } catch (error) {
    console.error("Chart 03 could not be rendered:", error);
    showChartError("chart3", "The monthly event calendar could not load. Check the event data and browser console.");
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
  const lowestMean = summaries.reduce((best, row) => row.Mean_Hs_m < best.Mean_Hs_m ? row : best);
  document.getElementById("chart04-insight").textContent =
    highestMean.Location + " averaged " + format(highestMean.Mean_Hs_m - lowestMean.Mean_Hs_m) +
    " m higher than " + lowestMean.Location + ".";

  const highestMedian = boxStats.reduce((best, row) => row.median > best.median ? row : best);
  const widestSpread = boxStats.reduce((best, row) => row.iqr > best.iqr ? row : best);
  document.getElementById("chart05-insight").textContent = highestMedian.Location === widestSpread.Location
    ? `${highestMedian.Location} had the highest median wave height and widest interquartile range.`
    : `${highestMedian.Location} had the highest median wave height; ${widestSpread.Location} had the widest interquartile range.`;
}

function setWaveSymbolLegend(maximumArea) {
  for (const circle of document.querySelectorAll("[data-hs-reference]")) {
    const value = Number(circle.dataset.hsReference);
    const diameter = Math.sqrt((value / 2) * maximumArea);
    circle.style.width = diameter.toFixed(1) + "px";
    circle.style.height = diameter.toFixed(1) + "px";
  }
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
    showChartError("chart4", "The regional wave map could not be prepared. Check the local basemap files and browser console.");
    showChartError("chart4-compare", "The wave-height comparison could not be prepared.");
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
      chart04.data.values = summaries;
      // Vega normally fetches layer URLs itself; explicitly bypass the browser
      // cache so an old land-polygon winding cannot survive a map update.
      const geographicRequests = new Map();
      await Promise.all(chart04.layer.map(async layer => {
        const source = layer.data;
        if (!source?.url) return;
        if (source.format?.type !== "json" || source.format?.property !== "features") {
          throw new Error("Unexpected Chart 04 geographic data format: " + source.url);
        }
        if (!geographicRequests.has(source.url)) {
          geographicRequests.set(source.url, fetch(source.url, {cache: "no-store"}).then(async response => {
            if (!response.ok) throw new Error("Cannot load Chart 04 geography: " + source.url);
            const collection = await response.json();
            if (!Array.isArray(collection.features)) throw new Error("Invalid geographic features: " + source.url);
            return collection.features;
          }));
        }
        layer.data = {values: await geographicRequests.get(source.url)};
      }));
      const mapElement = document.getElementById("chart4");
      const symbolLayer = chart04.layer?.find(layer => layer.encoding?.size?.scale);
      if (!symbolLayer?.encoding?.size?.scale) {
        throw new Error("The Chart 04 symbol layer has no area scale.");
      }
      const maximumArea = 600;
      symbolLayer.encoding.size.scale.range = [0, maximumArea];
      setWaveSymbolLegend(maximumArea);
      let lastWidth = Math.round(mapElement.clientWidth);
      let compact = lastWidth < 500;
      chart04.height = compact ? 300 : 400;
      const mapView = (await window.vegaEmbed(mapElement, chart04, {actions: false, renderer: "svg"})).view;
      // Resize the projection when the panel width changes, including within the same breakpoint.
      const resizeObserver = new ResizeObserver(entries => {
        const width = Math.round(entries[0].contentRect.width);
        if (width <= 0 || width === lastWidth) return;
        lastWidth = width;
        const nextCompact = width < 500;
        if (nextCompact !== compact) {
          compact = nextCompact;
          mapView.height(compact ? 300 : 400);
        }
        mapView.resize().runAsync().catch(error =>
          console.error("Chart 04 resize failed:", error));
      });
      resizeObserver.observe(mapElement);
    })(),
    (async () => {
      const response = await fetch("charts/chart04_wave_comparison.json", {cache: "no-store"});
      if (!response.ok) throw new Error("Cannot load the Chart 04 comparison specification.");
      const comparison = await response.json();
      if (!comparison.data || typeof comparison.data !== "object") {
        throw new Error("The Chart 04 comparison has no top-level data source.");
      }
      comparison.data.values = summaries;
      await window.vegaEmbed("#chart4-compare", comparison, {actions: false, renderer: "svg"});
    })(),
    (async () => {
      const response = await fetch("charts/chart05_wave_distribution.json");
      if (!response.ok) throw new Error("Cannot load the Chart 05 specification.");
      const chart05 = await response.json();
      if (!chart05.data || typeof chart05.data !== "object") {
        throw new Error("The Chart 05 specification has no top-level data source.");
      }
      chart05.data.values = distribution;
      await window.vegaEmbed("#chart5", chart05, {actions: false, renderer: "svg"});
    })()
  ]);
  if (results[0].status === "rejected") {
    console.error("Chart 04 could not be rendered:", results[0].reason);
    showChartError("chart4", "The regional map could not load. Check the local basemap files and browser console.");
  }
  if (results[1].status === "rejected") {
    console.error("Chart 04 comparison could not be rendered:", results[1].reason);
    showChartError("chart4-compare", "The aligned wave-height comparison could not load.");
  }
  if (results[2].status === "rejected") {
    console.error("Chart 05 could not be rendered:", results[2].reason);
    showChartError("chart5", "The wave distribution chart could not load. Check the event data, chart path, and browser console.");
  }
}

const WAVE_CHART_SITE_ORDER = ["Gold Coast", "Palm Beach", "Tweed Offshore"];
const WAVE_CHART_PANEL_IDS = {
  "Gold Coast": {direction: "chart06-gold", directionNote: "chart06-gold-note", calendar: "chart07-gold", pairs: "chart08-gold", pairsNote: "chart08-gold-note"},
  "Palm Beach": {direction: "chart06-palm", directionNote: "chart06-palm-note", calendar: "chart07-palm", pairs: "chart08-palm", pairsNote: "chart08-palm-note"},
  "Tweed Offshore": {direction: "chart06-tweed", directionNote: "chart06-tweed-note", calendar: "chart07-tweed", pairs: "chart08-tweed", pairsNote: "chart08-tweed-note"}
};
const WAVE_COMPASS_SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const WAVE_CHART_START = "2026-01-01";
const WAVE_CHART_END = "2026-02-01";
const WAVE_HS_BIN_WIDTH = 0.25;
const WAVE_TP_BIN_WIDTH = 2;

async function readWaveChartCsv(path, label) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Cannot load " + label + " (HTTP " + response.status + ").");
  return window.vega.read(await response.text(), {type: "csv"});
}

async function readWaveChartSpec(path, label) {
  const response = await fetch(path, {cache: "no-store"});
  if (!response.ok) throw new Error("Cannot load the " + label + " specification (HTTP " + response.status + ").");
  return response.json();
}

function cloneWaveChartSpecWithValues(template, values, label) {
  if (!template || typeof template !== "object" ||
      !template.data || typeof template.data !== "object" ||
      !Array.isArray(template.data.values)) {
    throw new Error(label + " must declare an explicit root-level data.values array.");
  }
  if (Array.isArray(template.layer) && template.layer.some(layer => layer.data)) {
    throw new Error(label + " layers must inherit the shared root-level data source.");
  }
  const specification = JSON.parse(JSON.stringify(template));
  if (!Array.isArray(specification.data.values)) {
    throw new Error(label + " root-level data.values could not be cloned.");
  }
  specification.data.values = values;
  return specification;
}

function displayWaveError(targetIds, message) {
  for (const targetId of targetIds) showChartError(targetId, message);
}

function verifyWaveChartSites(rows, label, expectedRowsPerSite = null) {
  const names = new Set(rows.map(row => row.Location));
  if (names.size !== WAVE_CHART_SITE_ORDER.length ||
      WAVE_CHART_SITE_ORDER.some(site => !names.has(site))) {
    throw new Error(label + " must contain exactly Gold Coast, Palm Beach and Tweed Offshore.");
  }
  if (expectedRowsPerSite !== null) {
    for (const site of WAVE_CHART_SITE_ORDER) {
      const count = rows.filter(row => row.Location === site).length;
      if (count !== expectedRowsPerSite) {
        throw new Error(site + " has " + count + " " + label + " rows; expected " + expectedRowsPerSite + ".");
      }
    }
  }
}

function buildWaveDirectionRows(observations) {
  verifyWaveChartSites(observations, "January wave-observation");
  for (const site of WAVE_CHART_SITE_ORDER) {
    const count = observations.filter(row => row.Location === site &&
      row.Date >= WAVE_CHART_START && row.Date < WAVE_CHART_END).length;
    if (count !== EXPECTED_WAVE_RECORDS_PER_SITE) {
      throw new Error(site + " has " + count + " January observations; expected " + EXPECTED_WAVE_RECORDS_PER_SITE + ".");
    }
  }

  const countsBySite = new Map(WAVE_CHART_SITE_ORDER.map(site => [site, Array(8).fill(0)]));
  const validBySite = new Map(WAVE_CHART_SITE_ORDER.map(site => [site, 0]));
  for (const row of observations) {
    if (!WAVE_CHART_SITE_ORDER.includes(row.Location) ||
        row.Date < WAVE_CHART_START || row.Date >= WAVE_CHART_END) continue;
    if (row.Peak_Direction_deg === null || row.Peak_Direction_deg === undefined ||
        String(row.Peak_Direction_deg).trim() === "") continue;
    const bearing = Number(row.Peak_Direction_deg);
    if (!Number.isFinite(bearing) || bearing < 0 || bearing > 360) continue;
    const normalized = ((bearing % 360) + 360) % 360;
    const sectorIndex = Math.floor((normalized + 22.5) / 45) % 8;
    countsBySite.get(row.Location)[sectorIndex] += 1;
    validBySite.set(row.Location, validBySite.get(row.Location) + 1);
  }

  const output = new Map();
  for (const site of WAVE_CHART_SITE_ORDER) {
    const counts = countsBySite.get(site);
    const validCount = validBySite.get(site);
    if (!validCount || counts.reduce((sum, count) => sum + count, 0) !== validCount) {
      throw new Error(site + " directional sector counts do not reconcile.");
    }
    const maximum = Math.max(...counts);
    const rows = WAVE_COMPASS_SECTORS.map((sector, index) => {
      const percentage = counts[index] / validCount * 100;
      return {
        Location: site,
        Sector: sector,
        SectorIndex: index,
        Count: counts[index],
        Percentage: percentage,
        PercentLabel: percentage.toFixed(1) + "%",
        ValidCount: validCount,
        IsDominant: counts[index] === maximum
      };
    });
    const leading = rows.filter(row => row.Count === maximum);
    output.set(site, {rows, validCount, leading, maximumPercentage: leading[0].Percentage});
  }
  return output;
}
async function initializeChart06WaveDirection() {
  const targetIds = WAVE_CHART_SITE_ORDER.map(site => WAVE_CHART_PANEL_IDS[site].direction);
  try {
    const [observations, template] = await Promise.all([
      readWaveChartCsv(WAVE_DATA_CSV, "the January wave observations"),
      readWaveChartSpec("charts/chart06_wave_rose.json", "Chart 06")
    ]);
    const perSite = buildWaveDirectionRows(observations);
    const maximumShare = Math.max(...WAVE_CHART_SITE_ORDER.map(site => perSite.get(site).maximumPercentage));
    if (maximumShare > 90) throw new Error("A direction share exceeds the shared 90% rose scale.");

    const embeds = WAVE_CHART_SITE_ORDER.map(async site => {
      const summary = perSite.get(site);
      const panel = WAVE_CHART_PANEL_IDS[site];
      const leaders = summary.leading.map(row => row.Sector).join(" / ");
      const leadPercent = summary.leading[0].Percentage.toFixed(1);
      document.getElementById(panel.directionNote).textContent =
        "n = " + summary.validCount.toLocaleString("en-AU") + " valid readings · " +
        leaders + " leads at " + leadPercent + "%";
      const container = document.getElementById(panel.direction);
      const specification = JSON.parse(JSON.stringify(template));
      const sectorData = specification.data.find(data => data.name === "sectors");
      if (!sectorData) throw new Error("Chart 06 has no sectors data source.");
      sectorData.values = summary.rows;
      const sizeForWidth = width => Math.max(1, Math.min(360, Math.floor(width)));
      let size = sizeForWidth(container.clientWidth);
      specification.width = size;
      specification.height = size;
      const {view} = await window.vegaEmbed(container, specification, {actions: false, renderer: "svg"});
      const observer = new ResizeObserver(entries => {
        const nextSize = sizeForWidth(entries[0].contentRect.width);
        if (nextSize === size) return;
        size = nextSize;
        view.width(size).height(size).resize().runAsync().catch(error =>
          console.error("Chart 06 resize failed:", error));
      });
      observer.observe(container);
    });
    const results = await Promise.allSettled(embeds);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const site = WAVE_CHART_SITE_ORDER[index];
        console.error("Chart 06 could not render for " + site + ":", result.reason);
        showChartError(WAVE_CHART_PANEL_IDS[site].direction, "The wave-direction chart could not load. Check the chart specification and browser console.");
      }
    });

  } catch (error) {
    console.error("Chart 06 wave-direction data could not be prepared:", error);
    displayWaveError(targetIds, "The January direction data or wave rose specification could not be loaded. Check the data path and browser console.");
  }
}
function buildWaveCalendarRows(dailyRows) {
  verifyWaveChartSites(dailyRows, "daily-summary");
  if (dailyRows.length !== 93) throw new Error("The daily summary must contain 93 rows for January 2026.");
  const perSite = new Map();
  const janFirst = new Date(WAVE_CHART_START + "T12:00:00Z");
  const mondayFirstOffset = (janFirst.getUTCDay() + 6) % 7;
  const gridCellCount = Math.ceil((mondayFirstOffset + 31) / 7) * 7;

  for (const site of WAVE_CHART_SITE_ORDER) {
    const siteRows = dailyRows.filter(row => row.Location === site &&
      row.Date >= WAVE_CHART_START && row.Date < WAVE_CHART_END);
    if (siteRows.length !== 31) {
      throw new Error(site + " has " + siteRows.length + " daily rows; expected 31.");
    }
    const byDay = new Map();
    for (const row of siteRows) {
      const date = new Date(row.Date + "T12:00:00Z");
      if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== 2026 ||
          date.getUTCMonth() !== 0) {
        throw new Error(site + " contains an invalid January date: " + row.Date);
      }
      const day = date.getUTCDate();
      if (byDay.has(day)) throw new Error(site + " contains duplicate daily summary for " + row.Date + ".");
      const validReadings = Number(row.Records_Valid_Hs);
      if (!Number.isInteger(validReadings) || validReadings < 0) {
        throw new Error(site + " has an invalid valid-Hs count for " + row.Date + ".");
      }
      const meanHs = parseWaveMeasurement(row.Mean_Hs_m, true);
      if ((validReadings > 0 && meanHs === null) || (validReadings === 0 && meanHs !== null)) {
        throw new Error(site + " has inconsistent Hs data and valid-reading count for " + row.Date + ".");
      }
      const hasData = validReadings > 0 && meanHs !== null;
      const summary = {
        Location: site,
        Date: row.Date,
        DateDisplay: String(day).padStart(2, "0") + " Jan 2026",
        DayNumber: day,
        Mean_Hs_m: hasData ? meanHs : null,
        HsDisplay: hasData ? meanHs.toFixed(2) + " m" : "No data",
        ValidReadings: validReadings,
        HasData: hasData
      };
      byDay.set(day, summary);
    }
    if (byDay.size !== 31 || Array.from({length: 31}, (_, i) => i + 1).some(day => !byDay.has(day))) {
      throw new Error(site + " is missing one or more January calendar dates.");
    }

    const cells = [];
    for (let cell = 0; cell < gridCellCount; cell += 1) {
      const week = Math.floor(cell / 7);
      const weekday = cell % 7;
      const day = cell - mondayFirstOffset + 1;
      if (day < 1 || day > 31) {
        cells.push({
          RowType: "outside",
          Location: site,
          InMonth: false,
          HasData: false,
          X0: weekday,
          X1: weekday + 1,
          XCenter: weekday + 0.5,
          Y0: week,
          Y1: week + 1,
          YCenter: week + 0.5,
          DayLabel: "",
          NoDataLabel: "",
          Mean_Hs_m: null
        });
        continue;
      }
      const summary = byDay.get(day);
      const rowType = summary.HasData ? "day" : "no-data";
      cells.push({
        ...summary,
        RowType: rowType,
        InMonth: true,
        X0: weekday,
        X1: weekday + 1,
        XCenter: weekday + 0.5,
        Y0: week,
        Y1: week + 1,
        YCenter: week + 0.5,
        DayLabel: String(day),
        NoDataLabel: summary.HasData ? "" : "No data"
      });
    }
    if (cells.filter(cell => cell.RowType === "no-data").length !== 1 ||
        cells.find(cell => cell.Date === "2026-01-18")?.RowType !== "no-data") {
      throw new Error(site + " must show 18 January as the one no-data calendar cell.");
    }
    perSite.set(site, {cells, summaries: Array.from(byDay.values())});
  }
  return perSite;
}

async function initializeChart07WaveCalendar() {
  const targetIds = WAVE_CHART_SITE_ORDER.map(site => WAVE_CHART_PANEL_IDS[site].calendar);
  try {
    const [dailyRows, template] = await Promise.all([
      readWaveChartCsv("data/wave_january_2026_daily_summary.csv", "the daily wave-height summaries"),
      readWaveChartSpec("charts/chart07_wave_calendar.json", "Chart 07")
    ]);
    const perSite = buildWaveCalendarRows(dailyRows);
    const results = await Promise.allSettled(WAVE_CHART_SITE_ORDER.map(async site => {
      const specification = cloneWaveChartSpecWithValues(template, perSite.get(site).cells, "Chart 07");
      await window.vegaEmbed("#" + WAVE_CHART_PANEL_IDS[site].calendar, specification, {actions: false});
    }));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const site = WAVE_CHART_SITE_ORDER[index];
        console.error("Chart 07 could not render for " + site + ":", result.reason);
        showChartError(WAVE_CHART_PANEL_IDS[site].calendar, "The January calendar could not load for this site. Check the chart specification and browser console.");
      }
    });

    const perSiteStats = WAVE_CHART_SITE_ORDER.map(site => {
      const validDays = perSite.get(site).summaries.filter(row => row.HasData);
      const high = validDays.reduce((best, row) => row.Mean_Hs_m > best.Mean_Hs_m ? row : best);
      const low = validDays.reduce((best, row) => row.Mean_Hs_m < best.Mean_Hs_m ? row : best);
      return {site, high, low};
    });
    const overallLow = Math.min(...perSiteStats.map(row => row.low.Mean_Hs_m));
    const overallHighLow = Math.max(...perSiteStats.map(row => row.low.Mean_Hs_m));
    const commonPeak = perSiteStats.every(row => row.high.Date === perSiteStats[0].high.Date);
    const highestPeak = perSiteStats.reduce((best, row) =>
      row.high.Mean_Hs_m > best.high.Mean_Hs_m ? row : best);
    const lowerDates = Array.from(new Set(perSiteStats.map(row => Number(row.low.Date.slice(-2))))).sort((a, b) => a - b);
    const lowDateText = lowerDates.length === 1
      ? String(lowerDates[0]) + " Jan"
      : lowerDates[0] + "–" + lowerDates[lowerDates.length - 1] + " Jan";
    const peakDate = Number(perSiteStats[0].high.Date.slice(-2));
    document.getElementById("chart07-insight").textContent =
      "Daily means were lowest on " + lowDateText + " (" + overallLow.toFixed(2) + "–" +
      overallHighLow.toFixed(2) + " m); " +
      (commonPeak ? "all three peaked on " + peakDate + " Jan" : "their highest days varied") +
      ", with " + highestPeak.site + " reaching " + highestPeak.high.Mean_Hs_m.toFixed(2) + " m.";
  } catch (error) {
    console.error("Chart 07 daily wave data could not be prepared:", error);
    displayWaveError(targetIds, "The January daily summaries or calendar specification could not be loaded. Check the data path and browser console.");
  }
}

function buildWaveHeightPeriodBins(observations) {
  verifyWaveChartSites(observations, "January wave-observation");
  for (const site of WAVE_CHART_SITE_ORDER) {
    const count = observations.filter(row => row.Location === site &&
      row.Date >= WAVE_CHART_START && row.Date < WAVE_CHART_END).length;
    if (count !== EXPECTED_WAVE_RECORDS_PER_SITE) {
      throw new Error(site + " has " + count + " January observations; expected " + EXPECTED_WAVE_RECORDS_PER_SITE + ".");
    }
  }
  const binsBySite = new Map(WAVE_CHART_SITE_ORDER.map(site => [site, new Map()]));
  const pairCountBySite = new Map(WAVE_CHART_SITE_ORDER.map(site => [site, 0]));
  const hsDomainMax = 3.5;
  const tpDomainMax = 20;

  for (const row of observations) {
    if (!WAVE_CHART_SITE_ORDER.includes(row.Location) ||
        row.Date < WAVE_CHART_START || row.Date >= WAVE_CHART_END) continue;
    const hs = parseWaveMeasurement(row.Hs_m, true);
    const tp = parseWaveMeasurement(row.Tp_s, false);
    if (hs === null || tp === null) continue;
    if (hs > hsDomainMax || tp > tpDomainMax) {
      throw new Error("A valid Hs–Tp pair falls outside the common January chart domain.");
    }
    const hsIndex = Math.min(Math.floor(hs / WAVE_HS_BIN_WIDTH), hsDomainMax / WAVE_HS_BIN_WIDTH - 1);
    const tpIndex = Math.min(Math.floor(tp / WAVE_TP_BIN_WIDTH), tpDomainMax / WAVE_TP_BIN_WIDTH - 1);
    const key = hsIndex + ":" + tpIndex;
    const siteBins = binsBySite.get(row.Location);
    siteBins.set(key, (siteBins.get(key) || 0) + 1);
    pairCountBySite.set(row.Location, pairCountBySite.get(row.Location) + 1);
  }

  const perSite = new Map();
  let commonMaxCount = 0;
  let totalPairs = 0;
  for (const site of WAVE_CHART_SITE_ORDER) {
    const binMap = binsBySite.get(site);
    const pairCount = pairCountBySite.get(site);
    const bins = [];
    for (const [key, count] of binMap) {
      const [hsIndexText, tpIndexText] = key.split(":");
      const hsIndex = Number(hsIndexText);
      const tpIndex = Number(tpIndexText);
      const hsStart = Number((hsIndex * WAVE_HS_BIN_WIDTH).toFixed(2));
      const hsEnd = Number((hsStart + WAVE_HS_BIN_WIDTH).toFixed(2));
      const tpStart = tpIndex * WAVE_TP_BIN_WIDTH;
      const tpEnd = tpStart + WAVE_TP_BIN_WIDTH;
      const bin = {
        Location: site,
        HsStart: hsStart,
        HsEnd: hsEnd,
        TpStart: tpStart,
        TpEnd: tpEnd,
        HsRange: hsStart.toFixed(2) + "–" + hsEnd.toFixed(2) + " m",
        TpRange: tpStart + "–" + tpEnd + " s",
        Count: count
      };
      bins.push(bin);
      if (count > commonMaxCount) commonMaxCount = count;
    }
    const countedPairs = bins.reduce((sum, bin) => sum + bin.Count, 0);
    if (!pairCount || countedPairs !== pairCount) {
      throw new Error(site + " paired Hs–Tp bin counts do not reconcile.");
    }
    bins.sort((a, b) => a.HsStart - b.HsStart || a.TpStart - b.TpStart);
    const mode = bins.reduce((best, bin) => !best || bin.Count > best.Count ? bin : best, null);
    perSite.set(site, {bins, pairCount, mode});
    totalPairs += pairCount;
  }
  return {perSite, commonMaxCount, totalPairs};
}

async function initializeChart08HeightPeriod() {
  const targetIds = WAVE_CHART_SITE_ORDER.map(site => WAVE_CHART_PANEL_IDS[site].pairs);
  try {
    const [observations, template] = await Promise.all([
      readWaveChartCsv(WAVE_DATA_CSV, "the January wave observations"),
      readWaveChartSpec("charts/chart08_height_period_heatmap.json", "Chart 08")
    ]);
    const {perSite, commonMaxCount} = buildWaveHeightPeriodBins(observations);
    if (!template.encoding || !template.encoding.color || !template.encoding.color.scale) {
      throw new Error("Chart 08 must define a shared quantitative color scale in its top-level encoding.");
    }
    // Match the five colour stops in the shared legend to the data-derived maximum.
    template.encoding.color.scale.domain = [0, 0.25, 0.5, 0.75, 1].map(fraction => fraction * commonMaxCount);
    document.getElementById("chart08-count-max").textContent = commonMaxCount.toLocaleString("en-AU");

    const results = await Promise.allSettled(WAVE_CHART_SITE_ORDER.map(async site => {
      const summary = perSite.get(site);
      const panel = WAVE_CHART_PANEL_IDS[site];
      document.getElementById(panel.pairsNote).textContent =
        summary.pairCount.toLocaleString("en-AU") + " paired readings · most frequent: Hs " +
        summary.mode.HsRange + " with Tp " + summary.mode.TpRange + " (" +
        summary.mode.Count.toLocaleString("en-AU") + ")";
      const specification = cloneWaveChartSpecWithValues(template, summary.bins, "Chart 08");
      await window.vegaEmbed("#" + panel.pairs, specification, {actions: false});
    }));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const site = WAVE_CHART_SITE_ORDER[index];
        console.error("Chart 08 could not render for " + site + ":", result.reason);
        showChartError(WAVE_CHART_PANEL_IDS[site].pairs, "The Hs–Tp heatmap could not load for this site. Check the chart specification and browser console.");
      }
    });

  } catch (error) {
    console.error("Chart 08 paired wave data could not be prepared:", error);
    displayWaveError(targetIds, "The January paired Hs–Tp data or heatmap specification could not be loaded. Check the data path and browser console.");
  }
}

const AUSPLAY_PARTICIPATION_CSV = "data/ausplay_surfing_2025_clean.csv";
const AUSPLAY_AGE_ORDER = ["15-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
let ausplayParticipationRowsPromise;

async function readAusplayParticipationRows() {
  if (!ausplayParticipationRowsPromise) {
    ausplayParticipationRowsPromise = (async () => {
      const response = await fetch(AUSPLAY_PARTICIPATION_CSV);
      if (!response.ok) throw new Error("Cannot load AusPlay participation data (HTTP " + response.status + ").");
      return window.vega.read(await response.text(), {type: "csv"}).map(row => ({
        Table_Number: Number(row.Table_Number),
        Population: String(row.Population).trim(),
        Breakdown_Type: String(row.Breakdown_Type).trim(),
        Category: String(row.Category).trim(),
        Year: Number(row.Year),
        Measure: String(row.Measure).trim(),
        Value: Number(row.Value),
        Value_Percent: row.Value_Percent === "" || row.Value_Percent == null ? null : Number(row.Value_Percent)
      }));
    })();
  }
  return ausplayParticipationRowsPromise;
}

function requireParticipationRows(rows, expectedCount, label) {
  if (rows.length !== expectedCount) {
    throw new Error(label + " matched " + rows.length + " rows; expected " + expectedCount + ".");
  }
  return rows;
}

function formatAusplayPeople(value) {
  return Math.round(value).toLocaleString("en-AU");
}

async function loadParticipationChart(targetId, specificationPath, label, makeValues) {
  const [rows, template] = await Promise.all([
    readAusplayParticipationRows(),
    readWaveChartSpec(specificationPath, label)
  ]);
  const values = makeValues(rows);
  const specification = cloneWaveChartSpecWithValues(template, values, label);
  const {view} = await window.vegaEmbed("#" + targetId, specification, {actions: false});
  if (targetId === "chart11" || targetId === "chart12") {
    observeChartWidth(document.getElementById(targetId), view, label);
  }
  return values;
}

async function initializeChart09AgeParticipation() {
  try {
    const values = await loadParticipationChart("chart9", "charts/chart09_age_participation.json", "Chart 09", rows => {
      const ageRows = rows.filter(row => row.Table_Number === 1 && row.Population === "Adults" &&
        row.Breakdown_Type === "Demographic" && row.Year === 2025 && row.Measure === "Participation rate" &&
        AUSPLAY_AGE_ORDER.includes(row.Category));
      requireParticipationRows(ageRows, AUSPLAY_AGE_ORDER.length, "Chart 09 age-group filter");
      const ordered = [...ageRows].sort((a, b) => AUSPLAY_AGE_ORDER.indexOf(a.Category) - AUSPLAY_AGE_ORDER.indexOf(b.Category));
      return ordered.map(row => {
        if (!Number.isFinite(row.Value_Percent)) throw new Error("Chart 09 contains a missing percentage value.");
        return {
          Age: row.Category,
          AgeOrder: AUSPLAY_AGE_ORDER.indexOf(row.Category),
          RatePercent: row.Value_Percent,
          RateLabel: row.Value_Percent.toFixed(2) + "%",
          Highlight: row.Category === "15-17" ? "Highest" : row.Category === "65+" ? "Lowest" : "Other age groups"
        };
      });
    });
    const highest = values.reduce((best, row) => row.RatePercent > best.RatePercent ? row : best);
    const lowest = values.reduce((best, row) => row.RatePercent < best.RatePercent ? row : best);
    document.getElementById("chart09-insight").textContent =
      highest.Age + " had the highest listed rate (" + highest.RatePercent.toFixed(2) + "%), while " +
      lowest.Age + " had the lowest (" + lowest.RatePercent.toFixed(2) + "%).";
  } catch (error) {
    console.error("Chart 09 age participation could not be rendered:", error);
    showChartError("chart9", "The AusPlay age-group rates or Chart 09 specification could not be loaded. Check the data path and browser console.");
  }
}

async function initializeChart10GenderButterfly() {
  try {
    const values = await loadParticipationChart("chart10", "charts/chart10_gender_butterfly.json", "Chart 10", rows => {
      const selected = rows.filter(row =>
        ((row.Table_Number === 1 && row.Population === "Adults") || (row.Table_Number === 2 && row.Population === "Children")) &&
        row.Breakdown_Type === "Demographic" && row.Year === 2025 && row.Measure === "Participation rate" &&
        (row.Category === "Male" || row.Category === "Female"));
      requireParticipationRows(selected, 4, "Chart 10 sex and population filter");
      const seen = new Set();
      return selected.map(row => {
        if (!Number.isFinite(row.Value_Percent)) throw new Error("Chart 10 contains a missing percentage value.");
        const key = row.Population + "|" + row.Category;
        if (seen.has(key)) throw new Error("Chart 10 contains a duplicate population and sex row.");
        seen.add(key);
        return {
          PopulationLabel: row.Population,
          Sex: row.Category,
          RatePercent: row.Value_Percent,
          ZeroRate: 0,
          PlotRate: row.Category === "Female" ? -row.Value_Percent : row.Value_Percent,
          RateLabel: row.Value_Percent.toFixed(2) + "%"
        };
      });
    });
    const rate = (population, sex) => values.find(row =>
      row.PopulationLabel === population && row.Sex === sex).RatePercent;
    document.getElementById("chart10-insight").textContent =
      "Male rates were higher in both groups: " + rate("Adults", "Male").toFixed(2) +
      "% versus " + rate("Adults", "Female").toFixed(2) +
      "% for Adults, and " + rate("Children", "Male").toFixed(2) +
      "% versus " + rate("Children", "Female").toFixed(2) + "% for Children.";
  } catch (error) {
    console.error("Chart 10 gender comparison could not be rendered:", error);
    showChartError("chart10", "The AusPlay sex-specific rates or Chart 10 specification could not be loaded. Check the data path and browser console.");
  }
}

async function initializeChart11ParticipationSlope() {
  try {
    const values = await loadParticipationChart("chart11", "charts/chart11_participation_slope.json", "Chart 11", rows => {
      const selected = rows.filter(row =>
        ((row.Table_Number === 6 && row.Population === "Adults") || (row.Table_Number === 7 && row.Population === "Children")) &&
        row.Breakdown_Type === "Year-on-year" && row.Category === "Total" &&
        row.Measure === "Estimated number of participants" && (row.Year === 2024 || row.Year === 2025));
      requireParticipationRows(selected, 4, "Chart 11 year-on-year filter");
      const byPopulation = new Map();
      for (const row of selected) {
        if (!Number.isFinite(row.Value)) throw new Error("Chart 11 contains a missing participant estimate.");
        if (!byPopulation.has(row.Population)) byPopulation.set(row.Population, new Map());
        const years = byPopulation.get(row.Population);
        if (years.has(row.Year)) throw new Error("Chart 11 contains a duplicate population and year row.");
        years.set(row.Year, row.Value);
      }
      if (byPopulation.size !== 2 || [...byPopulation.values()].some(years => years.size !== 2 || !years.has(2024) || !years.has(2025))) {
        throw new Error("Chart 11 must include 2024 and 2025 estimates for Adults and Children.");
      }
      return selected.map(row => {
        const years = byPopulation.get(row.Population);
        const baseline = years.get(2024);
        const index = years.get(row.Year) / baseline * 100;
        const changePercent = (years.get(2025) / baseline - 1) * 100;
        return {
          Population: row.Population,
          Year: row.Year,
          Participants: row.Value,
          Index: index,
          ChangePercent: changePercent,
          EndpointLabel: row.Population + " " + (changePercent >= 0 ? "+" : "−") + Math.abs(changePercent).toFixed(2) + "%"
        };
      });
    });
    const adults = values.find(row => row.Population === "Adults" && row.Year === 2025).ChangePercent;
    const children = values.find(row => row.Population === "Children" && row.Year === 2025).ChangePercent;
    const change = value => (value >= 0 ? "increased" : "decreased") + " by " + Math.abs(value).toFixed(2) + "%";
    document.getElementById("chart11-insight").textContent =
      "Adult estimates " + change(adults) + "; child estimates " + change(children) + ".";
  } catch (error) {
    console.error("Chart 11 participation change could not be rendered:", error);
    showChartError("chart11", "The AusPlay year-on-year estimates or Chart 11 specification could not be loaded. Check the data path and browser console.");
  }
}

async function initializeChart12OrganisedWaffle() {
  try {
    const values = await loadParticipationChart("chart12", "charts/chart12_organised_waffle.json", "Chart 12", rows => {
      const totalRows = rows.filter(row => row.Table_Number === 1 && row.Population === "Adults" &&
        row.Breakdown_Type === "Demographic" && row.Category === "Total" && row.Year === 2025 &&
        row.Measure === "Estimated number of participants");
      const organisedRows = rows.filter(row => row.Table_Number === 3 && row.Population === "Adults" &&
        row.Breakdown_Type === "Organised participation" && row.Category === "Total" && row.Year === 2025 &&
        row.Measure === "Estimated number of participants");
      requireParticipationRows(totalRows, 1, "Chart 12 total adult estimate filter");
      requireParticipationRows(organisedRows, 1, "Chart 12 organised adult estimate filter");
      const total = totalRows[0].Value;
      const organised = organisedRows[0].Value;
      if (!Number.isFinite(total) || !Number.isFinite(organised) || total <= 0 || organised < 0 || organised > total) {
        throw new Error("Chart 12 participant estimates do not form a valid part-to-whole comparison.");
      }
      const sharePercent = organised / total * 100;
      const organisedCells = Math.round(sharePercent);
      return Array.from({length: 100}, (_, index) => {
        const cell = index + 1;
        const isOrganised = cell <= organisedCells;
        return {
          Cell: cell,
          Column: (cell - 1) % 10 + 1,
          Row: 10 - Math.floor((cell - 1) / 10),
          ParticipationGroup: isOrganised ? "Organised" : "Remainder",
          CellShareApprox: 1,
          GroupParticipants: isOrganised ? organised : total - organised,
          TotalParticipants: total,
          OrganisedSharePercent: sharePercent
        };
      }).map(cell => Object.assign(cell, {
        TotalParticipants: total,
        OrganisedParticipants: organised,
        OrganisedSharePercent: sharePercent
      }));
    });
    const total = values[0].TotalParticipants;
    const organised = values[0].OrganisedParticipants;
    const sharePercent = values[0].OrganisedSharePercent;
    document.getElementById("chart12-share").textContent = "≈" + sharePercent.toFixed(1) + "%";
    document.getElementById("chart12-counts").textContent =
      "Estimated participants: " + formatAusplayPeople(organised) + " organised out of " + formatAusplayPeople(total) + " adults.";
  } catch (error) {
    console.error("Chart 12 organised participation could not be rendered:", error);
    showChartError("chart12", "The AusPlay total or organised adult estimates or Chart 12 specification could not be loaded. Check the data path and browser console.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initializeEventMap();
  initializeStateCountMap();
  initializeEventTimeline();
  initializeWaveCharts();
  initializeChart06WaveDirection();
  initializeChart07WaveCalendar();
  initializeChart08HeightPeriod();
  initializeChart09AgeParticipation();
  initializeChart10GenderButterfly();
  initializeChart11ParticipationSlope();
  initializeChart12OrganisedWaffle();
});
