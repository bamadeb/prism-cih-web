// Spreadsheet apps run a cell that starts with = + - @ (or tab / CR) as a
// formula, so exported user text like "=HYPERLINK(...)" could execute when the
// CSV is opened. Prefixing an apostrophe makes it plain text. A leading "-"
// followed by a digit is left alone so negative numbers stay numbers.
export function neutralizeCsvFormula(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/^[=+@\t\r]/.test(s) || /^-(?!\d)/.test(s)) {
    return `'${s}`;
  }
  return s;
}

/** Quoted, formula-safe CSV cell. */
export function csvCell(value: unknown): string {
  return `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;
}
