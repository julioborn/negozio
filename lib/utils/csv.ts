/** Genera y descarga un archivo CSV desde un array de objetos. */
export function exportToCSV(
  rows: Record<string, unknown>[],
  filename: string,
  columnLabels?: Record<string, string>
): void {
  if (rows.length === 0) return;

  const keys = Object.keys(rows[0]!);
  const headers = keys.map((k) => columnLabels?.[k] ?? k);

  const escape = (val: unknown): string => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.join(','),
    ...rows.map((row) => keys.map((k) => escape(row[k])).join(',')),
  ];

  const bom = '﻿'; // UTF-8 BOM para que Excel abra bien los acentos
  const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
