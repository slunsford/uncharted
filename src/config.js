/**
 * Configuration normalization layer for Uncharted
 * Transforms various config formats into a standardized structure
 */

/**
 * Normalize chart configuration to standardized structure
 *
 * Axis properties:
 * - x.max / y.max, x.min / y.min
 * - x.title / y.title
 * - x.format / y.format
 *
 * Column mapping:
 * - x.column / x.columns / y.column / y.columns
 *
 * Legend:
 * - y.columns: { key: "Label" } or x.columns (for stacked-bar)
 *
 * @param {Object} config - Raw chart configuration
 * @param {string} [chartId] - Chart ID (unused, kept for API compatibility)
 * @returns {Object} - Normalized configuration
 */
export function normalizeConfig(config, chartId = 'unknown') {
  if (!config) return config;

  const normalized = { ...config };

  // Build x axis config
  normalized.x = buildAxisConfig('x', config);

  // Build y axis config
  normalized.y = buildAxisConfig('y', config);

  return normalized;
}

/**
 * Build normalized axis configuration
 * @param {'x' | 'y'} axis - Axis name
 * @param {Object} config - Raw config
 * @returns {Object} - Normalized axis config
 */
function buildAxisConfig(axis, config) {
  const existingAxisConfig = config[axis] || {};

  // Start with existing axis config if present
  const axisConfig = { ...existingAxisConfig };

  // max: x.max > max (global fallback)
  if (axisConfig.max === undefined && config.max !== undefined) {
    axisConfig.max = config.max;
  }

  // min: x.min > min (global fallback)
  if (axisConfig.min === undefined && config.min !== undefined) {
    axisConfig.min = config.min;
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
 * Get rotateLabels setting from axis config
 * @param {Object} config - Normalized config
 * @returns {boolean} - Whether to rotate labels
 */
export function getRotateLabels(config) {
  return config.x?.rotateLabels ?? false;
}
