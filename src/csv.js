import fs from 'fs';
import path from 'path';

/**
 * Parse a CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]} - Array of field values
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Push last field
  fields.push(current.trim());

  return fields;
}

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

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
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
