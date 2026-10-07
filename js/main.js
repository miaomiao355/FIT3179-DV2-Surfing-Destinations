// Reusable helper for embedding a Vega-Lite specification in a page element.
// Pass a CSS selector or an element, a Vega-Lite JSON specification, and
// optional Vega-Embed settings. No specifications are embedded at this stage.
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
