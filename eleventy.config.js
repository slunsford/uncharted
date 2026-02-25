import path from 'path';
import { fileURLToPath } from 'url';
import { renderers } from './src/renderers/index.js';
import { loadCSV } from './src/csv.js';
import { normalizeConfig } from './src/config.js';
import { resolveColumns } from './src/columns.js';
import { validateChartType, checkDeprecatedOptions } from './src/deprecation.js';
import {
  normalizeImageOptions,
  queueChartForImage,
  processQueue,
  getImageUrl,
  getStoredImageUrl,
  shouldSkipInDevMode,
  clearImageUrls
} from './src/image/index.js';

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
 * @param {Object} [options.image] - Image generation options
 * @param {boolean} [options.image.enabled=false] - Enable PNG image generation
 * @param {string} [options.image.outputDir='/images/charts/'] - Output directory for images
 * @param {number} [options.image.width=800] - Default image width in pixels
 * @param {number} [options.image.height=400] - Default image height in pixels
 * @param {number} [options.image.scale=2] - Device scale factor (2 for retina)
 * @param {string} [options.image.background='#ffffff'] - Default background color
 * @param {boolean} [options.image.skipDev=true] - Skip image generation during --serve/--watch
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

  // Image generation options
  const imageOptions = normalizeImageOptions(options.image);
  const skipImageGeneration = shouldSkipInDevMode(imageOptions);

  // Clear image URLs at start of each build
  clearImageUrls();

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

    // Check for deprecated chart type (ERROR - prevents rendering)
    const typeError = validateChartType(chartType, chartId);
    if (typeError) {
      console.error(`[uncharted] ${typeError}`);
      return `<!-- ${typeError} -->`;
    }

    const renderer = renderers[chartType];
    if (!renderer) {
      return `<!-- Unknown chart type "${chartType}" for chart "${chartId}" -->`;
    }

    // Check for deprecated config options (WARNING - chart renders but option ignored)
    checkDeprecatedOptions(chartConfig, chartId);

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

    // Render the chart HTML
    let chartHtml = renderer({
      ...normalizedConfig,
      id: chartId,
      data,
      animate,
      downloadData,
      downloadDataUrl,
      _columns: columns
    });

    // Add aria-label for accessibility
    const altText = chartConfig.alt || chartConfig.title || chartId;
    chartHtml = chartHtml.replace(
      /^<figure([^>]*class="chart[^"]*")/,
      `<figure aria-label="${altText}"$1`
    );

    // Handle image generation
    const chartImageEnabled = chartConfig.image?.enabled ?? imageOptions.enabled;
    if (chartImageEnabled && !skipImageGeneration && eleventyDirs?.output) {
      // Queue chart for image generation
      queueChartForImage(chartId, chartHtml, chartConfig, imageOptions, eleventyDirs.output);

      // Add data-chart-image and data-chart-alt attributes to the figure element
      const imageUrl = getImageUrl(chartId, chartConfig, imageOptions);
      chartHtml = chartHtml.replace(
        /^<figure([^>]*aria-label="[^"]*"[^>]*class="chart[^"]*")/,
        `<figure$1 data-chart-image="${imageUrl}" data-chart-alt="${altText}"`
      );
    }

    return chartHtml;
  });

  // Shortcode to get chart image URL
  eleventyConfig.addShortcode('chartImageUrl', function(chartId) {
    // First check if we have a stored URL from queueing
    const storedUrl = getStoredImageUrl(chartId);
    if (storedUrl) return storedUrl;

    // Otherwise, look up chart config and compute URL
    const pageCharts = this.page?.charts;
    const globalCharts = this.charts || this.ctx?.charts;
    const chartConfig = pageCharts?.[chartId] || globalCharts?.[chartId];

    if (!chartConfig) return '';

    return getImageUrl(chartId, chartConfig, imageOptions);
  });

  // Filter to replace chart HTML with image tags (for RSS feeds)
  eleventyConfig.addFilter('chartToImage', function(content, baseUrl = '') {
    if (!content) return content;

    // Find chart figures with data-chart-image and data-chart-alt attributes and replace with img tags
    return content.replace(
      /<figure[^>]*class="chart[^"]*"[^>]*data-chart-image="([^"]+)"[^>]*data-chart-alt="([^"]+)"[^>]*>[\s\S]*?<\/figure>/g,
      (match, src, alt) => `<img src="${baseUrl}${src}" alt="${alt}">`
    );
  });

  // Process image queue after build completes
  eleventyConfig.on('eleventy.after', async () => {
    if (!imageOptions.enabled || skipImageGeneration) return;

    const results = await processQueue(imageOptions);

    if (results.skipped) return;

    if (results.success.length > 0) {
      console.log(`[uncharted] Generated ${results.success.length} chart image(s)`);
    }
    if (results.failed.length > 0) {
      console.warn(`[uncharted] Failed to generate ${results.failed.length} chart image(s)`);
    }
  });
}
