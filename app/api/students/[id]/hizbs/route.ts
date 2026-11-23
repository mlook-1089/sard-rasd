import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { studentHizbs, students } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin', 'supervisor']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const hz = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, id));
  const hizbs = hz.map((h) => h.hizbNumber).sort((a, b) => a - b);
  const mandatoryHizbs = hz.filter((h) => h.isMandatory).map((h) => h.hizbNumber).sort((a, b) => a - b);
  return NextResponse.json({ hizbs, mandatoryHizbs });
}

/** Only Admin can replace hizbs for a student here (Circle Teacher uses /api/teacher/[token]/students/[id]/hizbs). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const b = await req.json();
  const rawList: any[] = Array.isArray(b.hizbs) ? b.hizbs : [];
  const list: number[] = Array.from(
    new Set(
      rawList
        .map((n: any) => Number(n))
        .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 60)
    )
  ).sort((a, b) => a - b);

  const existing = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, id));
  const mandatory = new Set(existing.filter((h) => h.isMandatory).map((h) => h.hizbNumber));

  await db.delete(studentHizbs).where(eq(studentHizbs.studentId, id));
  if (list.length > 0) {
    await db
      .insert(studentHizbs)
      .values(list.map((n) => ({ studentId: id, hizbNumber: n, isMandatory: mandatory.has(n) })))
      .onConflictDoNothing();
  }

  // Re-read student's current committeeId and recalculate status accurately
  const [st] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  let nextStatus = 'waiting_hizbs';
  if (st) {
    if (list.length === 0) {
      nextStatus = 'waiting_hizbs';
    } else if (!st.committeeId) {
      nextStatus = 'waiting_committee';
    } else {
      nextStatus = 'active';
    }
    await db.update(students).set({ status: nextStatus }).where(eq(students.id, id));
  }
  return NextResponse.json({
    ok: true,
    hizbs: list,
    mandatoryHizbs: list.filter((n) => mandatory.has(n)),
    status: nextStatus
  });
}
