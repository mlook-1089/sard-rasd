'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('ar'); } catch { return iso; }
}
function fmtDur(sec: number | null) {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}د ${s}ث`;
}

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

function buildSessionWhatsAppMessage(r: any): string {
  const statusText =
    r.passed === true ? 'ناجح ✅' : r.passed === false ? 'راسب ❌' : 'جارية / غير مكتملة';
  const lines = [
    'السلام عليكم ورحمة الله',
    `تقرير تسميع الطالب: ${r.studentName || '—'}`,
    `الحزب: ${r.hizbNumber ?? '—'}`,
    `الدرجة: ${r.score != null ? r.score : '—'} (${statusText})`,
    `الأخطاء: ${r.errors ?? 0} | التنبيهات: ${r.alerts ?? 0}`
  ];
  if (r.reciterName) lines.push(`المسمع: ${r.reciterName}`);
  if (r.committeeName) lines.push(`اللجنة: ${r.committeeName}`);
  return lines.join('\n');
}

type SortKey =
  | 'startedAt'
  | 'studentName'
  | 'hizbNumber'
  | 'reciterName'
  | 'committeeName'
  | 'errors'
  | 'alerts'
  | 'score'
  | 'durationSeconds';

export default function SessionsLogPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [phoneMap, setPhoneMap] = useState<Record<number, string>>({});
  const [q, setQ] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('startedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDeleting, setConfirmDeleting] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [sessRes, studRes] = await Promise.all([
        fetch('/api/sessions').then((r) => r.json()).catch(() => ({ rows: [] })),
        fetch('/api/students').then((r) => (r.ok ? r.json() : { rows: [] })).catch(() => ({ rows: [] }))
      ]);
      setRows(sessRes.rows || []);
      const map: Record<number, string> = {};
      const studs = studRes.rows || studRes.students || (Array.isArray(studRes) ? studRes : []);
      for (const s of studs) {
        if (s && s.id != null && s.parentPhone) {
          map[Number(s.id)] = String(s.parentPhone);
        }
      }
      setPhoneMap(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const committeesList = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.committeeName && String(r.committeeName).trim()) {
        s.add(String(r.committeeName).trim());
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'studentName' || key === 'reciterName' || key === 'committeeName' ? 'asc' : 'desc');
    }
  }

  function clearFilters() {
    setQ('');
    setCommitteeFilter('');
    setStatusFilter('all');
    setSortKey('startedAt');
    setSortDir('desc');
  }

  const filteredAndSorted = useMemo(() => {
    const query = q.trim();
    const list = rows.filter((r) => {
      if (query) {
        const hit = [r.studentName, r.reciterName, r.committeeName, String(r.hizbNumber ?? '')]
          .some((x) => String(x || '').includes(query));
        if (!hit) return false;
      }
      if (committeeFilter && (r.committeeName || '') !== committeeFilter) {
        return false;
      }
      if (statusFilter === 'passed' && !(r.passed === true && !r.cancelled)) return false;
      if (statusFilter === 'failed' && !(r.passed === false && !r.cancelled)) return false;
      if (statusFilter === 'ongoing' && !(r.passed == null || r.cancelled)) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'startedAt') {
        const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return (ta - tb) * dir || ((a.id ?? 0) - (b.id ?? 0)) * dir;
      }
      if (sortKey === 'studentName' || sortKey === 'reciterName' || sortKey === 'committeeName') {
        const sa = String(a[sortKey] || '');
        const sb = String(b[sortKey] || '');
        return sa.localeCompare(sb, 'ar') * dir;
      }
      const na = Number(a[sortKey] ?? -1);
      const nb = Number(b[sortKey] ?? -1);
      return (na - nb) * dir;
    });
  }, [rows, q, committeeFilter, statusFilter, sortKey, sortDir]);

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span style={{ opacity: 0.35, marginInlineStart: 4, fontSize: 11 }}>⇅</span>;
    return <span style={{ marginInlineStart: 4, fontSize: 11 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  return (
    <div className="u-page">
      <div className="u-top" style={{ flexWrap: 'wrap', gap: 8, rowGap: 8 }}>
        <div><h1>سجل الرصد الشامل</h1></div>
        <div className="u-actions" style={{ marginTop: 0 }}>
          <a href="/api/reports/sessions" className="u-btn u-btn-ok sm" style={{ textDecoration: 'none' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"/></svg><span>تصدير إكسل</span>
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 540px) {
          .u-page > .u-top { flex-direction: column; align-items: stretch; }
          .u-page > .u-top .u-actions { margin-top: 8px; }
        }
        .sess-th-btn {
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .sess-th-btn:hover {
          background: rgba(15, 118, 110, 0.08);
        }
        .sess-mobile-list {
          display: none;
        }
        @media (max-width: 767px) {
          .sess-desktop-table {
            display: none !important;
          }
          .sess-mobile-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>

      {err && <div className="u-note bad" style={{ position: 'sticky', top: 8, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}>⚠ {err}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div className="u-search" style={{ flex: '1 1 220px', marginBottom: 0 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم / الحزب / المسمع / اللجنة..."
          />
        </div>

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

        <select
          className="u-select"
          style={{ width: 'auto', minWidth: 150 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="فلتر النتيجة"
        >
          <option value="all">الكل (جميع النتائج)</option>
          <option value="passed">ناجح</option>
          <option value="failed">راسب</option>
          <option value="ongoing">جارية / غير مكتملة</option>
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
          <div className="u-empty">لا توجد سجلات</div>
        ) : (
          <>
            <div className="th-rpt-table-wrap sess-desktop-table">
              <table className="th-rpt-table">
                <thead>
                  <tr>
                    <th className="sess-th-btn" onClick={() => toggleSort('startedAt')}>التاريخ{sortIcon('startedAt')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('studentName')}>الطالب{sortIcon('studentName')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('hizbNumber')}>الحزب{sortIcon('hizbNumber')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('reciterName')}>المسمع{sortIcon('reciterName')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('committeeName')}>اللجنة{sortIcon('committeeName')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('errors')}>الأخطاء{sortIcon('errors')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('alerts')}>التنبيهات{sortIcon('alerts')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('score')}>الدرجة{sortIcon('score')}</th>
                    <th className="sess-th-btn" onClick={() => toggleSort('durationSeconds')}>المدة{sortIcon('durationSeconds')}</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((r) => {
                    const phone = r.parentPhone || phoneMap[Number(r.studentId)] || '';
                    const waHref = buildWhatsAppUrl(phone, buildSessionWhatsAppMessage(r));
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.startedAt)}</td>
                        <td><b>{r.studentName}</b></td>
                        <td>{r.hizbNumber}</td>
                        <td>{r.reciterName}</td>
                        <td>{r.committeeName || '—'}</td>
                        <td style={{ color: 'var(--bad)' }}>{r.errors}</td>
                        <td style={{ color: 'var(--warn)' }}>{r.alerts}</td>
                        <td>
                          {r.score != null ? (
                            <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>{r.score}</span>
                          ) : (
                            <span className="u-pill">جارية</span>
                          )}
                        </td>
                        <td>{fmtDur(r.durationSeconds)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="u-btn u-btn-ok sm"
                              style={{ textDecoration: 'none' }}
                              title="إرسال التقرير عبر واتساب"
                            >
                              📱 واتساب
                            </a>
                            <button onClick={() => setEditing(r)} className="u-btn u-btn-s sm">تعديل</button>
                            <button onClick={() => setConfirmDeleting(r)} className="u-btn u-btn-bad sm">حذف</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sess-mobile-list">
              {filteredAndSorted.map((r) => {
                const phone = r.parentPhone || phoneMap[Number(r.studentId)] || '';
                const waHref = buildWhatsAppUrl(phone, buildSessionWhatsAppMessage(r));
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
                        <b style={{ fontSize: 15 }}>{r.studentName}</b>
                        <div className="u-muted" style={{ fontSize: 12 }}>{fmtDate(r.startedAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="u-pill brand">حزب {r.hizbNumber}</span>
                        {r.score != null ? (
                          <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>{r.score}</span>
                        ) : (
                          <span className="u-pill">جارية</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 13, marginBottom: 10 }}>
                      <div><span className="u-muted">المسمع: </span><b>{r.reciterName || '—'}</b></div>
                      <div><span className="u-muted">اللجنة: </span><b>{r.committeeName || '—'}</b></div>
                      <div><span className="u-muted">الأخطاء: </span><b style={{ color: 'var(--bad)' }}>{r.errors}</b></div>
                      <div><span className="u-muted">التنبيهات: </span><b style={{ color: 'var(--warn)' }}>{r.alerts}</b></div>
                      <div><span className="u-muted">المدة: </span><b>{fmtDur(r.durationSeconds)}</b></div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="u-btn u-btn-ok sm"
                        style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
                      >
                        📱 واتساب
                      </a>
                      <button
                        onClick={() => setEditing(r)}
                        className="u-btn u-btn-s sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => setConfirmDeleting(r)}
                        className="u-btn u-btn-bad sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {editing && (
        <EditRecordModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onError={(m) => { setErr(m); setTimeout(() => setErr(null), 3200); }}
        />
      )}

      {confirmDeleting && (
        <ConfirmDeleteModal
          row={confirmDeleting}
          onClose={() => setConfirmDeleting(null)}
          onDeleted={() => { setConfirmDeleting(null); load(); }}
          onError={(m) => { setErr(m); setTimeout(() => setErr(null), 3200); }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteModal({ row, onClose, onDeleted, onError }: {
  row: any;
  onClose: () => void;
  onDeleted: () => void;
  onError: (m: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, deleting]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error || `فشل الحذف (HTTP ${res.status})`);
        setDeleting(false);
        return;
      }
      onDeleted();
    } catch {
      onError('خطأ في الاتصال بالخادم');
      setDeleting(false);
    }
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && !deleting && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'var(--overlay)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="u-card" style={{ margin: 0, width: '100%', maxWidth: 400 }}>
        <div className="u-card-h" style={{ marginBottom: 10 }}>
          <h3>تأكيد حذف السجل</h3>
          <button onClick={onClose} className="u-icon-btn" aria-label="إغلاق" disabled={deleting}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
          هل أنت متأكد من حذف سجل تسميع الطالب <b>{row.studentName}</b> (الحزب <b>{row.hizbNumber}</b>)؟
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <button ref={cancelBtnRef} onClick={onClose} className="u-btn u-btn-g" disabled={deleting} autoFocus>
            إلغاء
          </button>
          <button onClick={confirmDelete} className="u-btn u-btn-bad" disabled={deleting}>
            {deleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
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
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  function clamp(s: string) {
    const n = Math.floor(Number(s));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  async function save() {
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
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'var(--overlay)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="u-card" style={{ margin: 0, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="u-card-h" style={{ marginBottom: 10 }}>
          <h3>تعديل الأخطاء والتنبيهات</h3>
          <button onClick={onClose} className="u-icon-btn" aria-label="إغلاق" disabled={saving}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div className="u-muted" style={{ marginBottom: 10 }}>الطالب: <b>{row.studentName}</b> · الحزب <b>{row.hizbNumber}</b></div>
          <div className="u-field">
            <label>عدد الأخطاء</label>
            <input ref={firstInputRef} type="number" min={0} step={1} value={errors} onChange={(e) => setErrors(e.target.value)} className="u-input" autoFocus />
          </div>
          <div className="u-field">
            <label>عدد التنبيهات</label>
            <input type="number" min={0} step={1} value={alerts} onChange={(e) => setAlerts(e.target.value)} className="u-input" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <button onClick={onClose} className="u-btn u-btn-g" disabled={saving}>إلغاء</button>
          <button onClick={save} className="u-btn u-btn-p" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
