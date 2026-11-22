import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programs, sessions, attendance } from '@/lib/schema';
import { and, count, eq, isNull, ne } from 'drizzle-orm';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const [p] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json();

  if (b.action === 'rename') {
    const name = (b.name || '').trim();
    if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    await db.update(programs).set({ name }).where(eq(programs.id, id));
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'activate') {
    await db.update(programs).set({ isActive: false }).where(eq(programs.isActive, true));
    await db.update(programs).set({ isActive: true, archivedAt: null }).where(eq(programs.id, id));
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'archive') {
    // Must have another non-archived program to archive the active one.
    const others = await db.select({ id: programs.id }).from(programs)
      .where(and(ne(programs.id, id), isNull(programs.archivedAt)));
    if (others.length === 0) {
      return NextResponse.json({ error: 'لا يمكن أرشفة البرنامج النشط الوحيد' }, { status: 400 });
    }
    await db.update(programs).set({ isActive: false, archivedAt: new Date() }).where(eq(programs.id, id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const [s] = await db.select({ c: count() }).from(sessions).where(eq(sessions.programId, id));
  const [a] = await db.select({ c: count() }).from(attendance).where(eq(attendance.programId, id));
  if (Number(s?.c ?? 0) > 0 || Number(a?.c ?? 0) > 0) {
    return NextResponse.json({ error: 'لا يمكن حذف برنامج يحوي رصداً' }, { status: 400 });
  }
  await db.delete(programs).where(eq(programs.id, id));
  return NextResponse.json({ ok: true });
}
