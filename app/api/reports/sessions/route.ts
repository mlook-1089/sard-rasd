import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, students, committees } from '@/lib/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { xlsxResponse } from '@/lib/xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'supervisor'].includes(session.role)) {
    return new Response('unauthorized', { status: 401 });
  }
  const where: any[] = [];
  if (session.role === 'supervisor' && session.committeeId) {
    where.push(eq(sessions.committeeId, session.committeeId));
  }

  const rows = await db.select({
    id: sessions.id,
    studentId: sessions.studentId,
    date: sessions.startedAt,
    hizb: sessions.hizbNumber,
    errors: sessions.errors,
    alerts: sessions.alerts,
    score: sessions.score,
    passed: sessions.passed,
    cancelled: sessions.cancelled,
    reciter: sessions.reciterName,
    durationSeconds: sessions.durationSeconds,
    studentName: students.name,
    parentPhone: students.parentPhone,
    committeeName: committees.name
  })
    .from(sessions)
    .leftJoin(students, eq(sessions.studentId, students.id))
    .leftJoin(committees, eq(sessions.committeeId, committees.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(sessions.id));

  const out = rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    date: r.date ? new Date(r.date as any).toLocaleDateString('ar') : '',
    startedAt: r.date,
    studentName: r.studentName || '',
    parentPhone: r.parentPhone || '',
    committeeName: r.committeeName || '',
    hizb: r.hizb,
    errors: r.errors,
    alerts: r.alerts,
    score: r.score ?? '',
    passed: r.passed === true ? 'ناجح' : r.passed === false ? 'راسب' : 'جارية',
    reciter: r.reciter,
    duration: r.durationSeconds != null ? `${Math.floor(r.durationSeconds / 60)}:${String(r.durationSeconds % 60).padStart(2, '0')}` : ''
  }));

  if (req.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json({ rows: out });
  }

  return xlsxResponse('سجل-الرصد.xlsx', [{
    name: 'سجل الرصد',
    headers: ['التاريخ', 'الطالب', 'ولي الأمر', 'اللجنة', 'الحزب', 'الأخطاء', 'التنبيهات', 'الدرجة', 'النتيجة', 'المسمع', 'المدة'],
    keys: ['date', 'studentName', 'parentPhone', 'committeeName', 'hizb', 'errors', 'alerts', 'score', 'passed', 'reciter', 'duration'],
    rows: out
  }]);
}
