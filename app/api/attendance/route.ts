import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attendance, students } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getActiveProgram } from '@/lib/activeProgram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['present', 'absent', 'unset']);

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !['admin', 'supervisor'].includes(s.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const program = await getActiveProgram();
  if (!program) return NextResponse.json({ error: 'لا يوجد برنامج نشط' }, { status: 400 });

  const url = new URL(req.url);
  let committeeId: number | undefined;
  if (s.role === 'supervisor') {
    committeeId = s.committeeId ?? undefined;
  } else {
    const c = url.searchParams.get('committeeId');
    if (c) committeeId = Number(c);
  }

  const where = [eq(attendance.programId, program.id)];
  if (committeeId) where.push(eq(attendance.committeeId, committeeId));

  const rows = await db
    .select({ studentId: attendance.studentId, status: attendance.status })
    .from(attendance)
    .where(and(...where));

  return NextResponse.json({
    program: { id: program.id, name: program.name },
    rows
  });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || !['admin', 'supervisor'].includes(s.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const program = await getActiveProgram();
  if (!program) return NextResponse.json({ error: 'لا يوجد برنامج نشط' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { studentId?: number; status?: string };
  const studentId = Number(body.studentId);
  const status = String(body.status || '');
  if (!studentId || !ALLOWED.has(status)) {
    return NextResponse.json({ error: 'طلب غير صحيح' }, { status: 400 });
  }

  const [st] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!st) return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });

  // Supervisor can only mark attendance for students in their committee
  if (s.role === 'supervisor' && s.committeeId && st.committeeId !== s.committeeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const existing = await db
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.programId, program.id), eq(attendance.studentId, studentId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(attendance)
        .set({
          status,
          committeeId: st.committeeId ?? null,
          updatedAt: new Date()
        })
        .where(and(eq(attendance.programId, program.id), eq(attendance.studentId, studentId)));
    } else {
      await db.insert(attendance).values({
        studentId,
        programId: program.id,
        committeeId: st.committeeId ?? null,
        status,
        updatedAt: new Date()
      });
    }
  } catch (e: any) {
    console.error('[attendance POST] failed', e);
    return NextResponse.json({ error: e?.message || 'فشل حفظ التحضير' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, studentId, status });
}
