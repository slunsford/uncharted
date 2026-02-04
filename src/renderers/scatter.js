import { slugify, escapeHtml, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';

/**
 * Render a scatter plot (continuous X and Y axes)
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data (label + named columns: x, y, size, series)
 * @param {number} [config.maxX] - Maximum X value (defaults to max in data)
 * @param {number} [config.maxY] - Maximum Y value (defaults to max in data)
 * @param {number} [config.minX] - Minimum X value (defaults to min in data or 0)
 * @param {number} [config.minY] - Minimum Y value (defaults to min in data or 0)
 * @param {string[]} [config.legend] - Legend labels for series
 * @param {string} [config.legendTitle] - Title for series legend
 * @param {string} [config.sizeTitle] - Title for size legend (enables size legend display)
 * @param {boolean} [config.animate] - Enable animations
 * @param {string} [config.titleX] - X-axis title (defaults to column name)
 * @param {string} [config.titleY] - Y-axis title (defaults to column name)
 * @returns {string} - HTML string
 */
export function renderScatter(config) {
  const { title, subtitle, data, maxX, maxY, minX, minY, legend, legendTitle, sizeTitle, animate, format, titleX, titleY, id, downloadData, downloadDataUrl, proportional } = config;

  // Handle nested X/Y format for scatter charts
  const fmtX = format?.x || format || {};
  const fmtY = format?.y || format || {};

  if (!data || data.length === 0) {
    return `<!-- Scatter chart: no data provided -->`;
  }

  const animateClass = animate ? ' chart-animate' : '';

  // Named column detection (case-insensitive), with positional fallback for x/y
  const keys = Object.keys(data[0]);
  const findKey = name => keys.find(k => k.toLowerCase() === name) || null;

  // First column is always label
  const labelKey = keys[0];

  // X and Y: named if both exist, otherwise positional (columns 2 and 3)
  const namedX = findKey('x');
  const namedY = findKey('y');
  const xKey = (namedX && namedY) ? namedX : keys[1];
  const yKey = (namedX && namedY) ? namedY : keys[2];

  // Size and series: named only (no positional fallback)
  const sizeKey = findKey('size');
  const seriesKey = findKey('series');

  // Axis titles: explicit config overrides column names
  const xAxisTitle = titleX ?? xKey;
  const yAxisTitle = titleY ?? yKey;

  // Map data to dots
  const dots = data.map(item => ({
    label: item[labelKey] ?? '',
    x: typeof item[xKey] === 'number' ? item[xKey] : parseFloat(item[xKey]) || 0,
    y: typeof item[yKey] === 'number' ? item[yKey] : parseFloat(item[yKey]) || 0,
    rawSize: sizeKey ? (typeof item[sizeKey] === 'number' ? item[sizeKey] : parseFloat(item[sizeKey]) || 0) : null,
    series: seriesKey ? (item[seriesKey] ?? 'default') : 'default'
  }));

  // Size normalization: non-positive values get minimum size (scale 0)
  if (sizeKey) {
    const sizeValues = dots.map(d => d.rawSize).filter(v => v > 0);
    const minSizeVal = sizeValues.length ? Math.min(...sizeValues) : 1;
    const maxSizeVal = sizeValues.length ? Math.max(...sizeValues) : 1;
    const sizeRange = maxSizeVal - minSizeVal;

    dots.forEach(dot => {
      if (dot.rawSize <= 0 || sizeRange === 0) {
        dot.sizeScale = 0;
      } else {
        dot.sizeScale = (dot.rawSize - minSizeVal) / sizeRange;
      }
    });
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
  const dataAspectRatio = rangeY > 0 ? rangeX / rangeY : 1;

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
  const proportionalClass = proportional ? ' chart-proportional' : '';
  const idClass = id ? ` chart-${id}` : '';
  let html = `<figure class="chart chart-scatter${animateClass}${negativeClasses}${proportionalClass}${idClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  html += `<div class="chart-body">`;

  // Y-axis
  const yAxisStyle = hasNegativeY ? ` style="--zero-position-y: ${zeroPctY.toFixed(2)}%"` : '';
  html += `<div class="chart-y-axis"${yAxisStyle}>`;
  html += `<span class="axis-label">${formatNumber(calcMaxY, fmtY) || calcMaxY}</span>`;
  const midLabelY = hasNegativeY ? 0 : Math.round((calcMaxY + calcMinY) / 2);
  html += `<span class="axis-label">${formatNumber(midLabelY, fmtY) || midLabelY}</span>`;
  html += `<span class="axis-label">${formatNumber(calcMinY, fmtY) || calcMinY}</span>`;
  html += `<span class="axis-title">${escapeHtml(yAxisTitle)}</span>`;
  html += `</div>`;

  // Container gets zero position variables for axis line CSS
  const containerStyles = [];
  if (hasNegativeX) containerStyles.push(`--zero-position-x: ${zeroPctX.toFixed(2)}%`);
  if (hasNegativeY) containerStyles.push(`--zero-position-y: ${zeroPctY.toFixed(2)}%`);
  const containerStyle = containerStyles.length > 0 ? ` style="${containerStyles.join('; ')}"` : '';
  html += `<div class="scatter-container"${containerStyle}>`;
  const dotAreaStyle = proportional ? ` style="--data-aspect-ratio: ${dataAspectRatio.toFixed(4)}"` : '';
  html += `<div class="dot-area"${dotAreaStyle}>`;
  html += `<div class="dot-field">`;

  const fmtSize = format?.size || {};
  dots.forEach((dot, i) => {
    const xPct = rangeX > 0 ? ((dot.x - calcMinX) / rangeX) * 100 : 0;
    const yPct = rangeY > 0 ? ((dot.y - calcMinY) / rangeY) * 100 : 0;
    const colorIndex = seriesIndex.get(dot.series) + 1;
    const colorClass = `chart-color-${colorIndex}`;
    const seriesClass = `chart-series-${slugify(dot.series)}`;
    const fmtXVal = formatNumber(dot.x, fmtX) || dot.x;
    const fmtYVal = formatNumber(dot.y, fmtY) || dot.y;

    // Build tooltip with optional size value
    let tooltipText = dot.label ? `${dot.label}: (${fmtXVal}, ${fmtYVal})` : `(${fmtXVal}, ${fmtYVal})`;
    if (sizeKey && dot.rawSize !== null) {
      const fmtSizeVal = formatNumber(dot.rawSize, fmtSize) || dot.rawSize;
      tooltipText += ` [${fmtSizeVal}]`;
    }

    // Build style string with optional size scale
    let styleStr = `--dot-index: ${i}; --x: ${xPct.toFixed(2)}%; --value: ${yPct.toFixed(2)}%`;
    if (sizeKey) {
      styleStr += `; --size-scale: ${dot.sizeScale.toFixed(4)}`;
    }

    html += `<div class="dot ${colorClass} ${seriesClass}" `;
    html += `style="${styleStr}" `;
    html += `title="${escapeHtml(tooltipText)}"`;
    html += `></div>`;
  });

  html += `</div>`;
  html += `</div>`;

  // X-axis
  const xAxisStyle = hasNegativeX ? ` style="--zero-position-x: ${zeroPctX.toFixed(2)}%"` : '';
  html += `<div class="chart-x-axis"${xAxisStyle}>`;
  html += `<span class="axis-label">${formatNumber(calcMinX, fmtX) || calcMinX}</span>`;
  const midLabelX = hasNegativeX ? 0 : Math.round((calcMaxX + calcMinX) / 2);
  html += `<span class="axis-label">${formatNumber(midLabelX, fmtX) || midLabelX}</span>`;
  html += `<span class="axis-label">${formatNumber(calcMaxX, fmtX) || calcMaxX}</span>`;
  html += `<span class="axis-title">${escapeHtml(xAxisTitle)}</span>`;
  html += `</div>`;

  html += `</div>`;
  html += `</div>`;

  // Legend (if multiple series or legendTitle specified)
  if (seriesList.length > 1 || legend || legendTitle) {
    const legendLabels = legend ?? seriesList;
    if (legendTitle) {
      html += `<span class="chart-legend-title">${escapeHtml(legendTitle)}</span>`;
    }
    html += `<ul class="chart-legend">`;
    seriesList.forEach((series, i) => {
      const label = legendLabels[i] ?? series;
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(series)}`;
      html += `<li class="chart-legend-item ${colorClass} ${seriesClass}">${escapeHtml(label)}</li>`;
    });
    html += `</ul>`;
  }

  // Size legend (when sizeTitle is specified and size column exists)
  if (sizeTitle && sizeKey) {
    const sizeValues = dots.map(d => d.rawSize).filter(v => v > 0);
    const minSizeVal = sizeValues.length ? Math.min(...sizeValues) : 0;
    const maxSizeVal = sizeValues.length ? Math.max(...sizeValues) : 0;
    const fmtSizeLegend = format?.size || format || {};
    const minFormatted = formatNumber(minSizeVal, fmtSizeLegend) || minSizeVal;
    const maxFormatted = formatNumber(maxSizeVal, fmtSizeLegend) || maxSizeVal;

    html += `<div class="chart-size-legend">`;
    html += `<span class="chart-legend-title">${escapeHtml(sizeTitle)}</span>`;
    html += `<div class="size-legend-items">`;
    html += `<span class="size-legend-item"><span class="size-dot size-dot-min"></span><span class="size-value">${minFormatted}</span></span>`;
    html += `<span class="size-legend-item"><span class="size-dot size-dot-max"></span><span class="size-value">${maxFormatted}</span></span>`;
    html += `</div>`;
    html += `</div>`;
  }

  html += renderDownloadLink(downloadDataUrl, downloadData);
  html += `</figure>`;

  return html;
}
