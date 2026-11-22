import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supervisors } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { hash, passwordCollides } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const b = await req.json();
  const patch: any = {};
  for (const f of ['username', 'displayName', 'canEditRecords', 'canDeleteRecords'] as const) {
    if (f in b) patch[f] = b[f];
  }
  if ('committeeId' in b) patch.committeeId = b.committeeId || null;
  if (b.password) {
    const collision = await passwordCollides(b.password, { kind: 'supervisor', id });
    if (collision) return NextResponse.json({ error: 'كلمة المرور مستخدمة بالفعل' }, { status: 409 });
    patch.passwordHash = await hash(b.password);
  }
  await db.update(supervisors).set(patch).where(eq(supervisors.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  await db.delete(supervisors).where(eq(supervisors.id, Number(params.id)));
  return NextResponse.json({ ok: true });
}
