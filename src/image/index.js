/**
 * Chart Image Generation Module
 * Orchestrates PNG image generation for charts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { queueChart, getAndClearQueue, hasQueuedCharts, getQueueSize, clearQueue } from './queue.js';
import { renderCharts, isPuppeteerAvailable } from './renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {Object} ImageOptions
 * @property {boolean} [enabled=false] - Enable image generation
 * @property {string} [outputDir='/images/charts/'] - Output directory for images (URL path)
 * @property {string} [cacheDir=null] - Source directory for cached images (enables caching when set)
 * @property {number} [width=800] - Default image width
 * @property {number} [height=400] - Default image height
 * @property {number} [scale=2] - Device scale factor (2 for retina)
 * @property {string} [background='#ffffff'] - Default background color
 * @property {string[]} [stylesheets=[]] - External stylesheet URLs to include (e.g., Font Awesome)
 * @property {boolean} [skipDev=true] - Skip generation during --serve/--watch
 */

/** @type {Map<string, string>} Chart ID -> Image URL */
const imageUrls = new Map();

/**
 * Default image options.
 * @type {ImageOptions}
 */
const defaultOptions = {
  enabled: false,
  outputDir: '/images/charts/',
  cacheDir: null,
  width: 800,
  height: 400,
  scale: 2,
  background: '#ffffff',
  stylesheets: [],
  skipDev: true
};

/**
 * Normalize image options by merging defaults.
 * @param {Partial<ImageOptions>} options
 * @returns {ImageOptions}
 */
export function normalizeImageOptions(options = {}) {
  return { ...defaultOptions, ...options };
}

/**
 * Get the output path for a chart image.
 * @param {string} chartId - Chart identifier
 * @param {Object} chartConfig - Chart configuration
 * @param {ImageOptions} globalOptions - Global image options
 * @param {string} outputDir - Eleventy output directory
 * @returns {string} Absolute file path for the image
 */
export function getImageOutputPath(chartId, chartConfig, globalOptions, outputDir) {
  const imageConfig = chartConfig.image || {};
  const filename = imageConfig.filename || chartId;
  const dir = globalOptions.outputDir.replace(/^\//, '').replace(/\/$/, '');

  return path.join(outputDir, dir, `${filename}.png`);
}

/**
 * Get the URL for a chart image.
 * @param {string} chartId - Chart identifier
 * @param {Object} chartConfig - Chart configuration
 * @param {ImageOptions} globalOptions - Global image options
 * @returns {string} URL path to the image
 */
export function getImageUrl(chartId, chartConfig, globalOptions) {
  const imageConfig = chartConfig.image || {};
  const filename = imageConfig.filename || chartId;
  const dir = globalOptions.outputDir.endsWith('/')
    ? globalOptions.outputDir
    : globalOptions.outputDir + '/';

  return `${dir}${filename}.png`;
}

/**
 * Get the cache file path for a chart image.
 * @param {string} chartId - Chart identifier
 * @param {Object} chartConfig - Chart configuration
 * @param {ImageOptions} globalOptions - Global image options
 * @returns {string|null} Absolute cache path, or null if caching disabled
 */
export function getCachePath(chartId, chartConfig, globalOptions) {
  if (!globalOptions.cacheDir) return null;

  const imageConfig = chartConfig.image || {};
  const filename = imageConfig.filename || chartId;
  const cacheDir = globalOptions.cacheDir.replace(/\/$/, '');

  return path.resolve(process.cwd(), cacheDir, `${filename}.png`);
}

/**
 * Store the image URL for a chart (for shortcode lookup).
 * @param {string} chartId
 * @param {string} url
 */
export function storeImageUrl(chartId, url) {
  imageUrls.set(chartId, url);
}

/**
 * Get the stored image URL for a chart.
 * @param {string} chartId
 * @returns {string|null}
 */
export function getStoredImageUrl(chartId) {
  return imageUrls.get(chartId) || null;
}

/**
 * Clear all stored image URLs.
 */
export function clearImageUrls() {
  imageUrls.clear();
}

/**
 * Check if image generation should be skipped (dev mode).
 * @param {ImageOptions} options
 * @returns {boolean}
 */
export function shouldSkipInDevMode(options) {
  if (!options.skipDev) return false;

  // Check for common dev mode indicators
  const args = process.argv.join(' ').toLowerCase();
  return args.includes('--serve') || args.includes('--watch');
}

/**
 * Queue a chart for image generation.
 * @param {string} chartId - Chart identifier
 * @param {string} chartHtml - Rendered chart HTML
 * @param {Object} chartConfig - Chart configuration
 * @param {ImageOptions} globalOptions - Global image options
 * @param {string} outputDir - Eleventy output directory
 */
export function queueChartForImage(chartId, chartHtml, chartConfig, globalOptions, outputDir) {
  const imageConfig = chartConfig.image || {};

  // Merge global and per-chart config
  const config = {
    width: imageConfig.width || globalOptions.width,
    height: imageConfig.height || globalOptions.height,
    scale: imageConfig.scale || globalOptions.scale,
    background: imageConfig.background || globalOptions.background,
    filename: imageConfig.filename || chartId
  };

  const outputPath = getImageOutputPath(chartId, chartConfig, globalOptions, outputDir);
  const url = getImageUrl(chartId, chartConfig, globalOptions);
  const cachePath = getCachePath(chartId, chartConfig, globalOptions);

  // Store URL for shortcode lookup
  storeImageUrl(chartId, url);

  // Add to queue
  queueChart(chartId, {
    id: chartId,
    html: chartHtml,
    config,
    outputPath,
    cachePath
  });
}

/**
 * Process the chart image queue and generate all images.
 * @param {ImageOptions} options - Image options
 * @returns {Promise<{success: string[], failed: string[], skipped: boolean}>}
 */
export async function processQueue(options) {
  if (!hasQueuedCharts()) {
    return { success: [], failed: [], skipped: false };
  }

  // Check if Puppeteer is available
  const available = await isPuppeteerAvailable();
  if (!available) {
    const count = getQueueSize();
    clearQueue();
    // Suppress warning if cacheDir is set (cached images will be used via passthrough)
    if (!options.cacheDir) {
      console.warn(`[uncharted] Puppeteer not installed. Skipped ${count} chart image(s).`);
    }
    return { success: [], failed: [], skipped: true };
  }

  // Load CSS
  const cssPath = path.join(__dirname, '../../css/uncharted.css');
  let css = '';
  try {
    css = fs.readFileSync(cssPath, 'utf-8');
  } catch (err) {
    console.error('[uncharted] Failed to load CSS for image rendering:', err.message);
    clearQueue();
    return { success: [], failed: [], skipped: true };
  }

  // Get charts and clear queue
  const charts = getAndClearQueue();

  // Render all charts
  const results = await renderCharts(charts, css, {
    width: options.width,
    height: options.height,
    scale: options.scale,
    background: options.background,
    stylesheets: options.stylesheets
  });

  return { ...results, skipped: false };
}

// Re-export queue utilities for direct access if needed
export { hasQueuedCharts, getQueueSize, clearQueue };
