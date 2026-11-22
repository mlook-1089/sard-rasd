import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programs, sessions, attendance } from '@/lib/schema';
import { and, count, desc, eq, ne, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;

  const rows = await db.select().from(programs).orderBy(desc(programs.createdAt));
  const out = await Promise.all(rows.map(async (p) => {
    const [s] = await db.select({ c: count() }).from(sessions)
      .where(and(eq(sessions.programId, p.id), eq(sessions.cancelled, false), eq(sessions.passed, true)));
    const [a] = await db.select({ c: count() }).from(attendance)
      .where(and(eq(attendance.programId, p.id), ne(attendance.status, 'unset')));
    return {
      id: p.id, name: p.name, isActive: p.isActive, archivedAt: p.archivedAt, createdAt: p.createdAt,
      stats: { sessionsCount: Number(s?.c ?? 0), attendanceCount: Number(a?.c ?? 0) }
    };
  }));
  return NextResponse.json({ rows: out });
}

export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  const name = (b.name || '').trim();
  if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
  const setActive = !!b.setActive;

  if (setActive) {
    await db.update(programs).set({ isActive: false }).where(eq(programs.isActive, true));
  }
  const [row] = await db.insert(programs).values({ name, isActive: setActive, archivedAt: null }).returning();
  return NextResponse.json({ ok: true, row });
}
