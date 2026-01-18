import { slugify, escapeHtml } from '../utils.js';

/**
 * Render a scatter plot (continuous X and Y axes)
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data (with label, x, y, and optionally series)
 * @param {number} [config.maxX] - Maximum X value (defaults to max in data)
 * @param {number} [config.maxY] - Maximum Y value (defaults to max in data)
 * @param {number} [config.minX] - Minimum X value (defaults to min in data or 0)
 * @param {number} [config.minY] - Minimum Y value (defaults to min in data or 0)
 * @param {string[]} [config.legend] - Legend labels for series
 * @param {boolean} [config.animate] - Enable animations
 * @returns {string} - HTML string
 */
export function renderScatter(config) {
  const { title, subtitle, data, maxX, maxY, minX, minY, legend, animate } = config;

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
  const dataMaxX = Math.max(...xValues);
  const dataMinX = Math.min(...xValues);
  const dataMaxY = Math.max(...yValues);
  const dataMinY = Math.min(...yValues);

  const calcMaxX = maxX ?? dataMaxX;
  const calcMaxY = maxY ?? dataMaxY;
  const calcMinX = minX ?? (dataMinX < 0 ? dataMinX : 0);
  const calcMinY = minY ?? (dataMinY < 0 ? dataMinY : 0);
  const rangeX = calcMaxX - calcMinX;
  const rangeY = calcMaxY - calcMinY;

  const hasNegativeX = calcMinX < 0;
  const hasNegativeY = calcMinY < 0;

  // Calculate zero positions for axis lines
  const zeroPctX = hasNegativeX ? ((0 - calcMinX) / rangeX) * 100 : 0;
  const zeroPctY = hasNegativeY ? ((0 - calcMinY) / rangeY) * 100 : 0;

  // Get unique series
  const seriesSet = new Set(dots.map(d => d.series));
  const seriesList = Array.from(seriesSet);
  const seriesIndex = new Map(seriesList.map((s, i) => [s, i]));

  const negativeClasses = (hasNegativeX ? ' has-negative-x' : '') + (hasNegativeY ? ' has-negative-y' : '');
  let html = `<figure class="chart chart-scatter${animateClass}${negativeClasses}">`;

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
  const yAxisStyle = hasNegativeY ? ` style="--zero-position-y: ${zeroPctY.toFixed(2)}%"` : '';
  html += `<div class="chart-y-axis"${yAxisStyle}>`;
  html += `<span class="axis-label">${calcMaxY}</span>`;
  const midLabelY = hasNegativeY ? 0 : Math.round((calcMaxY + calcMinY) / 2);
  html += `<span class="axis-label">${midLabelY}</span>`;
  html += `<span class="axis-label">${calcMinY}</span>`;
  html += `</div>`;

  // Container gets zero position variables for axis line CSS
  const containerStyles = [];
  if (hasNegativeX) containerStyles.push(`--zero-position-x: ${zeroPctX.toFixed(2)}%`);
  if (hasNegativeY) containerStyles.push(`--zero-position-y: ${zeroPctY.toFixed(2)}%`);
  const containerStyle = containerStyles.length > 0 ? ` style="${containerStyles.join('; ')}"` : '';
  html += `<div class="scatter-container"${containerStyle}>`;
  html += `<div class="dot-area">`;
  html += `<div class="dot-field">`;

  dots.forEach((dot, i) => {
    const xPct = rangeX > 0 ? ((dot.x - calcMinX) / rangeX) * 100 : 0;
    const yPct = rangeY > 0 ? ((dot.y - calcMinY) / rangeY) * 100 : 0;
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
  html += `</div>`;

  // X-axis
  const xAxisStyle = hasNegativeX ? ` style="--zero-position-x: ${zeroPctX.toFixed(2)}%"` : '';
  html += `<div class="chart-x-axis"${xAxisStyle}>`;
  html += `<span class="axis-label">${calcMinX}</span>`;
  const midLabelX = hasNegativeX ? 0 : Math.round((calcMaxX + calcMinX) / 2);
  html += `<span class="axis-label">${midLabelX}</span>`;
  html += `<span class="axis-label">${calcMaxX}</span>`;
  html += `</div>`;

  html += `</div>`;
  html += `</div>`;

  html += `</figure>`;

  return html;
}
