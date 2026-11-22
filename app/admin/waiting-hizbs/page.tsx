'use client';
import { useEffect, useMemo, useState } from 'react';

export default function WaitingHizbsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [circleId, setCircleId] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/students').then((r) => r.json()),
      fetch('/api/circles').then((r) => r.json())
    ])
      .then(([a, b]) => {
        setRows((a.rows || []).filter((s: any) => s.status === 'waiting_hizbs'));
        setCircles(b.rows || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (circleId) {
        if (circleId === 'none') {
          if (r.circleId != null) return false;
        } else if (String(r.circleId) !== circleId) {
          return false;
        }
      }
      if (query) {
        const matchName = (r.name || '').toLowerCase().includes(query);
        const matchCircle = (r.circleName || '').toLowerCase().includes(query);
        const matchLevel = (r.level || '').toLowerCase().includes(query);
        if (!matchName && !matchCircle && !matchLevel) return false;
      }
      return true;
    });
  }, [rows, q, circleId]);

  function linkFor(cId: number | null): string | null {
    const c = circles.find((x) => x.id === cId);
    if (!c || !c.linkToken) return null;
    return `${location.origin}/teacher/${c.linkToken}`;
  }

  async function handleCopy(studentId: number, link: string) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard fallback
    }
    setCopiedId(studentId);
    setTimeout(() => {
      setCopiedId((prev) => (prev === studentId ? null : prev));
    }, 2200);
  }

  function clearFilters() {
    setQ('');
    setCircleId('');
  }

  return (
    <div className="u-page">
      <div className="u-top">
        <div>
          <h1>بانتظار الأحزاب</h1>
          <div className="u-sub">الطلاب المسجلون لكن لم يحدد معلم حلقتهم الأحزاب بعد.</div>
        </div>
      </div>

      <div className="u-card">
        <div className="u-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث باسم الطالب..."
            className="u-input"
            style={{ flex: '1 1 200px' }}
          />
          <select
            aria-label="تصفية بالحلقة"
            value={circleId}
            onChange={(e) => setCircleId(e.target.value)}
            className="u-input"
            style={{ flex: '1 1 180px' }}
          >
            <option value="">كل الحلقات</option>
            {circles.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
            <option value="none">بدون حلقة</option>
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="u-btn u-btn-g sm"
          >
            ✕ مسح الفلتر
          </button>
        </div>
      </div>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : rows.length === 0 ? (
        <div className="u-empty">لا يوجد طلاب في هذه الحالة</div>
      ) : filtered.length === 0 ? (
        <div className="u-empty">لا توجد نتائج مطابقة للبحث</div>
      ) : (
        <>
          <style>{`
            .wh-grid {
              display: grid;
              gap: 12px;
              grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            }
            @media (max-width: 768px) {
              .wh-grid {
                grid-template-columns: 1fr !important;
              }
            }
            .wh-card {
              margin-bottom: 0 !important;
              min-width: 0;
              overflow: hidden;
            }
            .wh-card .u-name,
            .wh-card .u-muted,
            .wh-card .u-pill {
              word-break: normal !important;
              overflow-wrap: break-word;
              white-space: normal;
            }
          `}</style>
          <div className="wh-grid">
            {filtered.map((r) => {
              const link = linkFor(r.circleId);
              const isCopied = copiedId === r.id;
              return (
                <div key={r.id} className="u-card wh-card">
                  <div className="u-row" style={{ minWidth: 0, alignItems: 'center' }}>
                    <div className="u-avatar" style={{ flexShrink: 0 }}>{r.name?.[0] || '؟'}</div>
                    <div className="u-grow" style={{ minWidth: 0 }}>
                      <div className="u-name">{r.name}</div>
                      <div className="u-muted">{r.circleName || 'بدون حلقة'}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {link ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(r.id, link)}
                          className={`u-btn ${isCopied ? 'u-btn-ok' : 'u-btn-p'} sm`}
                        >
                          {isCopied ? 'تم النسخ ✓' : 'نسخ رابط المعلم'}
                        </button>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="u-btn u-btn-g sm"
                          style={{ textDecoration: 'none' }}
                        >
                          فتح
                        </a>
                      </>
                    ) : (
                      <span className="u-pill bad">لا يوجد رابط — افتح "الحلقات والمعلمون"</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
