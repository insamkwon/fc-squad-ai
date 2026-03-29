/**
 * CSV parser for details.csv (from fconline-player-search project).
 *
 * Handles:
 * - UTF-8 BOM stripping
 * - Quoted fields with embedded commas and escaped quotes
 * - CRLF / LF line endings
 */

export interface CsvRow {
  [column: string]: string;
}

/**
 * Parse a CSV file into an array of row objects keyed by header names.
 *
 * @param filePath - Absolute path to the CSV file
 * @returns Array of row objects, where each key is a header column name
 */
export function parseCsvFile(filePath: string): CsvRow[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // Strip BOM
  return parseCsvString(raw);
}

/**
 * Parse a CSV string into an array of row objects keyed by header names.
 *
 * @param csv - Raw CSV string content
 * @returns Array of row objects
 */
export function parseCsvString(csv: string): CsvRow[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        // Escaped quote inside quoted field
        field += '"';
        i++;
      } else if (ch === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        current.push(field.trim());
        field = '';
        if (current.length > 1) rows.push(current);
        current = [];
        if (ch === '\r' && csv[i + 1] === '\n') i++; // Skip CRLF
      } else {
        field += ch;
      }
    }
  }

  // Handle last field/row
  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.length > 1) rows.push(current);
  }

  if (rows.length === 0) return [];

  // Convert arrays to objects using the first row as headers
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: CsvRow = {};
    headers.forEach((h, idx) => {
      obj[h] = idx < row.length ? row[idx] : '';
    });
    return obj;
  });
}

/**
 * Parse only the header row from a CSV file.
 * Useful for validating CSV structure before full parsing.
 */
export function parseCsvHeaders(filePath: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const firstNewline = raw.indexOf('\n');
  const headerLine = firstNewline > 0 ? raw.substring(0, firstNewline) : raw;
  return headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
}
