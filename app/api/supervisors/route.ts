import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supervisors, committees } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { hash, passwordCollides } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const rows = await db.select({
    id: supervisors.id, username: supervisors.username, displayName: supervisors.displayName,
    committeeId: supervisors.committeeId, canEditRecords: supervisors.canEditRecords,
    canDeleteRecords: supervisors.canDeleteRecords,
    committeeName: committees.name
  })
    .from(supervisors)
    .leftJoin(committees, eq(supervisors.committeeId, committees.id))
    .orderBy(supervisors.id);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;
  const b = await req.json();
  if (!b.username?.trim() || !b.password) {
    return NextResponse.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' }, { status: 400 });
  }
  const collision = await passwordCollides(b.password);
  if (collision) return NextResponse.json({ error: 'كلمة المرور مستخدمة بالفعل' }, { status: 409 });

  const [row] = await db.insert(supervisors).values({
    username: b.username.trim(),
    displayName: b.displayName || null,
    passwordHash: await hash(b.password),
    committeeId: b.committeeId || null,
    canEditRecords: b.canEditRecords ?? true,
    canDeleteRecords: b.canDeleteRecords ?? true
  }).returning();
  return NextResponse.json({ ok: true, row });
}
