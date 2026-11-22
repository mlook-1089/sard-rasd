/** CSV with UTF-8 BOM so Excel opens Arabic correctly. */

function escape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>, keys?: string[]): string {
  const cols = keys ?? headers;
  const head = headers.map(escape).join(',');
  const body = rows.map((r) => cols.map((k) => escape(r[k])).join(',')).join('\n');
  return '﻿' + head + '\n' + body;
}

/** Response with correct headers for Excel-friendly CSV download. */
export function csvResponse(filename: string, csv: string): Response {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_');
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  });
}

/** Minimal CSV parser: handles quoted fields with "" escapes, CR/LF line endings, and BOM. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(cell); cell = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
    cell += c; i++;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}
