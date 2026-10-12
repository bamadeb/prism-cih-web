import * as Papa from 'papaparse';

// Shared checks for the Process File (CSV import) pages.

export const MAX_CSV_MB = 25;
export const MAX_CSV_ROWS = 100000;

export interface CsvRowError {
  /** 1-based line number in the file (the header is line 1). 0 = whole file. */
  row: number;
  message: string;
}

export interface CsvRowRules {
  /** Columns that must have a non-blank value. */
  required?: string[];
  /** Columns that, when filled, must be a valid date (M/D/YYYY, M/D/YY, M-D-YYYY or YYYY-MM-DD). */
  dates?: string[];
  /** Columns that, when filled, must be a number. */
  numbers?: string[];
}

export interface ParsedCsv {
  rows: Record<string, any>[];
  fields: string[];
  errors: CsvRowError[];
}

/** File-level checks before parsing: extension, empty, size. */
export function checkCsvFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'csv') return 'Only .csv files are allowed.';
  if (file.size === 0) return 'The selected file is empty.';
  if (file.size > MAX_CSV_MB * 1024 * 1024) return `File is larger than ${MAX_CSV_MB} MB.`;
  return null;
}

/**
 * Parses with Papa Parse (handles quoted values containing commas) and reports
 * rows whose column count doesn't match the header, instead of skipping them.
 */
export function parseCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      transformHeader: (h: string) => h.trim(),
      complete: (result) => {
        const errors: CsvRowError[] = result.errors.map(e => ({
          row: e.row !== undefined && e.row !== null ? e.row + 2 : 0,
          message: e.code === 'TooFewFields' || e.code === 'TooManyFields'
            ? 'Column count does not match the header.'
            : e.message
        }));
        resolve({ rows: result.data, fields: result.meta.fields ?? [], errors });
      },
      error: (err: any) => reject(err)
    });
  });
}

/** Row count, required / date / number checks, and exact-duplicate rows. */
export function validateCsvRows(rows: Record<string, any>[], rules: CsvRowRules): CsvRowError[] {
  const errors: CsvRowError[] = [];

  if (rows.length === 0) {
    return [{ row: 0, message: 'The file has no data rows.' }];
  }
  if (rows.length > MAX_CSV_ROWS) {
    return [{ row: 0, message: `The file has ${rows.length} rows; the maximum is ${MAX_CSV_ROWS}.` }];
  }

  const seen = new Map<string, number>();

  rows.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const value = (col: string) => String(row[col] ?? '').trim();

    for (const col of rules.required ?? []) {
      if (!value(col)) errors.push({ row: line, message: `${col} is required.` });
    }
    for (const col of rules.dates ?? []) {
      const v = value(col);
      if (v && v.toUpperCase() !== 'NULL' && !isValidCsvDate(v)) {
        errors.push({ row: line, message: `${col} "${v}" is not a valid date.` });
      }
    }
    for (const col of rules.numbers ?? []) {
      const v = value(col);
      if (v && !/^-?\d+(\.\d+)?$/.test(v)) {
        errors.push({ row: line, message: `${col} "${v}" is not a number.` });
      }
    }

    const key = JSON.stringify(Object.keys(row).map(k => value(k)));
    const firstLine = seen.get(key);
    if (firstLine !== undefined) {
      errors.push({ row: line, message: `Duplicate of line ${firstLine}.` });
    } else {
      seen.set(key, line);
    }
  });

  return errors;
}

export function isValidCsvDate(value: string): boolean {
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(value);
    if (!match) return false;
    let [p1, p2] = [Number(match[1]), Number(match[2])];
    y = Number(match[3].length === 2 ? '20' + match[3] : match[3]);
    // Same rule as the pages' cleanDate(): first part > 12 means D/M/Y.
    if (p1 > 12) [p1, p2] = [p2, p1];
    [m, d] = [p1, p2];
  }
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
