/**
 * Slugify a string for use in CSS class names
 * @param {string} str - The string to slugify
 * @returns {string} - Slugified string
 */
export function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Calculate percentages from values
 * @param {number[]} values - Array of numeric values
 * @param {number} [max] - Optional max value (defaults to sum of values)
 * @returns {number[]} - Array of percentages (0-100)
 */
export function calculatePercentages(values, max) {
  const total = max ?? values.reduce((sum, v) => sum + v, 0);
  if (total === 0) return values.map(() => 0);
  return values.map(v => (v / total) * 100);
}

/**
 * Get the label key (first column name) from CSV data
 * @param {Object[]} data - Array of data objects
 * @returns {string|undefined} - The first column name, or undefined if no data
 */
export function getLabelKey(data) {
  if (!data || data.length === 0) return undefined;
  return Object.keys(data[0])[0];
}

/**
 * Get the value key (second column name) from CSV data
 * @param {Object[]} data - Array of data objects
 * @returns {string|undefined} - The second column name, or undefined if no data
 */
export function getValueKey(data) {
  if (!data || data.length === 0) return undefined;
  return Object.keys(data[0])[1];
}

/**
 * Extract series names from CSV data (all columns except the first)
 * @param {Object[]} data - Array of data objects
 * @returns {string[]} - Array of series names
 */
export function getSeriesNames(data) {
  if (!data || data.length === 0) return [];
  return Object.keys(data[0]).slice(1);
}

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeHtml(str) {
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(str).replace(/[&<>"']/g, char => htmlEntities[char]);
}

