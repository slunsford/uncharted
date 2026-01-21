import { slugify, escapeHtml, getLabelKey, getSeriesNames, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';

/**
 * Render a categorical dot chart (columns with dots at different Y positions)
 * Like atlas-wrapped's adoption chart - discrete X axis, continuous Y axis
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data with label column and value columns
 * @param {number} [config.max] - Maximum Y value (defaults to max in data)
 * @param {number} [config.min] - Minimum Y value (defaults to min in data or 0)
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @returns {string} - HTML string
 */
export function renderDot(config) {
  const { title, subtitle, data, max, min, legend, animate, format, id, rotateLabels, download, downloadUrl } = config;

  if (!data || data.length === 0) {
    return `<!-- Dot chart: no data provided -->`;
  }

  // Get label key (first column) and series keys (remaining columns)
  const labelKey = getLabelKey(data);
  const seriesKeys = getSeriesNames(data);
  const legendLabels = legend ?? seriesKeys;
  const animateClass = animate ? ' chart-animate' : '';

  // Calculate min and max values for Y scaling
  const allValues = data.flatMap(row =>
    seriesKeys.map(key => {
      const val = row[key];
      return typeof val === 'number' ? val : parseFloat(val) || 0;
    })
  );
  const dataMax = Math.max(...allValues);
  const dataMin = Math.min(...allValues);
  const maxValue = max ?? dataMax;
  const minValue = min ?? (dataMin < 0 ? dataMin : 0);
  const range = maxValue - minValue;
  const hasNegativeY = minValue < 0;

  // Calculate zero position for axis line
  const zeroPct = hasNegativeY ? ((0 - minValue) / range) * 100 : 0;

  const negativeClass = hasNegativeY ? ' has-negative-y' : '';
  const idClass = id ? ` chart-${id}` : '';
  const rotateClass = rotateLabels ? ' rotate-labels' : '';
  let html = `<figure class="chart chart-dot${animateClass}${negativeClass}${idClass}${rotateClass}">`;

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

  html += `<div class="chart-body">`;

  // Y-axis
  const yAxisStyle = hasNegativeY ? ` style="--zero-position: ${zeroPct.toFixed(2)}%"` : '';
  html += `<div class="chart-y-axis"${yAxisStyle}>`;
  html += `<span class="axis-label">${formatNumber(maxValue, format) || maxValue}</span>`;
  const midLabelY = hasNegativeY ? 0 : Math.round((maxValue + minValue) / 2);
  html += `<span class="axis-label">${formatNumber(midLabelY, format) || midLabelY}</span>`;
  html += `<span class="axis-label">${formatNumber(minValue, format) || minValue}</span>`;
  html += `</div>`;

  // Scroll wrapper for chart + labels
  html += `<div class="chart-scroll">`;

  // Calculate delay step to cap total stagger at 1s
  const maxStagger = 1; // seconds
  const defaultDelay = 0.08; // seconds
  const delayStep = data.length > 1 ? Math.min(defaultDelay, maxStagger / (data.length - 1)) : 0;
  const styleVars = [`--delay-step: ${delayStep.toFixed(3)}s`];
  if (hasNegativeY) styleVars.push(`--zero-position: ${zeroPct.toFixed(2)}%`);
  html += `<div class="dot-chart" style="${styleVars.join('; ')}">`;
  html += `<div class="dot-field">`;

  // Each row becomes a column with dots for each series
  data.forEach((row, colIndex) => {
    const label = row[labelKey] ?? '';

    html += `<div class="dot-col" style="--col-index: ${colIndex}">`;

    seriesKeys.forEach((key, i) => {
      const val = row[key];
      const value = typeof val === 'number' ? val : parseFloat(val) || 0;
      const yPct = range > 0 ? ((value - minValue) / range) * 100 : 0;
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      const tooltipLabel = legendLabels[i] ?? key;

      html += `<div class="dot ${colorClass} ${seriesClass}" `;
      html += `style="--value: ${yPct.toFixed(2)}%" `;
      html += `title="${escapeHtml(tooltipLabel)}: ${formatNumber(value, format) || value}"`;
      html += `></div>`;
    });

    html += `</div>`;
  });

  html += `</div>`;
  html += `</div>`;

  // X-axis labels
  html += `<div class="dot-labels">`;
  data.forEach(row => {
    const label = row[labelKey] ?? '';
    html += `<span class="dot-label">${escapeHtml(label)}</span>`;
  });
  html += `</div>`;

  html += `</div>`; // close chart-scroll
  html += `</div>`; // close chart-body
  html += renderDownloadLink(downloadUrl, download);
  html += `</figure>`;

  return html;
}
