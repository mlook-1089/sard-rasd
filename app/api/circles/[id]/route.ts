import { NextResponse } from 'next/server';
import { unstable_noStore as noStore, revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { circles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { randomToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function parseRevoked(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  noStore();
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const b = await req.json();

  if (b.action === 'regenerate_token') {
    const [existing] = await db.select().from(circles).where(eq(circles.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const revoked = parseRevoked(existing.revokedTokens);
    const oldToken = existing.linkToken ? String(existing.linkToken).trim() : null;
    const newRevoked = oldToken ? Array.from(new Set([...revoked, oldToken])) : revoked;

    let nextToken = randomToken(28);
    while (nextToken === oldToken || newRevoked.includes(nextToken)) {
      nextToken = randomToken(28);
    }

    const [updated] = await db.update(circles).set({
      linkToken: nextToken,
      revokedTokens: newRevoked
    }).where(eq(circles.id, id)).returning();

    if (oldToken) {
      revalidatePath(`/teacher/${oldToken}`);
    }
    revalidatePath(`/teacher/${nextToken}`);
    revalidatePath('/admin/circles');

    return NextResponse.json(
      { ok: true, row: updated, linkToken: nextToken },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }

  if (b.action === 'revoke_token') {
    const [existing] = await db.select().from(circles).where(eq(circles.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const revoked = parseRevoked(existing.revokedTokens);
    const oldToken = existing.linkToken ? String(existing.linkToken).trim() : null;
    const newRevoked = oldToken ? Array.from(new Set([...revoked, oldToken])) : revoked;

    const [updated] = await db.update(circles).set({
      linkToken: null,
      revokedTokens: newRevoked
    }).where(eq(circles.id, id)).returning();

    if (oldToken) {
      revalidatePath(`/teacher/${oldToken}`);
    }
    revalidatePath('/admin/circles');

    return NextResponse.json(
      { ok: true, row: updated },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }

  const patch: any = {};
  for (const f of ['name', 'teacherName', 'teacherPhone'] as const) {
    if (f in b) patch[f] = typeof b[f] === 'string' ? b[f].trim() || null : b[f] || null;
  }
  const [updated] = await db.update(circles).set(patch).where(eq(circles.id, id)).returning();
  if (updated?.linkToken) {
    revalidatePath(`/teacher/${updated.linkToken}`);
  }
  revalidatePath('/admin/circles');
  return NextResponse.json({ ok: true, row: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  noStore();
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const id = Number(params.id);
  const [existing] = await db.select().from(circles).where(eq(circles.id, id)).limit(1);
  await db.delete(circles).where(eq(circles.id, id));
  if (existing?.linkToken) {
    revalidatePath(`/teacher/${existing.linkToken}`);
  }
  revalidatePath('/admin/circles');
  return NextResponse.json({ ok: true });
}
