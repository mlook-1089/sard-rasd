import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const { studentIds, committeeId } = (await req.json()) as { studentIds: number[]; committeeId: number };
  if (!committeeId || !Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: 'اللجنة والطلاب مطلوبون' }, { status: 400 });
  }
  await db.update(students)
    .set({ committeeId, status: 'active' })
    .where(inArray(students.id, studentIds));
  return NextResponse.json({ ok: true });
}
