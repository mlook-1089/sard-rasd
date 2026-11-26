'use client';
import { useEffect, useMemo, useState } from 'react';

type Student = {
  id: number; name: string; level: string | null; status: string;
  circleId: number | null; committeeId: number | null;
  circleName: string | null; committeeName: string | null;
};
type ReportRow = {
  id: number; target: number; memorized: number; completionNum: number;
};
type SessRow = {
  id: number; startedAt: string; durationSeconds: number | null;
  hizbNumber: number; errors: number; alerts: number; score: number | null;
  passed: boolean | null; reciterName: string; programId: number | null;
};

type SortKey = 'name' | 'circleName' | 'target' | 'memorized' | 'completionNum';
type SortDir = 'asc' | 'desc';

type Combined = Student & { target: number; memorized: number; completionNum: number };

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}

// Color tier based on percentage — matches the model in the mockup
function pctColor(p: number): string {
  if (p >= 75) return 'var(--ok)';
  if (p >= 25) return 'var(--warn)';
  if (p > 0) return '#D9551F';
  return 'var(--bad)';
}

export default function SupStudentsReport() {
  const [students, setStudents] = useState<Combined[]>([]);
  const [program, setProgram] = useState<{ id: number; name: string } | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Combined | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    setLoading(true);
    // Each request is isolated: a failure in the report aggregates must NOT hide the student list.
    const safeJson = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    Promise.all([
      safeJson('/api/students'),
      safeJson('/api/reports/students?format=json'),
      safeJson('/api/programs/active')
    ])
      .then(([stData, repData, progData]) => {
        const activeStudents: Student[] = ((stData?.rows || []) as any[])
          .filter((s) => s.status === 'active');
        const repMap = new Map<number, ReportRow>();
        for (const r of (repData?.rows || [])) {
          repMap.set(r.id, {
            id: r.id,
            target: Number(r.target || 0),
            memorized: Number(r.memorized || 0),
            completionNum: Number(r.completionNum || 0)
          });
        }
        const combined: Combined[] = activeStudents.map((s) => {
          const rep = repMap.get(s.id);
          return {
            ...s,
            target: rep?.target ?? 0,
            memorized: rep?.memorized ?? 0,
            completionNum: rep?.completionNum ?? 0
          };
        });
        setStudents(combined);
        setProgram(progData && progData.id ? progData : null);
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

  if (sel) return <StudentDetail student={sel} program={program} onBack={() => setSel(null)} />;

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
        .st-rpt-sort-all {
          background: none;
          border: 0;
          color: var(--ink2);
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
        }
        .st-rpt-sort-all:hover { color: var(--brand-ink); background: var(--muted-bg); }

        /* Table */
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
        .st-sort {
          display: inline-block;
          margin-inline-start: 2px;
          font-size: 10px;
        }
        .st-sort.muted { color: var(--ink3); opacity: .5; }
        .st-sort.on { color: var(--brand-ink); }

        /* Mobile: hide circle column, show under name */
        @media (max-width: 560px) {
          .st-rpt-table .col-circle { display: none; }
          .st-rpt-table td.col-name,
          .st-rpt-table th.col-name { padding-inline-start: 10px; }
          .st-rpt-table td,
          .st-rpt-table th { padding: 9px 7px; font-size: 13px; }
          .st-pct { font-size: 14px; }
          .st-rpt-head { padding: 12px 14px; }
        }
        .st-circle-sub {
          font-size: 11.5px;
          color: var(--ink3);
          display: none;
          margin-top: 2px;
        }
        @media (max-width: 560px) {
          .st-circle-sub { display: block; }
        }
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

          <table className="st-rpt-table">
            <thead>
              <tr>
                <th className="col-name" onClick={() => toggleSort('name')}>الطالب{sortGlyph('name')}</th>
                <th className="col-circle" onClick={() => toggleSort('circleName')}>الحلقة{sortGlyph('circleName')}</th>
                <th onClick={() => toggleSort('target')}>الأجزاء{sortGlyph('target')}</th>
                <th onClick={() => toggleSort('memorized')}>المرصود{sortGlyph('memorized')}</th>
                <th onClick={() => toggleSort('completionNum')}>النسبة{sortGlyph('completionNum')}</th>
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
                    <span className="st-pct" style={{ color: pctColor(s.completionNum) }}>
                      {s.completionNum}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ======================================================
// Student Detail — Hizb grid view with colors
// ======================================================
type HizbStat = {
  hizb: number;
  attempts: number;
  passed: boolean;
  bestScore: number | null;
  lastDate: string | null;
};

function StudentDetail({ student, program, onBack }: { student: Combined; program: { id: number; name: string } | null; onBack: () => void }) {
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

  const inProgram = useMemo(
    () => (program ? rows.filter((r) => r.programId === program.id) : rows),
    [rows, program]
  );

  // Build per-hizb aggregate from all assigned hizbs, union with any hizb that has sessions
  const hizbStats: HizbStat[] = useMemo(() => {
    const byHizb = new Map<number, HizbStat>();
    // Seed from assigned hizbs
    for (const h of targetHizbs) {
      byHizb.set(h, { hizb: h, attempts: 0, passed: false, bestScore: null, lastDate: null });
    }
    for (const r of inProgram) {
      let stat = byHizb.get(r.hizbNumber);
      if (!stat) {
        stat = { hizb: r.hizbNumber, attempts: 0, passed: false, bestScore: null, lastDate: null };
        byHizb.set(r.hizbNumber, stat);
      }
      stat.attempts++;
      if (r.passed === true) stat.passed = true;
      if (r.score != null && (stat.bestScore == null || r.score > stat.bestScore)) {
        stat.bestScore = r.score;
      }
      if (!stat.lastDate || new Date(r.startedAt) > new Date(stat.lastDate)) {
        stat.lastDate = r.startedAt;
      }
    }
    return Array.from(byHizb.values()).sort((a, b) => a.hizb - b.hizb);
  }, [targetHizbs, inProgram]);

  const passedCount = hizbStats.filter((h) => h.passed).length;
  const totalTarget = targetHizbs.length;
  const completion = totalTarget > 0 ? Math.round((passedCount / totalTarget) * 100) : 0;
  const totalErrors = inProgram.reduce((a, b) => a + (b.errors || 0), 0);
  const scored = inProgram.filter((r) => r.score != null && r.passed !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + (b.score || 0), 0) / scored.length) : 0;

  // Sessions for the focused hizb (deep dive)
  const focusSessions = useMemo(() => {
    if (focusHizb == null) return [];
    return inProgram
      .filter((r) => r.hizbNumber === focusHizb)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [inProgram, focusHizb]);

  return (
    <div className="u-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .hz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
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
        .hz-score { font-size: 12px; font-weight: 700; margin-top: 4px; color: var(--ink2); }
        .hz-attempts { position: absolute; top: 6px; inset-inline-end: 6px; font-size: 10px; color: var(--ink3); font-weight: 700; background: var(--muted-bg); padding: 1px 6px; border-radius: 99px; }

        .hz-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; margin-top: 10px; }
        .hz-legend .leg { display: inline-flex; align-items: center; gap: 5px; }
        .hz-legend .dot { width: 10px; height: 10px; border-radius: 50%; }
        .hz-legend .dot.ok { background: var(--ok); }
        .hz-legend .dot.warn { background: var(--warn); }
        .hz-legend .dot.mute { background: var(--ink3); }
      ` }} />

      <div className="u-top">
        <div>
          <div className="u-sub">تقارير الطلاب</div>
          <h1>{student.name}</h1>
        </div>
        <div className="u-actions">
          <button type="button" onClick={onBack} className="u-btn u-btn-g sm">← رجوع</button>
        </div>
      </div>

      <div className="u-hero">
        <div className="l">{student.level || 'بدون مستوى'}{student.circleName ? ` · ${student.circleName}` : ''}</div>
        <div className="big">{student.name}</div>
        <div className="u-bar light"><i style={{ width: `${completion}%`, background: 'var(--gold-bright)' }} /></div>
        <div className="meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>الإنجاز في البرنامج</span>
          <span className="u-num"><bdi dir="ltr">{passedCount} / {totalTarget}</bdi> · <bdi dir="ltr">{completion}%</bdi></span>
        </div>
      </div>

      <div className="u-grid2 md4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="u-stat"><div className="l">الهدف</div><div className="v">{totalTarget}</div></div>
        <div className="u-stat"><div className="l">المرصود</div><div className="v" style={{ color: 'var(--ok)' }}>{passedCount}</div></div>
        <div className="u-stat"><div className="l">عدد الجلسات</div><div className="v">{inProgram.length}</div></div>
        <div className="u-stat">
          <div className="l">{scored.length > 0 ? 'متوسط الدرجة' : 'عدد الأخطاء'}</div>
          <div className="v" style={{ color: scored.length > 0 ? 'var(--brand-ink)' : 'var(--bad)' }}>
            {scored.length > 0 ? avgScore : totalErrors}
          </div>
        </div>
      </div>

      <div className="u-card">
        <div className="u-card-h">
          <h3>الأحزاب المسندة</h3>
          <span className="u-pill mute">اضغط على الحزب لتفاصيله</span>
        </div>

        {loading ? (
          <div className="u-empty">...جاري التحميل</div>
        ) : hizbStats.length === 0 ? (
          <div className="u-empty">لا توجد أحزاب مسندة لهذا الطالب</div>
        ) : (
          <>
            <div className="hz-grid">
              {hizbStats.map((h) => {
                const cls = h.passed ? 'passed' : (h.attempts > 0 ? 'attempted' : 'pending');
                const status = h.passed ? 'منجز' : (h.attempts > 0 ? 'لم يُجتز' : 'لم يُسمّع');
                return (
                  <div key={h.hizb} className={`hz-card ${cls}`} onClick={() => setFocusHizb(h.hizb)}>
                    {h.attempts > 0 && <span className="hz-attempts">×{h.attempts}</span>}
                    <div className="hz-num">{h.hizb}</div>
                    <div className="hz-label">الحزب</div>
                    <span className="hz-status">{status}</span>
                    {h.bestScore != null && (
                      <div className="hz-score">الدرجة: {h.bestScore}</div>
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
                {focusSessions.map((r) => (
                  <div key={r.id} style={{
                    border: '1px solid var(--line)',
                    borderRadius: 11,
                    padding: '10px 12px',
                    background: r.passed ? 'var(--ok-soft)' : (r.passed === false ? 'var(--bad-soft)' : 'var(--muted-bg)')
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
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
                      {r.reciterName && <span>المسمع: <b>{r.reciterName}</b></span>}
                    </div>
                  </div>
                ))}
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
