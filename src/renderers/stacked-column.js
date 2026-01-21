import { slugify, getLabelKey, getSeriesNames, escapeHtml, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';

/**
 * Render a stacked column chart (vertical)
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data
 * @param {number} [config.max] - Maximum value for Y-axis scaling
 * @param {number} [config.min] - Minimum value for Y-axis scaling (for negative values)
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @returns {string} - HTML string
 */
export function renderStackedColumn(config) {
  const { title, subtitle, data, max, min, legend, animate, format, id, rotateLabels, download, downloadUrl } = config;

  if (!data || data.length === 0) {
    return `<!-- Stacked column chart: no data provided -->`;
  }

  // Get label key (first column) and series keys (remaining columns)
  const labelKey = getLabelKey(data);
  const seriesKeys = getSeriesNames(data);
  // Use legend for display labels, fall back to data keys
  const legendLabels = legend ?? seriesKeys;
  const animateClass = animate ? ' chart-animate' : '';

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

  const hasNegativeY = minNegativeStack < 0 || min < 0;
  const maxValue = max ?? maxPositiveStack;
  const minValue = min ?? minNegativeStack;
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

  // Y-axis with --zero-position for label positioning
  const yAxisStyle = hasNegativeY ? ` style="--zero-position: ${zeroPct.toFixed(2)}%"` : '';
  html += `<div class="chart-y-axis"${yAxisStyle}>`;
  html += `<span class="axis-label">${formatNumber(maxValue, format) || maxValue}</span>`;
  const midLabelY = hasNegativeY ? 0 : Math.round(maxValue / 2);
  html += `<span class="axis-label">${formatNumber(midLabelY, format) || midLabelY}</span>`;
  const minLabelY = hasNegativeY ? minValue : 0;
  html += `<span class="axis-label">${formatNumber(minLabelY, format) || minLabelY}</span>`;
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
        const seriesLabel = legendLabels[i] ?? key;
        const segmentHeight = range > 0 ? (Math.abs(value) / range) * 100 : 0;

        if (value >= 0) {
          segments.push({
            classes: `column-segment ${colorClass} ${seriesClass}`,
            bottom: positiveBottom,
            height: segmentHeight,
            title: `${escapeHtml(seriesLabel)}: ${formatNumber(value, format) || value}`,
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
            title: `${escapeHtml(seriesLabel)}: ${formatNumber(value, format) || value}`,
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
        const seriesLabel = legendLabels[seg.i] ?? seg.key;
        const endClass = idx === lastIdx ? ' is-stack-end' : '';
        html += `<div class="column-segment ${colorClass} ${seriesClass}${endClass}" `;
        html += `style="--value: ${seg.pct.toFixed(2)}%" `;
        html += `title="${escapeHtml(seriesLabel)}: ${formatNumber(seg.value, format) || seg.value}"></div>`;
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
  html += renderDownloadLink(downloadUrl, download);
  html += `</figure>`;

  return html;
}
