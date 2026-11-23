'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type SortKey = 'startedAt' | 'studentName' | 'hizbNumber' | 'reciterName' | 'errors' | 'alerts' | 'score';
type SortDir = 'asc' | 'desc';

export default function SupSessions() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  async function load() {
    setLoading(true);
    try {
      const d = await fetch('/api/sessions').then((r) => r.json());
      setRows(d.rows || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!query) return true;
      return [r.studentName, r.reciterName, String(r.hizbNumber)].some((x) =>
        (x || '').toString().toLowerCase().includes(query)
      );
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'startedAt') {
        cmp = new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime();
      } else if (sortKey === 'studentName' || sortKey === 'reciterName') {
        cmp = (a[sortKey] || '').toString().localeCompare((b[sortKey] || '').toString(), 'ar');
      } else {
        const av = Number(a[sortKey] ?? -1);
        const bv = Number(b[sortKey] ?? -1);
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, q, sortKey, sortDir]);

  return (
    <div className="u-page">
      <div className="u-top" style={{ flexWrap: 'wrap', gap: 8, rowGap: 8 }}>
        <div><h1>سجل اللجنة</h1></div>
        <div className="u-actions" style={{ marginTop: 0 }}>
          <a href="/api/reports/sessions" className="u-btn u-btn-ok sm">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"/></svg>
            <span>تصدير إكسل</span>
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 540px) {
          .u-page > .u-top { flex-direction: column; align-items: stretch; }
          .u-page > .u-top .u-actions { margin-top: 8px; }
        }
        .sup-sess-desktop { display: block; }
        .sup-sess-mobile { display: none; }
        @media (max-width: 768px) {
          .sup-sess-desktop { display: none !important; }
          .sup-sess-mobile { display: flex !important; flex-direction: column; gap: 12px; }
        }
        .sup-sess-th {
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .sup-sess-th:hover {
          color: var(--brand);
        }
      `}</style>

      <div className="u-note warn">⚠ تعديل أو حذف أي سجل يُعيد حساب الدرجة. تأكد قبل الحفظ.</div>

      {err && (
        <div
          role="alert"
          className="u-note bad"
          style={{ position: 'sticky', top: 8, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}
        >
          ⚠ {err}
        </div>
      )}

      <div className="u-card">
        <div className="u-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="u-search" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم الطالب أو المسمع أو الحزب..." />
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
        <div className="u-card"><div className="u-empty">...جاري التحميل</div></div>
      ) : rows.length === 0 ? (
        <div className="u-card"><div className="u-empty">لا توجد سجلات</div></div>
      ) : filtered.length === 0 ? (
        <div className="u-card"><div className="u-empty">لا توجد نتائج مطابقة للبحث</div></div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="u-card sup-sess-desktop">
            <div className="th-rpt-table-wrap">
              <table className="th-rpt-table">
                <thead>
                  <tr>
                    <th className="sup-sess-th" onClick={() => toggleSort('startedAt')}>التاريخ{sortIcon('startedAt')}</th>
                    <th className="sup-sess-th" onClick={() => toggleSort('studentName')}>الطالب{sortIcon('studentName')}</th>
                    <th className="sup-sess-th" onClick={() => toggleSort('hizbNumber')}>الحزب{sortIcon('hizbNumber')}</th>
                    <th className="sup-sess-th" onClick={() => toggleSort('reciterName')}>المسمع{sortIcon('reciterName')}</th>
                    <th className="sup-sess-th" onClick={() => toggleSort('errors')}>الأخطاء{sortIcon('errors')}</th>
                    <th className="sup-sess-th" onClick={() => toggleSort('alerts')}>التنبيهات{sortIcon('alerts')}</th>
                    <th className="sup-sess-th" onClick={() => toggleSort('score')}>الدرجة{sortIcon('score')}</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.startedAt).toLocaleDateString('ar')}</td>
                      <td><b>{r.studentName}</b></td>
                      <td>{r.hizbNumber}</td>
                      <td>{r.reciterName}</td>
                      <td style={{ color: 'var(--bad)' }}>{r.errors}</td>
                      <td style={{ color: 'var(--warn)' }}>{r.alerts}</td>
                      <td>
                        {r.score != null ? (
                          <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>{r.score}</span>
                        ) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button type="button" onClick={() => setEditing(r)} className="u-icon-btn u-icon-btn-info" title="تعديل" aria-label="تعديل">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M4 20h4L19 9a2.5 2.5 0 00-3.536-3.536L4 16v4z"/></svg>
                          </button>
                          <button type="button" onClick={() => setDeleting(r)} className="u-icon-btn u-icon-btn-bad" title="حذف" aria-label="حذف">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="sup-sess-mobile">
            {filtered.map((r) => (
              <div key={r.id} className="u-card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="u-name" style={{ wordBreak: 'normal', overflowWrap: 'break-word' }}>{r.studentName}</div>
                    <div className="u-muted" style={{ fontSize: 12 }}>
                      {new Date(r.startedAt).toLocaleDateString('ar')} · المسمع: {r.reciterName || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="u-pill brand">الحزب {r.hizbNumber}</span>
                    {r.score != null ? (
                      <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>الدرجة: {r.score}</span>
                    ) : (
                      <span className="u-pill">—</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 12 }}>
                  <span style={{ color: 'var(--bad)' }}>الأخطاء: <b>{r.errors}</b></span>
                  <span style={{ color: 'var(--warn)' }}>التنبيهات: <b>{r.alerts}</b></span>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditing(r)} className="u-icon-btn u-icon-btn-info" title="تعديل" aria-label="تعديل">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M4 20h4L19 9a2.5 2.5 0 00-3.536-3.536L4 16v4z"/></svg>
                  </button>
                  <button type="button" onClick={() => setDeleting(r)} className="u-icon-btn u-icon-btn-bad" title="حذف" aria-label="حذف">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <EditRecordModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onError={(m) => { setErr(m); setTimeout(() => setErr(null), 3200); }}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          row={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); load(); }}
          onError={(m) => { setErr(m); setTimeout(() => setErr(null), 3200); }}
        />
      )}
    </div>
  );
}

function DeleteConfirmModal({ row, onClose, onDeleted, onError }: {
  row: any;
  onClose: () => void;
  onDeleted: () => void;
  onError: (m: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function confirmDelete() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error || `فشل الحذف (HTTP ${res.status})`);
        setSaving(false);
        return;
      }
      onDeleted();
    } catch {
      onError('خطأ في الاتصال بالخادم');
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="del-modal-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'var(--overlay)' }}
    >
      <div className="u-card" style={{ margin: 0, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column' }}>
        <div className="u-card-h" style={{ marginBottom: 10 }}>
          <h3 id="del-modal-title">تأكيد حذف السجل</h3>
          <button type="button" onClick={onClose} disabled={saving} className="u-icon-btn" aria-label="إغلاق">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ marginBottom: 16, lineHeight: 1.6 }}>
          هل أنت متأكد من حذف سجل التسميع للطالب <b>{row.studentName}</b> (الحزب <b>{row.hizbNumber}</b>)؟
          <div className="u-muted" style={{ marginTop: 4 }}>لا يمكن التراجع عن هذا الإجراء.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onClose} className="u-btn u-btn-g" disabled={saving}>
            إلغاء
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={confirmDelete}
            className="u-btn u-btn-bad"
            disabled={saving}
            autoFocus
          >
            {saving ? 'جاري الحفظ...' : 'تأكيد الحذف'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditRecordModal({ row, onClose, onSaved, onError }: {
  row: any;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [errors, setErrors] = useState<string>(String(row.errors ?? 0));
  const [alerts, setAlerts] = useState<string>(String(row.alerts ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  function clamp(s: string) {
    const n = Math.floor(Number(s));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${row.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'edit', errors: clamp(errors), alerts: clamp(alerts) })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error || `فشل الحفظ (HTTP ${res.status})`);
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      onError('خطأ في الاتصال بالخادم');
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'var(--overlay)' }}
    >
      <div className="u-card" style={{ margin: 0, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="u-card-h" style={{ marginBottom: 10 }}>
          <h3>تعديل الأخطاء والتنبيهات</h3>
          <button type="button" onClick={onClose} disabled={saving} className="u-icon-btn" aria-label="إغلاق">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div className="u-muted" style={{ marginBottom: 10 }}>الطالب: <b>{row.studentName}</b> · الحزب <b>{row.hizbNumber}</b></div>
          <div className="u-field">
            <label>عدد الأخطاء</label>
            <input type="number" min={0} step={1} value={errors} onChange={(e) => setErrors(e.target.value)} className="u-input" autoFocus disabled={saving} />
          </div>
          <div className="u-field">
            <label>عدد التنبيهات</label>
            <input type="number" min={0} step={1} value={alerts} onChange={(e) => setAlerts(e.target.value)} className="u-input" disabled={saving} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onClose} className="u-btn u-btn-g" disabled={saving}>إلغاء</button>
          <button type="button" onClick={save} className="u-btn u-btn-p" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
