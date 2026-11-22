import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, circles } from '@/lib/schema';
import { requireRole } from '@/lib/require';
import { hash, randomPassword, passwordCollides } from '@/lib/auth';
import { parseCsv } from '@/lib/csv';
import { parseXlsxBuffer } from '@/lib/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bulk import students from an Excel (.xlsx) or CSV body.
 * Expected columns (header row required): الاسم, الهوية, ولي الأمر, المستوى, الحلقة
 * The الحلقة column is matched by name against existing circles; unknown names are skipped.
 */
export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;

  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  const contentDisp = (req.headers.get('content-disposition') || '').toLowerCase();
  const rawFilename = req.headers.get('x-filename') || '';
  let filename = rawFilename.toLowerCase();
  try {
    filename = decodeURIComponent(rawFilename).toLowerCase();
  } catch {}

  let rows: string[][] = [];

  try {
    let buf: ArrayBuffer;
    let isXlsxHint =
      contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      contentType.includes('application/octet-stream') ||
      filename.endsWith('.xlsx') ||
      contentDisp.endsWith('.xlsx');

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const fileEntry = form.get('file');
      if (!fileEntry || typeof (fileEntry as any).arrayBuffer !== 'function') {
        return NextResponse.json({ error: 'الملف مفقود' }, { status: 400 });
      }
      const f = fileEntry as File;
      buf = await f.arrayBuffer();
      if ((f.name || '').toLowerCase().endsWith('.xlsx')) isXlsxHint = true;
    } else {
      buf = await req.arrayBuffer();
    }

    const bytes = new Uint8Array(buf);
    if (bytes.length === 0) {
      return NextResponse.json({ error: 'الملف فارغ أو لا يحتوي رؤوس أعمدة' }, { status: 400 });
    }
    const isZip =
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05) &&
      (bytes[3] === 0x04 || bytes[3] === 0x06);

    if (isXlsxHint || isZip) {
      const sheets = parseXlsxBuffer(buf);
      rows = sheets[0]?.rows ?? [];
    } else {
      const text = new TextDecoder('utf-8').decode(bytes);
      rows = parseCsv(text);
    }
  } catch {
    return NextResponse.json({ error: 'تعذر قراءة الملف. تأكد من أن الملف بصيغة Excel (.xlsx) أو CSV صحيحة' }, { status: 400 });
  }

  if (rows.length < 2) return NextResponse.json({ error: 'الملف فارغ أو لا يحتوي رؤوس أعمدة' }, { status: 400 });

  const header = rows[0].map((h) => (h || '').trim());
  const idx = {
    name: header.findIndex((h) => h.includes('الاسم')),
    nid: header.findIndex((h) => h.includes('الهوية')),
    phone: header.findIndex((h) => h.includes('ولي') || h.includes('جوال') || h.includes('هاتف')),
    level: header.findIndex((h) => h.includes('المستوى')),
    circle: header.findIndex((h) => h.includes('الحلقة'))
  };
  if (idx.name === -1) return NextResponse.json({ error: 'عمود "الاسم" مفقود' }, { status: 400 });

  const [allCircles, existingStudents] = await Promise.all([
    db.select().from(circles),
    db.select({
      id: students.id,
      name: students.name,
      nationalId: students.nationalId,
      passwordHash: students.passwordHash
    }).from(students)
  ]);

  const normalizeCircle = (s: string) =>
    s.trim().replace(/^حلقة\s+/i, '').replace(/\s+/g, ' ').trim();

  const findCircleId = (name: string) => {
    const n = (name || '').trim();
    if (!n) return null;
    const exact = allCircles.find((c) => c.name.trim() === n);
    if (exact) return exact.id;
    const norm = normalizeCircle(n);
    return allCircles.find((c) => normalizeCircle(c.name) === norm)?.id ?? null;
  };

  const usedPasswords = new Set<string>();
  const existingByNid = new Map<string, number>();
  const existingByName = new Map<string, number>();

  for (const st of existingStudents) {
    if (st.nationalId) {
      const nid = st.nationalId.trim();
      usedPasswords.add(nid);
      existingByNid.set(nid, st.id);
    }
    if (st.passwordHash && !st.passwordHash.startsWith('$2')) {
      usedPasswords.add(st.passwordHash.trim());
    }
    if (st.name) {
      existingByName.set(st.name.trim(), st.id);
    }
  }

  const created: Array<{ name: string; password: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const toInsert: Array<{
    name: string;
    nationalId: string | null;
    parentPhone: string | null;
    level: string | null;
    circleId: number | null;
    passwordHash: string;
    status: string;
  }> = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[idx.name] || '').trim();
    if (!name) {
      skipped.push({ name: `صف ${i + 1}`, reason: 'اسم فارغ' });
      continue;
    }

    const nationalId = idx.nid >= 0 ? String(r[idx.nid] ?? '').trim() || null : null;

    // Skip if already imported (e.g. from a previous partial import)
    if (nationalId && existingByNid.has(nationalId)) {
      skipped.push({ name, reason: 'موجود مسبقاً بنفس رقم الهوية' });
      continue;
    }
    if (!nationalId && existingByName.has(name)) {
      skipped.push({ name, reason: 'موجود مسبقاً بنفس الاسم' });
      continue;
    }

    let pw = nationalId || '';
    if (!pw) {
      for (let t = 0; t < 20; t++) {
        const candidate = randomPassword(6);
        if (!usedPasswords.has(candidate)) {
          pw = candidate;
          break;
        }
      }
      if (!pw) pw = randomPassword(8);
    }

    usedPasswords.add(pw);
    if (nationalId) existingByNid.set(nationalId, -1);
    existingByName.set(name, -1);

    toInsert.push({
      name,
      nationalId,
      parentPhone: idx.phone >= 0 ? String(r[idx.phone] ?? '').trim() || null : null,
      level: idx.level >= 0 ? String(r[idx.level] ?? '').trim() || null : null,
      circleId: idx.circle >= 0 ? findCircleId(String(r[idx.circle] ?? '')) : null,
      passwordHash: pw,
      status: 'waiting_hizbs'
    });
    created.push({ name, password: pw });
  }

  // Batch insert in chunks of 100 rows (1 fast query per 100 students instead of 1 query + bcrypt per student)
  const CHUNK_SIZE = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(students).values(chunk);
  }

  if (created.length === 0 && skipped.length === 0) {
    return NextResponse.json(
      { error: 'لم يتم العثور على بيانات طلاب صالحة للاستيراد في الملف', created, skipped },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, created, skipped });
}
