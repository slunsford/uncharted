import { slugify, calculatePercentages, getLabelKey, getSeriesNames, escapeHtml, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';
import { getAxisMax, getAxisFormat } from '../config.js';

/**
 * Render a stacked bar chart (horizontal)
 * @param {Object} config - Chart configuration (normalized)
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data
 * @param {Object} [config.x] - X-axis configuration { max, format } (bars extend along X)
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @param {Object} [config._columns] - Resolved column mappings
 * @returns {string} - HTML string
 */
export function renderStackedBar(config) {
  const { title, subtitle, data, max, legend, legendTitle, animate, format, id, downloadData, downloadDataUrl, _columns } = config;

  if (!data || data.length === 0) {
    return `<!-- Stacked bar chart: no data provided -->`;
  }

  // Get label key and series keys (use resolved columns if available)
  const labelKey = _columns?.label ?? getLabelKey(data);
  const seriesKeys = _columns?.values?.length > 0 ? _columns.values : getSeriesNames(data);

  // Build legend labels from: 1) xLabels (new - stacked-bar uses x for values), 2) legend array (deprecated), 3) column names
  const xLabels = _columns?.xLabels || {};
  const getSeriesLabel = (key, index) => {
    if (xLabels[key]) return xLabels[key];
    if (Array.isArray(legend)) return legend[index] ?? key;
    return key;
  };

  const animateClass = animate ? ' chart-animate' : '';

  // Get X-axis format (bars extend along X)
  const xFormat = getAxisFormat(config, 'x');

  // Calculate max total across all rows if not provided
  // Use normalized x.max, fall back to legacy top-level max
  const configMax = getAxisMax(config, 'x') ?? max;
  const calculatedMax = configMax ?? Math.max(...data.map(row => {
    return seriesKeys.reduce((sum, key) => {
      const val = row[key];
      return sum + (typeof val === 'number' ? val : parseFloat(val) || 0);
    }, 0);
  }));

  const idClass = id ? ` chart-${id}` : '';
  let html = `<figure class="chart chart-stacked-bar${animateClass}${idClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  // Legend (show if legend !== false and we have series keys or legendTitle)
  const showLegend = config.legend !== false && (seriesKeys.length > 0 || legendTitle);
  if (showLegend) {
    if (legendTitle) {
      html += `<span class="chart-legend-title">${escapeHtml(legendTitle)}</span>`;
    }
    html += `<div class="chart-legend">`;
    seriesKeys.forEach((key, i) => {
      const label = getSeriesLabel(key, i);
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      html += `<span class="chart-legend-item ${colorClass} ${seriesClass}">${escapeHtml(label)}</span>`;
    });
    html += `</div>`;
  }

  // Calculate delay step to cap total stagger at 1s
  const maxStagger = 1; // seconds
  const defaultDelay = 0.08; // seconds
  const delayStep = data.length > 1 ? Math.min(defaultDelay, maxStagger / (data.length - 1)) : 0;
  html += `<div class="chart-bars" style="--delay-step: ${delayStep.toFixed(3)}s">`;

  data.forEach((row, rowIndex) => {
    const label = row[labelKey] ?? '';
    const values = seriesKeys.map(key => {
      const val = row[key];
      return typeof val === 'number' ? val : parseFloat(val) || 0;
    });
    const total = values.reduce((sum, v) => sum + v, 0);
    const percentages = calculatePercentages(values, calculatedMax);

    html += `<div class="bar-row" style="--row-index: ${rowIndex}">`;
    html += `<span class="bar-label">${escapeHtml(label)}</span>`;
    html += `<div class="bar-track">`;
    html += `<div class="bar-fills" title="${escapeHtml(label)}: ${formatNumber(total, xFormat) || total}">`;

    seriesKeys.forEach((key, i) => {
      const pct = percentages[i];
      const value = values[i];
      if (pct > 0) {
        const colorClass = `chart-color-${i + 1}`;
        const seriesClass = `chart-series-${slugify(key)}`;
        const seriesLabel = getSeriesLabel(key, i);
        html += `<div class="bar-fill ${colorClass} ${seriesClass}" style="--value: ${pct.toFixed(2)}%" title="${escapeHtml(seriesLabel)}: ${formatNumber(value, xFormat) || value}"></div>`;
      }
    });

    html += `</div>`;
    html += `</div>`;

    // Show total value
    html += `<span class="bar-value">${formatNumber(total, xFormat) || total}</span>`;
    html += `</div>`;
  });

  html += `</div>`;
  html += renderDownloadLink(downloadDataUrl, downloadData);
  html += `</figure>`;

  return html;
}
