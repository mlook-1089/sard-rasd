import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { hash, randomPassword, randomStrongPassword, passwordCollides } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const { mode, studentIds } = (await req.json()) as { mode?: 'numeric' | 'strong'; studentIds?: number[] };
  const gen = mode === 'strong' ? () => randomStrongPassword(10) : () => randomPassword(6);

  const all = await db.select({ id: students.id, name: students.name }).from(students);
  const target = studentIds && studentIds.length > 0 ? all.filter((s) => studentIds.includes(s.id)) : all;

  const out: Array<{ id: number; name: string; password: string }> = [];
  for (const s of target) {
    let pw = '';
    for (let i = 0; i < 10; i++) {
      pw = gen();
      const collides = await passwordCollides(pw);
      if (!collides) break;
    }
    const h = await hash(pw);
    await db.update(students).set({ passwordHash: h }).where(eq(students.id, s.id));
    out.push({ id: s.id, name: s.name, password: pw });
  }
  return NextResponse.json({ ok: true, updated: out });
}
