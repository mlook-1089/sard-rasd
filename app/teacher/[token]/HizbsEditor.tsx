'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type TeacherStudentRow = {
  id: number;
  name: string;
  nationalId: string | null;
  parentPhone: string | null;
  committeeId?: number | null;
  status: string;
  hizbsSet: number[];
  target: number;
  memorized: number;
  errors: number;
  alerts: number;
  completion: number;
};

function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '966' + d.slice(1);
  return d;
}

function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function HizbsEditor({
  token,
  studentId,
  initial,
  studentName,
  onSaved
}: {
  token: string;
  studentId: number;
  initial: number[];
  studentName: string;
  onSaved?: (newHizbs: number[], newStatus?: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [savedHizbs, setSavedHizbs] = useState<number[]>(initial);
  const [sel, setSel] = useState<Set<number>>(new Set(initial));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSavedHizbs(initial);
    setSel(new Set(initial));
  }, [initial]);

  function openModal() {
    setSel(new Set(savedHizbs));
    setErr(null);
    setOpen(true);
  }

  function toggle(n: number) {
    if (saving) return;
    const next = new Set(sel);
    if (next.has(n)) next.delete(n); else next.add(n);
    setSel(next);
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving]);

  function selectAll() {
    if (saving) return;
    setSel(new Set(Array.from({ length: 60 }, (_, i) => i + 1)));
  }

  function clearAll() {
    if (saving) return;
    setSel(new Set());
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    const chosen = Array.from(sel).sort((a, b) => a - b);
    try {
      const res = await fetch(`/api/teacher/${token}/students/${studentId}/hizbs`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ hizbs: chosen })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || 'فشل الحفظ');
      }
      const nextHizbs: number[] = Array.isArray(d.hizbs) ? d.hizbs : chosen;
      setSavedHizbs(nextHizbs);
      setSel(new Set(nextHizbs));
      onSaved?.(nextHizbs, d.status);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="u-btn u-btn-p"
        style={{ minHeight: 44, minWidth: 44 }}
      >
        <span>📚</span><span>تحديد الأحزاب ({savedHizbs.length})</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={`أحزاب ${studentName}`}
          style={{ background: 'var(--overlay)', display: 'grid', placeItems: 'center', padding: 16, overflow: 'hidden' }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 20,
              maxWidth: 560,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div className="u-row u-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>أحزاب {studentName}</h3>
                  <p className="u-muted" style={{ margin: '2px 0 0' }}>المختار: <b>{sel.size}</b> / 60</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={saving}
                    className="u-btn u-btn-s"
                    style={{ minHeight: 44, minWidth: 44, padding: '0 12px' }}
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={saving}
                    className="u-btn u-btn-g"
                    style={{ minHeight: 44, minWidth: 44, padding: '0 12px' }}
                  >
                    إلغاء الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => !saving && setOpen(false)}
                    disabled={saving}
                    aria-label="إغلاق"
                    className="u-icon-btn"
                    style={{ minHeight: 44, minWidth: 44, width: 44, height: 44 }}
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              <div className="th-hizb-grid">
                {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => {
                  const on = sel.has(n);
                  return (
                    <button
                      key={n}
                      onClick={() => toggle(n)}
                      disabled={saving}
                      className={`th-h${on ? ' on' : ''}`}
                      type="button"
                    >
                      <span className="th-h-num">{n}</span>
                    </button>
                  );
                })}
              </div>

              {err && (
                <div className="u-note bad" style={{ marginTop: 14, marginBottom: 0 }}>{err}</div>
              )}
            </div>

            {/* Sticky footer */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--card)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => !saving && setOpen(false)}
                disabled={saving}
                className="u-btn u-btn-g"
                style={{ minHeight: 44, minWidth: 72 }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="u-btn u-btn-p"
                style={{ minHeight: 44, minWidth: 96 }}
              >
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function TeacherPortalClient({
  token,
  circleName,
  teacherName,
  waTemplate,
  initialRows
}: {
  token: string;
  circleName: string;
  teacherName: string | null;
  waTemplate: string;
  initialRows: TeacherStudentRow[];
}) {
  const [rows, setRows] = useState<TeacherStudentRow[]>(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  function handleStudentSaved(studentId: number, newHizbs: number[], newStatus?: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== studentId) return r;
        const target = newHizbs.length;
        const completion = target > 0 ? Math.round((r.memorized / target) * 100) : 0;
        const status =
          newStatus ??
          (target === 0
            ? 'waiting_hizbs'
            : r.committeeId
              ? 'active'
              : r.status === 'active'
                ? 'active'
                : 'waiting_committee');
        return {
          ...r,
          hizbsSet: newHizbs,
          target,
          completion,
          status
        };
      })
    );
  }

  const totalTarget = rows.reduce((a, r) => a + r.target, 0);
  const totalMem = rows.reduce((a, r) => a + r.memorized, 0);
  const avgCompletion = rows.length > 0
    ? Math.round(rows.reduce((a, r) => a + r.completion, 0) / rows.length)
    : 0;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px' }} className="u-page">
      <div className="u-hero">
        <div className="l">السلام عليكم ورحمة الله</div>
        <div className="big">
          {teacherName ? `أهلاً ${teacherName}` : 'أهلاً بك'}
        </div>
        <div className="meta">
          <span>حلقة <b>{circleName}</b></span>
        </div>
      </div>

      <div className="u-grid3">
        <div className="u-stat">
          <div className="l">عدد الطلاب</div>
          <div className="v">{rows.length}</div>
        </div>
        <div className="u-stat">
          <div className="l">المحفوظ / الهدف</div>
          <div className="v sm"><span className="u-num">{totalMem}</span> / <span className="u-num">{totalTarget}</span></div>
        </div>
        <div className="u-stat">
          <div className="l">متوسط الإنجاز</div>
          <div className="v" style={{ color: 'var(--ok)' }}>{avgCompletion}%</div>
        </div>
      </div>

      <div className="u-card">
        <div className="u-card-h"><h3>طلاب الحلقة</h3></div>
        {rows.length === 0 ? (
          <div className="u-empty">لا يوجد طلاب في حلقتك بعد.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {rows.map((r) => {
              const wa = waNumber(r.parentPhone);
              const waText = fillTemplate(waTemplate, {
                name: r.name,
                memorized: r.memorized,
                hizbs: r.target,
                errors: r.errors,
                alerts: r.alerts,
                completion: r.completion
              });
              const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(waText)}` : null;
              const pillClass =
                r.status === 'active' ? 'u-pill ok' :
                r.status === 'waiting_committee' ? 'u-pill warn' :
                'u-pill mute';
              const pillLabel =
                r.status === 'active' ? 'نشط' :
                r.status === 'waiting_committee' ? 'بانتظار اللجنة' :
                'بانتظار الأحزاب';

              return (
                <div key={r.id} className="u-card" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="u-name">{r.name}</div>
                      {r.nationalId && <div className="u-muted" dir="ltr">{r.nationalId}</div>}
                      {r.parentPhone && <div className="u-muted" dir="ltr">{r.parentPhone}</div>}
                    </div>
                    <span className={pillClass}>{pillLabel}</span>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink2)', marginBottom: 4 }}>
                      <span>المحفوظ: {r.memorized} / {r.target}</span>
                      <span className="u-num" style={{ fontWeight: 800 }}>{r.completion}%</span>
                    </div>
                    <div className="u-bar light"><i style={{ width: `${r.completion}%` }} /></div>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="u-pill bad">أخطاء: {r.errors}</span>
                    <span className="u-pill gold">تنبيهات: {r.alerts}</span>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <HizbsEditor
                      token={token}
                      studentId={r.id}
                      initial={r.hizbsSet}
                      studentName={r.name}
                      onSaved={(newHizbs, newStatus) => handleStudentSaved(r.id, newHizbs, newStatus)}
                    />
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="u-btn u-btn-ok"
                        style={{ textDecoration: 'none', minHeight: 44, minWidth: 44 }}
                      >
                        <span>📱</span><span>واتساب</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="u-card">
        <div className="u-card-h"><h3>تقرير الحلقة الكامل</h3></div>
        {rows.length === 0 ? (
          <div className="u-empty">لا يوجد طلاب بعد</div>
        ) : (
          <div className="th-rpt-table-wrap">
            <table className="th-rpt-table">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>المحفوظ</th>
                  <th>الهدف</th>
                  <th>الأخطاء</th>
                  <th>التنبيهات</th>
                  <th>النسبة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td>
                    <td style={{ color: 'var(--ok)' }}>{r.memorized}</td>
                    <td>{r.target}</td>
                    <td style={{ color: 'var(--bad)' }}>{r.errors}</td>
                    <td style={{ color: 'var(--warn)' }}>{r.alerts}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="u-bar light" style={{ minWidth: 60, flex: 1 }}>
                          <i style={{ width: `${r.completion}%` }} />
                        </div>
                        <span className="u-num" style={{ fontWeight: 800 }}>{r.completion}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
