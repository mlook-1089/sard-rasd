import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, circles, committees, sessions, studentHizbs, settings } from '@/lib/schema';
import { eq, sql, count } from 'drizzle-orm';
import { requireRole } from '@/lib/require';
import { xlsxResponse } from '@/lib/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_WA_TEMPLATE =
  'السلام عليكم ورحمة الله\nتقرير الطالب {name}\nالمحفوظ: {memorized} / {hizbs}\nالأخطاء: {errors} | التنبيهات: {alerts}\nنسبة الإنجاز: {completion}%';

export async function GET(req: NextRequest) {
  const g = await requireRole(['admin', 'supervisor']);
  if (!g.ok) return g.res;

  const [rows, tgtRows, sessRows, setRows] = await Promise.all([
    db.select({
      id: students.id,
      name: students.name,
      nationalId: students.nationalId,
      level: students.level,
      parentPhone: students.parentPhone,
      circleName: circles.name,
      committeeName: committees.name
    })
      .from(students)
      .leftJoin(circles, eq(students.circleId, circles.id))
      .leftJoin(committees, eq(students.committeeId, committees.id))
      .orderBy(students.name),
    db.select({
      studentId: studentHizbs.studentId,
      c: count()
    })
      .from(studentHizbs)
      .groupBy(studentHizbs.studentId),
    db.select({
      studentId: sessions.studentId,
      passedCount: sql<number>`COALESCE(SUM(CASE WHEN ${sessions.passed} = TRUE THEN 1 ELSE 0 END), 0)`,
      sumErr: sql<number>`COALESCE(SUM(${sessions.errors}), 0)`,
      sumAlt: sql<number>`COALESCE(SUM(${sessions.alerts}), 0)`
    })
      .from(sessions)
      .where(eq(sessions.cancelled, false))
      .groupBy(sessions.studentId),
    db.select({ whatsappTemplate: settings.whatsappTemplate })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1)
  ]);

  const tgtMap = new Map<number, number>();
  for (const t of tgtRows) tgtMap.set(t.studentId, Number(t.c ?? 0));

  const sessMap = new Map<number, { passedCount: number; sumErr: number; sumAlt: number }>();
  for (const s of sessRows) {
    sessMap.set(s.studentId, {
      passedCount: Number(s.passedCount ?? 0),
      sumErr: Number(s.sumErr ?? 0),
      sumAlt: Number(s.sumAlt ?? 0)
    });
  }

  const out = rows.map((r) => {
    const target = tgtMap.get(r.id) ?? 0;
    const st = sessMap.get(r.id) ?? { passedCount: 0, sumErr: 0, sumAlt: 0 };
    const memorized = st.passedCount;
    const completionNum = target > 0 ? Math.round((memorized / target) * 100) : 0;
    return {
      id: r.id,
      name: r.name,
      nationalId: r.nationalId || '',
      parentPhone: r.parentPhone || '',
      level: r.level || '',
      circleName: r.circleName || '',
      committeeName: r.committeeName || '',
      target,
      memorized,
      errors: st.sumErr,
      alerts: st.sumAlt,
      completionNum,
      completion: `${completionNum}%`
    };
  });

  if (req.nextUrl.searchParams.get('format') === 'json') {
    const whatsappTemplate = setRows[0]?.whatsappTemplate || DEFAULT_WA_TEMPLATE;
    return NextResponse.json({ rows: out, whatsappTemplate });
  }

  return xlsxResponse('تقرير-الطلاب.xlsx', [{
    name: 'الطلاب',
    headers: ['الاسم', 'الهوية', 'ولي الأمر', 'المستوى', 'الحلقة', 'اللجنة', 'الهدف', 'أنجز', 'الأخطاء', 'التنبيهات', 'النسبة'],
    keys: ['name', 'nationalId', 'parentPhone', 'level', 'circleName', 'committeeName', 'target', 'memorized', 'errors', 'alerts', 'completion'],
    rows: out
  }]);
}
