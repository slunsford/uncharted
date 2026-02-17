import { slugify, escapeHtml, getLabelKey, getSeriesNames, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';
import { getAxisMax, getAxisMin, getAxisFormat, getRotateLabels } from '../config.js';

/**
 * Render a categorical dot chart (columns with dots at different Y positions)
 * Like atlas-wrapped's adoption chart - discrete X axis, continuous Y axis
 * @param {Object} config - Chart configuration (normalized)
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data with label column and value columns
 * @param {Object} [config.y] - Y-axis configuration { max, min, format }
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @param {Object} [config._columns] - Resolved column mappings
 * @returns {string} - HTML string
 */
export function renderDot(config) {
  const { title, subtitle, data, max, min, legend, legendTitle, animate, format, id, downloadData, downloadDataUrl, connectDots, dots: showDots = true, icons, chartType = 'dot', _columns } = config;

  if (!data || data.length === 0) {
    return `<!-- Dot chart: no data provided -->`;
  }

  // Get label key and series keys (use resolved columns if available)
  const labelKey = _columns?.label ?? getLabelKey(data);
  const seriesKeys = _columns?.values?.length > 0 ? _columns.values : getSeriesNames(data);

  // Build legend labels from: 1) yLabels (new), 2) legend array (deprecated), 3) column names
  const yLabels = _columns?.yLabels || {};
  const getSeriesLabel = (key, index) => {
    if (yLabels[key]) return yLabels[key];
    if (Array.isArray(legend)) return legend[index] ?? key;
    return key;
  };

  // Helper to get icon for a series
  const getSeriesIcon = (key) => {
    if (!icons) return null;
    if (typeof icons === 'string') return icons;
    return icons[key] ?? null;
  };

  const animateClass = animate ? ' chart-animate' : '';
  const rotateLabels = getRotateLabels(config, config.id);

  // Get Y-axis format
  const yFormat = getAxisFormat(config, 'y');

  // Calculate min and max values for Y scaling (exclude null values)
  const allValues = data.flatMap(row =>
    seriesKeys.map(key => row[key]).filter(val => val !== null && val !== undefined && val !== '')
  ).map(val => typeof val === 'number' ? val : parseFloat(val)).filter(v => !isNaN(v));
  const dataMax = Math.max(...allValues);
  const dataMin = Math.min(...allValues);

  // Use normalized axis config, fall back to legacy top-level max/min
  const maxValue = getAxisMax(config, 'y') ?? max ?? dataMax;
  const minValue = getAxisMin(config, 'y') ?? min ?? (dataMin < 0 ? dataMin : 0);
  const range = maxValue - minValue;
  const hasNegativeY = minValue < 0;

  // Calculate zero position for axis line
  const zeroPct = hasNegativeY ? ((0 - minValue) / range) * 100 : 0;

  const negativeClass = hasNegativeY ? ' has-negative-y' : '';
  const idClass = id ? ` chart-${id}` : '';
  const rotateClass = rotateLabels ? ' rotate-labels' : '';
  // Add no-dots class if dots are disabled (icons only affect legend, not dots)
  const dotsClass = !showDots ? ' no-dots' : '';
  let html = `<figure class="chart chart-${chartType}${animateClass}${negativeClass}${idClass}${rotateClass}${dotsClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  html += `<div class="chart-body">`;

  // Y-axis
  const yAxisStyle = hasNegativeY ? ` style="--zero-position: ${zeroPct.toFixed(2)}%"` : '';
  html += `<div class="chart-y-axis"${yAxisStyle}>`;
  html += `<span class="axis-label">${formatNumber(maxValue, yFormat) || maxValue}</span>`;
  const midLabelY = hasNegativeY ? 0 : Math.round((maxValue + minValue) / 2);
  html += `<span class="axis-label">${formatNumber(midLabelY, yFormat) || midLabelY}</span>`;
  html += `<span class="axis-label">${formatNumber(minValue, yFormat) || minValue}</span>`;
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

  // CSS line segments connecting dots (rendered before dot-cols so they stack behind)
  // Skip segments where either endpoint is null (gap in data)
  if (connectDots && data.length > 1) {
    let segIndex = 0;
    seriesKeys.forEach((key, i) => {
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      for (let colIndex = 0; colIndex < data.length - 1; colIndex++) {
        const val1 = data[colIndex][key];
        const val2 = data[colIndex + 1][key];
        // Skip segment if either endpoint is null/missing
        if (val1 === null || val1 === undefined || val1 === '' ||
            val2 === null || val2 === undefined || val2 === '') {
          continue;
        }
        const v1 = typeof val1 === 'number' ? val1 : parseFloat(val1);
        const v2 = typeof val2 === 'number' ? val2 : parseFloat(val2);
        const y1 = range > 0 ? ((v1 - minValue) / range) * 100 : 0;
        const y2 = range > 0 ? ((v2 - minValue) / range) * 100 : 0;
        const x1 = ((colIndex + 0.5) / data.length) * 100;
        const x2 = ((colIndex + 1.5) / data.length) * 100;
        html += `<div class="chart-line-segment ${colorClass} ${seriesClass}" `;
        html += `style="--x1: ${x1.toFixed(2)}; --y1: ${y1.toFixed(2)}; --x2: ${x2.toFixed(2)}; --y2: ${y2.toFixed(2)}; --seg-index: ${segIndex}">`;
        html += `</div>`;
        segIndex++;
      }
    });
  }

  // Always render dots for hover/tooltips (CSS handles visibility)
  // Only show icons inside dots when dots are visible
  data.forEach((row, colIndex) => {
    const label = row[labelKey] ?? '';

    html += `<div class="dot-col" style="--col-index: ${colIndex}">`;

    seriesKeys.forEach((key, i) => {
      const val = row[key];
      // Skip null/missing values - don't render a dot
      if (val === null || val === undefined || val === '') return;

      const value = typeof val === 'number' ? val : parseFloat(val) || 0;
      const yPct = range > 0 ? ((value - minValue) / range) * 100 : 0;
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      const tooltipLabel = getSeriesLabel(key, i);
      const icon = showDots ? getSeriesIcon(key) : null;
      const iconClass = icon ? ' has-icon' : '';

      html += `<div class="dot ${colorClass} ${seriesClass}${iconClass}" `;
      html += `style="--value: ${yPct.toFixed(2)}%" `;
      html += `title="${escapeHtml(tooltipLabel)}: ${formatNumber(value, yFormat) || value}"`;
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
  data.forEach(row => {
    const label = row[labelKey] ?? '';
    html += `<span class="dot-label">${escapeHtml(label)}</span>`;
  });
  html += `</div>`;

  html += `</div>`; // close chart-scroll
  html += `</div>`; // close chart-body

  // Legend (show if legend !== false and we have series keys or legendTitle)
  const showLegend = config.legend !== false && (seriesKeys.length > 0 || legendTitle);
  if (showLegend) {
    if (legendTitle) {
      html += `<span class="chart-legend-title">${escapeHtml(legendTitle)}</span>`;
    }
    html += `<div class="chart-legend">`;
    seriesKeys.forEach((key, i) => {
      const label = getSeriesLabel(key, i);
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      const icon = getSeriesIcon(key);
      const iconClass = icon ? ' has-icon' : '';
      html += `<span class="chart-legend-item ${colorClass} ${seriesClass}${iconClass}">`;
      if (icon) {
        html += `<i class="${escapeHtml(icon)}"></i>`;
      }
      html += `${escapeHtml(label)}</span>`;
    });
    html += `</div>`;
  }

  html += renderDownloadLink(downloadDataUrl, downloadData);
  html += `</figure>`;

  return html;
}
