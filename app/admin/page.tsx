import { db } from '@/lib/db';
import { students, circles, committees, sessions, studentHizbs } from '@/lib/schema';
import { count, sql } from 'drizzle-orm';
import LiveSessionsPanel from '@/components/LiveSessionsPanel';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function kpis() {
  const [stCount] = await db.select({ c: count() }).from(students);
  const [crCount] = await db.select({ c: count() }).from(circles);
  const [coCount] = await db.select({ c: count() }).from(committees);
  const [sessDone] = await db.select({ c: count() }).from(sessions)
    .where(sql`${sessions.endedAt} IS NOT NULL AND ${sessions.cancelled} = FALSE`);
  const [recitedHizbs] = await db.select({
    c: sql<number>`count(DISTINCT (${sessions.studentId}::text || '-' || ${sessions.hizbNumber}::text))`
  }).from(sessions)
    .where(sql`${sessions.endedAt} IS NOT NULL AND ${sessions.cancelled} = FALSE AND ${sessions.passed} = TRUE`);
  const [targetSum] = await db.select({ c: count() }).from(studentHizbs);
  const target = targetSum?.c ?? 0;
  const done = recitedHizbs?.c ?? 0;
  const completion = target > 0 ? Math.round((Number(done) / Number(target)) * 100) : 0;
  return {
    students: stCount?.c ?? 0, circles: crCount?.c ?? 0, committees: coCount?.c ?? 0,
    sessions: sessDone?.c ?? 0, done, target, completion
  };
}

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 17) return 'ظهر مبارك';
  if (h >= 17 && h < 20) return 'مساء الخير';
  return 'ليلة طيبة';
}

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default async function AdminHome() {
  const k = await kpis();
  const today = new Date();
  const dateStr = `${AR_DAYS[today.getDay()]}، ${today.getDate()} ${AR_MONTHS[today.getMonth()]} ${today.getFullYear()}`;

  return (
    <div className="u-page">
      {/* Hero */}
      <div className="u-hero">
        <div className="l">{dateStr}</div>
        <div className="big">{greeting()} يا مدير المنصة 🌿</div>
        <div className="u-bar"><i style={{ width: `${k.completion}%` }} /></div>
        <div className="meta">
          <span>الإنجاز العام</span>
          <span className="u-num">{k.completion}%</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="u-grid2 md4">
        <Link href="/admin/students/new" className="u-stat text-center" style={{ textDecoration: 'none' }}>
          <div className="text-2xl mb-1">➕</div>
          <div className="l">إضافة طالب</div>
        </Link>
        <Link href="/admin/waiting-committee" className="u-stat text-center" style={{ textDecoration: 'none' }}>
          <div className="text-2xl mb-1">🧩</div>
          <div className="l">تعيين لجان</div>
        </Link>
        <Link href="/admin/attendance" className="u-stat text-center" style={{ textDecoration: 'none' }}>
          <div className="text-2xl mb-1">📋</div>
          <div className="l">التحضير</div>
        </Link>
        <Link href="/admin/reports/students" className="u-stat text-center" style={{ textDecoration: 'none' }}>
          <div className="text-2xl mb-1">📊</div>
          <div className="l">التقارير</div>
        </Link>
      </div>

      {/* 6 KPI cards */}
      <div className="u-grid2 md4">
        <div className="u-stat"><div className="l">إجمالي الطلاب</div><div className="v">{k.students}</div></div>
        <div className="u-stat"><div className="l">الحلقات</div><div className="v">{k.circles}</div></div>
        <div className="u-stat"><div className="l">اللجان</div><div className="v">{k.committees}</div></div>
        <div className="u-stat"><div className="l">الأحزاب المقروءة</div><div className="v">{Number(k.done)}</div></div>
        <div className="u-stat"><div className="l">الأوجه المقروءة</div><div className="v">{Number(k.done) * 20}</div></div>
        <div className="u-stat"><div className="l">نسبة الإنجاز</div><div className="v" style={{ color: 'var(--ok)' }}>{k.completion}%</div></div>
      </div>

      <LiveSessionsPanel scope="all" />
    </div>
  );
}
