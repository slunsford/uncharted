import { slugify, escapeHtml } from '../utils.js';

/**
 * Render a scatter plot (continuous X and Y axes)
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data (with label, x, y, and optionally series)
 * @param {number} [config.maxX] - Maximum X value (defaults to max in data)
 * @param {number} [config.maxY] - Maximum Y value (defaults to max in data)
 * @param {string[]} [config.legend] - Legend labels for series
 * @param {boolean} [config.animate] - Enable animations
 * @returns {string} - HTML string
 */
export function renderScatter(config) {
  const { title, subtitle, data, maxX, maxY, legend, animate } = config;

  if (!data || data.length === 0) {
    return `<!-- Scatter chart: no data provided -->`;
  }

  const animateClass = animate ? ' chart-animate' : '';

  // Normalize data format
  let dots = [];
  if (data[0].x !== undefined && data[0].y !== undefined) {
    // Direct {label, x, y, series?} format
    dots = data.map(item => ({
      label: item.label ?? '',
      x: typeof item.x === 'number' ? item.x : parseFloat(item.x) || 0,
      y: typeof item.y === 'number' ? item.y : parseFloat(item.y) || 0,
      series: item.series ?? 'default'
    }));
  } else if (data[0].value !== undefined) {
    // Simple {label, value} format - use index as x, value as y
    dots = data.map((item, i) => ({
      label: item.label ?? '',
      x: i,
      y: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0,
      series: 'default'
    }));
  }

  // Calculate bounds
  const xValues = dots.map(d => d.x);
  const yValues = dots.map(d => d.y);
  const calcMaxX = maxX ?? Math.max(...xValues);
  const calcMaxY = maxY ?? Math.max(...yValues);

  // Get unique series
  const seriesSet = new Set(dots.map(d => d.series));
  const seriesList = Array.from(seriesSet);
  const seriesIndex = new Map(seriesList.map((s, i) => [s, i]));

  let html = `<figure class="chart chart-scatter${animateClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  // Legend (if multiple series)
  if (seriesList.length > 1 || legend) {
    const legendLabels = legend ?? seriesList;
    html += `<ul class="chart-legend">`;
    seriesList.forEach((series, i) => {
      const label = legendLabels[i] ?? series;
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(series)}`;
      html += `<li class="chart-legend-item ${colorClass} ${seriesClass}">${escapeHtml(label)}</li>`;
    });
    html += `</ul>`;
  }

  html += `<div class="chart-body">`;

  // Y-axis
  html += `<div class="chart-y-axis">`;
  html += `<span class="axis-label">${calcMaxY}</span>`;
  html += `<span class="axis-label">${Math.round(calcMaxY / 2)}</span>`;
  html += `<span class="axis-label">0</span>`;
  html += `</div>`;

  html += `<div class="scatter-container">`;
  html += `<div class="dot-area">`;

  dots.forEach((dot, i) => {
    const xPct = calcMaxX > 0 ? (dot.x / calcMaxX) * 100 : 0;
    const yPct = calcMaxY > 0 ? (dot.y / calcMaxY) * 100 : 0;
    const colorIndex = seriesIndex.get(dot.series) + 1;
    const colorClass = `chart-color-${colorIndex}`;
    const seriesClass = `chart-series-${slugify(dot.series)}`;
    const tooltipText = dot.label ? `${dot.label}: (${dot.x}, ${dot.y})` : `(${dot.x}, ${dot.y})`;

    html += `<div class="dot ${colorClass} ${seriesClass}" `;
    html += `style="--dot-index: ${i}; --x: ${xPct.toFixed(2)}%; --value: ${yPct.toFixed(2)}%" `;
    html += `title="${escapeHtml(tooltipText)}"`;
    html += `></div>`;
  });

  html += `</div>`;

  // X-axis
  html += `<div class="chart-x-axis">`;
  html += `<span class="axis-label">0</span>`;
  html += `<span class="axis-label">${Math.round(calcMaxX / 2)}</span>`;
  html += `<span class="axis-label">${calcMaxX}</span>`;
  html += `</div>`;

  html += `</div>`;
  html += `</div>`;

  html += `</figure>`;

  return html;
}
