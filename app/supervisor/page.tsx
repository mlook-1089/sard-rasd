import { db } from '@/lib/db';
import { students, sessions, studentHizbs } from '@/lib/schema';
import { and, count, eq, isNotNull, isNull, gte, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import LiveSessionsPanel from '@/components/LiveSessionsPanel';

export const dynamic = 'force-dynamic';

export default async function SupervisorHome() {
  const s = await getSession();
  if (!s || s.role !== 'supervisor') return null;
  if (!s.committeeId) {
    return (
      <div className="u-page">
        <div className="u-top">
          <div><h1>لوحة مشرف اللجنة</h1></div>
        </div>
        <div className="u-note warn">لم يتم تعيين لجنة لحسابك بعد. يرجى التواصل مع الإدارة.</div>
      </div>
    );
  }
  const cid = s.committeeId;

  const [stCount] = await db.select({ c: count() }).from(students).where(eq(students.committeeId, cid));
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [todaySess] = await db.select({ c: count() }).from(sessions)
    .where(and(eq(sessions.committeeId, cid), isNotNull(sessions.endedAt), gte(sessions.startedAt, todayStart), eq(sessions.cancelled, false)));

  const [openSess] = await db.select({ c: count() }).from(sessions)
    .where(and(eq(sessions.committeeId, cid), isNull(sessions.endedAt), eq(sessions.cancelled, false)));

  const sts = await db.select({ id: students.id }).from(students).where(eq(students.committeeId, cid));
  const ids = sts.map((x) => x.id);
  let avgCompletion = 0;
  if (ids.length > 0) {
    const [tgt] = await db.select({ c: count() }).from(studentHizbs).where(inArray(studentHizbs.studentId, ids));
    const [done] = await db.select({ c: count() }).from(sessions)
      .where(and(inArray(sessions.studentId, ids), eq(sessions.passed, true), eq(sessions.cancelled, false)));
    const t = Number(tgt?.c ?? 0), d = Number(done?.c ?? 0);
    avgCompletion = t > 0 ? Math.round((d / t) * 100) : 0;
  }

  return (
    <div className="u-page">
      <div className="u-top">
        <div><h1>لوحة مشرف اللجنة</h1></div>
      </div>

      <LiveSessionsPanel scope="mine" />

      <div className="u-grid2 md4">
        <div className="u-stat">
          <div className="l">عدد الطلاب</div>
          <div className="v" style={{ color: 'var(--brand-ink)' }}>{stCount?.c ?? 0}</div>
        </div>
        <div className="u-stat">
          <div className="l">متوسط الإنجاز</div>
          <div className="v" style={{ color: 'var(--ok)' }}>{avgCompletion}%</div>
        </div>
        <div className="u-stat">
          <div className="l">جلسات اليوم (المنتهية)</div>
          <div className="v" style={{ color: 'var(--gold)' }}>{Number(todaySess?.c ?? 0)}</div>
        </div>
        <div className="u-stat">
          <div className="l">جلسات مفتوحة الآن</div>
          <div className="v" style={{ color: 'var(--bad)' }}>{Number(openSess?.c ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}
