import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, circles, committees, studentHizbs, sessions, programs, supervisors } from '@/lib/schema';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { hash, randomPassword, passwordCollides, getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Supervisors can read students but are forced to their own committee server-side.
  const session = await getSession();
  if (!session || !['admin', 'supervisor'].includes(session.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let q = db.select({
    id: students.id,
    name: students.name,
    nationalId: students.nationalId,
    parentPhone: students.parentPhone,
    level: students.level,
    status: students.status,
    circleId: students.circleId,
    committeeId: students.committeeId,
    circleName: circles.name,
    committeeName: committees.name
  })
    .from(students)
    .leftJoin(circles, eq(students.circleId, circles.id))
    .leftJoin(committees, eq(students.committeeId, committees.id))
    .$dynamic();

  if (session.role === 'supervisor') {
    let cid = session.committeeId ?? null;
    if (!cid && (session as any).supervisorId) {
      const [sup] = await db
        .select({ committeeId: supervisors.committeeId })
        .from(supervisors)
        .where(eq(supervisors.id, Number((session as any).supervisorId)))
        .limit(1);
      cid = sup?.committeeId ?? null;
    }
    if (cid) {
      q = q.where(eq(students.committeeId, cid));
    } else {
      return NextResponse.json({ rows: [] });
    }
  }

  const baseRows = await q.orderBy(students.id);
  if (baseRows.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const studentIds = baseRows.map((r) => r.id);

  const [allHizbs, activeProgs, endedSessions] = await Promise.all([
    db.select().from(studentHizbs).where(inArray(studentHizbs.studentId, studentIds)),
    db.select({ id: programs.id }).from(programs).where(eq(programs.isActive, true)).limit(1),
    db
      .select({
        studentId: sessions.studentId,
        programId: sessions.programId,
        hizbNumber: sessions.hizbNumber,
        errors: sessions.errors,
        alerts: sessions.alerts,
        passed: sessions.passed,
        cancelled: sessions.cancelled,
        endedAt: sessions.endedAt
      })
      .from(sessions)
      .where(and(inArray(sessions.studentId, studentIds), isNotNull(sessions.endedAt), eq(sessions.cancelled, false)))
  ]);

  const activeProgramId = activeProgs[0]?.id ?? null;

  const hizbsByStudent = new Map<number, number[]>();
  for (const h of allHizbs) {
    const arr = hizbsByStudent.get(h.studentId) || [];
    arr.push(h.hizbNumber);
    hizbsByStudent.set(h.studentId, arr);
  }

  const statsByStudent = new Map<number, { passedSet: Set<number>; errors: number; alerts: number }>();
  for (const s of endedSessions) {
    if (activeProgramId && s.programId !== null && s.programId !== activeProgramId) continue;
    let st = statsByStudent.get(s.studentId);
    if (!st) {
      st = { passedSet: new Set<number>(), errors: 0, alerts: 0 };
      statsByStudent.set(s.studentId, st);
    }
    st.errors += s.errors || 0;
    st.alerts += s.alerts || 0;
    if (s.passed !== false) {
      st.passedSet.add(s.hizbNumber);
    }
  }

  const rows = await Promise.all(
    baseRows.map(async (r) => {
      const hizbs = (hizbsByStudent.get(r.id) || []).slice().sort((a, b) => a - b);
      const st = statsByStudent.get(r.id);
      const completedHizbs = st ? Array.from(st.passedSet).sort((a, b) => a - b) : [];
      const memorizedCount = completedHizbs.length;
      const errors = st ? st.errors : 0;
      const alerts = st ? st.alerts : 0;
      const completion = hizbs.length > 0 ? Math.min(100, Math.round((memorizedCount / hizbs.length) * 100)) : 0;

      const expectedStatus =
        hizbs.length === 0 ? 'waiting_hizbs' : !r.committeeId ? 'waiting_committee' : 'active';
      if (r.status !== expectedStatus) {
        await db.update(students).set({ status: expectedStatus }).where(eq(students.id, r.id));
      }

      return {
        ...r,
        status: expectedStatus,
        hizbs,
        hizbsCount: hizbs.length,
        completedHizbs,
        memorizedCount,
        memorized: memorizedCount,
        errors,
        alerts,
        completion
      };
    })
  );

  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  const name = (b.name || '').trim();
  if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });

  const nationalId = (b.nationalId || '').trim() || null;
  let password = (b.password || '').trim() || nationalId || '';
  if (!password) password = randomPassword(6);
  else {
    const collision = await passwordCollides(password);
    if (collision) return NextResponse.json({ error: 'رقم الهوية / كلمة المرور مستخدمة بالفعل' }, { status: 409 });
  }
  const passwordHash = await hash(password);

  const [row] = await db.insert(students).values({
    name,
    nationalId,
    parentPhone: b.parentPhone || null,
    level: b.level || null,
    circleId: b.circleId || null,
    passwordHash,
    status: 'waiting_hizbs'
  }).returning();

  return NextResponse.json({ ok: true, id: row.id, password });
}
