'use client';
import { useEffect, useMemo, useState } from 'react';
import ExportButton from '@/components/ExportButton';

const DEFAULT_WA_TEMPLATE =
  'السلام عليكم ورحمة الله\nتقرير الطالب {name}\nالمحفوظ: {memorized} / {hizbs}\nالأخطاء: {errors} | التنبيهات: {alerts}\nنسبة الإنجاز: {completion}%';

function buildWhatsAppUrl(phone: string | null | undefined, text: string): string {
  const encoded = encodeURIComponent(text);
  if (!phone) return `https://wa.me/?text=${encoded}`;
  let digits = String(phone).replace(/\D+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('05') && digits.length === 10) {
    digits = '966' + digits.slice(1);
  } else if (digits.startsWith('5') && digits.length === 9) {
    digits = '966' + digits;
  } else if (digits.startsWith('0') && digits.length >= 9) {
    digits = '966' + digits.slice(1);
  }
  return digits.length >= 8
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

function formatStudentWhatsApp(template: string, r: any): string {
  const tpl = template || DEFAULT_WA_TEMPLATE;
  return tpl
    .replace(/\{name\}/g, String(r.name || ''))
    .replace(/\{memorized\}/g, String(r.memorized ?? 0))
    .replace(/\{hizbs\}/g, String(r.target ?? 0))
    .replace(/\{errors\}/g, String(r.errors ?? 0))
    .replace(/\{alerts\}/g, String(r.alerts ?? 0))
    .replace(/\{completion\}%/g, `${r.completionNum ?? 0}%`)
    .replace(/\{completion\}/g, String(r.completionNum ?? 0));
}

type SortKey =
  | 'name'
  | 'level'
  | 'circleName'
  | 'committeeName'
  | 'target'
  | 'memorized'
  | 'errors'
  | 'alerts'
  | 'completionNum';

export default function StudentsReportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [waTemplate, setWaTemplate] = useState<string>(DEFAULT_WA_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [circleFilter, setCircleFilter] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/reports/students?format=json');
        if (res.ok) {
          const d = await res.json();
          if (alive) {
            setRows(d.rows || []);
            if (d.whatsappTemplate) setWaTemplate(d.whatsappTemplate);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const circlesList = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.circleName && String(r.circleName).trim()) s.add(String(r.circleName).trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows]);

  const committeesList = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.committeeName && String(r.committeeName).trim()) s.add(String(r.committeeName).trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(
        key === 'name' || key === 'level' || key === 'circleName' || key === 'committeeName'
          ? 'asc'
          : 'desc'
      );
    }
  }

  function clearFilters() {
    setQ('');
    setCircleFilter('');
    setCommitteeFilter('');
    setSortKey('name');
    setSortDir('asc');
  }

  const filteredAndSorted = useMemo(() => {
    const query = q.trim();
    const list = rows.filter((r) => {
      if (query) {
        const hit = [r.name, r.level, r.circleName, r.committeeName, r.nationalId, r.parentPhone]
          .some((x) => String(x || '').includes(query));
        if (!hit) return false;
      }
      if (circleFilter && (r.circleName || '') !== circleFilter) return false;
      if (committeeFilter && (r.committeeName || '') !== committeeFilter) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (
        sortKey === 'name' ||
        sortKey === 'level' ||
        sortKey === 'circleName' ||
        sortKey === 'committeeName'
      ) {
        return String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'ar') * dir;
      }
      return (Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0)) * dir;
    });
  }, [rows, q, circleFilter, committeeFilter, sortKey, sortDir]);

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span style={{ opacity: 0.35, marginInlineStart: 4, fontSize: 11 }}>⇅</span>;
    return <span style={{ marginInlineStart: 4, fontSize: 11 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  return (
    <div className="u-page">
      <div className="u-top" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div><h1>تقرير الطلاب</h1></div>
        <div className="u-actions" style={{ marginTop: 0 }}>
          <ExportButton href="/api/reports/students" />
        </div>
      </div>

      <style>{`
        .stud-rpt-th {
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .stud-rpt-th:hover {
          background: rgba(15, 118, 110, 0.08);
        }
        .stud-rpt-mobile {
          display: none;
        }
        @media (max-width: 767px) {
          .stud-rpt-desktop {
            display: none !important;
          }
          .stud-rpt-mobile {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div className="u-search" style={{ flex: '1 1 220px', marginBottom: 0 }}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث باسم الطالب..."
          />
        </div>

        <select
          className="u-select"
          style={{ width: 'auto', minWidth: 140 }}
          value={circleFilter}
          onChange={(e) => setCircleFilter(e.target.value)}
          aria-label="فلتر الحلقة"
        >
          <option value="">كل الحلقات</option>
          {circlesList.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="u-select"
          style={{ width: 'auto', minWidth: 140 }}
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          aria-label="فلتر اللجنة"
        >
          <option value="">كل اللجان</option>
          {committeesList.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={clearFilters}
          className="u-btn u-btn-g sm"
          style={{ whiteSpace: 'nowrap' }}
        >
          ✕ مسح الفلتر
        </button>
      </div>

      <div className="u-card">
        {loading ? (
          <div className="u-empty">...جاري التحميل</div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="u-empty">لا يوجد طلاب مطابقون.</div>
        ) : (
          <>
            <div className="th-rpt-table-wrap stud-rpt-desktop">
              <table className="th-rpt-table">
                <thead>
                  <tr>
                    <th className="stud-rpt-th" onClick={() => toggleSort('name')}>الاسم{sortIcon('name')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('level')}>المستوى{sortIcon('level')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('circleName')}>الحلقة{sortIcon('circleName')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('committeeName')}>اللجنة{sortIcon('committeeName')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('target')}>الهدف{sortIcon('target')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('memorized')}>أنجز{sortIcon('memorized')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('errors')}>الأخطاء{sortIcon('errors')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('alerts')}>التنبيهات{sortIcon('alerts')}</th>
                    <th className="stud-rpt-th" onClick={() => toggleSort('completionNum')}>النسبة{sortIcon('completionNum')}</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((r) => {
                    const waHref = buildWhatsAppUrl(r.parentPhone, formatStudentWhatsApp(waTemplate, r));
                    return (
                      <tr key={r.id}>
                        <td><b>{r.name}</b></td>
                        <td>{r.level || '—'}</td>
                        <td>{r.circleName || '—'}</td>
                        <td>{r.committeeName || '—'}</td>
                        <td className="u-num">{Number(r.target)}</td>
                        <td className="u-num" style={{ color: 'var(--ok)' }}>{Number(r.memorized)}</td>
                        <td style={{ color: 'var(--bad)' }}>{r.errors}</td>
                        <td style={{ color: 'var(--warn)' }}>{r.alerts}</td>
                        <td><span className="u-pill brand">{r.completionNum}%</span></td>
                        <td>
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="u-btn u-btn-ok sm"
                            style={{ textDecoration: 'none' }}
                            title="إرسال التقرير لولي الأمر عبر واتساب"
                          >
                            📱 واتساب
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="stud-rpt-mobile">
              {filteredAndSorted.map((r) => {
                const waHref = buildWhatsAppUrl(r.parentPhone, formatStudentWhatsApp(waTemplate, r));
                return (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 14,
                      padding: 12,
                      background: 'var(--card)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <b>{r.name}</b>
                      <span className="u-pill brand">{r.completionNum}%</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 13, marginBottom: 10 }}>
                      <div><span className="u-muted">المستوى: </span><b>{r.level || '—'}</b></div>
                      <div><span className="u-muted">الحلقة: </span><b>{r.circleName || '—'}</b></div>
                      <div><span className="u-muted">اللجنة: </span><b>{r.committeeName || '—'}</b></div>
                      <div><span className="u-muted">الإنجاز: </span><b style={{ color: 'var(--ok)' }}>{r.memorized} / {r.target}</b></div>
                      <div><span className="u-muted">الأخطاء: </span><b style={{ color: 'var(--bad)' }}>{r.errors}</b></div>
                      <div><span className="u-muted">التنبيهات: </span><b style={{ color: 'var(--warn)' }}>{r.alerts}</b></div>
                    </div>
                    <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)', display: 'flex' }}>
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="u-btn u-btn-ok sm"
                        style={{ textDecoration: 'none', width: '100%', justifyContent: 'center' }}
                      >
                        📱 واتساب
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
