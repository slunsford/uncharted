/**
 * Chart Image Renderer
 * Uses Puppeteer to render charts as PNG images.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

let puppeteer = null;

/**
 * Attempt to load Puppeteer dynamically.
 * Tries multiple resolution strategies to find Puppeteer in the consuming project.
 * @returns {Promise<Object|null>} Puppeteer module or null if not available
 */
async function loadPuppeteer() {
  if (puppeteer !== null) {
    return puppeteer;
  }

  // Try to resolve from the current working directory (consuming project)
  const require = createRequire(path.join(process.cwd(), 'package.json'));

  try {
    // Use require.resolve to find puppeteer in the project's node_modules
    const puppeteerPath = require.resolve('puppeteer');
    puppeteer = await import(puppeteerPath);
    return puppeteer;
  } catch (e) {
    // Fallback: try direct import (works if puppeteer is in plugin's deps)
    try {
      puppeteer = await import('puppeteer');
      return puppeteer;
    } catch (e2) {
      puppeteer = false; // Mark as unavailable
      return null;
    }
  }
}

/**
 * Check if Puppeteer is available.
 * @returns {Promise<boolean>}
 */
export async function isPuppeteerAvailable() {
  const pptr = await loadPuppeteer();
  return pptr !== null && pptr !== false;
}

/**
 * Check if a string is a URL (vs a local file path).
 * @param {string} str
 * @returns {boolean}
 */
function isUrl(str) {
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('//');
}

/**
 * Load stylesheets - URLs become link tags, local files are inlined.
 * @param {string[]} stylesheets - Array of URLs or file paths
 * @returns {{links: string, inlined: string}}
 */
function loadStylesheets(stylesheets) {
  const links = [];
  const inlined = [];

  for (const stylesheet of stylesheets) {
    if (isUrl(stylesheet)) {
      links.push(`  <link rel="stylesheet" href="${stylesheet}">`);
    } else {
      // Local file - read and inline
      try {
        const filePath = path.resolve(process.cwd(), stylesheet);
        const content = fs.readFileSync(filePath, 'utf-8');
        inlined.push(`/* ${stylesheet} */\n${content}`);
      } catch (err) {
        console.warn(`[uncharted] Could not load stylesheet "${stylesheet}": ${err.message}`);
      }
    }
  }

  return {
    links: links.join('\n'),
    inlined: inlined.join('\n\n')
  };
}

/**
 * Build a standalone HTML document for chart rendering.
 * @param {string} chartHtml - The rendered chart HTML
 * @param {string} css - The chart CSS
 * @param {Object} options - Rendering options
 * @param {string} [options.background] - Background color
 * @param {string[]} [options.stylesheets] - URLs or local file paths for additional stylesheets
 * @param {number} [options.height] - Image height in pixels
 * @returns {string} Complete HTML document
 */
function buildHtmlDocument(chartHtml, css, options = {}) {
  const background = options.background || '#ffffff';
  const stylesheets = options.stylesheets || [];
  const height = options.height || 400;

  // Remove chart-animate class - animations don't make sense in static images
  chartHtml = chartHtml.replace(/\bchart-animate\b/g, '');

  // Load stylesheets (URLs as links, local files inlined)
  const { links: stylesheetLinks, inlined: inlinedStyles } = loadStylesheets(stylesheets);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
${stylesheetLinks}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: ${background};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    body {
      height: 100vh;
      padding: 1rem;
    }
    .chart-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .chart-container > .chart:not(.chart-donut) {
      flex: 1;
      min-height: 0;
      --chart-height: 100%;
    }
    .chart-container > .chart:not(.chart-donut) .chart-body {
      flex: 1;
      min-height: 0;
    }
    /* Donut: just center it, don't stretch */
    .chart-container:has(.chart-donut) {
      justify-content: center;
    }
    /* Sankey: constrain to available height */
    .chart-sankey .chart-sankey-container {
      min-height: 0;
      height: 100%;
    }
    ${css}

    /* Additional stylesheets (inlined) */
    ${inlinedStyles}

    /* Hide download link in images */
    .chart-download { display: none; }
  </style>
</head>
<body>
  <div class="chart-container">
    ${chartHtml}
  </div>
</body>
</html>`;
}

/**
 * Render a single chart to PNG using an existing Puppeteer page.
 * @param {Object} page - Puppeteer page instance
 * @param {Object} chart - Chart data
 * @param {string} chart.html - Chart HTML
 * @param {Object} chart.config - Image configuration
 * @param {string} chart.outputPath - Output file path
 * @param {string} css - Chart CSS content
 * @param {Object} defaults - Default image options
 * @returns {Promise<void>}
 */
async function renderChart(page, chart, css, defaults) {
  const config = { ...defaults, ...chart.config };
  const width = config.width || 800;
  const height = config.height || 400;
  const scale = config.scale || 2;
  const background = config.background || '#ffffff';
  const stylesheets = config.stylesheets || defaults.stylesheets || [];

  // Set viewport
  await page.setViewport({
    width,
    height,
    deviceScaleFactor: scale
  });

  // Build and set HTML content
  const html = buildHtmlDocument(chart.html, css, { background, stylesheets, height });

  // Use 'load' for basic page load, then wait briefly for fonts if stylesheets are included
  await page.setContent(html, { waitUntil: 'load' });
  if (stylesheets.length > 0) {
    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');
  }

  // Ensure output directory exists
  const outputDir = path.dirname(chart.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Take screenshot
  await page.screenshot({
    path: chart.outputPath,
    type: 'png',
    omitBackground: background === 'transparent'
  });
}

/**
 * Render multiple charts to PNG images.
 * @param {Object[]} charts - Array of chart data objects
 * @param {string} css - Chart CSS content
 * @param {Object} options - Rendering options
 * @param {number} [options.width] - Default image width
 * @param {number} [options.height] - Default image height
 * @param {number} [options.scale] - Default device scale factor
 * @param {string} [options.background] - Default background color
 * @param {string[]} [options.stylesheets] - External stylesheet URLs to include
 * @returns {Promise<{success: string[], failed: string[]}>} Results
 */
export async function renderCharts(charts, css, options = {}) {
  const pptr = await loadPuppeteer();

  if (!pptr) {
    console.warn('[uncharted] Puppeteer not installed. Skipping image generation.');
    console.warn('[uncharted] Install puppeteer to enable: npm install puppeteer');
    return { success: [], failed: charts.map(c => c.id) };
  }

  const results = { success: [], failed: [] };

  let browser;
  try {
    browser = await pptr.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    for (const chart of charts) {
      try {
        await renderChart(page, chart, css, options);
        results.success.push(chart.id);
      } catch (err) {
        console.error(`[uncharted] Failed to render image for chart "${chart.id}":`, err.message);
        results.failed.push(chart.id);
      }
    }
  } catch (err) {
    console.error('[uncharted] Failed to launch browser:', err.message);
    return { success: [], failed: charts.map(c => c.id) };
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}
