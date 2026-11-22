'use client';
import { useEffect, useMemo, useState } from 'react';
import ExportButton from '@/components/ExportButton';

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

function formatCircleWhatsApp(r: any): string {
  const lines = [
    'السلام عليكم ورحمة الله',
    `تقرير الحلقة: ${r.name || '—'}`
  ];
  if (r.teacherName) lines.push(`المعلم: ${r.teacherName}`);
  lines.push(
    `عدد الطلاب: ${r.studentsCount ?? 0}`,
    `إجمالي الهدف: ${r.target ?? 0} حزب`,
    `الأحزاب المجتازة: ${r.passed ?? 0}`,
    `الأحزاب الراسبة: ${r.failed ?? 0}`,
    `غير مقروءة: ${r.pending ?? 0}`,
    `مجموع الدرجات: ${r.totalScore ?? 0}`,
    `نسبة الإنجاز: ${r.completionNum ?? 0}%`
  );
  return lines.join('\n');
}

type SortKey =
  | 'name'
  | 'teacherName'
  | 'studentsCount'
  | 'target'
  | 'passed'
  | 'failed'
  | 'pending'
  | 'totalScore'
  | 'completionNum';

export default function CirclesReportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/reports/circles?format=json');
        if (res.ok) {
          const d = await res.json();
          if (alive) setRows(d.rows || []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'teacherName' ? 'asc' : 'desc');
    }
  }

  function clearFilters() {
    setQ('');
    setSortKey('name');
    setSortDir('asc');
  }

  const filteredAndSorted = useMemo(() => {
    const query = q.trim();
    const list = rows.filter((r) => {
      if (!query) return true;
      return [r.name, r.teacherName, r.teacherPhone].some((x) => String(x || '').includes(query));
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'name' || sortKey === 'teacherName') {
        return String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'ar') * dir;
      }
      return (Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0)) * dir;
    });
  }, [rows, q, sortKey, sortDir]);

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span style={{ opacity: 0.35, marginInlineStart: 4, fontSize: 11 }}>⇅</span>;
    return <span style={{ marginInlineStart: 4, fontSize: 11 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  return (
    <div className="u-page">
      <div className="u-top" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div><h1>تقرير الحلقات</h1></div>
        <div className="u-actions" style={{ marginTop: 0 }}>
          <ExportButton href="/api/reports/circles" />
        </div>
      </div>

      <style>{`
        .circ-rpt-th {
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .circ-rpt-th:hover {
          background: rgba(15, 118, 110, 0.08);
        }
        .circ-rpt-mobile {
          display: none;
        }
        @media (max-width: 767px) {
          .circ-rpt-desktop {
            display: none !important;
          }
          .circ-rpt-mobile {
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
            placeholder="بحث باسم الحلقة أو المعلم..."
          />
        </div>

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
          <div className="u-empty">لا توجد حلقات مطابقة.</div>
        ) : (
          <>
            <div className="th-rpt-table-wrap circ-rpt-desktop">
              <table className="th-rpt-table">
                <thead>
                  <tr>
                    <th className="circ-rpt-th" onClick={() => toggleSort('name')}>الحلقة{sortIcon('name')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('teacherName')}>المعلم{sortIcon('teacherName')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('studentsCount')}>الطلاب{sortIcon('studentsCount')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('target')}>إجمالي الهدف{sortIcon('target')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('passed')}>مجتازة{sortIcon('passed')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('failed')}>راسبة{sortIcon('failed')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('pending')}>غير مقروءة{sortIcon('pending')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('totalScore')}>مجموع الدرجات{sortIcon('totalScore')}</th>
                    <th className="circ-rpt-th" onClick={() => toggleSort('completionNum')}>النسبة{sortIcon('completionNum')}</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((r) => {
                    const waHref = buildWhatsAppUrl(r.teacherPhone, formatCircleWhatsApp(r));
                    return (
                      <tr key={r.id}>
                        <td><b>{r.name}</b></td>
                        <td>{r.teacherName || '—'}</td>
                        <td className="u-num">{r.studentsCount}</td>
                        <td className="u-num">{r.target}</td>
                        <td className="u-num" style={{ color: 'var(--ok)' }}>{r.passed}</td>
                        <td className="u-num" style={{ color: 'var(--bad)' }}>{r.failed}</td>
                        <td className="u-num">{r.pending}</td>
                        <td className="u-num">{r.totalScore}</td>
                        <td><span className="u-pill brand">{r.completionNum}%</span></td>
                        <td>
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="u-btn u-btn-ok sm"
                            style={{ textDecoration: 'none' }}
                            title="إرسال تقرير الحلقة للمعلم عبر واتساب"
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

            <div className="circ-rpt-mobile">
              {filteredAndSorted.map((r) => {
                const waHref = buildWhatsAppUrl(r.teacherPhone, formatCircleWhatsApp(r));
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
                      <div>
                        <b>{r.name}</b>
                        {r.teacherName && <div className="u-muted" style={{ fontSize: 12 }}>المعلم: {r.teacherName}</div>}
                      </div>
                      <span className="u-pill brand">{r.completionNum}%</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 13, marginBottom: 10 }}>
                      <div><span className="u-muted">الطلاب: </span><b>{r.studentsCount}</b></div>
                      <div><span className="u-muted">إجمالي الهدف: </span><b>{r.target}</b></div>
                      <div><span className="u-muted">مجتازة: </span><b style={{ color: 'var(--ok)' }}>{r.passed}</b></div>
                      <div><span className="u-muted">راسبة: </span><b style={{ color: 'var(--bad)' }}>{r.failed}</b></div>
                      <div><span className="u-muted">غير مقروءة: </span><b>{r.pending}</b></div>
                      <div><span className="u-muted">مجموع الدرجات: </span><b>{r.totalScore}</b></div>
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
