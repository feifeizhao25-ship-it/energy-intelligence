/** Escape CSV syntax and prevent spreadsheet formulas in user-controlled text. */
export function escapeCsvCell(cell: unknown): string {
    let value = cell === null || cell === undefined ? '' : String(cell);
    if (typeof cell === 'string' && (/^\s*[=+@-]/.test(value) || /^[\t\r\n]/.test(value))) {
        value = "'" + value;
    }
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
