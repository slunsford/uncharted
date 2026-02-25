import { slugify, getLabelKey, getSeriesNames, escapeHtml, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';
import { getAxisMax, getAxisMin, getAxisFormat, getRotateLabels } from '../config.js';

/**
 * Render a stacked column chart (vertical)
 * @param {Object} config - Chart configuration (normalized)
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data
 * @param {Object} [config.y] - Y-axis configuration { max, min, format }
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @param {Object} [config._columns] - Resolved column mappings
 * @returns {string} - HTML string
 */
export function renderStackedColumn(config) {
  const { title, subtitle, data, max, min, legend, animate, format, id, downloadData, downloadDataUrl, _columns } = config;

  if (!data || data.length === 0) {
    return `<!-- Stacked column chart: no data provided -->`;
  }

  // Get label key and series keys (use resolved columns if available)
  const labelKey = _columns?.label ?? getLabelKey(data);
  const seriesKeys = _columns?.values?.length > 0 ? _columns.values : getSeriesNames(data);

  // Build legend labels from yLabels (new schema) or column names
  const yLabels = _columns?.yLabels || {};
  const getSeriesLabel = (key) => {
    if (yLabels[key]) return yLabels[key];
    return key;
  };

  const animateClass = animate ? ' chart-animate' : '';
  const rotateLabels = getRotateLabels(config);

  // Get Y-axis format
  const yFormat = getAxisFormat(config, 'y');

  // Calculate stacked totals for positive and negative values separately
  // Positives stack up from zero, negatives stack down from zero
  let maxPositiveStack = 0;
  let minNegativeStack = 0;

  data.forEach(row => {
    let positiveSum = 0;
    let negativeSum = 0;
    seriesKeys.forEach(key => {
      const val = row[key];
      const value = typeof val === 'number' ? val : parseFloat(val) || 0;
      if (value >= 0) {
        positiveSum += value;
      } else {
        negativeSum += value;
      }
    });
    maxPositiveStack = Math.max(maxPositiveStack, positiveSum);
    minNegativeStack = Math.min(minNegativeStack, negativeSum);
  });

  // Use normalized axis config, fall back to legacy top-level max/min
  const configMaxY = getAxisMax(config, 'y') ?? max;
  const configMinY = getAxisMin(config, 'y') ?? min;
  const hasNegativeY = minNegativeStack < 0 || configMinY < 0;
  const maxValue = configMaxY ?? maxPositiveStack;
  const minValue = configMinY ?? minNegativeStack;
  const range = maxValue - minValue;
  const zeroPct = hasNegativeY ? ((0 - minValue) / range) * 100 : 0;

  const negativeClass = hasNegativeY ? ' has-negative-y' : '';
  const idClass = id ? ` chart-${id}` : '';
  const rotateClass = rotateLabels ? ' rotate-labels' : '';
  let html = `<figure class="chart chart-stacked-column${animateClass}${negativeClass}${idClass}${rotateClass}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  html += `<div class="chart-body">`;

  // Y-axis with --zero-position for label positioning
  const yAxisStyle = hasNegativeY ? ` style="--zero-position: ${zeroPct.toFixed(2)}%"` : '';
  html += `<div class="chart-y-axis"${yAxisStyle}>`;
  html += `<span class="axis-label">${formatNumber(maxValue, yFormat) || maxValue}</span>`;
  const midLabelY = hasNegativeY ? 0 : Math.round(maxValue / 2);
  html += `<span class="axis-label">${formatNumber(midLabelY, yFormat) || midLabelY}</span>`;
  const minLabelY = hasNegativeY ? minValue : 0;
  html += `<span class="axis-label">${formatNumber(minLabelY, yFormat) || minLabelY}</span>`;
  html += `</div>`;

  // Scroll wrapper for columns + labels
  html += `<div class="chart-scroll">`;

  // Calculate delay step to cap total stagger at 1s
  const maxStagger = 1; // seconds
  const defaultDelay = 0.05; // seconds
  const delayStep = data.length > 1 ? Math.min(defaultDelay, maxStagger / (data.length - 1)) : 0;
  const styleVars = [`--delay-step: ${delayStep.toFixed(3)}s`];
  if (hasNegativeY) styleVars.push(`--zero-position: ${zeroPct.toFixed(2)}%`);
  html += `<div class="chart-columns" style="${styleVars.join('; ')}">`;

  data.forEach((row, colIndex) => {
    const label = row[labelKey] ?? '';
    html += `<div class="column-track" style="--col-index: ${colIndex}" title="${escapeHtml(label)}">`;

    if (hasNegativeY) {
      // Build segments first to identify stack ends
      const segments = [];
      let positiveBottom = zeroPct;
      let negativeTop = zeroPct;
      let lastPositiveIdx = -1;
      let lastNegativeIdx = -1;

      seriesKeys.forEach((key, i) => {
        const val = row[key];
        const value = typeof val === 'number' ? val : parseFloat(val) || 0;
        const colorClass = `chart-color-${i + 1}`;
        const seriesClass = `chart-series-${slugify(key)}`;
        const seriesLabel = getSeriesLabel(key);
        const segmentHeight = range > 0 ? (Math.abs(value) / range) * 100 : 0;

        if (value >= 0) {
          segments.push({
            classes: `column-segment ${colorClass} ${seriesClass}`,
            bottom: positiveBottom,
            height: segmentHeight,
            title: `${escapeHtml(seriesLabel)}: ${formatNumber(value, yFormat) || value}`,
            isNegative: false
          });
          lastPositiveIdx = segments.length - 1;
          positiveBottom += segmentHeight;
        } else {
          negativeTop -= segmentHeight;
          segments.push({
            classes: `column-segment ${colorClass} ${seriesClass} is-negative`,
            bottom: negativeTop,
            height: segmentHeight,
            title: `${escapeHtml(seriesLabel)}: ${formatNumber(value, yFormat) || value}`,
            isNegative: true
          });
          lastNegativeIdx = segments.length - 1;
        }
      });

      // Output segments with stack-end class on outermost segments
      segments.forEach((seg, idx) => {
        const endClass = (idx === lastPositiveIdx || idx === lastNegativeIdx) ? ' is-stack-end' : '';
        html += `<div class="${seg.classes}${endClass}" `;
        html += `style="--value-bottom: ${seg.bottom.toFixed(2)}%; --value-height: ${seg.height.toFixed(2)}%" `;
        html += `title="${seg.title}"></div>`;
      });
    } else {
      // Original stacked behavior for positive-only
      const segmentData = [];

      seriesKeys.forEach((key, i) => {
        const val = row[key];
        const value = typeof val === 'number' ? val : parseFloat(val) || 0;
        const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
        if (pct > 0) {
          segmentData.push({ key, i, value, pct });
        }
      });

      const lastIdx = segmentData.length - 1;
      segmentData.forEach((seg, idx) => {
        const colorClass = `chart-color-${seg.i + 1}`;
        const seriesClass = `chart-series-${slugify(seg.key)}`;
        const seriesLabel = getSeriesLabel(seg.key, seg.i);
        const endClass = idx === lastIdx ? ' is-stack-end' : '';
        html += `<div class="column-segment ${colorClass} ${seriesClass}${endClass}" `;
        html += `style="--value: ${seg.pct.toFixed(2)}%" `;
        html += `title="${escapeHtml(seriesLabel)}: ${formatNumber(seg.value, yFormat) || seg.value}"></div>`;
      });
    }

    html += `</div>`;
  });

  html += `</div>`;

  // X-axis labels
  html += `<div class="column-labels">`;
  data.forEach(row => {
    const label = row[labelKey] ?? '';
    html += `<span class="column-label">${escapeHtml(label)}</span>`;
  });
  html += `</div>`;

  html += `</div>`; // close chart-scroll
  html += `</div>`; // close chart-body

  // Legend (show if legend !== false and we have series keys)
  const showLegend = config.legend !== false && seriesKeys.length > 0;
  if (showLegend) {
    html += `<div class="chart-legend">`;
    seriesKeys.forEach((key, i) => {
      const label = getSeriesLabel(key);
      const colorClass = `chart-color-${i + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      html += `<span class="chart-legend-item ${colorClass} ${seriesClass}">${escapeHtml(label)}</span>`;
    });
    html += `</div>`;
  }

  html += renderDownloadLink(downloadDataUrl, downloadData);
  html += `</figure>`;

  return html;
}
