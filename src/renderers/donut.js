import { slugify, escapeHtml, getLabelKey, getValueKey, getSeriesNames } from '../utils.js';
import { formatNumber } from '../formatters.js';

/**
 * Render a donut/pie chart using conic-gradient
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data (with label and value properties)
 * @param {string[]} [config.legend] - Legend labels (defaults to data labels)
 * @param {Object} [config.center] - Center content options
 * @param {string|number} [config.center.value] - Value to show in center (use "total" for auto-calculated)
 * @param {string} [config.center.label] - Label below the value
 * @param {boolean} [config.animate] - Enable animations
 * @param {boolean} [config.showPercentages] - Show percentages instead of values in legend
 * @returns {string} - HTML string
 */
export function renderDonut(config) {
  const { title, subtitle, data, legend, center, animate, format, id, showPercentages } = config;

  if (!data || data.length === 0) {
    return `<!-- Donut chart: no data provided -->`;
  }

  const animateClass = animate ? ' chart-animate' : '';

  // Get column keys positionally
  const labelKey = getLabelKey(data);
  const valueKey = getValueKey(data);
  const seriesKeys = getSeriesNames(data);

  // Extract values - support both label/value format and series format
  let segments = [];
  if (seriesKeys.length === 1) {
    // Two columns: first is label, second is value (multiple rows)
    segments = data.map(item => ({
      label: item[labelKey],
      value: typeof item[valueKey] === 'number' ? item[valueKey] : parseFloat(item[valueKey]) || 0
    }));
  } else {
    // Series format - first row only, columns after the first are series
    segments = seriesKeys.map(name => ({
      label: name,
      value: typeof data[0][name] === 'number' ? data[0][name] : parseFloat(data[0][name]) || 0
    }));
  }

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return `<!-- Donut chart: total is zero -->`;
  }

  // Build conic-gradient stops
  let currentAngle = 0;
  const gradientStops = [];

  segments.forEach((segment, i) => {
    const percentage = (segment.value / total) * 100;
    const startAngle = currentAngle;
    const endAngle = currentAngle + percentage;

    // Use segment-specific variable (defaults set in CSS)
    gradientStops.push(`var(--donut-${i + 1}) ${startAngle.toFixed(2)}% ${endAngle.toFixed(2)}%`);
    currentAngle = endAngle;
  });

  const gradient = `conic-gradient(${gradientStops.join(', ')})`;

  const idClass = id ? ` chart-${id}` : '';
  let html = `<figure class="chart chart-donut${animateClass}${idClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  // Donut body wrapper (for container queries)
  html += `<div class="donut-body">`;

  // Donut visual
  html += `<div class="donut-container">`;
  html += `<div class="donut-ring" style="background: ${gradient}"></div>`;
  html += `<div class="donut-center">`;

  // Center content (optional)
  if (center) {
    const centerValue = center.value === 'total' ? total : center.value;
    if (centerValue !== undefined) {
      const displayValue = typeof centerValue === 'number' ? (formatNumber(centerValue, format) || centerValue) : centerValue;
      html += `<span class="donut-value">${escapeHtml(String(displayValue))}</span>`;
    }
    if (center.label) {
      html += `<span class="donut-label">${escapeHtml(center.label)}</span>`;
    }
  }

  html += `</div>`;
  html += `</div>`;

  // Legend with values (or percentages if showPercentages is true)
  const legendLabels = legend ?? segments.map(s => s.label);
  html += `<ul class="chart-legend">`;
  segments.forEach((segment, i) => {
    const label = legendLabels[i] ?? segment.label;
    let displayValue;
    if (showPercentages) {
      displayValue = ((segment.value / total) * 100).toFixed(1) + '%';
    } else {
      displayValue = formatNumber(segment.value, format) || segment.value;
    }
    const colorClass = `chart-color-${i + 1}`;
    const seriesClass = `chart-series-${slugify(segment.label)}`;
    html += `<li class="chart-legend-item ${colorClass} ${seriesClass}">`;
    html += `<span class="legend-label">${escapeHtml(label)}</span>`;
    html += `<span class="legend-value">${escapeHtml(String(displayValue))}</span>`;
    html += `</li>`;
  });
  html += `</ul>`;

  html += `</div>`; // Close donut-body

  html += `</figure>`;

  return html;
}
