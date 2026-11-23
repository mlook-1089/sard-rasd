import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { committees } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clampInt(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  const patch: any = {};
  if ('name' in b) {
    const name = String(b.name || '').trim();
    if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    patch.name = name;
  }
  // Optional capacity constraints for auto-assign
  if ('maxStudents' in b) patch.maxStudents = clampInt(b.maxStudents);
  if ('minStudents' in b) patch.minStudents = clampInt(b.minStudents);
  if ('maxHizbs' in b) patch.maxHizbs = clampInt(b.maxHizbs);
  if ('minHizbs' in b) patch.minHizbs = clampInt(b.minHizbs);
  if ('maxPerCircle' in b) patch.maxPerCircle = clampInt(b.maxPerCircle);
  // Sanity: min cannot exceed max
  if (patch.maxStudents != null && patch.minStudents != null && patch.minStudents > patch.maxStudents) {
    patch.minStudents = patch.maxStudents;
  }
  if (patch.maxHizbs != null && patch.minHizbs != null && patch.minHizbs > patch.maxHizbs) {
    patch.minHizbs = patch.maxHizbs;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, noop: true });
  await db.update(committees).set(patch).where(eq(committees.id, Number(params.id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  await db.delete(committees).where(eq(committees.id, Number(params.id)));
  return NextResponse.json({ ok: true });
}
