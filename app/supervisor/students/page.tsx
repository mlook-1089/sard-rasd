'use client';
import { useEffect, useMemo, useState } from 'react';

type Student = {
  id: number; name: string; level: string | null; status: string;
  circleId: number | null; committeeId: number | null;
  circleName: string | null; committeeName: string | null;
};
type SessRow = {
  id: number; startedAt: string; durationSeconds: number | null;
  hizbNumber: number; errors: number; alerts: number; score: number | null;
  passed: boolean | null; reciterName: string; programId: number | null;
};

type StudentSortKey = 'name' | 'level' | 'circleName';
type SessSortKey = 'startedAt' | 'hizbNumber' | 'errors' | 'alerts' | 'score' | 'reciterName' | 'durationSeconds';
type SortDir = 'asc' | 'desc';

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}
function fmtDur(sec: number | null) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}د ${s}ث`;
}

export default function SupStudentsReport() {
  const [students, setStudents] = useState<Student[]>([]);
  const [program, setProgram] = useState<{ id: number; name: string } | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<StudentSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/students').then((r) => r.json()),
      fetch('/api/programs/active').then((r) => r.json())
    ])
      .then(([stData, progData]) => {
        setStudents((stData.rows || []).filter((s: any) => s.status === 'active'));
        setProgram(progData && progData.id ? progData : null);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleSort(key: StudentSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortIcon(key: StudentSortKey) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
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
      const av = (a[sortKey] || '').toString();
      const bv = (b[sortKey] || '').toString();
      const cmp = av.localeCompare(bv, 'ar');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [students, q, sortKey, sortDir]);

  if (sel) return <StudentDetail student={sel} program={program} onBack={() => setSel(null)} />;

  return (
    <div className="u-page">
      <div className="u-top">
        <div><h1>تقارير الطلاب</h1></div>
      </div>

      <div className="u-card">
        <div className="u-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="u-search" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الطالب..." />
          </div>
          <button
            type="button"
            onClick={() => setQ('')}
            className="u-btn u-btn-g sm"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>مسح الفلتر</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : students.length === 0 ? (
        <div className="u-empty">لا يوجد طلاب في لجنتك</div>
      ) : filtered.length === 0 ? (
        <div className="u-empty">لا توجد نتائج مطابقة للبحث</div>
      ) : (
        <>
          <style>{`
            .sup-st-desktop { display: block; }
            .sup-st-mobile { display: none; }
            @media (max-width: 768px) {
              .sup-st-desktop { display: none !important; }
              .sup-st-mobile { display: flex !important; flex-direction: column; gap: 10px; }
            }
            .sup-sortable-th {
              cursor: pointer;
              user-select: none;
              white-space: nowrap;
            }
            .sup-sortable-th:hover {
              color: var(--brand);
            }
          `}</style>

          {/* Desktop Sortable Table View */}
          <div className="u-card sup-st-desktop">
            <div className="th-rpt-table-wrap">
              <table className="th-rpt-table">
                <thead>
                  <tr>
                    <th className="sup-sortable-th" onClick={() => toggleSort('name')}>
                      الطالب{sortIcon('name')}
                    </th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('level')}>
                      المستوى{sortIcon('level')}
                    </th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('circleName')}>
                      الحلقة{sortIcon('circleName')}
                    </th>
                    <th>التقرير</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSel(s)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="u-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{s.name?.[0] || '؟'}</div>
                          <b>{s.name}</b>
                        </div>
                      </td>
                      <td>{s.level || '—'}</td>
                      <td>{s.circleName || 'بدون حلقة'}</td>
                      <td>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSel(s); }} className="u-btn u-btn-g sm">
                          تفاصيل ←
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="sup-st-mobile">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="u-card"
                style={{ marginBottom: 0, cursor: 'pointer' }}
                onClick={() => setSel(s)}
              >
                <div className="u-item" style={{ padding: 0, borderBottom: 0, flexWrap: 'wrap', gap: 10 }}>
                  <div className="u-avatar lg" style={{ flexShrink: 0 }}>{s.name?.[0] || '؟'}</div>
                  <div className="u-grow" style={{ minWidth: 140 }}>
                    <div className="u-name" style={{ wordBreak: 'normal', overflowWrap: 'break-word' }}>{s.name}</div>
                    <div className="u-muted">
                      {s.level || '—'}{s.circleName ? ` · ${s.circleName}` : ''}
                    </div>
                  </div>
                  <span className="u-pill brand">تفاصيل ←</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StudentDetail({ student, program, onBack }: { student: Student; program: { id: number; name: string } | null; onBack: () => void }) {
  const [rows, setRows] = useState<SessRow[]>([]);
  const [hizbsTarget, setHizbsTarget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SessSortKey>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    fetch(`/api/sessions?studentId=${student.id}`).then((r) => r.json()).then((d) => {
      setRows(d.rows || []);
      setLoading(false);
    }).catch(() => setLoading(false));
    fetch(`/api/students/${student.id}`).then((r) => r.json()).then((d) => {
      setHizbsTarget((d.hizbs || []).length);
    }).catch(() => {});
  }, [student.id]);

  function toggleSort(key: SessSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortIcon(key: SessSortKey) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const inProgram = useMemo(
    () => (program ? rows.filter((r) => r.programId === program.id) : rows),
    [rows, program]
  );

  const sortedSessions = useMemo(() => {
    return [...inProgram].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'startedAt') {
        cmp = new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime();
      } else if (sortKey === 'reciterName') {
        cmp = (a.reciterName || '').localeCompare(b.reciterName || '', 'ar');
      } else {
        const av = Number(a[sortKey] ?? -1);
        const bv = Number(b[sortKey] ?? -1);
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [inProgram, sortKey, sortDir]);

  const completed = inProgram.filter((r) => !!r.score && r.passed !== null);
  const passed = inProgram.filter((r) => (r.passed === true && !r.score ? false : r.passed === true));
  const memorized = new Set(passed.map((r) => r.hizbNumber)).size;
  const avgScore = completed.length
    ? Math.round(completed.reduce((a, b) => a + (b.score || 0), 0) / completed.length)
    : 0;
  const sumErrors = inProgram.reduce((a, b) => a + (b.errors || 0), 0);
  const completion = hizbsTarget > 0 ? Math.round((memorized / hizbsTarget) * 100) : 0;

  return (
    <div className="u-page">
      <div className="u-top">
        <div>
          <h1>{student.name}</h1>
        </div>
        <div className="u-actions">
          <button type="button" onClick={onBack} className="u-btn u-btn-g sm">← رجوع</button>
        </div>
      </div>

      <div className="u-hero">
        <div className="l">{student.level || 'بدون مستوى'}{student.committeeName ? ` · ${student.committeeName}` : ''}</div>
        <div className="big">{student.name}</div>
        <div className="u-bar light"><i style={{ width: `${completion}%`, background: 'var(--gold-bright)' }} /></div>
        <div className="meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>الإنجاز في البرنامج: </span>
          {' '}
          <span className="u-num"><bdi dir="ltr">{memorized} / {hizbsTarget}</bdi> · <bdi dir="ltr">{completion}%</bdi></span>
        </div>
      </div>

      <div className="u-grid2 md4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="u-stat"><div className="l">الهدف</div><div className="v">{hizbsTarget}</div></div>
        <div className="u-stat"><div className="l">المحفوظ</div><div className="v" style={{ color: 'var(--ok)' }}>{memorized}</div></div>
        <div className="u-stat"><div className="l">عدد الجلسات</div><div className="v">{inProgram.length}</div></div>
        <div className="u-stat">
          <div className="l">{completed.length > 0 ? 'متوسط الدرجة' : 'عدد الأخطاء'}</div>
          <div className="v" style={{ color: completed.length > 0 ? 'var(--brand-ink)' : 'var(--bad)' }}>
            {completed.length > 0 ? avgScore : sumErrors}
          </div>
        </div>
      </div>

      <div className="u-card">
        <div className="u-card-h"><h3>جلسات التسميع داخل البرنامج</h3></div>
        {loading ? (
          <div className="u-empty">...جاري التحميل</div>
        ) : sortedSessions.length === 0 ? (
          <div className="u-empty">لا توجد جلسات في هذا البرنامج بعد</div>
        ) : (
          <>
            <style>{`
              .st-det-desktop { display: block; }
              .st-det-mobile { display: none; }
              @media (max-width: 768px) {
                .st-det-desktop { display: none !important; }
                .st-det-mobile { display: flex !important; flex-direction: column; gap: 10px; }
              }
            `}</style>
            <div className="th-rpt-table-wrap st-det-desktop">
              <table className="th-rpt-table">
                <thead>
                  <tr>
                    <th className="sup-sortable-th" onClick={() => toggleSort('startedAt')}>التاريخ{sortIcon('startedAt')}</th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('hizbNumber')}>الحزب{sortIcon('hizbNumber')}</th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('errors')}>الأخطاء{sortIcon('errors')}</th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('alerts')}>التنبيهات{sortIcon('alerts')}</th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('score')}>الدرجة{sortIcon('score')}</th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('reciterName')}>المسمع{sortIcon('reciterName')}</th>
                    <th className="sup-sortable-th" onClick={() => toggleSort('durationSeconds')}>المدة{sortIcon('durationSeconds')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.startedAt)}</td>
                      <td><b>{r.hizbNumber}</b></td>
                      <td style={{ color: 'var(--bad)' }}>{r.errors}</td>
                      <td style={{ color: 'var(--warn)' }}>{r.alerts}</td>
                      <td>
                        {r.score != null ? (
                          <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>{r.score}</span>
                        ) : '—'}
                      </td>
                      <td>{r.reciterName}</td>
                      <td>{fmtDur(r.durationSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< 768px) */}
            <div className="st-det-mobile">
              {sortedSessions.map((r) => (
                <div key={r.id} className="u-card" style={{ marginBottom: 0, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <div>
                      <b>الحزب {r.hizbNumber}</b>
                      <span className="u-muted" style={{ marginInlineStart: 8 }}>{fmtDate(r.startedAt)}</span>
                    </div>
                    {r.score != null ? (
                      <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>الدرجة: {r.score}</span>
                    ) : (
                      <span className="u-pill">مفتوحة</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                    <span style={{ color: 'var(--bad)' }}>الأخطاء: <b>{r.errors}</b></span>
                    <span style={{ color: 'var(--warn)' }}>التنبيهات: <b>{r.alerts}</b></span>
                    <span className="u-muted">المسمع: <b>{r.reciterName || '—'}</b></span>
                    <span className="u-muted">المدة: <b>{fmtDur(r.durationSeconds)}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
