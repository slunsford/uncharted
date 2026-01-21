import { slugify, calculatePercentages, getLabelKey, getSeriesNames, escapeHtml, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';

/**
 * Render a stacked bar chart (horizontal)
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data
 * @param {number} [config.max] - Maximum value for percentage calculation
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @returns {string} - HTML string
 */
export function renderStackedBar(config) {
  const { title, subtitle, data, max, legend, animate, format, id, download, downloadUrl } = config;

  if (!data || data.length === 0) {
    return `<!-- Stacked bar chart: no data provided -->`;
  }

  // Get label key (first column) and series keys (remaining columns)
  const labelKey = getLabelKey(data);
  const seriesKeys = getSeriesNames(data);
  // Use legend for display labels, fall back to data keys
  const legendLabels = legend ?? seriesKeys;
  const animateClass = animate ? ' chart-animate' : '';

  // Calculate max total across all rows if not provided
  const calculatedMax = max ?? Math.max(...data.map(row => {
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

  // Legend
  if (seriesKeys.length > 0) {
    html += `<ul class="chart-legend">`;
    seriesKeys.forEach((key, i) => {
      const label = legendLabels[i] ?? key;
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      html += `<li class="chart-legend-item ${colorClass} ${seriesClass}">${escapeHtml(label)}</li>`;
    });
    html += `</ul>`;
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
    const seriesLabels = legendLabels ?? seriesKeys;

    html += `<div class="bar-row" style="--row-index: ${rowIndex}">`;
    html += `<span class="bar-label">${escapeHtml(label)}</span>`;
    html += `<div class="bar-track">`;
    html += `<div class="bar-fills" title="${escapeHtml(label)}: ${formatNumber(total, format) || total}">`;

    seriesKeys.forEach((key, i) => {
      const pct = percentages[i];
      const value = values[i];
      if (pct > 0) {
        const colorClass = `chart-color-${i + 1}`;
        const seriesClass = `chart-series-${slugify(key)}`;
        const seriesLabel = seriesLabels[i] ?? key;
        html += `<div class="bar-fill ${colorClass} ${seriesClass}" style="--value: ${pct.toFixed(2)}%" title="${escapeHtml(seriesLabel)}: ${formatNumber(value, format) || value}"></div>`;
      }
    });

    html += `</div>`;
    html += `</div>`;

    // Show total value
    html += `<span class="bar-value">${formatNumber(total, format) || total}</span>`;
    html += `</div>`;
  });

  html += `</div>`;
  html += renderDownloadLink(downloadUrl, download);
  html += `</figure>`;

  return html;
}
