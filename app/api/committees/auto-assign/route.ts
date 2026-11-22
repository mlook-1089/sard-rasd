import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentHizbs, committees, circles } from '@/lib/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { computeAssignments, type StudentInput, type CommitteeInput, type Options } from '@/lib/autoAssign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/committees/auto-assign
 * Body: {
 *   dryRun?: boolean,              // true → return plan without applying
 *   includeActive?: boolean,       // true → re-distribute even students already in a committee
 *   weights?: { diversity?, level?, load?, hizbs?, minFloor? }
 * }
 *
 * Returns the Plan. When dryRun=false and all rows are assignable, applies DB updates.
 */
export async function POST(req: Request) {
  const g = await requireRole(['admin']);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    includeActive?: boolean;
    weights?: Options['weights'];
  };
  const dryRun = body.dryRun !== false;
  const includeActive = body.includeActive === true;

  // Fetch committees
  const comRows = await db.select().from(committees).orderBy(committees.id);
  if (comRows.length === 0) {
    return NextResponse.json({ error: 'لا توجد لجان. أضف لجان أولاً.' }, { status: 400 });
  }

  const committeesInput: CommitteeInput[] = comRows.map((c) => ({
    id: c.id,
    name: c.name,
    maxStudents: c.maxStudents,
    minStudents: c.minStudents,
    maxHizbs: c.maxHizbs,
    minHizbs: c.minHizbs
  }));

  // Fetch candidate students.
  // Baseline: all students that have hizbs assigned (not waiting_hizbs).
  const allStudents = await db
    .select({
      id: students.id,
      name: students.name,
      circleId: students.circleId,
      circleName: circles.name,
      level: students.level,
      status: students.status,
      committeeId: students.committeeId
    })
    .from(students)
    .leftJoin(circles, eq(students.circleId, circles.id))
    .where(sql`${students.status} <> 'waiting_hizbs'`);

  if (allStudents.length === 0) {
    return NextResponse.json({ error: 'لا يوجد طلاب جاهزون للتوزيع (أضف أحزاب لهم أولاً).' }, { status: 400 });
  }

  // Fetch hizb counts per student
  const hizbCounts = await db
    .select({ studentId: studentHizbs.studentId, c: sql<number>`count(*)` })
    .from(studentHizbs)
    .where(inArray(studentHizbs.studentId, allStudents.map((s) => s.id)))
    .groupBy(studentHizbs.studentId);
  const hizbMap = new Map<number, number>();
  for (const h of hizbCounts) hizbMap.set(h.studentId, Number(h.c));

  const studentsInput: StudentInput[] = allStudents.map((s) => ({
    id: s.id,
    name: s.name,
    circleId: s.circleId,
    circleName: s.circleName,
    level: s.level,
    hizbCount: hizbMap.get(s.id) ?? 0,
    currentCommitteeId: s.committeeId
  }));

  const plan = computeAssignments(studentsInput, committeesInput, {
    includeActive,
    weights: body.weights
  });

  if (!dryRun) {
    // Apply: update students.committeeId and status='active' for all assigned rows.
    for (const row of plan.rows) {
      if (row.toCommitteeId == null) continue;
      // Skip no-op (same committee)
      if (row.fromCommitteeId === row.toCommitteeId) continue;
      await db
        .update(students)
        .set({ committeeId: row.toCommitteeId, status: 'active' })
        .where(eq(students.id, row.studentId));
    }
  }

  return NextResponse.json({ ok: true, dryRun, plan });
}
