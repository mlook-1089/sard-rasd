import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentHizbs, sessionMarks, sessions, committees } from '@/lib/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'student' || !session.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const studentId = session.id;

  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const committee = student.committeeId
    ? (await db.select().from(committees).where(eq(committees.id, student.committeeId)).limit(1))[0]
    : null;

  const hs = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, studentId));
  const target = hs.length;

  const rawSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.studentId, studentId), eq(sessions.cancelled, false)))
    .orderBy(desc(sessions.startedAt));

  const markRows = rawSessions.length > 0
    ? await db
      .select({
        sessionId: sessionMarks.sessionId,
        surah: sessionMarks.surah,
        ayah: sessionMarks.ayah,
        type: sessionMarks.type
      })
      .from(sessionMarks)
      .where(inArray(sessionMarks.sessionId, rawSessions.map((row) => row.id)))
      .orderBy(asc(sessionMarks.id))
    : [];
  const marksBySession = new Map<number, { surah: number; ayah: number; type: string }[]>();
  for (const mark of markRows) {
    const current = marksBySession.get(mark.sessionId) || [];
    current.push({ surah: mark.surah, ayah: mark.ayah, type: mark.type });
    marksBySession.set(mark.sessionId, current);
  }

  const passedHizbs = new Set(
    rawSessions.filter((s) => s.passed && s.endedAt).map((s) => s.hizbNumber)
  );
  const memorized = passedHizbs.size;
  const completion = target > 0 ? Math.round((memorized / target) * 100) : 0;

  // Rank overall: by # of unique passed hizbs, desc
  const allStudents = await db.select({ id: students.id, level: students.level }).from(students);
  const perStudentPassed = await db
    .select({
      studentId: sessions.studentId,
      c: sql<number>`count(DISTINCT ${sessions.hizbNumber})`
    })
    .from(sessions)
    .where(and(eq(sessions.cancelled, false), eq(sessions.passed, true)))
    .groupBy(sessions.studentId);
  const byId = new Map<number, number>();
  for (const r of perStudentPassed) byId.set(r.studentId, Number(r.c));
  const ranked = allStudents
    .map((s) => ({ id: s.id, level: s.level, m: byId.get(s.id) ?? 0 }))
    .sort((a, b) => b.m - a.m);
  const rankOverall = ranked.findIndex((r) => r.id === studentId) + 1;

  const inLevel = ranked.filter((r) => (r.level ?? null) === (student.level ?? null));
  const rankInLevel = inLevel.findIndex((r) => r.id === studentId) + 1;

  const sessionsOut = rawSessions.map((s) => ({
    id: s.id,
    date: s.startedAt,
    hizb: s.hizbNumber,
    errors: s.errors,
    alerts: s.alerts,
    score: s.score,
    passed: s.passed,
    reciter: s.reciterName,
    recordingMode: s.recordingMode,
    durationSeconds: s.durationSeconds,
    marks: marksBySession.get(s.id) || []
  }));

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      level: student.level,
      nationalId: student.nationalId,
      committeeName: committee?.name ?? null
    },
    target,
    memorized,
    completion,
    rankOverall,
    rankInLevel,
    levelSize: inLevel.length,
    totalStudents: ranked.length,
    sessions: sessionsOut
  });
}
