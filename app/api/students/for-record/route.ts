import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentHizbs, sessions, attendance, circles } from '@/lib/schema';
import { and, asc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getActiveProgramId } from '@/lib/activeProgram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns active students for a committee, plus for each one:
 *   assignedHizbs (from studentHizbs), recitedHizbs (completed passed sessions),
 *   remainingHizbs = assigned - recited, hizbResults (latest result per hizb),
 *   circleName, and attendanceStatus ('present' | 'absent' | 'unset').
 */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !['admin', 'supervisor', 'reciter'].includes(s.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  let committeeId: number | undefined;
  if (s.role === 'supervisor') committeeId = s.committeeId ?? undefined;
  else committeeId = Math.max(0, Math.floor(Number(url.searchParams.get('committeeId')) || 0)) || undefined;
  if (!committeeId) return NextResponse.json({ error: 'اللجنة مطلوبة' }, { status: 400 });

  const activeProgramId = await getActiveProgramId();

  const sts = await db.select({
    id: students.id,
    name: students.name,
    level: students.level,
    circleId: students.circleId,
    circleName: circles.name
  })
    .from(students)
    .leftJoin(circles, eq(students.circleId, circles.id))
    .where(and(eq(students.committeeId, committeeId), eq(students.status, 'active')));

  // Fetch attendance records for the active program
  const attMap = new Map<number, 'present' | 'absent' | 'unset'>();
  if (activeProgramId) {
    const attRows = await db.select({
      studentId: attendance.studentId,
      status: attendance.status
    }).from(attendance).where(eq(attendance.programId, activeProgramId));
    for (const r of attRows) {
      const st = r.status === 'present' || r.status === 'absent' ? r.status : 'unset';
      attMap.set(r.studentId, st);
    }
  }

  // Fetch currently active (in-progress) sessions across all students (< 2 hours old)
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const openRows = await db.select({
    id: sessions.id,
    studentId: sessions.studentId,
    hizbNumber: sessions.hizbNumber,
    reciterName: sessions.reciterName,
    deviceTag: sessions.deviceTag,
    startedAt: sessions.startedAt
  }).from(sessions).where(and(eq(sessions.cancelled, false), isNull(sessions.endedAt)));

  const activeSessionMap = new Map<number, {
    id: number;
    hizbNumber: number;
    reciterName: string;
    deviceTag: string | null;
    startedAt: string;
  }>();
  for (const r of openRows) {
    const startedMs = new Date(r.startedAt).getTime();
    if (startedMs > twoHoursAgo && !activeSessionMap.has(r.studentId)) {
      activeSessionMap.set(r.studentId, {
        id: r.id,
        hizbNumber: r.hizbNumber,
        reciterName: r.reciterName,
        deviceTag: r.deviceTag ?? null,
        startedAt: new Date(r.startedAt).toISOString()
      });
    }
  }

  type HizbResult = {
    sessionId: number;
    score: number;
    passed: boolean;
    errors: number;
    alerts: number;
  };

  const out: {
    id: number;
    name: string;
    level: string | null;
    circleName: string | null;
    assigned: number[];
    recited: number[];
    remaining: number[];
    memorized: number;
    target: number;
    hizbResults: Record<number, HizbResult>;
    attendanceStatus: 'present' | 'absent' | 'unset';
    activeSession: {
      id: number;
      hizbNumber: number;
      reciterName: string;
      deviceTag: string | null;
      startedAt: string;
    } | null;
  }[] = [];

  for (const st of sts) {
    const assigned = (await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, st.id)))
      .map((r) => r.hizbNumber)
      .sort((a, b) => a - b);

    const completedWhere: any[] = [
      eq(sessions.studentId, st.id),
      isNotNull(sessions.endedAt),
      isNotNull(sessions.score),
      eq(sessions.cancelled, false)
    ];
    if (activeProgramId) {
      completedWhere.push(or(eq(sessions.programId, activeProgramId), isNull(sessions.programId)));
    }
    const completedRows = await db.select({
      id: sessions.id,
      h: sessions.hizbNumber,
      score: sessions.score,
      passed: sessions.passed,
      errors: sessions.errors,
      alerts: sessions.alerts
    })
      .from(sessions)
      .where(and(...completedWhere))
      .orderBy(asc(sessions.id));

    const hizbResults: Record<number, HizbResult> = {};
    for (const r of completedRows) {
      const prev = hizbResults[r.h];
      // Passed result stays unless overwritten by a newer passed result; otherwise latest attempt is shown
      if (!prev || !prev.passed || r.passed) {
        hizbResults[r.h] = {
          sessionId: r.id,
          score: Number(r.score ?? 0),
          passed: Boolean(r.passed),
          errors: Number(r.errors ?? 0),
          alerts: Number(r.alerts ?? 0)
        };
      }
    }

    const recited = Object.entries(hizbResults)
      .filter(([, v]) => v.passed)
      .map(([k]) => Number(k));
    const remaining = assigned.filter((h) => !recited.includes(h)).sort((a, b) => a - b);
    const attendanceStatus = attMap.get(st.id) ?? 'unset';
    const activeSession = activeSessionMap.get(st.id) ?? null;

    out.push({
      id: st.id,
      name: st.name,
      level: st.level,
      circleName: st.circleName ?? null,
      assigned,
      recited,
      remaining,
      memorized: recited.length,
      target: assigned.length,
      hizbResults,
      attendanceStatus,
      activeSession
    });
  }

  // Sort 'present' students first, then 'unset', then 'absent'
  const statusOrder: Record<'present' | 'unset' | 'absent', number> = {
    present: 0,
    unset: 1,
    absent: 2
  };
  out.sort((a, b) => (statusOrder[a.attendanceStatus] ?? 1) - (statusOrder[b.attendanceStatus] ?? 1));

  return NextResponse.json({ students: out });
}
