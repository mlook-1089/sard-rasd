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

  await db.delete(studentHizbs).where(eq(studentHizbs.studentId, studentId));
  if (hizbs.length > 0) {
    await db.insert(studentHizbs).values(hizbs.map((n) => ({ studentId, hizbNumber: n })));
  }

  const nextStatus =
    hizbs.length === 0
      ? 'waiting_hizbs'
      : student.committeeId
        ? 'active'
        : 'waiting_committee';

  await db.update(students).set({ status: nextStatus }).where(eq(students.id, studentId));

  revalidatePath(`/teacher/${token}`);

  return NextResponse.json(
    { ok: true, count: hizbs.length, hizbs, status: nextStatus },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
