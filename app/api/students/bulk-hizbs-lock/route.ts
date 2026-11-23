import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const guard = await requireRole(['admin']);
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => ({}));
  if (typeof body.locked !== 'boolean') {
    return NextResponse.json({ error: 'حالة القفل غير صحيحة' }, { status: 400 });
  }
  const updated = await db.update(students).set({ hizbsLocked: body.locked }).returning({ id: students.id });
  return NextResponse.json({ ok: true, locked: body.locked, count: updated.length });
}
