import { slugify, escapeHtml, getSeriesNames } from '../utils.js';

/**
 * Render a categorical dot chart (columns with dots at different Y positions)
 * Like atlas-wrapped's adoption chart - discrete X axis, continuous Y axis
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data with label column and value columns
 * @param {number} [config.max] - Maximum Y value (defaults to max in data)
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @returns {string} - HTML string
 */
export function renderDot(config) {
  const { title, subtitle, data, max, legend, animate } = config;

  if (!data || data.length === 0) {
    return `<!-- Dot chart: no data provided -->`;
  }

  // Get series keys from data columns (excluding 'label')
  const seriesKeys = getSeriesNames(data);
  const legendLabels = legend ?? seriesKeys;
  const animateClass = animate ? ' chart-animate' : '';

  // Calculate max value for Y scaling
  let maxValue = max;
  if (!maxValue) {
    maxValue = Math.max(
      ...data.flatMap(row =>
        seriesKeys.map(key => {
          const val = row[key];
          return typeof val === 'number' ? val : parseFloat(val) || 0;
        })
      )
    );
  }

  let html = `<figure class="chart chart-dot${animateClass}">`;

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
  html += `<div class="chart-y-axis">`;
  html += `<span class="axis-label">${maxValue}</span>`;
  html += `<span class="axis-label">${Math.round(maxValue / 2)}</span>`;
  html += `<span class="axis-label">0</span>`;
  html += `</div>`;

  html += `<div class="dot-chart">`;

  // Each row becomes a column with dots for each series
  data.forEach(row => {
    const label = row.label ?? '';

    html += `<div class="dot-col">`;

    seriesKeys.forEach((key, i) => {
      const val = row[key];
      const value = typeof val === 'number' ? val : parseFloat(val) || 0;
      const yPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      const tooltipLabel = legendLabels[i] ?? key;

      html += `<div class="dot ${colorClass} ${seriesClass}" `;
      html += `style="--value: ${yPct.toFixed(2)}%" `;
      html += `title="${escapeHtml(label)}: ${value} ${escapeHtml(tooltipLabel)}"`;
      html += `></div>`;
    });

    html += `</div>`;
  });

  html += `</div>`;
  html += `</div>`;

  // X-axis labels
  html += `<div class="dot-labels">`;
  data.forEach(row => {
    const label = row.label ?? '';
    html += `<span class="dot-label">${escapeHtml(label)}</span>`;
  });
  html += `</div>`;

  html += `</figure>`;

  return html;
}
