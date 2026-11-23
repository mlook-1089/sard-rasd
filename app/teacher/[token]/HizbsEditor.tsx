'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HIZB_PRESETS, juzForHizb } from '@/lib/hizbPresets';

export type TeacherStudentRow = {
  id: number;
  name: string;
  nationalId: string | null;
  parentPhone: string | null;
  committeeId?: number | null;
  status: string;
  hizbsSet: number[];
  mandatoryHizbs: number[];
  hizbsLocked: boolean;
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
  mandatory,
  studentName,
  editingLocked = false,
  compact = false,
  onSaved
}: {
  token: string;
  studentId: number;
  initial: number[];
  mandatory: number[];
  studentName: string;
  editingLocked?: boolean;
  compact?: boolean;
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
    if (mandatory.includes(n)) return;
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
    setSel(new Set(mandatory));
  }

  function togglePreset(hizbs: readonly number[]) {
    if (saving) return;
    setSel((current) => {
      const complete = hizbs.every((n) => current.has(n));
      if (!complete) return new Set([...current, ...hizbs]);
      const next = new Set(current);
      for (const n of hizbs) {
        if (!mandatory.includes(n)) next.delete(n);
      }
      return next;
    });
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
        disabled={editingLocked}
        className={`u-btn ${editingLocked ? 'u-btn-g' : 'u-btn-p'}${compact ? ' sm teacher-hizbs-btn' : ''}`}
        style={{ minHeight: 44, minWidth: 44 }}
        title={editingLocked ? 'تعديل الأحزاب مقفل من الإدارة' : `تحديد أحزاب ${studentName}`}
      >
        <span aria-hidden="true">{editingLocked ? '🔒' : '📚'}</span><span>{editingLocked ? `مقفلة (${savedHizbs.length})` : compact ? `الأحزاب (${savedHizbs.length})` : `تحديد الأحزاب (${savedHizbs.length})`}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 hizb-editor-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`أحزاب ${studentName}`}
          style={{ background: 'var(--overlay)', display: 'grid', placeItems: 'center', padding: 16, overflow: 'hidden' }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="hizb-editor-panel"
            style={{
              background: 'var(--card)',
              borderRadius: 20,
              maxWidth: 760,
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
            <div className="hizb-editor-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div className="u-row u-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="hizb-editor-title">
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>أحزاب {studentName}</h3>
                  <p className="u-muted" style={{ margin: '2px 0 0' }}>الحالي: <b>{savedHizbs.length}</b> · بعد الحفظ: <b>{sel.size}</b></p>
                </div>
                <div className="hizb-editor-toolbar" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    إلغاء تحديد الكل
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
            <div className="hizb-editor-body" style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              <div className="hizb-presets">
                <div className="hizb-presets-title">
                  <div><b>اختيارات سريعة</b><span>اضغط مرة للإضافة ومرة أخرى للإلغاء</span></div>
                </div>
                <div className="hizb-presets-grid">
                  {HIZB_PRESETS.map((preset) => {
                    const complete = preset.hizbs.every((n) => sel.has(n));
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={saving}
                        className={`hizb-preset${complete ? ' complete' : ''}`}
                        onClick={() => togglePreset(preset.hizbs)}
                      >
                        <span>{complete ? '✓' : '+'}</span>
                        <b>{preset.label}</b>
                        <small>الأحزاب {preset.detail}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="hizb-lock-legend" aria-label="مفتاح حالات الأحزاب">
                <span><i className="mandatory" /> إلزامي من الإدارة</span>
                <span><i className="saved" /> مضاف سابقاً</span>
                <span><i className="new" /> إضافة جديدة</span>
                {savedHizbs.some((n) => !mandatory.includes(n) && !sel.has(n)) && <span><i className="remove" /> سيُحذف عند الحفظ</span>}
              </div>
              <div className="th-hizb-grid">
                {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => {
                  const on = sel.has(n);
                  const isMandatory = mandatory.includes(n);
                  const isSaved = savedHizbs.includes(n);
                  const willBeRemoved = isSaved && !isMandatory && !on;
                  const stateClass = isMandatory
                    ? ' locked'
                    : willBeRemoved
                      ? ' removed'
                      : isSaved && on
                        ? ' saved'
                        : on
                          ? ' on'
                          : '';
                  return (
                    <button
                      key={n}
                      onClick={() => toggle(n)}
                      disabled={saving || isMandatory}
                      className={`th-h${stateClass}`}
                      type="button"
                      title={isMandatory ? 'حزب إلزامي مقفل من الإدارة' : willBeRemoved ? 'سيُحذف عند الحفظ' : isSaved ? 'محفوظ سابقاً ويمكن إلغاء اختياره' : undefined}
                    >
                      {isMandatory && <span className="th-h-lock" aria-hidden="true">🔒</span>}
                      {willBeRemoved && <span className="th-h-remove" aria-hidden="true">×</span>}
                      <span className="th-h-num">{n}</span>
                      <span className="th-h-sub">جزء {juzForHizb(n)}</span>
                    </button>
                  );
                })}
              </div>

              {err && (
                <div className="u-note bad" style={{ marginTop: 14, marginBottom: 0 }}>{err}</div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="hizb-editor-footer" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--card)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
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
    <div style={{ maxWidth: 1120, width: '100%', margin: '0 auto', padding: '12px', boxSizing: 'border-box' }} className="u-page">
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
        <div className="u-card-h"><h3>تقرير الحلقة الكامل</h3></div>
        {rows.length === 0 ? (
          <div className="u-empty">لا يوجد طلاب بعد</div>
        ) : (
          <div className="th-rpt-table-wrap teacher-report-table">
            <table className="th-rpt-table">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>المحفوظ</th>
                  <th>الهدف</th>
                  <th>الأخطاء</th>
                  <th>التنبيهات</th>
                  <th>النسبة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
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
                  return (
                    <tr key={r.id}>
                      <td data-label="الطالب"><b>{r.name}</b></td>
                      <td data-label="المحفوظ" style={{ color: 'var(--ok)' }}>{r.memorized}</td>
                      <td data-label="الهدف">{r.target}</td>
                      <td data-label="الأخطاء" style={{ color: 'var(--bad)' }}>{r.errors}</td>
                      <td data-label="التنبيهات" style={{ color: 'var(--warn)' }}>{r.alerts}</td>
                      <td data-label="الإنجاز">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="u-bar light" style={{ minWidth: 60, flex: 1 }}>
                            <i style={{ width: `${r.completion}%` }} />
                          </div>
                          <span className="u-num" style={{ fontWeight: 800 }}>{r.completion}%</span>
                        </div>
                      </td>
                      <td data-label="الإجراء">
                        <div className="teacher-row-actions">
                          <HizbsEditor
                            token={token}
                            studentId={r.id}
                            initial={r.hizbsSet}
                            mandatory={r.mandatoryHizbs}
                            studentName={r.name}
                            editingLocked={r.hizbsLocked}
                            compact
                            onSaved={(newHizbs, newStatus) => handleStudentSaved(r.id, newHizbs, newStatus)}
                          />
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="u-icon-btn u-icon-btn-whatsapp"
                              title={`إرسال تقرير ${r.name} عبر واتساب`}
                              aria-label={`إرسال تقرير ${r.name} عبر واتساب`}
                              style={{ textDecoration: 'none' }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.11 4.9A10.14 10.14 0 0 0 11.9 2a10.08 10.08 0 0 0-8.7 15.17L2 22l4.95-1.17A10.07 10.07 0 0 0 11.9 22a10.08 10.08 0 0 0 7.21-17.1zM11.9 20.14a8.37 8.37 0 0 1-4.27-1.17l-.3-.18-3.1.73.82-3.04-.2-.31a8.37 8.37 0 0 1 7.05-12.83 8.3 8.3 0 0 1 5.9 2.45 8.3 8.3 0 0 1-5.9 14.35zm4.57-6.26c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.56.13s-.65.8-.8.97c-.14.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.1-.5.1-.1.23-.3.34-.44.11-.14.14-.25.21-.42.07-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.44.06-.67.31-.22.25-.87.85-.87 2.07 0 1.22.9 2.4 1.02 2.57.12.17 1.77 2.72 4.3 3.81.6.26 1.07.42 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.14-1.19-.06-.1-.23-.16-.47-.28z"/></svg>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
