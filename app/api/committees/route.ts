import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { committees, students } from '@/lib/schema';
import { eq, count } from 'drizzle-orm';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Reciter needs this list too to pick which committee to record for.
  const g = await requireRole(['admin', 'supervisor', 'reciter']);
  if (!g.ok) return g.res;
  const rows = await db.select().from(committees).orderBy(committees.id);
  const withCounts = await Promise.all(rows.map(async (c) => {
    const [k] = await db.select({ c: count() }).from(students).where(eq(students.committeeId, c.id));
    return { ...c, studentsCount: k?.c ?? 0 };
  }));
  return NextResponse.json({ rows: withCounts });
}

export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  const name = (b.name || '').trim();
  if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
  // Reject duplicate names
  const existing = await db.select().from(committees);
  if (existing.some((c) => c.name.trim() === name)) {
    return NextResponse.json({ error: 'توجد لجنة بنفس الاسم' }, { status: 409 });
  }
  const [row] = await db.insert(committees).values({ name }).returning();
  return NextResponse.json({ ok: true, row });
}
