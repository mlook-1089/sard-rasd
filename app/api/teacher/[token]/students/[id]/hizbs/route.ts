import { NextResponse } from 'next/server';
import { unstable_noStore as noStore, revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { circles, students, studentHizbs } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function parseRevoked(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

export async function PUT(
  req: Request,
  { params }: { params: { token: string; id: string } }
) {
  noStore();
  const token = (params.token || '').trim();
  const studentId = Number(params.id);
  if (!token) return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  if (!Number.isFinite(studentId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const [circle] = await db.select().from(circles).where(eq(circles.linkToken, token)).limit(1);
  if (!circle || circle.linkToken !== token) {
    return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  }
  const revoked = parseRevoked(circle.revokedTokens);
  if (revoked.includes(token)) {
    return NextResponse.json({ error: 'revoked' }, { status: 404 });
  }

  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student || student.circleId !== circle.id) {
    return NextResponse.json({ error: 'student not in circle' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { hizbs?: unknown };
  const rawHizbs = Array.isArray(body.hizbs) ? body.hizbs : [];
  const hizbs = Array.from(new Set(
    rawHizbs
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60)
  )).sort((a, b) => a - b);

  const existing = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, studentId));
  const existingSet = new Set(existing.map((h) => h.hizbNumber));
  const removed = existing.filter((h) => !hizbs.includes(h.hizbNumber));
  if (removed.length > 0) {
    return NextResponse.json(
      { error: 'لا يمكن إنقاص الأحزاب المحفوظة. يمكنك الزيادة فقط.' },
      { status: 409 }
    );
  }

  const additions = hizbs.filter((n) => !existingSet.has(n));
  if (additions.length > 0) {
    await db
      .insert(studentHizbs)
      .values(additions.map((n) => ({ studentId, hizbNumber: n, isMandatory: false })))
      .onConflictDoNothing();
  }

  const savedHizbs = Array.from(new Set([...existingSet, ...additions])).sort((a, b) => a - b);
  const mandatoryHizbs = existing
    .filter((h) => h.isMandatory)
    .map((h) => h.hizbNumber)
    .sort((a, b) => a - b);

  const nextStatus =
    savedHizbs.length === 0
      ? 'waiting_hizbs'
      : student.committeeId
        ? 'active'
        : 'waiting_committee';

  await db.update(students).set({ status: nextStatus }).where(eq(students.id, studentId));

  revalidatePath(`/teacher/${token}`);

  return NextResponse.json(
    { ok: true, count: savedHizbs.length, hizbs: savedHizbs, mandatoryHizbs, status: nextStatus },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
