import fs from 'fs';
import path from 'path';

/**
 * Parse CSV content into array of objects
 * @param {string} content - Raw CSV content
 * @returns {Object[]} - Array of row objects with header keys
 */
export function parseCSV(content) {
  const lines = content
    .trim()
    .split('\n')
    .filter(line => !line.startsWith('#') && line.trim() !== '');

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};

    headers.forEach((header, index) => {
      const value = values[index] ?? '';
      // Try to parse as number, keep as string if not numeric
      const num = parseFloat(value);
      row[header] = isNaN(num) ? value : num;
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Load and parse a CSV file
 * @param {string} filePath - Path to CSV file (relative to data directory)
 * @param {string} dataDir - Base data directory path
 * @returns {Object[]} - Parsed CSV data
 */
export function loadCSV(filePath, dataDir) {
  const fullPath = path.join(dataDir, filePath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`[uncharted] CSV file not found: ${fullPath}`);
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  return parseCSV(content);
}
