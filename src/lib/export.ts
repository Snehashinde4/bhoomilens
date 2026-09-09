import Papa from 'papaparse';

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  fileName: string,
  columns?: Array<{ key: keyof T & string; header: string }>,
): void {
  if (!rows.length) return;
  const data = columns
    ? rows.map((r) =>
        Object.fromEntries(columns.map((c) => [c.header, normalizeCell(r[c.key])])),
      )
    : rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, normalizeCell(v)])));
  const csv = Papa.unparse(data);
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), ensureExt(fileName, 'csv'));
}

export function exportJson(payload: unknown, fileName: string): void {
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    ensureExt(fileName, 'json'),
  );
}

/**
 * "Excel export" is produced as an Excel-compatible XML spreadsheet so that the
 * prototype ships without a heavyweight binary writer dependency.
 */
export function exportExcel<T extends Record<string, unknown>>(rows: T[], fileName: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const body = rows
    .map(
      (r) =>
        `<Row>${headers
          .map((h) => `<Cell><Data ss:Type="String">${esc(normalizeCell(r[h]))}</Data></Cell>`)
          .join('')}</Row>`,
    )
    .join('');
  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="BhoomiLens"><Table>
<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>
${body}
</Table></Worksheet></Workbook>`;
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel' }), ensureExt(fileName, 'xls'));
}

export function printView(): void {
  window.print();
}

export function parseCsv<T = Record<string, unknown>>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data),
      error: (e: Error) => reject(e),
    });
  });
}

export async function parseJsonFile<T = unknown>(file: File): Promise<T> {
  const text = await file.text();
  return JSON.parse(text) as T;
}

function normalizeCell(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((v) => normalizeCell(v)).join('; ');
  return JSON.stringify(value);
}

function ensureExt(name: string, ext: string): string {
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}
