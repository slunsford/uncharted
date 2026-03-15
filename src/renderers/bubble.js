import { slugify, escapeHtml, renderDownloadLinks } from '../utils.js';
import { formatNumber } from '../formatters.js';
import { getAxisMax, getAxisMin, getAxisTitle, getAxisFormat, getRotateLabels } from '../config.js';

/**
 * Render a bubble chart (categorical X axis, continuous Y, variable dot sizes)
 * Like scatter but with categorical X axis and always variable-sized dots
 * @param {Object} config - Chart configuration (normalized)
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data (x, y, size, optional series columns)
 * @param {Object} [config.y] - Y-axis configuration { max, min, title, format }
 * @param {Object} [config.size] - Size configuration { title }
 * @param {string[]} [config.legend] - Legend labels for series
 * @param {boolean} [config.animate] - Enable animations
 * @param {Object} [config._columns] - Resolved column mappings
 * @returns {string} - HTML string
 */
export function renderBubble(config) {
  const { title, subtitle, data, legend, animate, format, id, downloadData, downloadDataUrl, downloadImage, downloadImageUrl, icons, _columns } = config;

  // Get axis-specific format configs
  const fmtY = getAxisFormat(config, 'y');

  if (!data || data.length === 0) {
    return `<!-- Bubble chart: no data provided -->`;
  }

  const animateClass = animate ? ' chart-animate' : '';
  const rotateLabels = getRotateLabels(config);

  // Use resolved columns if available, otherwise fall back to implicit detection
  const keys = Object.keys(data[0]);
  const findKey = name => keys.find(k => k.toLowerCase() === name) || null;

  let xKey, yKey, sizeKey, seriesKey;

  if (_columns) {
    xKey = _columns.x;
    yKey = _columns.y;
    sizeKey = _columns.size;
    seriesKey = _columns.series;
  } else {
    const namedX = findKey('x');
    const namedY = findKey('y');
    xKey = namedX || keys[0];
    yKey = namedY || keys[1];
    sizeKey = findKey('size') || keys[2];
    seriesKey = findKey('series');
  }

  // Get legend/size titles from resolved columns (new schema only)
  const legendTitle = _columns?.seriesTitle;
  const sizeTitle = _columns?.sizeTitle;

  // Axis titles
  const xAxisTitle = getAxisTitle(config, 'x', '');
  const yAxisTitle = getAxisTitle(config, 'y', '');

  // Map data to dots
  const dots = data.map(item => ({
    x: item[xKey] ?? '',
    y: typeof item[yKey] === 'number' ? item[yKey] : parseFloat(item[yKey]) || 0,
    rawSize: sizeKey ? (typeof item[sizeKey] === 'number' ? item[sizeKey] : parseFloat(item[sizeKey]) || 0) : null,
    series: seriesKey ? (item[seriesKey] ?? 'default') : 'default'
  }));

  // Get unique X categories (maintain data order)
  const seenCategories = new Set();
  const categories = [];
  dots.forEach(d => {
    if (!seenCategories.has(d.x)) {
      seenCategories.add(d.x);
      categories.push(d.x);
    }
  });

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

  // Calculate Y bounds
  const yValues = dots.map(d => d.y);
  const dataMaxY = Math.max(...yValues);
  const dataMinY = Math.min(...yValues);

  const calcMaxY = getAxisMax(config, 'y') ?? dataMaxY;
  const calcMinY = getAxisMin(config, 'y') ?? (dataMinY < 0 ? dataMinY : 0);
  const rangeY = calcMaxY - calcMinY;

  const hasNegativeY = calcMinY < 0;
  const zeroPctY = hasNegativeY ? ((0 - calcMinY) / rangeY) * 100 : 0;

  // Get unique series
  const seriesSet = new Set(dots.map(d => d.series));
  const seriesList = Array.from(seriesSet);
  const seriesIndex = new Map(seriesList.map((s, i) => [s, i]));

  // Helper to get icon for a series
  const getSeriesIcon = (seriesName) => {
    if (!icons) return null;
    if (typeof icons === 'string') return icons;
    return icons[seriesName] ?? null;
  };

  const negativeClass = hasNegativeY ? ' has-negative-y' : '';
  const idClass = id ? ` chart-${id}` : '';
  const rotateClass = rotateLabels ? ' rotate-labels' : '';
  let html = `<figure class="chart chart-bubble${animateClass}${negativeClass}${idClass}${rotateClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  html += `<div class="chart-body">`;

  // Y-axis
  const yAxisStyle = hasNegativeY ? ` style="--zero-position: ${zeroPctY.toFixed(2)}%"` : '';
  html += `<div class="chart-y-axis"${yAxisStyle}>`;
  html += `<span class="axis-label">${formatNumber(calcMaxY, fmtY) || calcMaxY}</span>`;
  const midLabelY = hasNegativeY ? 0 : Math.round((calcMaxY + calcMinY) / 2);
  html += `<span class="axis-label">${formatNumber(midLabelY, fmtY) || midLabelY}</span>`;
  html += `<span class="axis-label">${formatNumber(calcMinY, fmtY) || calcMinY}</span>`;
  if (yAxisTitle) {
    html += `<span class="axis-title">${escapeHtml(yAxisTitle)}</span>`;
  }
  html += `</div>`;

  // Scroll wrapper for chart + labels
  html += `<div class="chart-scroll">`;

  // Calculate delay step to cap total stagger at 1s
  const maxStagger = 1;
  const defaultDelay = 0.08;
  const delayStep = dots.length > 1 ? Math.min(defaultDelay, maxStagger / (dots.length - 1)) : 0;
  const styleVars = [`--delay-step: ${delayStep.toFixed(3)}s`];
  if (hasNegativeY) styleVars.push(`--zero-position: ${zeroPctY.toFixed(2)}%`);
  html += `<div class="dot-chart" style="${styleVars.join('; ')}">`;
  html += `<div class="dot-field">`;

  // Group dots by category
  const dotsByCategory = new Map();
  categories.forEach(cat => dotsByCategory.set(cat, []));
  dots.forEach((dot, i) => {
    dotsByCategory.get(dot.x).push({ ...dot, originalIndex: i });
  });

  const fmtSize = _columns?.sizeFormat || {};

  // Render dots by category column
  categories.forEach((category, colIndex) => {
    const categoryDots = dotsByCategory.get(category);

    html += `<div class="dot-col" style="--col-index: ${colIndex}">`;

    categoryDots.forEach((dot) => {
      const yPct = rangeY > 0 ? ((dot.y - calcMinY) / rangeY) * 100 : 0;
      const colorIndex = seriesIndex.get(dot.series) + 1;
      const colorClass = `chart-color-${colorIndex}`;
      const seriesClass = `chart-series-${slugify(dot.series)}`;
      const icon = getSeriesIcon(dot.series);
      const iconClass = icon ? ' has-icon' : '';

      // Build tooltip: series: value, plus size if available
      const fmtYVal = formatNumber(dot.y, fmtY) || dot.y;
      let tooltipText = seriesList.length > 1 ? `${dot.series}: ${fmtYVal}` : `${fmtYVal}`;
      if (sizeKey && dot.rawSize !== null) {
        const fmtSizeVal = formatNumber(dot.rawSize, fmtSize) || dot.rawSize;
        const sizeLabel = sizeTitle || sizeKey;
        tooltipText += ` — ${sizeLabel}: ${fmtSizeVal}`;
      }

      // Build style string with size scale
      let styleStr = `--value: ${yPct.toFixed(2)}%; --dot-index: ${dot.originalIndex}`;
      if (sizeKey) {
        styleStr += `; --size-scale: ${dot.sizeScale.toFixed(4)}`;
      }

      html += `<div class="dot ${colorClass} ${seriesClass}${iconClass}" `;
      html += `style="${styleStr}" `;
      html += `title="${escapeHtml(tooltipText)}"`;
      html += `>`;
      if (icon) {
        html += `<i class="${escapeHtml(icon)}"></i>`;
      }
      html += `</div>`;
    });

    html += `</div>`;
  });

  html += `</div>`; // close dot-field
  html += `</div>`; // close dot-chart

  // X-axis labels
  html += `<div class="dot-labels">`;
  categories.forEach(category => {
    html += `<span class="dot-label">${escapeHtml(category)}</span>`;
  });
  html += `</div>`;

  html += `</div>`; // close chart-scroll
  if (xAxisTitle) {
    html += `<span class="axis-title">${escapeHtml(xAxisTitle)}</span>`;
  }
  html += `</div>`; // close chart-body

  // Legend (if multiple series or legendTitle specified)
  // Note: legend array is deprecated; use series names directly
  if (seriesList.length > 1 || legendTitle) {
    const legendLabels = seriesList;
    if (legendTitle) {
      html += `<span class="chart-legend-title">${escapeHtml(legendTitle)}</span>`;
    }
    html += `<div class="chart-legend">`;
    seriesList.forEach((series, i) => {
      const label = legendLabels[i] ?? series;
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(series)}`;
      const icon = getSeriesIcon(series);
      const iconClass = icon ? ' has-icon' : '';
      html += `<span class="chart-legend-item ${colorClass} ${seriesClass}${iconClass}">`;
      if (icon) {
        html += `<i class="${escapeHtml(icon)}"></i>`;
      }
      html += `${escapeHtml(label)}</span>`;
    });
    html += `</div>`;
  }

  // Size legend (when sizeTitle is specified and size column exists)
  if (sizeTitle && sizeKey) {
    const sizeValues = dots.map(d => d.rawSize).filter(v => v > 0);
    const minSizeVal = sizeValues.length ? Math.min(...sizeValues) : 0;
    const maxSizeVal = sizeValues.length ? Math.max(...sizeValues) : 0;
    const fmtSizeLegend = _columns?.sizeFormat || {};
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

  html += renderDownloadLinks(downloadDataUrl, downloadData, downloadImageUrl, downloadImage);
  html += `</figure>`;

  return html;
}
