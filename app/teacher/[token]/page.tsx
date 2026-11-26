import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';
import { circles, students, studentHizbs, sessions, settings } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { TeacherPortalClient, type TeacherStudentRow } from './HizbsEditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PageProps = { params: { token: string } };

function parseRevoked(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

export default async function TeacherPortal({ params }: PageProps) {
  noStore();
  const token = (params.token || '').trim();
  const [circle] = token
    ? await db.select().from(circles).where(eq(circles.linkToken, token)).limit(1)
    : [];
  const revoked = circle ? parseRevoked(circle.revokedTokens) : [];

  if (!token || !circle || circle.linkToken !== token || revoked.includes(token)) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
        <div className="u-card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--bad)', marginBottom: 8 }}>رابط غير صالح أو منتهي</h1>
          <p className="u-muted" style={{ marginBottom: 16 }}>يرجى التواصل مع إدارة المجمع للحصول على رابط جديد.</p>
          <a href="/" className="u-btn u-btn-p" style={{ textDecoration: 'none', minHeight: 44 }}>العودة لتسجيل الدخول</a>
        </div>
      </main>
    );
  }

  const [set] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const waTemplate = set?.whatsappTemplate ??
    'السلام عليكم\nتقرير الطالب {name}\nالمنجز: {memorized} / {hizbs}\nالأخطاء: {errors} | التنبيهات: {alerts}\nنسبة الإنجاز: {completion}%';

  const studs = await db.select().from(students).where(eq(students.circleId, circle.id)).orderBy(students.id);

  const rows: TeacherStudentRow[] = [];

  for (const s of studs) {
    const hs = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, s.id));
    const hizbsSet = hs.map((r) => r.hizbNumber).sort((a, b) => a - b);
    const mandatoryHizbs = hs.filter((r) => r.isMandatory).map((r) => r.hizbNumber).sort((a, b) => a - b);
    const [agg] = await db
      .select({
        memorized: sql<number>`COUNT(DISTINCT CASE WHEN ${sessions.passed} = TRUE THEN ${sessions.hizbNumber} END)`,
        errors: sql<number>`COALESCE(SUM(${sessions.errors}), 0)`,
        alerts: sql<number>`COALESCE(SUM(${sessions.alerts}), 0)`,
        avgScore: sql<number>`COALESCE(AVG(${sessions.score}), 0)`,
        scoredCount: sql<number>`COALESCE(SUM(CASE WHEN ${sessions.score} IS NOT NULL THEN 1 ELSE 0 END), 0)`
      })
      .from(sessions)
      .where(and(
        eq(sessions.studentId, s.id),
        eq(sessions.cancelled, false)
      ));
    const target = hizbsSet.length;
    const memorized = Number(agg?.memorized ?? 0);
    const errors = Number(agg?.errors ?? 0);
    const alerts = Number(agg?.alerts ?? 0);
    const scoredCount = Number(agg?.scoredCount ?? 0);
    const avgScore = scoredCount > 0 ? Math.round(Number(agg?.avgScore ?? 0) * 10) / 10 : 0;
    const completion = target > 0 ? Math.round((memorized / target) * 100) : 0;
    const effectiveStatus =
      target === 0
        ? 'waiting_hizbs'
        : s.committeeId
          ? 'active'
          : s.status === 'active'
            ? 'active'
            : 'waiting_committee';

    rows.push({
      id: s.id,
      name: s.name,
      nationalId: s.nationalId,
      parentPhone: s.parentPhone,
      committeeId: s.committeeId,
      status: effectiveStatus,
      hizbsSet,
      mandatoryHizbs,
      hizbsLocked: s.hizbsLocked,
      target,
      memorized,
      errors,
      alerts,
      completion,
      avgScore,
      scoredCount
    });
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="u-avatar teacher-portal-brand" style={{ background: 'var(--brand)', color: 'var(--gold-bright)', width: 42, height: 42, borderRadius: 12, fontSize: 18 }}>۞</div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>بوابة معلم الحلقة</h1>
            <p className="u-muted" style={{ margin: 0, fontSize: 12 }}>منصة رصد — برنامج السرد</p>
          </div>
        </div>
      </header>

      <TeacherPortalClient
        token={token}
        circleName={circle.name}
        teacherName={circle.teacherName}
        waTemplate={waTemplate}
        initialRows={rows}
      />
    </main>
  );
}
