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
    reciterName: sessions.reciterName, recordingMode: sessions.recordingMode, deviceTag: sessions.deviceTag,
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
  const recordingMode = b.recordingMode === 'mushaf' ? 'mushaf' : 'manual';
  const deviceTag = b.deviceTag ? String(b.deviceTag).trim() : null;
  const STALE_SESSION_MS = 2 * 60 * 60 * 1000; // 2 hours

  // 1) Check ALL open sessions for this student across ALL hizbs and ALL reciters
  const openStudentSessions = await db.select().from(sessions).where(and(
    eq(sessions.studentId, studentId),
    eq(sessions.cancelled, false),
    isNull(sessions.endedAt)
  ));

  const liveStudentSessions: typeof openStudentSessions = [];
  for (const s of openStudentSessions) {
    const ageMs = Date.now() - new Date(s.startedAt).getTime();
    if (ageMs >= STALE_SESSION_MS) {
      // Auto-cancel stale orphan sessions older than 2 hours
      await db.update(sessions).set({
        cancelled: true,
        endedAt: new Date(),
        durationSeconds: Math.max(0, Math.floor(ageMs / 1000))
      }).where(eq(sessions.id, s.id));
    } else {
      liveStudentSessions.push(s);
    }
  }

  if (liveStudentSessions.length > 0) {
    // Keep the earliest live session if multiple somehow existed in DB, cancel any extras
    liveStudentSessions.sort((a, b) => a.id - b.id);
    const activeStudentSession = liveStudentSessions[0];
    for (let i = 1; i < liveStudentSessions.length; i++) {
      const extra = liveStudentSessions[i];
      await db.update(sessions).set({
        cancelled: true,
        endedAt: new Date(),
        durationSeconds: Math.max(0, Math.floor((Date.now() - new Date(extra.startedAt).getTime()) / 1000))
      }).where(eq(sessions.id, extra.id));
    }

    const sameDevice = Boolean(deviceTag && activeStudentSession.deviceTag && activeStudentSession.deviceTag === deviceTag);
    const sameNameNoDevice = Boolean(!deviceTag && !activeStudentSession.deviceTag && activeStudentSession.reciterName === trimmedReciter);
    const sameOwner = sameDevice || sameNameNoDevice;

    // If the same reciter/device is re-requesting the exact same active hizb, resume it idempotently
    if (sameOwner && activeStudentSession.hizbNumber === hizbNumber && activeStudentSession.recordingMode === recordingMode) {
      return NextResponse.json({
        ok: true,
        id: activeStudentSession.id,
        startedAt: activeStudentSession.startedAt,
        resumed: true
      });
    }

    // Otherwise, strictly block opening a second concurrent session for the same student!
    return NextResponse.json({
      error: `الطالب في جلسة تسميع جارية حالياً (الحزب ${activeStudentSession.hizbNumber} مع المسمع: ${activeStudentSession.reciterName}). لا يمكن فتح جلستين لنفس الطالب في نفس الوقت.`
    }, { status: 409 });
  }

  // 2) Also ensure this reciter/device does not already have an open session with ANOTHER student
  if (deviceTag) {
    const openDeviceSessions = await db.select().from(sessions).where(and(
      eq(sessions.deviceTag, deviceTag),
      eq(sessions.cancelled, false),
      isNull(sessions.endedAt)
    ));
    for (const ds of openDeviceSessions) {
      const ageMs = Date.now() - new Date(ds.startedAt).getTime();
      if (ageMs >= STALE_SESSION_MS) {
        await db.update(sessions).set({
          cancelled: true,
          endedAt: new Date(),
          durationSeconds: Math.max(0, Math.floor(ageMs / 1000))
        }).where(eq(sessions.id, ds.id));
      } else if (ds.studentId !== studentId) {
        return NextResponse.json({
          error: `لديك جلسة تسميع جارية حالياً مع طالب آخر (الحزب ${ds.hizbNumber}). يجب إنهاء الجلسة الحالية أو إلغاؤها أولاً.`
        }, { status: 409 });
      }
    }
  }

  const [row] = await db.insert(sessions).values({
    studentId,
    hizbNumber,
    reciterName: trimmedReciter,
    recordingMode,
    committeeId,
    programId: activeId,
    deviceTag
  }).returning();

  // 3) Post-insert atomic race check: if two requests for the same student raced at the exact same millisecond,
  // only the lowest session ID wins; any higher ID is immediately rolled back and rejected with 409.
  const afterInsertOpen = await db.select({
    id: sessions.id,
    hizbNumber: sessions.hizbNumber,
    reciterName: sessions.reciterName
  }).from(sessions).where(and(
    eq(sessions.studentId, studentId),
    eq(sessions.cancelled, false),
    isNull(sessions.endedAt)
  ));

  if (afterInsertOpen.length > 1) {
    const winnerId = Math.min(...afterInsertOpen.map((r) => r.id));
    if (row.id !== winnerId) {
      await db.delete(sessions).where(eq(sessions.id, row.id));
      const winner = afterInsertOpen.find((r) => r.id === winnerId);
      return NextResponse.json({
        error: `الطالب في جلسة تسميع جارية حالياً (الحزب ${winner?.hizbNumber ?? hizbNumber} مع المسمع: ${winner?.reciterName ?? ''}). لا يمكن فتح جلستين لنفس الطالب في نفس الوقت.`
      }, { status: 409 });
    }
  }

  return NextResponse.json({ ok: true, id: row.id, startedAt: row.startedAt });
}
