import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { committees, supervisors } from '@/lib/schema';
import { eq, notInArray, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { hash, randomStrongPassword, passwordCollides } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  // committees without a supervisor
  const taken = await db.select({ c: supervisors.committeeId }).from(supervisors);
  const takenIds = taken.map((r) => r.c).filter((x): x is number => x !== null);
  const rows = takenIds.length > 0
    ? await db.select().from(committees).where(notInArray(committees.id, takenIds))
    : await db.select().from(committees);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const { entries } = (await req.json()) as { entries: Array<{ committeeId: number; username: string; password?: string }> };
  const out: Array<{ committeeId: number; username: string; password: string }> = [];
  for (const e of entries) {
    let pw = e.password || '';
    if (!pw) {
      for (let i = 0; i < 10; i++) {
        pw = randomStrongPassword(10);
        const collides = await passwordCollides(pw);
        if (!collides) break;
      }
    } else {
      const col = await passwordCollides(pw);
      if (col) continue; // skip collisions, caller can retry
    }
    await db.insert(supervisors).values({
      username: e.username,
      passwordHash: await hash(pw),
      committeeId: e.committeeId
    });
    out.push({ committeeId: e.committeeId, username: e.username, password: pw });
  }
  return NextResponse.json({ ok: true, created: out });
}
