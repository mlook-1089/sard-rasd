import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, students, committees, attendance } from '@/lib/schema';
import { and, desc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getActiveProgramId } from '@/lib/activeProgram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId');
  const committeeId = url.searchParams.get('committeeId');
  const includeCancelled = url.searchParams.get('includeCancelled') === '1';
  const activeOnly = url.searchParams.get('activeOnly') === '1';
  const deviceTag = (url.searchParams.get('deviceTag') || '').trim();
  const reciterName = (url.searchParams.get('reciterName') || '').trim();

  // Default: hide cancelled sessions. Only include them when explicitly asked.
  const where: any[] = includeCancelled ? [] : [eq(sessions.cancelled, false)];
  if (activeOnly) {
    where.push(isNull(sessions.endedAt));
  }
  if (studentId) {
    const sid = Math.max(0, Math.floor(Number(studentId) || 0));
    if (sid > 0) where.push(eq(sessions.studentId, sid));
  }
  if (committeeId) {
    const cid = Math.max(0, Math.floor(Number(committeeId) || 0));
    if (cid > 0) where.push(eq(sessions.committeeId, cid));
  }
  if (session.role === 'supervisor' && session.committeeId) {
    where.push(eq(sessions.committeeId, session.committeeId));
  }
  if (deviceTag && reciterName) {
    where.push(or(eq(sessions.deviceTag, deviceTag), eq(sessions.reciterName, reciterName)));
  } else if (deviceTag) {
    where.push(eq(sessions.deviceTag, deviceTag));
  } else if (reciterName) {
    where.push(eq(sessions.reciterName, reciterName));
  }

  const rows = await db.select({
    id: sessions.id, startedAt: sessions.startedAt, endedAt: sessions.endedAt,
    durationSeconds: sessions.durationSeconds, hizbNumber: sessions.hizbNumber,
    errors: sessions.errors, alerts: sessions.alerts, score: sessions.score,
    passed: sessions.passed, cancelled: sessions.cancelled,
    reciterName: sessions.reciterName, deviceTag: sessions.deviceTag,
    studentId: sessions.studentId, committeeId: sessions.committeeId,
    studentName: students.name, committeeName: committees.name
  })
    .from(sessions)
    .leftJoin(students, eq(sessions.studentId, students.id))
    .leftJoin(committees, eq(sessions.committeeId, committees.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(sessions.id))
    .limit(500);

  return NextResponse.json({ rows });
}

/** START a session. Body: { studentId, hizbNumber, reciterName, committeeId, deviceTag? } */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !['supervisor', 'reciter'].includes(session.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const b = await req.json();
  const committeeId = session.role === 'supervisor'
    ? session.committeeId
    : Math.max(0, Math.floor(Number(b.committeeId) || 0));
  if (!committeeId) return NextResponse.json({ error: 'اللجنة مطلوبة' }, { status: 400 });

  const studentId = Math.max(0, Math.floor(Number(b.studentId) || 0));
  const hizbNumber = Math.max(0, Math.floor(Number(b.hizbNumber) || 0));
  if (!studentId || hizbNumber < 1 || hizbNumber > 60) {
    return NextResponse.json({ error: 'بيانات الطالب أو الحزب غير صالحة' }, { status: 400 });
  }

  const activeId = await getActiveProgramId();
  if (!activeId) return NextResponse.json({ error: 'لا يوجد برنامج نشط' }, { status: 400 });

  // Verify student is not marked absent in attendance for the active program
  const [att] = await db.select({ status: attendance.status })
    .from(attendance)
    .where(and(eq(attendance.studentId, studentId), eq(attendance.programId, activeId)))
    .limit(1);
  if (att && att.status === 'absent') {
    return NextResponse.json({ error: 'لا يمكن تسميع طالب مسجل غائباً في التحضير' }, { status: 400 });
  }

  // Block only if this hizb was already PASSED in the active program. Failed or cancelled attempts can be retried.
  const dup = await db.select({ id: sessions.id }).from(sessions).where(and(
    eq(sessions.studentId, studentId),
    eq(sessions.hizbNumber, hizbNumber),
    eq(sessions.programId, activeId),
    isNotNull(sessions.endedAt),
    eq(sessions.cancelled, false),
    eq(sessions.passed, true)
  )).limit(1);
  if (dup.length > 0) {
    return NextResponse.json({ error: 'هذا الحزب تم اجتيازه لهذا الطالب من قبل' }, { status: 409 });
  }

  const trimmedReciter = (b.reciterName || '').trim() || 'بدون اسم';
  const deviceTag = b.deviceTag ? String(b.deviceTag).trim() : null;

  // Check if there is an existing un-ended session for this student & hizb
  const openSessions = await db.select().from(sessions).where(and(
    eq(sessions.studentId, studentId),
    eq(sessions.hizbNumber, hizbNumber),
    eq(sessions.cancelled, false),
    isNull(sessions.endedAt)
  ));

  if (openSessions.length > 0) {
    const latestOpen = openSessions[openSessions.length - 1];
    const ageMs = Date.now() - new Date(latestOpen.startedAt).getTime();
    const sameOwner = (deviceTag && latestOpen.deviceTag === deviceTag) || latestOpen.reciterName === trimmedReciter;

    // If double-clicked within 5 seconds by the same reciter/device, return existing session
    if (sameOwner && ageMs < 5000 && !b.forceNew) {
      return NextResponse.json({ ok: true, id: latestOpen.id, startedAt: latestOpen.startedAt, resumed: true });
    }

    // Cancel stale un-ended sessions for this student+hizb so orphan sessions never accumulate
    for (const oldOpen of openSessions) {
      await db.update(sessions).set({
        cancelled: true,
        endedAt: new Date(),
        durationSeconds: Math.max(0, Math.floor((Date.now() - new Date(oldOpen.startedAt).getTime()) / 1000))
      }).where(eq(sessions.id, oldOpen.id));
    }
  }

  const [row] = await db.insert(sessions).values({
    studentId,
    hizbNumber,
    reciterName: trimmedReciter,
    committeeId,
    programId: activeId,
    deviceTag
  }).returning();
  return NextResponse.json({ ok: true, id: row.id, startedAt: row.startedAt });
}
