import * as XLSX from 'xlsx';

export type SheetSpec = {
  name: string;
  headers: string[];
  rows: Array<Record<string, any>>;
  keys?: string[];
};

/** Build an .xlsx file from one or more sheet specs and return a Next Response. */
export function xlsxResponse(filename: string, sheets: SheetSpec[]): Response {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const cols = s.keys ?? s.headers;
    const data: any[][] = [s.headers, ...s.rows.map((r) => cols.map((k) => {
      const v = r[k];
      return v == null ? '' : v;
    }))];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Set RTL on the sheet view for Arabic workbooks.
    (ws as any)['!views'] = [{ RTL: true }];
    const sheetName = (s.name || 'Sheet1').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  // RFC 5987: use `filename*=UTF-8''...` to preserve Arabic filenames.
  // Also include a meaningful ASCII fallback so clients never save as "-_.xlsx".
  const ARABIC_TO_ASCII: Record<string, string> = {
    'تقرير-الطلاب.xlsx': 'students-report.xlsx',
    'تقرير-الحلقات.xlsx': 'circles-report.xlsx',
    'سجل-الرصد.xlsx': 'sessions-report.xlsx',
    'قالب-الطلاب.xlsx': 'students-template.xlsx',
    'قالب-الأحزاب-الإجبارية.xlsx': 'mandatory-hizbs-template.xlsx',
    'قالب-الحلقات.xlsx': 'circles-template.xlsx',
    'قالب-اللجان.xlsx': 'committees-template.xlsx'
  };
  const stripped = filename
    .replace(/\.xlsx$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const asciiFallback =
    ARABIC_TO_ASCII[filename] ||
    (stripped && /[A-Za-z0-9]/.test(stripped) ? `${stripped}.xlsx` : 'sard-report.xlsx');
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  });
}

/** Parse an uploaded .xlsx ArrayBuffer into normalized 2D string rows per sheet. */
export function parseXlsxBuffer(buf: ArrayBuffer): Array<{ sheetName: string; rows: string[][] }> {
  const wb = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
    const rows: string[][] = aoa
      .map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? '' : String(c))) : []))
      .filter((r) => r.some((c) => c.trim() !== ''));
    return { sheetName, rows };
  });
}
