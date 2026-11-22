import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { circles, students, sessions, studentHizbs } from '@/lib/schema';
import { eq, sql, count } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { xlsxResponse } from '@/lib/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const g = await requireRole(['admin', 'supervisor']);
  if (!g.ok) return g.res;

  const [circleRows, studRows, tgtRows, sessRows] = await Promise.all([
    db.select().from(circles).orderBy(circles.name),
    db.select({ id: students.id, circleId: students.circleId }).from(students),
    db.select({ studentId: studentHizbs.studentId, c: count() })
      .from(studentHizbs)
      .groupBy(studentHizbs.studentId),
    db.select({
      studentId: sessions.studentId,
      passedCount: sql<number>`COALESCE(SUM(CASE WHEN ${sessions.passed} = TRUE THEN 1 ELSE 0 END), 0)`,
      failedCount: sql<number>`COALESCE(SUM(CASE WHEN ${sessions.passed} = FALSE THEN 1 ELSE 0 END), 0)`,
      sumScore: sql<number>`COALESCE(SUM(${sessions.score}), 0)`
    })
      .from(sessions)
      .where(eq(sessions.cancelled, false))
      .groupBy(sessions.studentId)
  ]);

  const tgtMap = new Map<number, number>();
  for (const t of tgtRows) tgtMap.set(t.studentId, Number(t.c ?? 0));

  const sessMap = new Map<number, { passed: number; failed: number; score: number }>();
  for (const s of sessRows) {
    sessMap.set(s.studentId, {
      passed: Number(s.passedCount ?? 0),
      failed: Number(s.failedCount ?? 0),
      score: Number(s.sumScore ?? 0)
    });
  }

  const out = circleRows.map((c) => {
    const cStuds = studRows.filter((s) => s.circleId === c.id);
    let target = 0;
    let passed = 0;
    let failed = 0;
    let totalScore = 0;
    for (const st of cStuds) {
      target += tgtMap.get(st.id) ?? 0;
      const ss = sessMap.get(st.id);
      if (ss) {
        passed += ss.passed;
        failed += ss.failed;
        totalScore += ss.score;
      }
    }
    const pending = Math.max(0, target - passed);
    const completionNum = target > 0 ? Math.round((passed / target) * 100) : 0;
    return {
      id: c.id,
      name: c.name,
      teacherName: c.teacherName || '',
      teacherPhone: c.teacherPhone || '',
      studentsCount: cStuds.length,
      target,
      passed,
      failed,
      pending,
      totalScore,
      completionNum,
      completion: `${completionNum}%`
    };
  });

  if (req.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json({ rows: out });
  }

  return xlsxResponse('تقرير-الحلقات.xlsx', [{
    name: 'الحلقات',
    headers: ['الحلقة', 'المعلم', 'جوال المعلم', 'الطلاب', 'إجمالي الهدف', 'مجتازة', 'راسبة', 'غير مقروءة', 'مجموع الدرجات', 'النسبة'],
    keys: ['name', 'teacherName', 'teacherPhone', 'studentsCount', 'target', 'passed', 'failed', 'pending', 'totalScore', 'completion'],
    rows: out
  }]);
}
