/**
 * Chart Image Queue
 * Tracks charts that need PNG image generation during the build.
 */

/** @type {Map<string, ChartImageData>} */
const queue = new Map();

/**
 * @typedef {Object} ChartImageData
 * @property {string} id - Chart identifier
 * @property {string} html - Rendered chart HTML
 * @property {Object} config - Image configuration
 * @property {number} [config.width] - Image width in pixels
 * @property {number} [config.height] - Image height in pixels
 * @property {number} [config.scale] - Device scale factor (e.g., 2 for retina)
 * @property {string} [config.background] - Background color
 * @property {string} [config.filename] - Custom filename (without extension)
 * @property {string} outputPath - Output file path for the image
 */

/**
 * Add a chart to the image generation queue.
 * @param {string} id - Chart identifier
 * @param {ChartImageData} data - Chart data for image generation
 */
export function queueChart(id, data) {
  queue.set(id, data);
}

/**
 * Get all queued charts and clear the queue.
 * @returns {ChartImageData[]} Array of queued chart data
 */
export function getAndClearQueue() {
  const charts = Array.from(queue.values());
  queue.clear();
  return charts;
}

/**
 * Check if there are any charts queued for image generation.
 * @returns {boolean}
 */
export function hasQueuedCharts() {
  return queue.size > 0;
}

/**
 * Get the number of queued charts.
 * @returns {number}
 */
export function getQueueSize() {
  return queue.size;
}

/**
 * Clear the queue without returning charts.
 */
export function clearQueue() {
  queue.clear();
}
