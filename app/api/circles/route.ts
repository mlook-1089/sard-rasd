import { NextResponse } from 'next/server';
import { unstable_noStore as noStore, revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { circles, students } from '@/lib/schema';
import { eq, count } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { randomToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  noStore();
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const rows = await db.select().from(circles).orderBy(circles.id);
  const withCounts = await Promise.all(rows.map(async (c) => {
    const [k] = await db.select({ c: count() }).from(students).where(eq(students.circleId, c.id));
    return { ...c, studentsCount: k?.c ?? 0 };
  }));
  return NextResponse.json(
    { rows: withCounts },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}

export async function POST(req: Request) {
  noStore();
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
  const [row] = await db.insert(circles).values({
    name: b.name.trim(),
    teacherName: b.teacherName?.trim() || null,
    teacherPhone: b.teacherPhone?.trim() || null,
    linkToken: b.generateLink ? randomToken(28) : null
  }).returning();
  revalidatePath('/admin/circles');
  return NextResponse.json({ ok: true, row });
}
