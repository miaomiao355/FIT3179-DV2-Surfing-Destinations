// Reusable helper for embedding a Vega-Lite specification in a page element.
// Pass a CSS selector or an element, a Vega-Lite JSON specification, and
// optional Vega-Embed settings. Specifications are supplied by callers.
async function embedVegaLite(target, specification, options = {}) {
  const container = typeof target === "string"
    ? document.querySelector(target)
    : target;

  if (!container) {
    throw new Error(`Could not find a chart container for: ${target}`);
  }

  return window.vegaEmbed(container, specification, {
    actions: false,
    ...options
  });
}

// Load a chart specification from charts/ and pass it to the shared helper.
// The named point layer reads its accent from the site's CSS color variable.
async function loadVegaLiteChart(specificationUrl, target, options = {}) {
  const response = await fetch(specificationUrl);
  if (!response.ok) {
    throw new Error(`Could not load chart specification: ${specificationUrl}`);
  }

  const specification = await response.json();
  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-accent")
    .trim();
  const eventLayer = specification.layer?.find(
    (layer) => layer.name === "event-locations"
  );

  if (accentColor && eventLayer?.mark) {
    eventLayer.mark.color = accentColor;
  }

  return embedVegaLite(target, specification, options);
}

// Chart 1 only. The remaining chart placeholders stay untouched.
document.addEventListener("DOMContentLoaded", () => {
  loadVegaLiteChart("charts/chart01_event_locations.json", "#chart1")
    .catch((error) => console.error("Chart 1 could not be rendered:", error));
});
