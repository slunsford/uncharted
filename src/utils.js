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

/**
 * Render a download link for chart data
 * @param {string} url - URL to the CSV file
 * @param {boolean|string} label - true for default label, or custom string
 * @returns {string} - HTML string for the download link, or empty string if no URL
 */
export function renderDownloadLink(url, label) {
  if (!url) return '';
  const text = typeof label === 'string' ? label : '↓ Download data';
  return `<a href="${escapeHtml(url)}" class="chart-download" download>${escapeHtml(text)}</a>`;
}

/**
 * Render a download link for chart image
 * @param {string} url - URL to the image file
 * @param {boolean|string} label - true for default label, or custom string
 * @returns {string} - HTML string for the download link, or empty string if no URL
 */
export function renderDownloadImageLink(url, label) {
  if (!url) return '';
  const text = typeof label === 'string' ? label : '↓ Download image';
  return `<a href="${escapeHtml(url)}" class="chart-download" download>${escapeHtml(text)}</a>`;
}

/**
 * Render download links container (wraps data and image download links)
 * @param {string} dataUrl - URL to the CSV file
 * @param {boolean|string} dataLabel - true for default label, or custom string
 * @param {string} imageUrl - URL to the image file
 * @param {boolean|string} imageLabel - true for default label, or custom string
 * @returns {string} - HTML string for the download links container, or empty string if no URLs
 */
export function renderDownloadLinks(dataUrl, dataLabel, imageUrl, imageLabel) {
  const dataLink = renderDownloadLink(dataUrl, dataLabel);
  const imageLink = renderDownloadImageLink(imageUrl, imageLabel);
  if (!dataLink && !imageLink) return '';
  const separator = dataLink && imageLink ? ' <span class="chart-download-sep">•</span> ' : '';
  return `<div class="chart-downloads">${dataLink}${separator}${imageLink}</div>`;
}

