import path from 'path';
import { fileURLToPath } from 'url';
import { renderers } from './src/renderers/index.js';
import { loadCSV } from './src/csv.js';
import { normalizeConfig } from './src/config.js';
import { resolveColumns } from './src/columns.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Uncharted - Eleventy CSS Charts Plugin
 * @param {Object} eleventyConfig - Eleventy configuration object
 * @param {Object} [options] - Plugin options
 * @param {string} [options.dataDir] - Data directory path relative to root (e.g., '_data/charts'). Defaults to Eleventy's dir.data config.
 * @param {boolean} [options.animate] - Enable animations globally (individual charts can override)
 * @param {string} [options.cssPath] - Output path for stylesheet (default: '/css/uncharted.css')
 * @param {boolean} [options.injectCss] - Automatically copy and inject CSS (default: true)
 * @param {boolean} [options.dataPassthrough] - Copy CSV files to public dataPath (default: false)
 * @param {string} [options.dataPath] - Public URL path for CSV files (default: '/data/')
 * @param {boolean|string} [options.downloadData] - Enable download links globally (individual charts can override)
 */
export default function(eleventyConfig, options = {}) {
  // Directory config from Eleventy (populated by eleventy.directories event)
  let eleventyDirs = null;

  // Listen for Eleventy's directory configuration
  eleventyConfig.on('eleventy.directories', (dirs) => {
    eleventyDirs = dirs;
  });

  // Helper to resolve data directory
  function getDataDir() {
    // Plugin option takes precedence if explicitly set
    if (options.dataDir) {
      return path.resolve(process.cwd(), options.dataDir);
    }
    // Use Eleventy's directory configuration (already includes full path)
    if (eleventyDirs?.data) {
      return path.resolve(process.cwd(), eleventyDirs.data);
    }
    // Fallback to default
    return path.resolve(process.cwd(), '_data');
  }

  const globalAnimate = options.animate ?? false;
  const cssPath = options.cssPath || '/css/uncharted.css';
  const injectCss = options.injectCss ?? true;
  const dataPassthrough = options.dataPassthrough ?? false;
  const dataPath = options.dataPath || '/data/';
  const globalDownloadData = options.downloadData ?? false;

  // Automatic CSS handling
  if (injectCss) {
    const cssSource = path.join(__dirname, 'css/uncharted.css');

    // Copy plugin's CSS to output (strip leading slash for passthrough)
    eleventyConfig.addPassthroughCopy({
      [cssSource]: cssPath.replace(/^\//, '')
    });

    // Inject stylesheet link into pages with charts
    eleventyConfig.addTransform('uncharted-css', function(content) {
      const outputPath = this.page.outputPath || '';
      if (!outputPath.endsWith('.html')) return content;

      const hasCharts = content.includes('class="chart ');
      const hasStylesheet = content.includes('uncharted.css');

      if (hasCharts && !hasStylesheet) {
        const link = `<link rel="stylesheet" href="${cssPath}">\n  `;

        // Try to inject before first <style> or <link> in <head>
        const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        if (headMatch) {
          const firstTagMatch = headMatch[1].match(/^([\s\S]*?)(<(?:style|link)\b)/i);
          if (firstTagMatch) {
            const insertPos = content.indexOf(headMatch[0]) +
                              headMatch[0].indexOf(headMatch[1]) +
                              firstTagMatch[1].length;
            return content.slice(0, insertPos) + link + content.slice(insertPos);
          }
        }

        // Fallback: after <head>
        return content.replace(/<head([^>]*)>/i, `<head$1>\n  ${link}`);
      }
      return content;
    });
  }

  // CSV data passthrough for download links
  // When dataDir is set explicitly, use it; otherwise use Eleventy's default _data
  if (dataPassthrough) {
    const dataDirForPassthrough = options.dataDir || '_data';
    const destPath = dataPath.replace(/^\//, '').replace(/\/$/, '');
    eleventyConfig.addPassthroughCopy({
      [dataDirForPassthrough]: destPath
    });
  }

  eleventyConfig.addShortcode('chart', function(chartId) {
    // Get resolved data directory (from Eleventy config or plugin options)
    const resolvedDataDir = getDataDir();

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

    // Render the chart (chart-specific settings override global)
    const animate = chartConfig.animate ?? globalAnimate;
    const downloadData = chartConfig.downloadData ?? globalDownloadData;

    // Calculate download URL if download is enabled and file is specified
    let downloadDataUrl = null;
    if (downloadData && chartConfig.file) {
      const normalizedDataPath = dataPath.endsWith('/') ? dataPath : dataPath + '/';
      downloadDataUrl = normalizedDataPath + chartConfig.file;
    }

    // Normalize configuration (handles deprecated keys, axis config)
    const normalizedConfig = normalizeConfig(chartConfig, chartId);

    // Resolve column mappings
    const columns = resolveColumns(normalizedConfig, data, chartType);

    return renderer({
      ...normalizedConfig,
      id: chartId,
      data,
      animate,
      downloadData,
      downloadDataUrl,
      _columns: columns
    });
  });
}
