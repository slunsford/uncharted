/**
 * Deprecation validation for Uncharted
 * Validates config for deprecated usage and logs appropriate warnings/errors
 */

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
 * Validate chart type and return error message if deprecated
 * @param {string} type - Chart type
 * @param {string} chartId - Chart identifier
 * @returns {string|null} - Error message or null if valid
 */
export function validateChartType(type, chartId) {
  if (type === 'dot') {
    return `Chart "${chartId}": type "dot" is no longer supported. Use type "line" with lines: false instead.`;
  }
  return null;
}

/**
 * Check config for deprecated options and log warnings
 * @param {Object} config - Chart configuration
 * @param {string} chartId - Chart identifier
 */
export function checkDeprecatedOptions(config, chartId) {
  if (!config) return;

  // Check for deprecated axis shorthand keys
  if (config.maxX !== undefined) {
    warnDeprecation(chartId, 'maxX', 'x.max');
  }
  if (config.minX !== undefined) {
    warnDeprecation(chartId, 'minX', 'x.min');
  }
  if (config.maxY !== undefined) {
    warnDeprecation(chartId, 'maxY', 'y.max');
  }
  if (config.minY !== undefined) {
    warnDeprecation(chartId, 'minY', 'y.min');
  }
  if (config.titleX !== undefined) {
    warnDeprecation(chartId, 'titleX', 'x.title');
  }
  if (config.titleY !== undefined) {
    warnDeprecation(chartId, 'titleY', 'y.title');
  }

  // Check for deprecated top-level rotateLabels
  if (config.rotateLabels !== undefined) {
    warnDeprecation(chartId, 'rotateLabels', 'x.rotateLabels');
  }

  // Check for deprecated legend array (when used for labels, not boolean)
  if (Array.isArray(config.legend)) {
    warnDeprecation(chartId, 'legend (array)', 'y.columns: { key: "Label" }');
  }

  // Check for deprecated scatter-specific keys
  if (config.legendTitle !== undefined) {
    warnDeprecation(chartId, 'legendTitle', 'series.title');
  }
  if (config.sizeTitle !== undefined) {
    warnDeprecation(chartId, 'sizeTitle', 'size.title');
  }

  // Check for deprecated format.x / format.y structure
  if (config.format && typeof config.format === 'object') {
    if (config.format.x !== undefined) {
      warnDeprecation(chartId, 'format.x', 'x.format');
    }
    if (config.format.y !== undefined) {
      warnDeprecation(chartId, 'format.y', 'y.format');
    }
  }

  // Check for deprecated columns.* structure
  if (config.columns && typeof config.columns === 'object') {
    const deprecatedColumnKeys = ['x', 'y', 'label', 'series', 'size', 'source', 'target', 'value'];
    for (const key of deprecatedColumnKeys) {
      if (config.columns[key] !== undefined) {
        const newPath = key === 'label' ? 'x.column or label.column' :
                        key === 'x' ? 'x.column' :
                        key === 'y' ? 'y.columns' :
                        `${key}.column`;
        warnDeprecation(chartId, `columns.${key}`, newPath);
      }
    }
  }
}

/**
 * Clear warning cache (useful for testing)
 */
export function clearWarningCache() {
  warnedConfigs.clear();
}
