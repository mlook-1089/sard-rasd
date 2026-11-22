import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, students, committees } from '@/lib/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') || 'all';

  // Ignore cancelled sessions and stale orphan sessions older than 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const where = [
    isNull(sessions.endedAt),
    eq(sessions.cancelled, false),
    gt(sessions.startedAt, twoHoursAgo)
  ];
  if (scope === 'mine' && session.role === 'supervisor' && session.committeeId) {
    where.push(eq(sessions.committeeId, session.committeeId));
  }

  const rows = await db
    .select({
      id: sessions.id,
      hizbNumber: sessions.hizbNumber,
      reciterName: sessions.reciterName,
      deviceTag: sessions.deviceTag,
      startedAt: sessions.startedAt,
      studentName: students.name,
      committeeName: committees.name
    })
    .from(sessions)
    .leftJoin(students, eq(sessions.studentId, students.id))
    .leftJoin(committees, eq(sessions.committeeId, committees.id))
    .where(and(...where));

  return NextResponse.json({ rows });
}
