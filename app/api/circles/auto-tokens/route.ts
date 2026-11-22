import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { circles } from '@/lib/schema';
import { eq, isNull } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { randomToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const rows = await db.select().from(circles).where(isNull(circles.linkToken));
  for (const c of rows) {
    await db.update(circles).set({ linkToken: randomToken(28) }).where(eq(circles.id, c.id));
  }
  return NextResponse.json({ ok: true, generated: rows.length });
}
