import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { committees } from '@/lib/schema';
import { requireRole } from '@/lib/require';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clampInt(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

/**
 * POST /api/committees/bulk-limits
 * Body: { maxStudents, minStudents, maxHizbs, minHizbs, maxPerCircle }
 * Applies the same limits to ALL committees. Missing fields are ignored (not cleared).
 */
export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;

  const b = await req.json().catch(() => ({})) as Record<string, any>;
  const patch: any = {};
  for (const f of ['maxStudents', 'minStudents', 'maxHizbs', 'minHizbs', 'maxPerCircle'] as const) {
    if (f in b) patch[f] = clampInt(b[f]);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'لا توجد إعدادات للتطبيق' }, { status: 400 });
  }

  // Sanity: min cannot exceed max
  if (patch.maxStudents != null && patch.minStudents != null && patch.minStudents > patch.maxStudents) {
    patch.minStudents = patch.maxStudents;
  }
  if (patch.maxHizbs != null && patch.minHizbs != null && patch.minHizbs > patch.maxHizbs) {
    patch.minHizbs = patch.maxHizbs;
  }

  const result = await db.update(committees).set(patch).returning({ id: committees.id });
  return NextResponse.json({ ok: true, updated: result.length, applied: patch });
}
