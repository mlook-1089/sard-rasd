import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentHizbs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { hash, passwordCollides } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin', 'supervisor']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const [row] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const hz = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, id));
  const hizbs = hz.map((h) => h.hizbNumber).sort((a, b) => a - b);
  return NextResponse.json({ student: { ...row, hizbs }, hizbs });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const [existing] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const b = await req.json();
  const patch: any = {};

  if ('name' in b) {
    const name = String(b.name || '').trim();
    if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    patch.name = name;
  }
  for (const f of ['nationalId', 'parentPhone', 'level'] as const) {
    if (f in b) patch[f] = b[f] ? String(b[f]).trim() : null;
  }
  if ('circleId' in b) patch.circleId = b.circleId ? Number(b.circleId) : null;
  if ('committeeId' in b) patch.committeeId = b.committeeId ? Number(b.committeeId) : null;

  const newPw = (b.password ? String(b.password).trim() : '') || (patch.nationalId ? String(patch.nationalId).trim() : '');
  if (newPw) {
    const collision = await passwordCollides(newPw, { kind: 'student', id });
    if (collision) return NextResponse.json({ error: 'رقم الهوية / كلمة المرور مستخدمة بالفعل' }, { status: 409 });
    patch.passwordHash = await hash(newPw);
  }

  if (Array.isArray(b.hizbs)) {
    const rawHizbs: any[] = b.hizbs;
    const list: number[] = Array.from(
      new Set<number>(
        rawHizbs
          .map((n: any) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 60)
      )
    ).sort((a, b) => a - b);
    await db.delete(studentHizbs).where(eq(studentHizbs.studentId, id));
    if (list.length > 0) {
      await db
        .insert(studentHizbs)
        .values(list.map((n) => ({ studentId: id, hizbNumber: n })))
        .onConflictDoNothing();
    }
  }

  const hz = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, id));
  const hizbs = hz.map((h) => h.hizbNumber).sort((a, b) => a - b);
  const effectiveCommitteeId = 'committeeId' in patch ? patch.committeeId : existing.committeeId;

  if (hizbs.length === 0) {
    patch.status = 'waiting_hizbs';
  } else if (!effectiveCommitteeId) {
    patch.status = 'waiting_committee';
  } else {
    patch.status = 'active';
  }

  await db.update(students).set(patch).where(eq(students.id, id));
  return NextResponse.json({ ok: true, status: patch.status, hizbs });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  await db.delete(students).where(eq(students.id, Number(params.id)));
  return NextResponse.json({ ok: true });
}
