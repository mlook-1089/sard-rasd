import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { circles, students, studentHizbs, sessions } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

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

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  noStore();
  const token = (params.token || '').trim();
  if (!token) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }

  const [circle] = await db.select().from(circles).where(eq(circles.linkToken, token)).limit(1);
  if (!circle || circle.linkToken !== token) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }
  const revoked = parseRevoked(circle.revokedTokens);
  if (revoked.includes(token)) {
    return NextResponse.json({ error: 'revoked' }, { status: 404 });
  }

  const studs = await db.select().from(students).where(eq(students.circleId, circle.id)).orderBy(students.id);

  const out: any[] = [];
  for (const s of studs) {
    const hs = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, s.id));
    const hizbsSet = hs.map((r) => r.hizbNumber).sort((a, b) => a - b);
    const target = hizbsSet.length;

    const [passedRow] = await db
      .select({
        memorized: sql<number>`count(DISTINCT ${sessions.hizbNumber})`,
        errors: sql<number>`COALESCE(SUM(${sessions.errors}), 0)`,
        alerts: sql<number>`COALESCE(SUM(${sessions.alerts}), 0)`
      })
      .from(sessions)
      .where(and(
        eq(sessions.studentId, s.id),
        eq(sessions.cancelled, false),
        eq(sessions.passed, true)
      ));

    const memorized = Number(passedRow?.memorized ?? 0);
    const errors = Number(passedRow?.errors ?? 0);
    const alerts = Number(passedRow?.alerts ?? 0);
    const completion = target > 0 ? Math.round((memorized / target) * 100) : 0;

    const effectiveStatus =
      target === 0
        ? 'waiting_hizbs'
        : s.committeeId
          ? 'active'
          : s.status === 'active'
            ? 'active'
            : 'waiting_committee';

    out.push({
      id: s.id,
      name: s.name,
      nationalId: s.nationalId,
      parentPhone: s.parentPhone,
      status: effectiveStatus,
      hizbsSet,
      memorized,
      target,
      errors,
      alerts,
      completion
    });
  }

  return NextResponse.json(
    { circle, students: out },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
