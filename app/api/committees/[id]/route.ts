import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { committees } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  await db.update(committees).set({ name: b.name }).where(eq(committees.id, Number(params.id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  await db.delete(committees).where(eq(committees.id, Number(params.id)));
  return NextResponse.json({ ok: true });
}
