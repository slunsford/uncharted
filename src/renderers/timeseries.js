import { slugify, escapeHtml, getLabelKey, getSeriesNames, renderDownloadLinks } from '../utils.js';
import { formatNumber } from '../formatters.js';
import { getAxisMax, getAxisMin, getAxisTitle, getAxisFormat, getRotateLabels } from '../config.js';

/**
 * Parse an x-axis value as a numeric timestamp
 * Supports: numeric years (1971, 2024) or ISO dates (2024-02-17)
 * @param {string|number} value - Raw x value
 * @returns {number|null} - Numeric value for positioning, or null if invalid
 */
function parseXValue(value) {
  if (value === null || value === undefined || value === '') return null;

  // If it's already a number, use as-is (year or numeric value)
  if (typeof value === 'number') return value;

  const str = String(value).trim();

  // Check if it's a pure integer (year like 1971, 2024)
  if (/^\d{4}$/.test(str)) {
    return parseInt(str, 10);
  }

  // Check if it looks like a number
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }

  // Try parsing as ISO date
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    return timestamp;
  }

  return null;
}

/**
 * Detect if x values are date timestamps (vs numeric years)
 * @param {number[]} values - Parsed x values
 * @returns {boolean} - True if values appear to be timestamps
 */
function isDateTimestamp(values) {
  if (values.length === 0) return false;
  // Timestamps are typically > 1e9 (around year 2001 in seconds, or 1970 in ms)
  // Years are typically < 3000
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return avg > 100000; // If average is > 100000, likely timestamps
}

/**
 * Calculate nice interval for axis ticks
 * @param {number} range - Data range
 * @param {boolean} isDate - Whether values are date timestamps
 * @returns {number} - Nice interval value
 */
function getNiceInterval(range, isDate) {
  if (isDate) {
    // Date ranges in milliseconds
    const MS_DAY = 86400000;
    const MS_WEEK = MS_DAY * 7;
    const MS_MONTH = MS_DAY * 30;
    const MS_YEAR = MS_DAY * 365;

    if (range > MS_YEAR * 50) return MS_YEAR * 10;  // Decades
    if (range > MS_YEAR * 10) return MS_YEAR * 5;   // 5 years
    if (range > MS_YEAR * 2) return MS_YEAR;        // Years
    if (range > MS_MONTH * 6) return MS_MONTH * 3;  // Quarters
    if (range > MS_MONTH * 2) return MS_MONTH;      // Months
    if (range > MS_WEEK * 2) return MS_WEEK;        // Weeks
    return MS_DAY;                                   // Days
  }

  // Numeric ranges (years) - minimum interval of 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
  const normalized = range / magnitude;

  let interval;
  if (normalized <= 2) interval = magnitude / 5;
  else if (normalized <= 5) interval = magnitude / 2;
  else interval = magnitude;

  return Math.max(1, interval);
}

/**
 * Round value down to interval boundary
 * For dates, aligns to calendar boundaries (month starts)
 * @param {number} value - Value to round
 * @param {number} interval - Interval size
 * @param {boolean} isDate - Whether value is a date timestamp
 * @returns {number} - Rounded value
 */
function floorToInterval(value, interval, isDate) {
  if (!isDate) {
    return Math.floor(value / interval) * interval;
  }

  // For dates, align to calendar month boundaries
  const date = new Date(value);
  const MS_DAY = 86400000;
  const MS_WEEK = MS_DAY * 7;
  const MS_MONTH = MS_DAY * 30;

  if (interval <= MS_WEEK) {
    // Weekly or daily: just floor to interval from epoch
    return Math.floor(value / interval) * interval;
  }

  // Monthly or longer: align to start of month
  const year = date.getFullYear();
  const month = date.getMonth();

  // Calculate months per interval
  const monthsPerInterval = Math.round(interval / MS_MONTH);

  // Floor month to interval boundary
  const flooredMonth = Math.floor(month / monthsPerInterval) * monthsPerInterval;

  return Date.UTC(year, flooredMonth, 1);
}

/**
 * Get next interval value for dates (calendar-aware)
 * @param {number} value - Current value
 * @param {number} interval - Interval size
 * @param {boolean} isDate - Whether value is a date timestamp
 * @returns {number} - Next interval value
 */
function nextInterval(value, interval, isDate) {
  if (!isDate) {
    return value + interval;
  }

  const MS_DAY = 86400000;
  const MS_WEEK = MS_DAY * 7;
  const MS_MONTH = MS_DAY * 30;

  if (interval <= MS_WEEK) {
    return value + interval;
  }

  // Monthly or longer: add months
  const date = new Date(value);
  const monthsPerInterval = Math.round(interval / MS_MONTH);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthsPerInterval, 1);
}

/**
 * Format x-axis tick label
 * @param {number} value - Tick value
 * @param {boolean} isDate - Whether value is a date timestamp
 * @param {number} range - Total range for context
 * @returns {string} - Formatted label
 */
function formatXLabel(value, isDate, range) {
  if (!isDate) {
    // Numeric years - just return as integer
    return String(Math.round(value));
  }

  // Date formatting
  const date = new Date(value);
  const MS_YEAR = 86400000 * 365;
  const MS_MONTH = 86400000 * 30;

  if (range > MS_YEAR * 2) {
    // Multi-year range: just show year
    return String(date.getFullYear());
  }

  if (range > MS_MONTH * 2) {
    // Months range: show MMM over YYYY (two lines)
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${month}<br>${year}`;
  }

  // Days/weeks range: show D MMM
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month}`;
}

/**
 * Generate axis ticks at regular intervals
 * @param {number} min - Data minimum
 * @param {number} max - Data maximum
 * @param {boolean} isDate - Whether values are date timestamps
 * @returns {Array<{value: number, label: string}>} - Tick objects
 */
function getAxisTicks(min, max, isDate) {
  const range = max - min;
  if (range <= 0) return [{ value: min, label: formatXLabel(min, isDate, range) }];

  const interval = getNiceInterval(range, isDate);
  const ticks = [];

  // Start at first interval boundary at or before min
  let tick = floorToInterval(min, interval, isDate);

  // If first tick is too far before min, start at next interval
  if (tick < min - interval * 0.1) {
    tick = nextInterval(tick, interval, isDate);
  }

  while (tick <= max + interval * 0.1) {
    ticks.push({
      value: tick,
      label: formatXLabel(tick, isDate, range)
    });
    tick = nextInterval(tick, interval, isDate);
  }

  // Ensure we have at least start and end
  if (ticks.length === 0) {
    return [
      { value: min, label: formatXLabel(min, isDate, range) },
      { value: max, label: formatXLabel(max, isDate, range) }
    ];
  }

  return ticks;
}

/**
 * Render a time-series line chart (continuous X axis with proportional positioning)
 * @param {Object} config - Chart configuration (normalized)
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data with x column and value columns
 * @param {Object} [config.x] - X-axis configuration { column, min, max, title }
 * @param {Object} [config.y] - Y-axis configuration { max, min, format, columns }
 * @param {string[]} [config.legend] - Legend labels (defaults to series names)
 * @param {boolean} [config.animate] - Enable animations
 * @param {Object} [config._columns] - Resolved column mappings
 * @returns {string} - HTML string
 */
export function renderTimeseries(config) {
  const { title, subtitle, data, legend, legendTitle, animate, format, id, downloadData, downloadDataUrl, downloadImage, downloadImageUrl, dots: showDots = false, icons, _columns } = config;

  if (!data || data.length === 0) {
    return `<!-- Timeseries chart: no data provided -->`;
  }

  // Get x column (first column or specified)
  const keys = Object.keys(data[0]);
  const xColumn = config.x?.column ?? _columns?.x ?? keys[0];

  // Get y series keys
  let seriesKeys;
  if (_columns?.values?.length > 0) {
    seriesKeys = _columns.values;
  } else if (config.y?.columns) {
    const cols = config.y.columns;
    seriesKeys = typeof cols === 'object' && !Array.isArray(cols)
      ? Object.keys(cols)
      : Array.isArray(cols) ? cols : [cols];
  } else {
    // Default: all columns except x column
    seriesKeys = keys.filter(k => k !== xColumn);
  }

  // Build legend labels
  // Build legend labels from yLabels (new schema) or column names
  const yLabels = _columns?.yLabels || {};
  const yColumnsLabels = config.y?.columns && typeof config.y.columns === 'object' && !Array.isArray(config.y.columns)
    ? config.y.columns
    : {};
  const getSeriesLabel = (key) => {
    if (yLabels[key]) return yLabels[key];
    if (yColumnsLabels[key]) return yColumnsLabels[key];
    return key;
  };

  // Helper to get icon for a series
  const getSeriesIcon = (key) => {
    if (!icons) return null;
    if (typeof icons === 'string') return icons;
    return icons[key] ?? null;
  };

  const animateClass = animate ? ' chart-animate' : '';

  // Get format configs
  const xFormat = getAxisFormat(config, 'x');
  const yFormat = getAxisFormat(config, 'y');

  // Parse x values and collect data points per series
  const seriesData = new Map();
  seriesKeys.forEach(key => seriesData.set(key, []));

  // Track all x values for range calculation
  const allXValues = [];

  data.forEach((row, rowIndex) => {
    const xRaw = row[xColumn];
    const xVal = parseXValue(xRaw);
    if (xVal === null) return;

    allXValues.push(xVal);

    seriesKeys.forEach(key => {
      const yRaw = row[key];
      if (yRaw === null || yRaw === undefined || yRaw === '') return;
      const yVal = typeof yRaw === 'number' ? yRaw : parseFloat(yRaw);
      if (isNaN(yVal)) return;

      seriesData.get(key).push({
        x: xVal,
        y: yVal,
        label: String(xRaw),
        rowIndex
      });
    });
  });

  // Sort each series by x value
  seriesData.forEach(points => points.sort((a, b) => a.x - b.x));

  // Calculate x range
  const dataMinX = Math.min(...allXValues);
  const dataMaxX = Math.max(...allXValues);
  const isDate = isDateTimestamp(allXValues);

  // Get preliminary range for tick calculation
  const prelimMinX = getAxisMin(config, 'x') ?? dataMinX;
  const prelimMaxX = getAxisMax(config, 'x') ?? dataMaxX;

  // Get x-axis ticks based on data range
  const xTicks = getAxisTicks(prelimMinX, prelimMaxX, isDate);

  // Extend range to include tick boundaries so labels align properly
  const tickMin = xTicks.length > 0 ? Math.min(...xTicks.map(t => t.value)) : prelimMinX;
  const tickMax = xTicks.length > 0 ? Math.max(...xTicks.map(t => t.value)) : prelimMaxX;
  const calcMinX = Math.min(prelimMinX, tickMin);
  const calcMaxX = Math.max(prelimMaxX, tickMax);
  const rangeX = calcMaxX - calcMinX;

  // Calculate y range
  const allYValues = [];
  seriesData.forEach(points => {
    points.forEach(p => allYValues.push(p.y));
  });

  const dataMaxY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
  const dataMinY = allYValues.length > 0 ? Math.min(...allYValues) : 0;

  const maxValue = getAxisMax(config, 'y') ?? config.max ?? dataMaxY;
  const minValue = getAxisMin(config, 'y') ?? config.min ?? (dataMinY < 0 ? dataMinY : 0);
  const rangeY = maxValue - minValue;
  const hasNegativeY = minValue < 0;

  // Calculate zero position for y-axis line
  const zeroPctY = hasNegativeY ? ((0 - minValue) / rangeY) * 100 : 0;

  // Axis titles
  const xAxisTitle = getAxisTitle(config, 'x', '');
  const yAxisTitle = getAxisTitle(config, 'y', '');

  // Count unique x values for scroll width calculation
  const uniqueXCount = new Set(allXValues).size;

  const negativeClass = hasNegativeY ? ' has-negative-y' : '';
  const idClass = id ? ` chart-${id}` : '';
  const dotsClass = !showDots ? ' no-dots' : '';
  let html = `<figure class="chart chart-timeseries${animateClass}${negativeClass}${idClass}${dotsClass}">`;

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
  html += `<span class="axis-label">${formatNumber(maxValue, yFormat) || maxValue}</span>`;
  const midLabelY = hasNegativeY ? 0 : (maxValue + minValue) / 2;
  html += `<span class="axis-label">${formatNumber(midLabelY, yFormat) || midLabelY}</span>`;
  html += `<span class="axis-label">${formatNumber(minValue, yFormat) || minValue}</span>`;
  if (yAxisTitle) {
    html += `<span class="axis-title">${escapeHtml(yAxisTitle)}</span>`;
  }
  html += `</div>`;

  // Scroll wrapper (scrolls when content overflows)
  html += `<div class="chart-scroll">`;

  // Container with zero position and point count for sizing
  const containerStyles = [];
  if (hasNegativeY) containerStyles.push(`--zero-position: ${zeroPctY.toFixed(2)}%`);
  if (showDots) containerStyles.push(`--point-count: ${uniqueXCount}`);
  const containerStyle = containerStyles.length > 0 ? ` style="${containerStyles.join('; ')}"` : '';
  html += `<div class="timeseries-container"${containerStyle}>`;
  html += `<div class="dot-area">`;
  html += `<div class="dot-field">`;

  // Render line segments for each series
  let segIndex = 0;
  seriesKeys.forEach((key, seriesIdx) => {
    const points = seriesData.get(key);
    if (points.length < 2) return;

    const colorClass = `chart-color-${seriesIdx + 1}`;
    const seriesClass = `chart-series-${slugify(key)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const x1 = rangeX > 0 ? ((p1.x - calcMinX) / rangeX) * 100 : 0;
      const y1 = rangeY > 0 ? ((p1.y - minValue) / rangeY) * 100 : 0;
      const x2 = rangeX > 0 ? ((p2.x - calcMinX) / rangeX) * 100 : 0;
      const y2 = rangeY > 0 ? ((p2.y - minValue) / rangeY) * 100 : 0;

      html += `<div class="chart-line-segment ${colorClass} ${seriesClass}" `;
      html += `style="--x1: ${x1.toFixed(2)}; --y1: ${y1.toFixed(2)}; --x2: ${x2.toFixed(2)}; --y2: ${y2.toFixed(2)}; --seg-index: ${segIndex}">`;
      html += `</div>`;
      segIndex++;
    }
  });

  // Always render dots for hover/tooltips (CSS handles visibility)
  // Only show icons inside dots when dots are visible
  {
    let dotIndex = 0;
    seriesKeys.forEach((key, seriesIdx) => {
      const points = seriesData.get(key);
      const colorClass = `chart-color-${seriesIdx + 1}`;
      const seriesClass = `chart-series-${slugify(key)}`;
      const seriesLabel = getSeriesLabel(key);
      const icon = showDots ? getSeriesIcon(key) : null;
      const iconClass = icon ? ' has-icon' : '';

      points.forEach(p => {
        const xPct = rangeX > 0 ? ((p.x - calcMinX) / rangeX) * 100 : 0;
        const yPct = rangeY > 0 ? ((p.y - minValue) / rangeY) * 100 : 0;

        const tooltipText = `${seriesLabel}: ${formatNumber(p.y, yFormat) || p.y} (${p.label})`;

        html += `<div class="dot ${colorClass} ${seriesClass}${iconClass}" `;
        html += `style="--x: ${xPct.toFixed(2)}%; --value: ${yPct.toFixed(2)}%; --dot-index: ${dotIndex}" `;
        html += `title="${escapeHtml(tooltipText)}"`;
        html += `>`;
        if (icon) {
          html += `<i class="${escapeHtml(icon)}"></i>`;
        }
        html += `</div>`;
        dotIndex++;
      });
    });
  }

  html += `</div>`; // close dot-field
  html += `</div>`; // close dot-area

  // X-axis with interval-based ticks
  html += `<div class="chart-x-axis timeseries-x-axis">`;
  xTicks.forEach(tick => {
    // Use decimal factor (0-1) so CSS can apply proper inset calculation
    const xFactor = rangeX > 0 ? (tick.value - calcMinX) / rangeX : 0;
    // Label may contain <br> for two-line formatting, so don't escape
    html += `<span class="axis-label" style="--x: ${xFactor.toFixed(4)}">${tick.label}</span>`;
  });
  if (xAxisTitle) {
    html += `<span class="axis-title">${escapeHtml(xAxisTitle)}</span>`;
  }
  html += `</div>`;

  html += `</div>`; // close timeseries-container
  html += `</div>`; // close chart-scroll
  html += `</div>`; // close chart-body

  // Legend
  const showLegend = config.legend !== false && (seriesKeys.length > 0 || legendTitle);
  if (showLegend) {
    if (legendTitle) {
      html += `<span class="chart-legend-title">${escapeHtml(legendTitle)}</span>`;
    }
    html += `<div class="chart-legend">`;
    seriesKeys.forEach((key, i) => {
      const label = getSeriesLabel(key);
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

  html += renderDownloadLinks(downloadDataUrl, downloadData, downloadImageUrl, downloadImage);
  html += `</figure>`;

  return html;
}
