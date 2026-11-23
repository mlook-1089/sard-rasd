import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { circles, sessions, studentHizbs, students } from '@/lib/schema';
import { and, desc, eq, isNotNull } from 'drizzle-orm';

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

export async function GET(
  _req: Request,
  { params }: { params: { token: string; id: string } }
) {
  noStore();
  const token = (params.token || '').trim();
  const studentId = Number(params.id);
  if (!token || !Number.isInteger(studentId) || studentId < 1) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }

  const [circle] = await db.select().from(circles).where(eq(circles.linkToken, token)).limit(1);
  if (!circle || circle.linkToken !== token || parseRevoked(circle.revokedTokens).includes(token)) {
    return NextResponse.json({ error: 'الرابط غير صالح أو منتهي' }, { status: 404 });
  }

  const [student] = await db
    .select({ id: students.id, name: students.name, circleId: students.circleId })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student || student.circleId !== circle.id) {
    return NextResponse.json({ error: 'الطالب غير موجود في هذه الحلقة' }, { status: 404 });
  }

  const [assigned, records] = await Promise.all([
    db
      .select({ hizbNumber: studentHizbs.hizbNumber })
      .from(studentHizbs)
      .where(eq(studentHizbs.studentId, studentId)),
    db
      .select({
        id: sessions.id,
        hizbNumber: sessions.hizbNumber,
        reciterName: sessions.reciterName,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
        durationSeconds: sessions.durationSeconds,
        errors: sessions.errors,
        alerts: sessions.alerts,
        score: sessions.score,
        passed: sessions.passed
      })
      .from(sessions)
      .where(and(
        eq(sessions.studentId, studentId),
        eq(sessions.cancelled, false),
        isNotNull(sessions.endedAt)
      ))
      .orderBy(desc(sessions.startedAt), desc(sessions.id))
  ]);

  return NextResponse.json(
    {
      student: { id: student.id, name: student.name },
      assignedHizbs: assigned.map((row) => row.hizbNumber).sort((a, b) => a - b),
      sessions: records
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
