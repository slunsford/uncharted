import path from 'path';
import { renderers } from './src/renderers/index.js';
import { loadCSV } from './src/csv.js';

/**
 * Uncharted - Eleventy CSS Charts Plugin
 * @param {Object} eleventyConfig - Eleventy configuration object
 * @param {Object} [options] - Plugin options
 * @param {string} [options.dataDir] - Data directory path (defaults to _data)
 * @param {boolean} [options.animate] - Enable animations globally (individual charts can override)
 */
export default function(eleventyConfig, options = {}) {
  const dataDir = options.dataDir || '_data';
  const globalAnimate = options.animate ?? false;

  eleventyConfig.addShortcode('chart', function(chartId) {
    // Resolve data directory relative to the current working directory
    const resolvedDataDir = path.resolve(process.cwd(), dataDir);

    // Look up chart config from page data or global data
    // In Eleventy 3.x, data is available directly on `this` context
    // 1. Page frontmatter charts.{id}
    // 2. Global data charts.{id} (from _data/charts.yaml or similar)
    const pageCharts = this.page?.charts;
    const globalCharts = this.charts || this.ctx?.charts;

    const chartConfig = pageCharts?.[chartId] || globalCharts?.[chartId];

    if (!chartConfig) {
      return `<!-- Chart "${chartId}" not found -->`;
    }

    // Validate chart type
    const chartType = chartConfig.type;
    if (!chartType) {
      return `<!-- Chart "${chartId}" has no type specified -->`;
    }

    const renderer = renderers[chartType];
    if (!renderer) {
      return `<!-- Unknown chart type "${chartType}" for chart "${chartId}" -->`;
    }

    // Load data from CSV file or use inline data
    let data = chartConfig.data;
    if (chartConfig.file && !data) {
      data = loadCSV(chartConfig.file, resolvedDataDir);
    }

    if (!data || data.length === 0) {
      return `<!-- Chart "${chartId}" has no data -->`;
    }

    // Render the chart (chart-specific animate overrides global setting)
    const animate = chartConfig.animate ?? globalAnimate;
    return renderer({
      ...chartConfig,
      data,
      animate
    });
  });
}
