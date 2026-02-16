/**
 * Configuration normalization layer for Uncharted
 * Transforms various config formats into a standardized structure
 */

// Deprecated keys mapping for deprecation warnings
const DEPRECATED_KEYS = {
  maxX: 'x.max',
  minX: 'x.min',
  maxY: 'y.max',
  minY: 'y.min',
  titleX: 'x.title',
  titleY: 'y.title',
  legendTitle: 'series.title',
  sizeTitle: 'size.title',
  rotateLabels: 'x.rotateLabels'
};

// Track which deprecation warnings have been shown to avoid spam
const warnedConfigs = new Set();

/**
 * Log a deprecation warning (once per config/key combination)
 * @param {string} chartId - Chart identifier
 * @param {string} oldKey - Deprecated key name
 * @param {string} newKey - New key path
 */
function warnDeprecation(chartId, oldKey, newKey) {
  const key = `${chartId}:${oldKey}`;
  if (warnedConfigs.has(key)) return;
  warnedConfigs.add(key);
  console.warn(`[uncharted] Chart "${chartId}": "${oldKey}" is deprecated, use "${newKey}" instead`);
}

/**
 * Normalize chart configuration to standardized structure
 *
 * Precedence for axis properties (highest to lowest):
 * 1. x.max / y.max (new nested format)
 * 2. maxX / maxY (deprecated suffixed format)
 * 3. max (global fallback)
 *
 * Format precedence:
 * 1. x.format / y.format (new nested format)
 * 2. format.x / format.y (deprecated nested format)
 * 3. format (global fallback)
 *
 * Column mapping precedence:
 * 1. x.column / x.columns / y.column / y.columns (new unified format)
 * 2. columns.x / columns.y (deprecated format)
 *
 * Legend precedence:
 * 1. y.columns: { key: "Label" } or x.columns (for stacked-bar)
 * 2. legend: ["Label1", "Label2"] (deprecated)
 *
 * @param {Object} config - Raw chart configuration
 * @param {string} [chartId] - Chart ID for deprecation warnings
 * @returns {Object} - Normalized configuration
 */
export function normalizeConfig(config, chartId = 'unknown') {
  if (!config) return config;

  const normalized = { ...config };

  // Build x axis config
  normalized.x = buildAxisConfig('x', config, chartId);

  // Build y axis config
  normalized.y = buildAxisConfig('y', config, chartId);

  // Warn for deprecated legend array (when used for labels, not boolean)
  if (Array.isArray(config.legend)) {
    warnDeprecation(chartId, 'legend (array)', 'y.columns: { key: "Label" }');
  }

  // Warn for deprecated scatter-specific keys
  if (config.legendTitle !== undefined) {
    warnDeprecation(chartId, 'legendTitle', 'series.title');
  }
  if (config.sizeTitle !== undefined) {
    warnDeprecation(chartId, 'sizeTitle', 'size.title');
  }

  // Clean up deprecated top-level keys (keep them for backwards compat but don't pass to renderers)
  // The renderers will use normalized.x and normalized.y instead

  return normalized;
}

/**
 * Build normalized axis configuration
 * @param {'x' | 'y'} axis - Axis name
 * @param {Object} config - Raw config
 * @param {string} chartId - Chart ID for warnings
 * @returns {Object} - Normalized axis config
 */
function buildAxisConfig(axis, config, chartId) {
  const axisUpper = axis.toUpperCase();
  const existingAxisConfig = config[axis] || {};

  // Start with existing axis config if present
  const axisConfig = { ...existingAxisConfig };

  // max: x.max > maxX > max
  if (axisConfig.max === undefined) {
    const deprecatedKey = `max${axisUpper}`;
    if (config[deprecatedKey] !== undefined) {
      warnDeprecation(chartId, deprecatedKey, `${axis}.max`);
      axisConfig.max = config[deprecatedKey];
    } else if (config.max !== undefined) {
      axisConfig.max = config.max;
    }
  }

  // min: x.min > minX > min
  if (axisConfig.min === undefined) {
    const deprecatedKey = `min${axisUpper}`;
    if (config[deprecatedKey] !== undefined) {
      warnDeprecation(chartId, deprecatedKey, `${axis}.min`);
      axisConfig.min = config[deprecatedKey];
    } else if (config.min !== undefined) {
      axisConfig.min = config.min;
    }
  }

  // title: x.title > titleX
  if (axisConfig.title === undefined) {
    const deprecatedKey = `title${axisUpper}`;
    if (config[deprecatedKey] !== undefined) {
      warnDeprecation(chartId, deprecatedKey, `${axis}.title`);
      axisConfig.title = config[deprecatedKey];
    }
  }

  // format: x.format > format.x > format
  if (axisConfig.format === undefined) {
    const globalFormat = config.format || {};
    if (globalFormat[axis] !== undefined) {
      // format.x or format.y (deprecated nested format)
      warnDeprecation(chartId, `format.${axis}`, `${axis}.format`);
      axisConfig.format = globalFormat[axis];
    } else if (typeof globalFormat === 'object' && !globalFormat.x && !globalFormat.y) {
      // Global format object (no x/y nesting) - use as fallback
      axisConfig.format = globalFormat;
    }
  }

  return axisConfig;
}

/**
 * Get effective max value for an axis
 * @param {Object} normalizedConfig - Normalized config
 * @param {'x' | 'y'} axis - Axis name
 * @returns {number|undefined} - Max value or undefined
 */
export function getAxisMax(normalizedConfig, axis) {
  return normalizedConfig[axis]?.max;
}

/**
 * Get effective min value for an axis
 * @param {Object} normalizedConfig - Normalized config
 * @param {'x' | 'y'} axis - Axis name
 * @returns {number|undefined} - Min value or undefined
 */
export function getAxisMin(normalizedConfig, axis) {
  return normalizedConfig[axis]?.min;
}

/**
 * Get effective title for an axis
 * @param {Object} normalizedConfig - Normalized config
 * @param {'x' | 'y'} axis - Axis name
 * @param {string} [fallback] - Fallback title (e.g., column name)
 * @returns {string} - Axis title
 */
export function getAxisTitle(normalizedConfig, axis, fallback = '') {
  return normalizedConfig[axis]?.title ?? fallback;
}

/**
 * Get effective format config for an axis
 * @param {Object} normalizedConfig - Normalized config
 * @param {'x' | 'y'} axis - Axis name
 * @returns {Object} - Format config
 */
export function getAxisFormat(normalizedConfig, axis) {
  return normalizedConfig[axis]?.format || normalizedConfig.format || {};
}

/**
 * Parse axis configuration with column definitions
 * Handles shorthand and full formats:
 * - String: "column" -> { columns: ["column"], labels: {} }
 * - Array: ["a", "b"] -> { columns: ["a", "b"], labels: {} }
 * - Object with column: { column: "x" } -> { columns: ["x"], labels: {}, ...rest }
 * - Object with columns array: { columns: ["a", "b"] } -> { columns: ["a", "b"], labels: {}, ...rest }
 * - Object with columns object: { columns: { a: "Label A" } } -> { columns: ["a"], labels: { a: "Label A" }, ...rest }
 *
 * @param {string|string[]|Object} axisConfig - Axis config in any supported format
 * @returns {{ columns: string[], labels: object, column?: string, title?: string, ... }|null}
 */
export function parseAxisConfig(axisConfig) {
  if (axisConfig === undefined || axisConfig === null) return null;

  // Handle shorthand: y: "revenue" or y: ["a", "b"]
  if (typeof axisConfig === 'string') {
    return { column: axisConfig, columns: [axisConfig], labels: {} };
  }
  if (Array.isArray(axisConfig)) {
    return { columns: axisConfig, labels: {} };
  }

  // Handle object format
  const { column, columns, ...rest } = axisConfig;

  // Parse columns definition
  let parsedColumns = [];
  let labels = {};

  if (column) {
    parsedColumns = [column];
  } else if (columns) {
    if (typeof columns === 'string') {
      parsedColumns = [columns];
    } else if (Array.isArray(columns)) {
      parsedColumns = columns;
    } else if (typeof columns === 'object') {
      parsedColumns = Object.keys(columns);
      labels = columns;  // { columnName: "Display Label" }
    }
  }

  return { columns: parsedColumns, labels, column, ...rest };
}

/**
 * Get rotateLabels setting from axis config or deprecated top-level
 * @param {Object} config - Normalized config
 * @param {string} chartId - Chart ID for deprecation warnings
 * @returns {boolean} - Whether to rotate labels
 */
export function getRotateLabels(config, chartId) {
  // New schema: x.rotateLabels
  if (config.x?.rotateLabels !== undefined) {
    return config.x.rotateLabels;
  }
  // Deprecated: top-level rotateLabels
  if (config.rotateLabels !== undefined) {
    warnDeprecation(chartId, 'rotateLabels', 'x.rotateLabels');
    return config.rotateLabels;
  }
  return false;
}
