import { slugify, calculatePercentages, getSeriesNames, escapeHtml } from '../utils.js';

/**
 * Render a stacked column chart (vertical)
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data
 * @param {number} [config.max] - Maximum value for percentage calculation
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @returns {string} - HTML string
 */
export function renderStackedColumn(config) {
  const { title, subtitle, data, max, legend, animate } = config;

  if (!data || data.length === 0) {
    return `<!-- Stacked column chart: no data provided -->`;
  }

  // Get actual data keys from the first row (excluding 'label')
  const seriesKeys = getSeriesNames(data);
  // Use legend for display labels, fall back to data keys
  const legendLabels = legend ?? seriesKeys;
  const animateClass = animate ? ' chart-animate' : '';

  // Calculate max for consistent scaling across all columns
  let maxValue = max;
  if (!maxValue) {
    maxValue = Math.max(
      ...data.map(row => {
        const values = seriesKeys.map(key => {
          const val = row[key];
          return typeof val === 'number' ? val : parseFloat(val) || 0;
        });
        return values.reduce((sum, v) => sum + v, 0);
      })
    );
  }

  let html = `<figure class="chart chart-stacked-column${animateClass}">`;

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

  html += `<div class="chart-columns">`;

  data.forEach(row => {
    const label = row.label ?? '';
    const values = seriesKeys.map(key => {
      const val = row[key];
      return typeof val === 'number' ? val : parseFloat(val) || 0;
    });
    const total = values.reduce((sum, v) => sum + v, 0);
    const percentages = calculatePercentages(values, maxValue);
    const seriesLabels = legendLabels ?? seriesKeys;

    html += `<div class="column-track" title="${escapeHtml(label)}: ${total}">`;

    // Render segments
    seriesKeys.forEach((key, i) => {
      const pct = percentages[i];
      const value = values[i];
      if (pct > 0) {
        const colorClass = `chart-color-${i + 1}`;
        const seriesClass = `chart-series-${slugify(key)}`;
        const seriesLabel = seriesLabels[i] ?? key;
        html += `<div class="column-segment ${colorClass} ${seriesClass}" style="--value: ${pct.toFixed(2)}%" title="${escapeHtml(seriesLabel)}: ${value}"></div>`;
      }
    });

    html += `</div>`;
  });

  html += `</div>`;
  html += `</div>`;

  // X-axis labels
  html += `<div class="column-labels">`;
  data.forEach(row => {
    const label = row.label ?? '';
    html += `<span class="column-label">${escapeHtml(label)}</span>`;
  });
  html += `</div>`;
  html += `</figure>`;

  return html;
}
