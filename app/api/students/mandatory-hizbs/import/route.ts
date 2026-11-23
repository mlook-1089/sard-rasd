import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { studentHizbs, students } from '@/lib/schema';
import { requireRole } from '@/lib/require';
import { parseXlsxBuffer } from '@/lib/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PreviewRow = {
  rowNumber: number;
  name: string;
  hizbs: number[];
  status: 'matched' | 'not_found' | 'ambiguous' | 'invalid' | 'duplicate';
  message: string;
  studentId?: number;
  currentMandatory?: number[];
};

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseHizbs(raw: string): { hizbs: number[]; error?: string } {
  const cleaned = normalizeArabicDigits(raw)
    .replace(/الأحزاب|الاحزاب|الحزب|حزب/g, ' ')
    .replace(/إلى|الى/g, '-')
    .replace(/[،,؛;]/g, ' ')
    .trim();
  if (!cleaned) return { hizbs: [], error: 'خانة الأحزاب فارغة' };

  const values = new Set<number>();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const match = token.match(/^(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?$/);
    if (!match) return { hizbs: [], error: `صيغة غير مفهومة: ${token}` };
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || start > 60 || end < 1 || end > 60) {
      return { hizbs: [], error: 'أرقام الأحزاب يجب أن تكون من 1 إلى 60' };
    }
    if (end < start) return { hizbs: [], error: `النطاق ${token} معكوس` };
    for (let n = start; n <= end; n++) values.add(n);
  }
  return { hizbs: Array.from(values).sort((a, b) => a - b) };
}

async function readRows(req: Request): Promise<string[][]> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  let buffer: ArrayBuffer;
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof (file as File).arrayBuffer !== 'function') throw new Error('الملف مفقود');
    buffer = await (file as File).arrayBuffer();
  } else {
    buffer = await req.arrayBuffer();
  }
  if (buffer.byteLength === 0) throw new Error('الملف فارغ');
  const sheets = parseXlsxBuffer(buffer);
  return sheets[0]?.rows ?? [];
}

async function buildPreview(rows: string[][]): Promise<PreviewRow[]> {
  if (rows.length < 2) throw new Error('الملف فارغ أو لا يحتوي على بيانات');
  const headers = rows[0].map((h) => normalizeName(String(h || '')));
  const nameIndex = headers.findIndex((h) => h.includes('اسم') && (h.includes('طالب') || h === 'الاسم'));
  const hizbsIndex = headers.findIndex((h) => h.includes('حزب') || h.includes('احزاب'));
  if (nameIndex === -1) throw new Error('عمود «اسم الطالب» مفقود');
  if (hizbsIndex === -1) throw new Error('عمود «الأحزاب الإجبارية» مفقود');

  const [allStudents, allHizbs] = await Promise.all([
    db.select({ id: students.id, name: students.name }).from(students),
    db.select().from(studentHizbs)
  ]);
  const studentsByName = new Map<string, Array<{ id: number; name: string }>>();
  for (const student of allStudents) {
    const key = normalizeName(student.name);
    const list = studentsByName.get(key) || [];
    list.push(student);
    studentsByName.set(key, list);
  }
  const mandatoryByStudent = new Map<number, number[]>();
  for (const h of allHizbs) {
    if (!h.isMandatory) continue;
    const list = mandatoryByStudent.get(h.studentId) || [];
    list.push(h.hizbNumber);
    mandatoryByStudent.set(h.studentId, list);
  }

  const seen = new Set<string>();
  const preview: PreviewRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][nameIndex] || '').trim();
    const rawHizbs = String(rows[i][hizbsIndex] || '').trim();
    if (!name && !rawHizbs) continue;
    const key = normalizeName(name);
    if (!name) {
      preview.push({ rowNumber: i + 1, name: `الصف ${i + 1}`, hizbs: [], status: 'invalid', message: 'اسم الطالب فارغ' });
      continue;
    }
    if (seen.has(key)) {
      preview.push({ rowNumber: i + 1, name, hizbs: [], status: 'duplicate', message: 'اسم مكرر داخل الملف' });
      continue;
    }
    seen.add(key);
    const parsed = parseHizbs(rawHizbs);
    if (parsed.error) {
      preview.push({ rowNumber: i + 1, name, hizbs: [], status: 'invalid', message: parsed.error });
      continue;
    }
    const matches = studentsByName.get(key) || [];
    if (matches.length === 0) {
      preview.push({ rowNumber: i + 1, name, hizbs: parsed.hizbs, status: 'not_found', message: 'الاسم غير موجود في المنصة' });
      continue;
    }
    if (matches.length > 1) {
      preview.push({ rowNumber: i + 1, name, hizbs: parsed.hizbs, status: 'ambiguous', message: 'يوجد أكثر من طالب بهذا الاسم' });
      continue;
    }
    const student = matches[0];
    preview.push({
      rowNumber: i + 1,
      name: student.name,
      hizbs: parsed.hizbs,
      status: 'matched',
      message: 'جاهز للاعتماد',
      studentId: student.id,
      currentMandatory: (mandatoryByStudent.get(student.id) || []).sort((a, b) => a - b)
    });
  }
  if (preview.length === 0) throw new Error('لم يتم العثور على صفوف بيانات في الملف');
  return preview;
}

export async function POST(req: Request) {
  const guard = await requireRole(['admin']);
  if (!guard.ok) return guard.res;
  const mode = new URL(req.url).searchParams.get('mode') === 'apply' ? 'apply' : 'preview';
  try {
    const rows = await readRows(req);
    const preview = await buildPreview(rows);
    const matched = preview.filter((row) => row.status === 'matched' && row.studentId);
    if (mode === 'preview') {
      return NextResponse.json({
        ok: true,
        rows: preview,
        summary: {
          total: preview.length,
          matched: matched.length,
          issues: preview.length - matched.length,
          hizbs: matched.reduce((sum, row) => sum + row.hizbs.length, 0)
        }
      });
    }

    let applied = 0;
    for (const row of matched) {
      const studentId = row.studentId!;
      // The uploaded row is authoritative for the student's administrative
      // mandatory set. Teacher-added assignments remain assigned.
      await db
        .update(studentHizbs)
        .set({ isMandatory: false })
        .where(eq(studentHizbs.studentId, studentId));

      if (row.hizbs.length > 0) {
        await db
          .insert(studentHizbs)
          .values(row.hizbs.map((hizbNumber) => ({ studentId, hizbNumber, isMandatory: true })))
          .onConflictDoNothing();
        await db
          .update(studentHizbs)
          .set({ isMandatory: true })
          .where(and(eq(studentHizbs.studentId, studentId), inArray(studentHizbs.hizbNumber, row.hizbs)));
      }

      const assigned = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, studentId));
      const [student] = await db.select({ committeeId: students.committeeId }).from(students).where(eq(students.id, studentId)).limit(1);
      const status = assigned.length === 0 ? 'waiting_hizbs' : student?.committeeId ? 'active' : 'waiting_committee';
      await db.update(students).set({ status }).where(eq(students.id, studentId));
      applied++;
    }

    return NextResponse.json({
      ok: true,
      applied,
      skipped: preview.length - matched.length,
      rows: preview,
      message: `تم تثبيت الأحزاب الإجبارية لـ ${applied} طالب`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر قراءة ملف Excel' }, { status: 400 });
  }
}
