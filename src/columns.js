/**
 * Column resolution for Uncharted
 * Handles explicit column mapping and implicit detection
 * Supports both new unified schema (x.column, y.columns) and deprecated columns key
 */

import { parseAxisConfig } from './config.js';

/**
 * Resolve column mappings for chart data
 *
 * New unified schema (takes precedence):
 * - x: { column: "month" } or x: "month"
 * - y: { columns: ["a", "b"] } or y: { columns: { a: "Label A" } }
 *
 * Deprecated schema (fallback):
 * - columns: { x: "month", y: ["a", "b"] }
 *
 * @param {Object} config - Chart configuration with optional columns mapping
 * @param {Object[]} data - Chart data array
 * @param {string} chartType - Chart type for context-aware defaults
 * @returns {Object} - Resolved column keys with labels
 */
export function resolveColumns(config, data, chartType) {
  if (!data || data.length === 0) {
    return {
      label: undefined,
      x: undefined,
      y: undefined,
      xLabels: {},
      yLabels: {},
      series: undefined,
      seriesTitle: undefined,
      size: undefined,
      sizeTitle: undefined,
      source: undefined,
      target: undefined,
      value: undefined,
      valueFormat: undefined,
      values: []
    };
  }

  const keys = Object.keys(data[0]);
  const deprecatedColumns = config.columns || {};

  // Helper to find column by name (case-insensitive)
  const findKey = name => keys.find(k => k.toLowerCase() === name.toLowerCase()) || null;

  // Helper to validate that a column exists
  const validateColumn = (configKey, configValue) => {
    if (configValue === undefined) return undefined;

    // Handle array of column names
    if (Array.isArray(configValue)) {
      const valid = configValue.filter(v => keys.includes(v));
      if (valid.length !== configValue.length) {
        const missing = configValue.filter(v => !keys.includes(v));
        console.warn(`[uncharted] ${configKey}: columns not found in data: ${missing.join(', ')}`);
      }
      return valid.length > 0 ? valid : undefined;
    }

    // Handle single column name
    if (!keys.includes(configValue)) {
      console.warn(`[uncharted] ${configKey}: column "${configValue}" not found in data`);
      return undefined;
    }
    return configValue;
  };

  // Parse axis configs using the new helper
  const xConfig = parseAxisConfig(config.x);
  const yConfig = parseAxisConfig(config.y);
  const labelConfig = parseAxisConfig(config.label);
  const seriesConfig = parseAxisConfig(config.series);
  const sizeConfig = parseAxisConfig(config.size);
  const sourceConfig = parseAxisConfig(config.source);
  const targetConfig = parseAxisConfig(config.target);
  const valueConfig = parseAxisConfig(config.value);

  // Resolve each column role
  const resolved = {
    label: undefined,
    x: undefined,
    y: undefined,
    xLabels: {},
    yLabels: {},
    series: undefined,
    seriesTitle: undefined,
    size: undefined,
    sizeTitle: undefined,
    source: undefined,
    target: undefined,
    value: undefined,
    valueFormat: undefined,
    values: []
  };

  // Chart-type specific resolution
  if (chartType === 'scatter') {
    // Scatter charts use x, y, label, series, size columns
    // New schema: x.column, y.column, label.column, series.column, size.column
    // Deprecated: columns.x, columns.y, columns.label, columns.series, columns.size

    // X column
    if (xConfig?.columns?.length) {
      resolved.x = validateColumn('x.column', xConfig.columns[0]);
    } else if (deprecatedColumns.x) {
      resolved.x = validateColumn('columns.x', deprecatedColumns.x);
    }

    // Y column
    if (yConfig?.columns?.length) {
      resolved.y = validateColumn('y.column', yConfig.columns[0]);
    } else if (deprecatedColumns.y) {
      resolved.y = validateColumn('columns.y', deprecatedColumns.y);
    }

    // Label column (point identifier)
    if (labelConfig?.columns?.length) {
      resolved.label = validateColumn('label.column', labelConfig.columns[0]);
    } else if (deprecatedColumns.label) {
      resolved.label = validateColumn('columns.label', deprecatedColumns.label);
    } else {
      resolved.label = keys[0];
    }

    // Series column (for coloring)
    if (seriesConfig?.columns?.length) {
      resolved.series = validateColumn('series.column', seriesConfig.columns[0]);
      resolved.seriesTitle = seriesConfig.title;
    } else if (deprecatedColumns.series) {
      resolved.series = validateColumn('columns.series', deprecatedColumns.series);
      resolved.seriesTitle = config.legendTitle; // deprecated
    }

    // Size column
    if (sizeConfig?.columns?.length) {
      resolved.size = validateColumn('size.column', sizeConfig.columns[0]);
      resolved.sizeTitle = sizeConfig.title;
    } else if (deprecatedColumns.size) {
      resolved.size = validateColumn('columns.size', deprecatedColumns.size);
      resolved.sizeTitle = config.sizeTitle; // deprecated
    }

    // Implicit detection for scatter if not explicitly specified
    if (!resolved.x || !resolved.y) {
      const namedX = findKey('x');
      const namedY = findKey('y');

      if (namedX && namedY) {
        resolved.x = resolved.x ?? namedX;
        resolved.y = resolved.y ?? namedY;
      } else {
        resolved.x = resolved.x ?? keys[1];
        resolved.y = resolved.y ?? keys[2];
      }
    }

    // Implicit series/size detection
    if (!resolved.series) {
      resolved.series = findKey('series');
    }
    if (!resolved.size) {
      resolved.size = findKey('size');
    }

  } else if (chartType === 'sankey') {
    // Sankey charts use source, target, value columns
    // New schema: source.column, target.column, value.column
    // Deprecated: columns.source, columns.target, columns.value

    if (sourceConfig?.columns?.length) {
      resolved.source = validateColumn('source.column', sourceConfig.columns[0]);
    } else if (deprecatedColumns.source) {
      resolved.source = validateColumn('columns.source', deprecatedColumns.source);
    } else {
      resolved.source = keys[0];
    }

    if (targetConfig?.columns?.length) {
      resolved.target = validateColumn('target.column', targetConfig.columns[0]);
    } else if (deprecatedColumns.target) {
      resolved.target = validateColumn('columns.target', deprecatedColumns.target);
    } else {
      resolved.target = keys[1];
    }

    if (valueConfig?.columns?.length) {
      resolved.value = validateColumn('value.column', valueConfig.columns[0]);
      resolved.valueFormat = valueConfig.format;
    } else if (deprecatedColumns.value) {
      resolved.value = validateColumn('columns.value', deprecatedColumns.value);
    } else {
      resolved.value = keys[2];
    }

  } else if (chartType === 'donut') {
    // Donut charts use label, value columns
    // New schema: label.column, value.column
    // Deprecated: columns.label, columns.value (or implicit first/second columns)

    if (labelConfig?.columns?.length) {
      resolved.label = validateColumn('label.column', labelConfig.columns[0]);
      resolved.yLabels = labelConfig.labels || {};
    } else if (deprecatedColumns.label) {
      resolved.label = validateColumn('columns.label', deprecatedColumns.label);
    } else {
      resolved.label = keys[0];
    }

    if (valueConfig?.columns?.length) {
      resolved.values = validateColumn('value.column', valueConfig.columns) || [];
      if (!Array.isArray(resolved.values)) {
        resolved.values = [resolved.values];
      }
      resolved.valueFormat = valueConfig.format;
    } else if (deprecatedColumns.value) {
      const val = validateColumn('columns.value', deprecatedColumns.value);
      resolved.values = val ? [val] : [];
    } else {
      // Default: all columns except label
      resolved.values = keys.filter(k => k !== resolved.label);
    }

  } else if (chartType === 'stacked-bar') {
    // Stacked bar: y = categories (left side), x = value series (bars extend right)
    // New schema: y.column (categories), x.columns (values with labels)
    // Deprecated: columns.y (or label), columns.x (or y as values)

    // Category column (on Y axis for stacked-bar)
    if (yConfig?.columns?.length) {
      resolved.label = validateColumn('y.column', yConfig.columns[0]);
    } else if (deprecatedColumns.label) {
      resolved.label = validateColumn('columns.label', deprecatedColumns.label);
    } else {
      resolved.label = keys[0];
    }

    // Value columns (extend along X axis)
    if (xConfig?.columns?.length) {
      resolved.values = validateColumn('x.columns', xConfig.columns) || [];
      resolved.xLabels = xConfig.labels || {};
    } else if (deprecatedColumns.y) {
      // Deprecated: columns.y was used for value columns in stacked-bar
      const explicitY = validateColumn('columns.y', deprecatedColumns.y);
      resolved.values = Array.isArray(explicitY) ? explicitY : (explicitY ? [explicitY] : []);
    } else {
      // Implicit: all columns except label are values
      resolved.values = keys.filter(k => k !== resolved.label);
    }

  } else {
    // Standard charts (dot, line, stacked-column): x = categories, y = multi-series values
    // New schema: x.column (categories), y.columns (values with labels)
    // Deprecated: columns.label (or implicit first), columns.y

    // Label/category column (X axis)
    if (xConfig?.columns?.length) {
      resolved.label = validateColumn('x.column', xConfig.columns[0]);
    } else if (deprecatedColumns.label) {
      resolved.label = validateColumn('columns.label', deprecatedColumns.label);
    } else {
      resolved.label = keys[0];
    }

    // Value columns (Y axis)
    if (yConfig?.columns?.length) {
      resolved.values = validateColumn('y.columns', yConfig.columns) || [];
      resolved.yLabels = yConfig.labels || {};
    } else if (deprecatedColumns.y) {
      const explicitY = validateColumn('columns.y', deprecatedColumns.y);
      resolved.values = Array.isArray(explicitY) ? explicitY : (explicitY ? [explicitY] : []);
    } else {
      // Implicit: all columns except label are values
      resolved.values = keys.filter(k => k !== resolved.label);
    }
  }

  return resolved;
}

/**
 * Get series names from resolved columns
 * @param {Object} resolved - Resolved columns from resolveColumns()
 * @returns {string[]} - Array of series/value column names
 */
export function getResolvedSeriesNames(resolved) {
  return resolved.values || [];
}

/**
 * Get the label key from resolved columns
 * @param {Object} resolved - Resolved columns from resolveColumns()
 * @returns {string|undefined} - Label column name
 */
export function getResolvedLabelKey(resolved) {
  return resolved.label;
}
