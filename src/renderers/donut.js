import { slugify, escapeHtml } from '../utils.js';

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
 * @returns {string} - HTML string
 */
export function renderDonut(config) {
  const { title, subtitle, data, legend, center, animate } = config;

  if (!data || data.length === 0) {
    return `<!-- Donut chart: no data provided -->`;
  }

  const animateClass = animate ? ' chart-animate' : '';

  // Extract values - support both {label, value} format and series format
  let segments = [];
  if (data[0].value !== undefined) {
    // Direct {label, value} format
    segments = data.map(item => ({
      label: item.label,
      value: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0
    }));
  } else {
    // Series format - first row only for donut
    const seriesNames = Object.keys(data[0]).filter(k => k !== 'label');
    segments = seriesNames.map(name => ({
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

    gradientStops.push(`var(--chart-color-${i + 1}) ${startAngle.toFixed(2)}% ${endAngle.toFixed(2)}%`);
    currentAngle = endAngle;
  });

  const gradient = `conic-gradient(${gradientStops.join(', ')})`;

  let html = `<figure class="chart chart-donut${animateClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  // Donut visual
  html += `<div class="donut-container">`;
  html += `<div class="donut-ring" style="background: ${gradient}"></div>`;
  html += `<div class="donut-center">`;

  // Center content (optional)
  if (center) {
    const centerValue = center.value === 'total' ? total : center.value;
    if (centerValue !== undefined) {
      html += `<span class="donut-value">${escapeHtml(String(centerValue))}</span>`;
    }
    if (center.label) {
      html += `<span class="donut-label">${escapeHtml(center.label)}</span>`;
    }
  }

  html += `</div>`;
  html += `</div>`;

  // Legend with percentages
  const legendLabels = legend ?? segments.map(s => s.label);
  html += `<ul class="chart-legend">`;
  segments.forEach((segment, i) => {
    const label = legendLabels[i] ?? segment.label;
    const percentage = ((segment.value / total) * 100).toFixed(1);
    const colorClass = `chart-color-${i + 1}`;
    const seriesClass = `chart-series-${slugify(segment.label)}`;
    html += `<li class="chart-legend-item ${colorClass} ${seriesClass}">`;
    html += `<span class="legend-label">${escapeHtml(label)}</span>`;
    html += `<span class="legend-value">${percentage}%</span>`;
    html += `</li>`;
  });
  html += `</ul>`;

  html += `</figure>`;

  return html;
}
