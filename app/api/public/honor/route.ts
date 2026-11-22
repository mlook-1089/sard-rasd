import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentHizbs, sessions, circles, committees, settings } from '@/lib/schema';
import { and, count, eq, isNull, or, sql } from 'drizzle-orm';
import { getActiveProgram } from '@/lib/activeProgram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function noStore(json: any) {
  return new NextResponse(JSON.stringify(json), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      pragma: 'no-cache',
      expires: '0'
    }
  });
}

export async function GET() {
  const [set] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const defaultLabels: Record<string, string> = {
    hizbs: 'الأحزاب المنجزة',
    pages: 'الأوجه المقروءة',
    circles: 'عدد الحلقات',
    students: 'عدد الطلاب',
    completion: 'نسبة الإنجاز',
    sessions: 'جلسات التسميع'
  };
  const customLabels = (set?.honorLabels as Record<string, string> | null) ?? {};
  const labels = {
    hizbs: customLabels.hizbs || defaultLabels.hizbs,
    pages: customLabels.pages || defaultLabels.pages,
    circles: customLabels.circles || defaultLabels.circles,
    students: customLabels.students || defaultLabels.students,
    completion: customLabels.completion || defaultLabels.completion,
    sessions: customLabels.sessions || defaultLabels.sessions
  };

  const activeProg = await getActiveProgram();
  const progFilter = activeProg
    ? or(eq(sessions.programId, activeProg.id), isNull(sessions.programId))
    : undefined;

  const [stCount] = await db.select({ c: count() }).from(students);
  const [crCount] = await db.select({ c: count() }).from(circles);
  const [coCount] = await db.select({ c: count() }).from(committees);
  void coCount;

  const completedBase = sql`(${sessions.endedAt} IS NOT NULL OR ${sessions.passed} IS NOT NULL) AND ${sessions.cancelled} = FALSE`;

  let [sessDone] = await db
    .select({ c: count() })
    .from(sessions)
    .where(progFilter ? and(progFilter, completedBase) : completedBase);

  let useProgFilter = Boolean(progFilter);
  if (useProgFilter && Number(sessDone?.c ?? 0) === 0) {
    const [allSessDone] = await db.select({ c: count() }).from(sessions).where(completedBase);
    if (Number(allSessDone?.c ?? 0) > 0) {
      sessDone = allSessDone;
      useProgFilter = false;
    }
  }

  const passedFilter = useProgFilter && progFilter
    ? and(progFilter, eq(sessions.cancelled, false), eq(sessions.passed, true))
    : and(eq(sessions.cancelled, false), eq(sessions.passed, true));

  const [uniqPassed] = await db
    .select({
      c: sql<number>`count(DISTINCT (${sessions.studentId}::text || '-' || ${sessions.hizbNumber}::text))`
    })
    .from(sessions)
    .where(passedFilter);

  const [targetSum] = await db.select({ c: count() }).from(studentHizbs);

  const perStudent = await db
    .select({
      studentId: sessions.studentId,
      c: sql<number>`count(DISTINCT ${sessions.hizbNumber})`
    })
    .from(sessions)
    .where(passedFilter)
    .groupBy(sessions.studentId);
  const byId = new Map<number, number>();
  for (const r of perStudent) byId.set(r.studentId, Number(r.c));

  const studs = await db.select().from(students);
  const allCircles = await db.select().from(circles);
  const targetsPerStudent = await db
    .select({ id: studentHizbs.studentId, c: count() })
    .from(studentHizbs)
    .groupBy(studentHizbs.studentId);
  const targetById = new Map<number, number>();
  for (const r of targetsPerStudent) targetById.set(r.id, Number(r.c));

  let computedTargetsSum = 0;
  for (const s of studs) {
    const mem = byId.get(s.id) ?? 0;
    const rawTgt = targetById.get(s.id) ?? 0;
    computedTargetsSum += rawTgt > 0 ? rawTgt : mem;
  }

  const hizbsDone = Number(uniqPassed?.c ?? 0);
  const rawTarget = Number(targetSum?.c ?? 0);
  const effectiveTarget = rawTarget > 0 ? rawTarget : computedTargetsSum;
  const completion = effectiveTarget > 0
    ? Math.min(100, Math.round((hizbsDone / effectiveTarget) * 100))
    : (hizbsDone > 0 ? 100 : 0);

  const stats = {
    hizbs: { label: labels.hizbs, value: hizbsDone },
    pages: { label: labels.pages, value: hizbsDone * 20 },
    sessions: { label: labels.sessions, value: Number(sessDone?.c ?? 0) },
    students: { label: labels.students, value: Math.max(Number(stCount?.c ?? 0), studs.length) },
    circles: { label: labels.circles, value: Math.max(Number(crCount?.c ?? 0), allCircles.length) },
    completion: { label: labels.completion, value: completion }
  };

  const hasDistinctLevels = studs.some((s) => Boolean(s.level && s.level.trim()));
  const byLevel = new Map<string, { id: number; name: string; memorized: number; target: number }[]>();
  for (const s of studs) {
    const key = hasDistinctLevels ? (s.level?.trim() || 'طلاب البرنامج') : 'أوائل الطلاب';
    const bucket = byLevel.get(key) ?? [];
    const mem = byId.get(s.id) ?? 0;
    const rawTgt = targetById.get(s.id) ?? 0;
    bucket.push({
      id: s.id,
      name: s.name,
      memorized: mem,
      target: rawTgt > 0 ? rawTgt : mem
    });
    byLevel.set(key, bucket);
  }

  const columns = Array.from(byLevel.entries())
    .map(([level, rows]) => ({
      level,
      rows: rows.sort((a, b) => (b.memorized - a.memorized) || a.name.localeCompare(b.name, 'ar'))
    }))
    .sort((a, b) => a.level.localeCompare(b.level, 'ar'));

  if (allCircles.length > 0) {
    const circleRows = allCircles.map((c) => {
      const cStuds = studs.filter((s) => s.circleId === c.id);
      let memSum = 0;
      let tgtSum = 0;
      for (const s of cStuds) {
        const m = byId.get(s.id) ?? 0;
        const t = targetById.get(s.id) ?? 0;
        memSum += m;
        tgtSum += t > 0 ? t : m;
      }
      return {
        id: c.id,
        name: c.name,
        memorized: memSum,
        target: tgtSum
      };
    }).sort((a, b) => (b.memorized - a.memorized) || a.name.localeCompare(b.name, 'ar'));

    columns.push({
      level: 'ترتيب الحلقات',
      rows: circleRows
    });
  }

  return noStore({ stats, columns });
}
