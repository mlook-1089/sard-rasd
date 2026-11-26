'use client';
import { useEffect, useMemo, useState } from 'react';

type Student = {
  id: number; name: string; level: string | null; status: string;
  circleId: number | null; committeeId: number | null;
  circleName: string | null; committeeName: string | null;
};
type ReportRow = {
  id: number; target: number; memorized: number; completionNum: number;
  avgScore: number; scoredCount: number;
};
type SessRow = {
  id: number; startedAt: string; durationSeconds: number | null;
  hizbNumber: number; errors: number; alerts: number; score: number | null;
  passed: boolean | null; reciterName: string; programId?: number | null;
};

type SortKey = 'name' | 'circleName' | 'target' | 'memorized' | 'avgScore';
type SortDir = 'asc' | 'desc';

type Combined = Student & {
  target: number;
  memorized: number;
  completionNum: number;
  avgScore: number;
  scoredCount: number;
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}

// Color tier based on the AVERAGE SCORE, aligned with the grading thresholds (pass = 60)
function pctColor(p: number): string {
  if (p >= 85) return 'var(--ok)';
  if (p >= 60) return 'var(--warn)';
  if (p > 0) return '#D9551F';
  return 'var(--bad)';
}

export default function SupStudentsReport() {
  const [students, setStudents] = useState<Combined[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Combined | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    setLoading(true);
    // Isolated requests: a failed aggregates endpoint must NOT hide the student list.
    const safeJson = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    Promise.all([
      safeJson('/api/students'),
      safeJson('/api/reports/students?format=json')
    ])
      .then(([stData, repData]) => {
        const activeStudents: Student[] = ((stData?.rows || []) as any[])
          .filter((s) => s.status === 'active');
        const repMap = new Map<number, ReportRow>();
        for (const r of (repData?.rows || [])) {
          repMap.set(r.id, {
            id: r.id,
            target: Number(r.target || 0),
            memorized: Number(r.memorized || 0),
            completionNum: Number(r.completionNum || 0),
            avgScore: Number(r.avgScore || 0),
            scoredCount: Number(r.scoredCount || 0)
          });
        }
        const combined: Combined[] = activeStudents.map((s) => {
          const rep = repMap.get(s.id);
          return {
            ...s,
            target: rep?.target ?? 0,
            memorized: rep?.memorized ?? 0,
            completionNum: rep?.completionNum ?? 0,
            avgScore: rep?.avgScore ?? 0,
            scoredCount: rep?.scoredCount ?? 0
          };
        });
        setStudents(combined);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'circleName' ? 'asc' : 'desc'); }
  }

  function sortGlyph(key: SortKey) {
    if (sortKey !== key) return <span className="st-sort muted">▾</span>;
    return <span className="st-sort on">{sortDir === 'asc' ? '▴' : '▾'}</span>;
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = students.filter((s) => {
      if (!query) return true;
      return (
        (s.name || '').toLowerCase().includes(query) ||
        (s.level || '').toLowerCase().includes(query) ||
        (s.circleName || '').toLowerCase().includes(query)
      );
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name' || sortKey === 'circleName') {
        cmp = ((a[sortKey] || '') as string).localeCompare((b[sortKey] || '') as string, 'ar');
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [students, q, sortKey, sortDir]);

  if (sel) return <StudentDetail student={sel} onBack={() => setSel(null)} />;

  return (
    <div className="u-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .st-rpt-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .st-rpt-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .st-rpt-scroll::-webkit-scrollbar { height: 4px; }
        .st-rpt-scroll::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 4px; }
        .st-rpt-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--line);
          gap: 10px;
          background: linear-gradient(0deg, var(--card2), var(--card));
        }
        .st-rpt-title { font-weight: 800; font-size: 15.5px; color: var(--ink); }
        .st-rpt-count {
          background: var(--brand-soft);
          color: var(--brand-ink);
          padding: 4px 11px;
          border-radius: 99px;
          font-weight: 800;
          font-size: 12.5px;
          font-variant-numeric: tabular-nums;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .st-rpt-table { width: 100%; border-collapse: collapse; }
        .st-rpt-table th {
          padding: 10px 12px;
          text-align: center;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ink3);
          border-bottom: 1px solid var(--line);
          background: var(--card2);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .st-rpt-table th:first-child { text-align: start; padding-inline-start: 16px; }
        .st-rpt-table th:hover { color: var(--brand-ink); }
        .st-rpt-table td {
          padding: 12px;
          text-align: center;
          font-size: 14px;
          border-bottom: 1px solid var(--line);
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .st-rpt-table td:first-child { text-align: start; padding-inline-start: 16px; }
        .st-rpt-table tr:last-child td { border-bottom: 0; }
        .st-rpt-table tr:hover td { background: var(--card2); }
        .st-rpt-link {
          color: var(--brand-ink);
          text-decoration: underline;
          text-decoration-color: color-mix(in srgb, var(--brand-ink) 40%, transparent);
          text-underline-offset: 3px;
          font-weight: 700;
          background: none;
          border: 0;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
          font-size: 14.5px;
          text-align: start;
        }
        .st-rpt-link:hover { text-decoration-color: var(--brand-ink); }
        .st-pct {
          display: inline-block;
          font-weight: 800;
          font-size: 15px;
          font-variant-numeric: tabular-nums;
        }
        .st-sort { display: inline-block; margin-inline-start: 2px; font-size: 10px; }
        .st-sort.muted { color: var(--ink3); opacity: .5; }
        .st-sort.on { color: var(--brand-ink); }
        .st-circle-sub { font-size: 11.5px; color: var(--ink3); display: none; margin-top: 2px; }

        /* === Mobile (≤ 640px): switch to per-student cards === */
        .st-desktop-view { display: block; }
        .st-mobile-view { display: none; }
        @media (max-width: 640px) {
          .st-desktop-view { display: none !important; }
          .st-mobile-view { display: block !important; }
          .st-rpt-head { padding: 12px 14px; }
        }

        .st-cards-list { display: flex; flex-direction: column; }
        .st-stu-card {
          background: var(--card);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 9px;
          border-bottom: 1px solid var(--line);
        }
        .st-stu-card:last-child { border-bottom: 0; }
        .st-stu-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .st-stu-name {
          background: none; border: 0;
          color: var(--brand-ink); font-weight: 800; font-size: 15px;
          text-align: start; padding: 0;
          text-decoration: underline;
          text-decoration-color: color-mix(in srgb, var(--brand-ink) 40%, transparent);
          text-underline-offset: 3px;
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-family: inherit; cursor: pointer;
        }
        .st-stu-pct {
          font-weight: 800; font-size: 14.5px;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
          padding: 4px 11px;
          border-radius: 99px;
          background: color-mix(in srgb, currentColor 12%, transparent);
          border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
        }
        .st-stu-sub { color: var(--ink3); font-size: 12px; margin-top: -2px; }
        .st-stu-meta { color: var(--ink2); font-size: 12.5px; display: flex; gap: 10px; flex-wrap: wrap; }
        .st-stu-meta .sep { color: var(--ink3); opacity: .5; }
        .st-stu-meta b { color: var(--ink); font-weight: 700; margin-inline-start: 3px; }
      ` }} />

      <div className="u-top">
        <div><h1>تقارير الطلاب</h1></div>
      </div>

      <div className="u-card" style={{ padding: 12 }}>
        <div className="u-search" style={{ marginBottom: 0 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الطالب أو الحلقة..." />
        </div>
      </div>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : students.length === 0 ? (
        <div className="u-empty">لا يوجد طلاب في لجنتك</div>
      ) : filtered.length === 0 ? (
        <div className="u-empty">لا توجد نتائج مطابقة للبحث</div>
      ) : (
        <div className="st-rpt-card">
          <div className="st-rpt-head">
            <div className="st-rpt-title">تقرير اللجنة</div>
            <div className="st-rpt-count">
              <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l7 10H5z"/></svg>
              {filtered.length} {filtered.length === 1 ? 'طالب' : 'طلاب'}
            </div>
          </div>

          <div className="st-rpt-scroll st-desktop-view">
          <table className="st-rpt-table">
            <thead>
              <tr>
                <th className="col-name" onClick={() => toggleSort('name')}>الطالب{sortGlyph('name')}</th>
                <th className="col-circle" onClick={() => toggleSort('circleName')}>الحلقة{sortGlyph('circleName')}</th>
                <th onClick={() => toggleSort('target')}>الأحزاب{sortGlyph('target')}</th>
                <th onClick={() => toggleSort('memorized')}>المرصود{sortGlyph('memorized')}</th>
                <th onClick={() => toggleSort('avgScore')}>النسبة{sortGlyph('avgScore')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="col-name">
                    <button type="button" onClick={() => setSel(s)} className="st-rpt-link">
                      {s.name}
                    </button>
                    {s.circleName && (
                      <div className="st-circle-sub">{s.circleName}</div>
                    )}
                  </td>
                  <td className="col-circle">{s.circleName || '—'}</td>
                  <td>{s.target}</td>
                  <td>{s.memorized}</td>
                  <td>
                    <span className="st-pct" style={{ color: pctColor(s.avgScore) }}>
                      {s.avgScore}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="st-mobile-view st-cards-list">
            {filtered.map((s) => {
              return (
                <div key={s.id} className="st-stu-card">
                  <div className="st-stu-head">
                    <button type="button" onClick={() => setSel(s)} className="st-stu-name">
                      {s.name}
                    </button>
                    <span className="st-stu-pct" style={{ color: pctColor(s.avgScore) }}>{s.avgScore}%</span>
                  </div>
                  {s.circleName && <div className="st-stu-sub">{s.circleName}</div>}
                  <div className="st-stu-meta">
                    <span>الأحزاب <b>{s.target}</b></span>
                    <span className="sep">·</span>
                    <span>المرصود <b>{s.memorized}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================
// Student Detail — hizb grid view with colors + reciter
// ======================================================
type HizbStat = {
  hizb: number;
  attempts: number;
  passed: boolean;
  bestScore: number | null;
  lastDate: string | null;
  lastReciter: string | null;
  isAssigned: boolean;
};

function StudentDetail({ student, onBack }: { student: Combined; onBack: () => void }) {
  const [rows, setRows] = useState<SessRow[]>([]);
  const [targetHizbs, setTargetHizbs] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusHizb, setFocusHizb] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/sessions?studentId=${student.id}`).then((r) => r.json()),
      fetch(`/api/students/${student.id}`).then((r) => r.json())
    ])
      .then(([sessData, stData]) => {
        setRows(sessData.rows || []);
        setTargetHizbs(((stData.hizbs || []) as number[]).sort((a, b) => a - b));
      })
      .finally(() => setLoading(false));
  }, [student.id]);

  // Build per-hizb aggregate from BOTH the assigned list and every session the
  // student has ever had. Any hizb the student has actually recited always
  // appears in the grid, even if it isn't on their assigned list.
  const hizbStats: HizbStat[] = useMemo(() => {
    const assignedSet = new Set(targetHizbs);
    const byHizb = new Map<number, HizbStat>();
    for (const h of targetHizbs) {
      byHizb.set(h, { hizb: h, attempts: 0, passed: false, bestScore: null, lastDate: null, lastReciter: null, isAssigned: true });
    }
    // Chronological order so lastReciter / lastDate reflect the latest session.
    const sortedRows = [...rows].sort((a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    for (const r of sortedRows) {
      let stat = byHizb.get(r.hizbNumber);
      if (!stat) {
        stat = { hizb: r.hizbNumber, attempts: 0, passed: false, bestScore: null, lastDate: null, lastReciter: null, isAssigned: assignedSet.has(r.hizbNumber) };
        byHizb.set(r.hizbNumber, stat);
      }
      stat.attempts++;
      if (r.passed === true) stat.passed = true;
      if (r.score != null && (stat.bestScore == null || r.score > stat.bestScore)) {
        stat.bestScore = r.score;
      }
      stat.lastDate = r.startedAt;
      stat.lastReciter = r.reciterName || stat.lastReciter;
    }
    return Array.from(byHizb.values()).sort((a, b) => a.hizb - b.hizb);
  }, [targetHizbs, rows]);

  // Sessions for the focused hizb (deep dive)
  const focusSessions = useMemo(() => {
    if (focusHizb == null) return [];
    return rows
      .filter((r) => r.hizbNumber === focusHizb)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [rows, focusHizb]);

  return (
    <div className="u-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .hz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
          gap: 10px;
        }
        .hz-card {
          background: var(--card);
          border: 1.5px solid var(--line);
          border-radius: 14px;
          padding: 10px 8px 9px;
          text-align: center;
          cursor: pointer;
          transition: transform .12s, box-shadow .12s, border-color .12s;
          position: relative;
          overflow: hidden;
        }
        .hz-card:hover { transform: translateY(-1px); box-shadow: var(--shadow); }
        .hz-card .hz-num { font-size: 22px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
        .hz-card .hz-label { font-size: 10.5px; color: var(--ink3); margin-top: 1px; }
        .hz-card .hz-status {
          display: inline-block; margin-top: 7px; font-size: 10.5px; font-weight: 700;
          padding: 2px 8px; border-radius: 99px;
        }
        .hz-card.passed { background: linear-gradient(0deg, color-mix(in srgb, var(--ok) 11%, var(--card)), var(--card)); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
        .hz-card.passed .hz-num { color: var(--ok); }
        .hz-card.passed .hz-status { background: var(--ok-soft); color: var(--ok); }
        .hz-card.attempted { background: linear-gradient(0deg, color-mix(in srgb, var(--warn) 11%, var(--card)), var(--card)); border-color: color-mix(in srgb, var(--warn) 45%, var(--line)); }
        .hz-card.attempted .hz-num { color: var(--warn); }
        .hz-card.attempted .hz-status { background: var(--warn-soft); color: var(--warn); }
        .hz-card.pending .hz-num { color: var(--ink3); }
        .hz-card.pending .hz-status { background: var(--muted-bg); color: var(--ink3); }
        .hz-card.extra {
          border-style: dashed;
          border-color: color-mix(in srgb, var(--brand-ink) 35%, var(--line));
        }
        .hz-score { font-size: 12px; font-weight: 700; margin-top: 4px; color: var(--ink2); }
        .hz-reciter {
          font-size: 10.5px;
          margin-top: 5px;
          color: var(--ink2);
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          background: var(--muted-bg);
          padding: 2px 6px;
          border-radius: 6px;
        }
        .hz-attempts { position: absolute; top: 6px; inset-inline-end: 6px; font-size: 10px; color: var(--ink3); font-weight: 700; background: var(--muted-bg); padding: 1px 6px; border-radius: 99px; }
        .hz-extra-tag { position: absolute; top: 6px; inset-inline-start: 6px; font-size: 9.5px; color: var(--brand-ink); font-weight: 700; background: var(--brand-soft); padding: 1px 6px; border-radius: 99px; }
        .hz-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; margin-top: 12px; color: var(--ink2); }
        .hz-legend .leg { display: inline-flex; align-items: center; gap: 5px; }
        .hz-legend .dot { width: 10px; height: 10px; border-radius: 50%; }
        .hz-legend .dot.ok { background: var(--ok); }
        .hz-legend .dot.warn { background: var(--warn); }
        .hz-legend .dot.mute { background: var(--ink3); }

        .sess-card {
          border: 1px solid var(--line);
          border-radius: 11px;
          padding: 10px 12px;
        }
        .sess-card.passed { background: var(--ok-soft); border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); }
        .sess-card.failed { background: var(--bad-soft); border-color: color-mix(in srgb, var(--bad) 35%, var(--line)); }
        .sess-card.open { background: var(--muted-bg); }
        .sess-reciter {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--card);
          border: 1px solid var(--line);
          padding: 3px 9px;
          border-radius: 99px;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--brand-ink);
          margin-top: 6px;
        }
      ` }} />

      <div className="u-top">
        <div>
          <div className="u-sub">تقارير الطلاب{student.circleName ? ` · ${student.circleName}` : ''}</div>
          <h1>{student.name}</h1>
        </div>
        <div className="u-actions">
          <button type="button" onClick={onBack} className="u-btn u-btn-g sm">← رجوع</button>
        </div>
      </div>

      <div className="u-card">
        <div className="u-card-h">
          <h3>سجل الأحزاب</h3>
          <span className="u-pill mute">اضغط على الحزب لتفاصيله</span>
        </div>

        {loading ? (
          <div className="u-empty">...جاري التحميل</div>
        ) : hizbStats.length === 0 ? (
          <div className="u-empty">لا توجد أحزاب مسندة ولا جلسات مسجّلة لهذا الطالب</div>
        ) : (
          <>
            <div className="hz-grid">
              {hizbStats.map((h) => {
                const cls = h.passed ? 'passed' : (h.attempts > 0 ? 'attempted' : 'pending');
                const status = h.passed ? 'منجز' : (h.attempts > 0 ? 'لم يُجتز' : 'لم يُسمّع');
                return (
                  <div
                    key={h.hizb}
                    className={`hz-card ${cls} ${!h.isAssigned ? 'extra' : ''}`}
                    onClick={() => setFocusHizb(h.hizb)}
                  >
                    {h.attempts > 0 && <span className="hz-attempts">×{h.attempts}</span>}
                    {!h.isAssigned && <span className="hz-extra-tag">خارج المسند</span>}
                    <div className="hz-num">{h.hizb}</div>
                    <div className="hz-label">الحزب</div>
                    <span className="hz-status">{status}</span>
                    {h.bestScore != null && (
                      <div className="hz-score">الدرجة: {h.bestScore}</div>
                    )}
                    {h.lastReciter && (
                      <div className="hz-reciter" title={`آخر مسمع: ${h.lastReciter}`}>
                        {h.lastReciter}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="hz-legend">
              <span className="leg"><span className="dot ok" />منجز</span>
              <span className="leg"><span className="dot warn" />لم يُجتز بعد</span>
              <span className="leg"><span className="dot mute" />لم يُسمّع</span>
            </div>
          </>
        )}
      </div>

      {/* Hizb detail bottom sheet */}
      <div className={`u-sheet-bg ${focusHizb != null ? 'show' : ''}`} onClick={() => setFocusHizb(null)} />
      <div className={`u-sheet ${focusHizb != null ? 'show' : ''}`}>
        <div className="grab" />
        {focusHizb != null && (
          <>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              الحزب {focusHizb} · {student.name}
            </div>
            {focusSessions.length === 0 ? (
              <div className="u-empty" style={{ margin: '20px 0' }}>لم يُسمَّع هذا الحزب بعد</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
                {focusSessions.map((r) => {
                  const cls = r.passed === true ? 'passed' : r.passed === false ? 'failed' : 'open';
                  return (
                    <div key={r.id} className={`sess-card ${cls}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                        <b style={{ fontSize: 13 }}>{fmtDate(r.startedAt)}</b>
                        {r.score != null ? (
                          <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>{r.score}</span>
                        ) : (
                          <span className="u-pill mute">مفتوحة</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 12, flexWrap: 'wrap', color: 'var(--ink2)' }}>
                        <span style={{ color: 'var(--bad)' }}>أخطاء: <b>{r.errors}</b></span>
                        <span style={{ color: 'var(--warn)' }}>تنبيهات: <b>{r.alerts}</b></span>
                      </div>
                      <div>
                        <span className="sess-reciter">
                          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a2 2 0 10-4 0v4M5 11h14l-1 10H6L5 11z"/>
                          </svg>
                          المسمع: {r.reciterName || 'بدون اسم'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="u-btn u-btn-g w sm" onClick={() => setFocusHizb(null)} style={{ marginTop: 6 }}>
              إغلاق
            </button>
          </>
        )}
      </div>
    </div>
  );
}
