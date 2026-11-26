import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { students, studentHizbs, sessionMarks, sessions, committees } from '@/lib/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import StudentActions from './StudentActions';
import { surahName } from '@/lib/quranSurahs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmtDuration(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}د ${r}ث`;
}
function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function StudentPage() {
  const session = await getSession();
  if (!session || session.role !== 'student' || !session.id) redirect('/');

  const studentId = session.id!;
  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student) redirect('/');

  const committee = student.committeeId
    ? (await db.select().from(committees).where(eq(committees.id, student.committeeId)).limit(1))[0]
    : null;

  const hs = await db.select().from(studentHizbs).where(eq(studentHizbs.studentId, studentId));
  const target = hs.length;

  const rawSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.studentId, studentId), eq(sessions.cancelled, false)))
    .orderBy(desc(sessions.startedAt));

  const markRows = rawSessions.length > 0
    ? await db
      .select({
        sessionId: sessionMarks.sessionId,
        surah: sessionMarks.surah,
        ayah: sessionMarks.ayah,
        type: sessionMarks.type
      })
      .from(sessionMarks)
      .where(inArray(sessionMarks.sessionId, rawSessions.map((row) => row.id)))
      .orderBy(asc(sessionMarks.id))
    : [];
  const marksBySession = new Map<number, typeof markRows>();
  for (const mark of markRows) {
    const current = marksBySession.get(mark.sessionId) || [];
    current.push(mark);
    marksBySession.set(mark.sessionId, current);
  }

  const passedHizbs = new Set(rawSessions.filter((s) => s.passed && s.endedAt).map((s) => s.hizbNumber));
  const memorized = passedHizbs.size;
  const completion = target > 0 ? Math.round((memorized / target) * 100) : 0;

  const allStudents = await db.select({ id: students.id, level: students.level }).from(students);
  const perStudent = await db
    .select({ id: sessions.studentId, c: sql<number>`count(DISTINCT ${sessions.hizbNumber})` })
    .from(sessions)
    .where(and(eq(sessions.cancelled, false), eq(sessions.passed, true)))
    .groupBy(sessions.studentId);
  const byId = new Map<number, number>();
  for (const r of perStudent) byId.set(r.id, Number(r.c));

  const ranked = allStudents
    .map((s) => ({ id: s.id, level: s.level, m: byId.get(s.id) ?? 0 }))
    .sort((a, b) => b.m - a.m);
  const rankOverall = ranked.findIndex((r) => r.id === studentId) + 1;
  const inLevel = ranked.filter((r) => (r.level ?? null) === (student.level ?? null));
  const rankInLevel = inLevel.findIndex((r) => r.id === studentId) + 1;

  return (
    <main className="min-h-screen bg-gray-50">
      <header
        className="student-portal-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--card)',
          borderBottom: '1px solid var(--line)',
          padding: 'calc(8px + env(safe-area-inset-top)) 12px 8px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          boxShadow: 'var(--shadow)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
            maxWidth: 1024,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: 'var(--brand)', color: 'var(--gold-bright)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>بوابة الطالب</div>
              <div className="truncate" style={{ fontSize: 11, color: 'var(--ink3)' }}>تقريرك المباشر</div>
            </div>
          </div>
          <StudentActions />
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <section className="u-hero">
          <div className="l">تقرير الطالب</div>
          <div className="big">{student.name}</div>
          <div className="meta" style={{ margin: '8px 0' }}>
            {student.level && <span>المستوى: <b>{student.level}</b></span>}
            {committee && <span>اللجنة: <b>{committee.name}</b></span>}
            {student.nationalId && <span>الرقم: <b dir="ltr">{student.nationalId}</b></span>}
          </div>
          <div className="u-bar"><i style={{ width: `${completion}%` }} /></div>
          <div className="meta">
            <span>الإنجاز العام</span>
            <span className="u-num">
              <span dir="ltr" style={{ display: 'inline-block', unicodeBidi: 'isolate' }}>{memorized} / {target}</span>
              {' · '}
              <span dir="ltr" style={{ display: 'inline-block', unicodeBidi: 'isolate' }}>{completion}%</span>
            </span>
          </div>
        </section>

        <section className="u-grid2 md4">
          <div className="u-stat"><div className="l">الهدف</div><div className="v">{target}</div></div>
          <div className="u-stat"><div className="l">المنجز</div><div className="v" style={{ color: 'var(--ok)' }}>{memorized}</div></div>
          <div className="u-stat"><div className="l">الترتيب العام</div><div className="v" style={{ color: 'var(--gold)' }}>{rankOverall > 0 ? <span dir="ltr" style={{ display: 'inline-block', unicodeBidi: 'isolate' }}>{rankOverall} / {ranked.length}</span> : '—'}</div></div>
          <div className="u-stat"><div className="l">ترتيبك في مستواك</div><div className="v" style={{ color: 'var(--info)' }}>{rankInLevel > 0 ? <span dir="ltr" style={{ display: 'inline-block', unicodeBidi: 'isolate' }}>{rankInLevel} / {inLevel.length}</span> : '—'}</div></div>
        </section>

        <section className="u-card">
          <div className="u-card-h">
            <h3>جلسات التسميع</h3>
          </div>
          {rawSessions.length === 0 ? (
            <div className="u-empty">لا توجد جلسات بعد.</div>
          ) : (
            <div className="th-rpt-table-wrap mobile-card-table">
              <table className="th-rpt-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الحزب</th>
                    <th>الأخطاء</th>
                    <th>التنبيهات</th>
                    <th>الدرجة</th>
                    <th>المسمع</th>
                    <th>المدة</th>
                    <th>تفاصيل الرصد</th>
                  </tr>
                </thead>
                <tbody>
                  {rawSessions.map((s) => (
                    <tr key={s.id}>
                      <td data-label="التاريخ" className="mobile-card-title">{fmtDate(s.startedAt)}</td>
                      <td data-label="الحزب" style={{ fontWeight: 700 }}>{s.hizbNumber}</td>
                      <td data-label="الأخطاء">{s.errors}</td>
                      <td data-label="التنبيهات">{s.alerts}</td>
                      <td data-label="الدرجة">
                        {s.score != null ? (
                          <span className={`u-pill ${s.passed ? 'ok' : 'bad'}`}>
                            <span className="u-num">{s.score}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td data-label="المسمع">{s.reciterName}</td>
                      <td data-label="المدة">{fmtDuration(s.durationSeconds)}</td>
                      <td data-label="تفاصيل الرصد">
                        {(marksBySession.get(s.id) || []).length > 0 ? (
                          <details style={{ textAlign: 'start', minWidth: 190 }}>
                            <summary style={{ cursor: 'pointer', color: 'var(--brand-ink)', fontWeight: 700 }}>
                              {s.recordingMode === 'mushaf' ? 'رصد بالمصحف' : 'عرض المواضع'} ({(marksBySession.get(s.id) || []).length})
                            </summary>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 7 }}>
                              {(marksBySession.get(s.id) || []).map((mark, index) => (
                                <span
                                  key={`${s.id}-${mark.surah}-${mark.ayah}-${mark.type}-${index}`}
                                  style={{
                                    display: 'block',
                                    borderRadius: 9,
                                    padding: '6px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: mark.type === 'error' ? 'var(--bad)' : 'var(--warn)',
                                    background: mark.type === 'error' ? 'var(--bad-soft)' : 'var(--warn-soft)'
                                  }}
                                >
                                  {mark.type === 'error' ? 'خطأ' : 'تنبيه'} · سورة {surahName(mark.surah)} · الآية {mark.ayah}
                                </span>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <span className="u-muted">لا توجد مواضع مفصلة</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
