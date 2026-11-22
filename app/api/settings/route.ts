import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { hash, passwordCollides } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (!row) return NextResponse.json({ error: 'missing settings' }, { status: 500 });
  const { adminPasswordHash, reciterPasswordHash, ...pub } = row;
  return NextResponse.json({ settings: pub });
}

export async function PATCH(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  const patch: any = {};
  for (const f of [
    'institutionName', 'logoUrl', 'subLogoUrl', 'loginImageUrl', 'certificateBgUrl',
    'honorLabels', 'whatsappTemplate'
  ] as const) {
    if (f in b) patch[f] = b[f];
  }
  // Numeric fields: clamp to non-negative integers via Math.max(0, Math.floor(Number(val) || 0)).
  for (const f of [
    'totalScore', 'passThreshold', 'errorDeduction', 'alertDeduction',
    'slowSessionMinutes', 'stuckSessionMinutes'
  ] as const) {
    if (f in b) {
      const val = b[f];
      const n = Math.max(0, Math.floor(Number(val) || 0));
      patch[f] = n;
    }
  }
  // Sanity: pass threshold cannot exceed totalScore
  if ('totalScore' in patch || 'passThreshold' in patch) {
    const [cur] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    const effectiveTotal = 'totalScore' in patch ? patch.totalScore : (cur?.totalScore ?? 100);
    const effectivePass = 'passThreshold' in patch ? patch.passThreshold : (cur?.passThreshold ?? 0);
    if (effectivePass > effectiveTotal) {
      patch.passThreshold = effectiveTotal;
    }
  }
  if (b.adminPassword) {
    const col = await passwordCollides(b.adminPassword, { kind: 'admin' });
    if (col) return NextResponse.json({ error: 'كلمة مرور المدير مستخدمة بالفعل' }, { status: 409 });
    patch.adminPasswordHash = await hash(b.adminPassword);
  }
  if (b.reciterPassword) {
    const col = await passwordCollides(b.reciterPassword, { kind: 'reciter' });
    if (col) return NextResponse.json({ error: 'كلمة مرور المسمع مستخدمة بالفعل' }, { status: 409 });
    patch.reciterPasswordHash = await hash(b.reciterPassword);
  }
  patch.updatedAt = new Date();
  await db.update(settings).set(patch).where(eq(settings.id, 1));
  return NextResponse.json({ ok: true });
}
