'use client';
import { useEffect, useMemo, useState } from 'react';

export default function WaitingCommitteePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [committeeId, setCommitteeId] = useState('');
  const [circleId, setCircleId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        fetch('/api/students').then((r) => r.json()),
        fetch('/api/committees').then((r) => r.json()),
        fetch('/api/circles').then((r) => r.json()).catch(() => ({ rows: [] }))
      ]);
      setRows((a.rows || []).filter((s: any) => s.status === 'waiting_committee'));
      setCommittees(b.rows || []);
      setCircles(c.rows || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

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

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map((r: any) => r.id)));
  }

  function clearFilters() {
    setQ('');
    setCircleId('');
  }

  async function assign() {
    if (!committeeId || selected.size === 0 || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/students/assign-committee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selected), committeeId: Number(committeeId) })
      });
      if (res.ok) {
        setSelected(new Set());
        setCommitteeId('');
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || `فشل تعيين اللجنة (HTTP ${res.status})`);
        setTimeout(() => setErrorMsg(null), 4000);
      }
    } catch {
      setErrorMsg('خطأ في الاتصال بالخادم');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="u-page">
      <div className="u-top"><div><h1>بانتظار اللجنة</h1></div></div>

      {errorMsg && (
        <div role="alert" className="u-note bad" style={{ position: 'sticky', top: 8, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}>
          ⚠ {errorMsg}
        </div>
      )}

      <div className="u-card">
        <div className="u-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
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
            style={{ flex: '1 1 170px' }}
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
          <button
            type="button"
            onClick={toggleAll}
            disabled={filtered.length === 0}
            className="u-btn u-btn-g sm"
          >
            {selected.size === filtered.length && filtered.length > 0 ? 'إلغاء التحديد' : 'تحديد الكل'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : rows.length === 0 ? (
        <div className="u-empty">لا يوجد طلاب بانتظار اللجنة</div>
      ) : filtered.length === 0 ? (
        <div className="u-empty">لا توجد نتائج مطابقة للبحث</div>
      ) : (
        <>
          <style>{`
            @media (max-width: 768px) {
              .wc-grid.u-grid3 {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
          <div className="u-grid3 wc-grid">
            {filtered.map((r) => {
              const sel = selected.has(r.id);
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className="u-card"
                  style={{
                    textAlign: 'right',
                    borderWidth: 2,
                    borderColor: sel ? 'var(--brand)' : 'var(--line)',
                    background: sel ? 'var(--brand-soft)' : 'var(--card)',
                    margin: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    minWidth: 0
                  }}
                >
                  <div className="u-name" style={{ wordBreak: 'normal', overflowWrap: 'break-word' }}>{r.name}</div>
                  <div className="u-muted">{r.level || '—'} · {r.circleName || 'بدون حلقة'}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected.size > 0 && (
        <div className="u-sticky" style={{ position: 'fixed', bottom: 100, insetInline: 16, zIndex: 40, display: 'flex', justifyContent: 'center' }}>
          <div className="u-card" style={{ margin: 0, boxShadow: 'var(--shadow-lg)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'var(--ink)', color: 'var(--card)', border: 'none' }}>
            <span style={{ fontWeight: 700 }}>المحددون: <span className="u-num">{selected.size}</span></span>
            <select
              value={committeeId}
              onChange={(e) => setCommitteeId(e.target.value)}
              className="u-input"
              style={{ minWidth: 180 }}
              disabled={saving}
            >
              <option value="">اختر لجنة</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              type="button"
              disabled={!committeeId || saving}
              onClick={assign}
              className="u-btn u-btn-ok"
            >
              {saving ? 'جاري الحفظ...' : 'تعيين اللجنة'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
