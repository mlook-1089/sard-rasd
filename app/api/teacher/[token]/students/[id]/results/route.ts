import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { circles, sessionMarks, sessions, studentHizbs, students } from '@/lib/schema';
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';

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
        recordingMode: sessions.recordingMode,
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

  const markRows = records.length > 0
    ? await db
      .select({
        sessionId: sessionMarks.sessionId,
        surah: sessionMarks.surah,
        ayah: sessionMarks.ayah,
        type: sessionMarks.type
      })
      .from(sessionMarks)
      .where(inArray(sessionMarks.sessionId, records.map((record) => record.id)))
      .orderBy(asc(sessionMarks.id))
    : [];
  const marksBySession = new Map<number, typeof markRows>();
  for (const mark of markRows) {
    const current = marksBySession.get(mark.sessionId) || [];
    current.push(mark);
    marksBySession.set(mark.sessionId, current);
  }

  return NextResponse.json(
    {
      student: { id: student.id, name: student.name },
      assignedHizbs: assigned.map((row) => row.hizbNumber).sort((a, b) => a - b),
      sessions: records.map((record) => ({
        ...record,
        marks: (marksBySession.get(record.id) || []).map(({ surah, ayah, type }) => ({ surah, ayah, type }))
      }))
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
