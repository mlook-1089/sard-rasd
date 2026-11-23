'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type Row = {
  id: number;
  name: string;
  nationalId: string | null;
  parentPhone: string | null;
  level: string | null;
  status: string;
  circleId: number | null;
  committeeId: number | null;
  circleName: string | null;
  committeeName: string | null;
  hizbs?: number[];
  hizbsCount?: number;
  completedHizbs?: number[];
  memorizedCount?: number;
  memorized?: number;
  errors?: number;
  alerts?: number;
  completion?: number;
};

type SortKey = 'name' | 'level' | 'circleName' | 'committeeName' | 'hizbs' | 'status';

type ConfirmAction =
  | { kind: 'delete'; student: Row }
  | { kind: 'bulk-password'; mode: 'numeric' | 'strong' };

const STATUS_PILL: Record<string, { label: string; variant: string }> = {
  waiting_hizbs: { label: 'بانتظار الأحزاب', variant: 'warn' },
  waiting_committee: { label: 'بانتظار اللجنة', variant: 'info' },
  active: { label: 'نشط', variant: 'ok' }
};

const DEFAULT_WA_TEMPLATE =
  'السلام عليكم ورحمة الله\nتقرير الطالب {name}\nالمحفوظ: {memorized} / {hizbs}\nالأخطاء: {errors} | التنبيهات: {alerts}\nنسبة الإنجاز: {completion}%';

function formatSaudiPhone(raw: string): string {
  const ascii = (raw || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  let digits = ascii.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('9660') && digits.length === 13) {
    digits = '966' + digits.slice(4);
  } else if (digits.startsWith('05') && digits.length === 10) {
    digits = '966' + digits.slice(1);
  } else if (digits.startsWith('5') && digits.length === 9) {
    digits = '966' + digits;
  } else if (digits.startsWith('0') && digits.length > 9) {
    digits = '966' + digits.slice(1);
  }
  return digits;
}

function buildWhatsAppUrl(student: Row, template: string): string {
  const phone = formatSaudiPhone(student.parentPhone || '');
  const hizbsCount = Array.isArray(student.hizbs) ? student.hizbs.length : (student.hizbsCount ?? 0);
  const memorizedCount = student.memorizedCount ?? student.memorized ?? 0;
  const errors = student.errors ?? 0;
  const alerts = student.alerts ?? 0;
  const completion =
    student.completion ?? (hizbsCount > 0 ? Math.min(100, Math.round((memorizedCount / hizbsCount) * 100)) : 0);
  const text = (template || DEFAULT_WA_TEMPLATE)
    .replace(/\{name\}/g, student.name || '')
    .replace(/\{memorized\}/g, String(memorizedCount))
    .replace(/\{hizbs\}/g, String(hizbsCount))
    .replace(/\{errors\}/g, String(errors))
    .replace(/\{alerts\}/g, String(alerts))
    .replace(/\{completion\}/g, String(completion));
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export default function StudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(DEFAULT_WA_TEMPLATE);

  const [q, setQ] = useState('');
  const [circleFilter, setCircleFilter] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [editing, setEditing] = useState<Row | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [pwOutput, setPwOutput] = useState<null | { id: number; name: string; password: string }[]>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        fetch('/api/students', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/circles', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/committees', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}))
      ]);
      setRows(r1.rows || []);
      setCircles(r2.rows || []);
      setCommittees(r3.rows || []);
      const tpl = r4?.settings?.whatsappTemplate || r4?.whatsappTemplate;
      if (tpl) setWhatsappTemplate(tpl);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const distinctLevels = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.level && r.level.trim()) s.add(r.level.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows]);

  function clearFilters() {
    setQ('');
    setCircleFilter('');
    setCommitteeFilter('');
    setStatusFilter('');
    setLevelFilter('');
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filteredAndSorted = useMemo(() => {
    const search = q.trim();
    const list = rows.filter(
      (r) =>
        (!search ||
          r.name.includes(search) ||
          (r.nationalId || '').includes(search) ||
          (r.parentPhone || '').includes(search)) &&
        (!circleFilter || String(r.circleId) === circleFilter) &&
        (!committeeFilter || String(r.committeeId) === committeeFilter) &&
        (!statusFilter || r.status === statusFilter) &&
        (!levelFilter || (r.level || '').trim() === levelFilter)
    );

    if (!sortKey) return list;

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'hizbs') {
        const aCount = Array.isArray(a.hizbs) ? a.hizbs.length : (a.hizbsCount ?? 0);
        const bCount = Array.isArray(b.hizbs) ? b.hizbs.length : (b.hizbsCount ?? 0);
        return (aCount - bCount) * dir;
      }
      if (sortKey === 'status') {
        const aLabel = STATUS_PILL[a.status]?.label || a.status || '';
        const bLabel = STATUS_PILL[b.status]?.label || b.status || '';
        return aLabel.localeCompare(bLabel, 'ar') * dir;
      }
      const aVal = (a[sortKey] || '').toString();
      const bVal = (b[sortKey] || '').toString();
      return aVal.localeCompare(bVal, 'ar') * dir;
    });
  }, [rows, q, circleFilter, committeeFilter, statusFilter, levelFilter, sortKey, sortDir]);

  async function executeConfirmedAction() {
    if (!confirmAction || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.kind === 'delete') {
        await fetch(`/api/students/${confirmAction.student.id}`, { method: 'DELETE' });
        setConfirmAction(null);
        await load();
      } else if (confirmAction.kind === 'bulk-password') {
        const res = await fetch('/api/students/bulk-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: confirmAction.mode })
        });
        const data = await res.json().catch(() => ({}));
        setConfirmAction(null);
        setPwOutput(data.updated || []);
      }
    } finally {
      setConfirmBusy(false);
    }
  }

  function renderSortArrow(key: SortKey) {
    if (sortKey !== key) return <span className="u-muted" style={{ fontSize: 11, marginRight: 4 }}>⇅</span>;
    return <span style={{ fontSize: 11, marginRight: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  return (
    <div className="u-page">
      <div className="u-top">
        <div><h1>إدارة الطلاب</h1></div>
      </div>

      <div className="u-card">
        <div className="u-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div className="u-field" style={{ margin: 0, flex: '1 1 180px' }}>
            <label>بحث</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بالاسم أو الهوية"
              className="u-input"
            />
          </div>
          <div className="u-field" style={{ margin: 0, flex: '1 1 150px' }}>
            <label>الحلقة</label>
            <select value={circleFilter} onChange={(e) => setCircleFilter(e.target.value)} className="u-input">
              <option value="">الكل</option>
              {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="u-field" style={{ margin: 0, flex: '1 1 150px' }}>
            <label>اللجنة</label>
            <select value={committeeFilter} onChange={(e) => setCommitteeFilter(e.target.value)} className="u-input">
              <option value="">الكل</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="u-field" style={{ margin: 0, flex: '1 1 140px' }}>
            <label>الحالة</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="u-input">
              <option value="">الكل</option>
              <option value="active">نشط</option>
              <option value="waiting_committee">بانتظار اللجنة</option>
              <option value="waiting_hizbs">بانتظار الأحزاب</option>
            </select>
          </div>
          <div className="u-field" style={{ margin: 0, flex: '1 1 130px' }}>
            <label>المستوى</label>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="u-input">
              <option value="">الكل</option>
              {distinctLevels.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={clearFilters}
              className="u-btn u-btn-g sm"
              style={{ height: 38 }}
            >
              ✕ مسح الفلتر
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="u-empty">لا توجد نتائج</div>
      ) : isMobile ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredAndSorted.map((r) => {
            const pill = STATUS_PILL[r.status] || { label: r.status, variant: 'mute' };
            const hizbCount = Array.isArray(r.hizbs) ? r.hizbs.length : (r.hizbsCount ?? 0);
            const hasPhone = Boolean(r.parentPhone && formatSaudiPhone(r.parentPhone));
            return (
              <div key={r.id} className="u-card" style={{ margin: 0, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div className="font-bold" style={{ fontSize: 15 }}>{r.name}</div>
                  <span className={`u-pill ${pill.variant}`}>{pill.label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 13, marginBottom: 12 }}>
                  <div><span className="u-muted">الهوية: </span><span>{r.nationalId || '—'}</span></div>
                  <div><span className="u-muted">ولي الأمر: </span><span dir="ltr">{r.parentPhone || '—'}</span></div>
                  <div><span className="u-muted">المستوى: </span><span>{r.level || '—'}</span></div>
                  <div><span className="u-muted">الأحزاب: </span><span className="font-semibold">{hizbCount}/60</span></div>
                  <div><span className="u-muted">الحلقة: </span><span>{r.circleName || '—'}</span></div>
                  <div><span className="u-muted">اللجنة: </span><span>{r.committeeName || '—'}</span></div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <button type="button" onClick={() => setEditing(r)} className="u-btn u-btn-s sm">تعديل</button>
                  <button type="button" onClick={() => setConfirmAction({ kind: 'delete', student: r })} className="u-btn u-btn-bad sm">حذف</button>
                  {hasPhone && (
                    <a
                      href={buildWhatsAppUrl(r, whatsappTemplate)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="u-btn u-btn-ok sm"
                    >
                      📱 واتساب
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="u-card" style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right">
                <th
                  className="py-2 px-2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('name')}
                >
                  الاسم {renderSortArrow('name')}
                </th>
                <th className="py-2 px-2">الهوية</th>
                <th className="py-2 px-2">ولي الأمر</th>
                <th
                  className="py-2 px-2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('level')}
                >
                  المستوى {renderSortArrow('level')}
                </th>
                <th
                  className="py-2 px-2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('circleName')}
                >
                  الحلقة {renderSortArrow('circleName')}
                </th>
                <th
                  className="py-2 px-2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('committeeName')}
                >
                  اللجنة {renderSortArrow('committeeName')}
                </th>
                <th
                  className="py-2 px-2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('hizbs')}
                >
                  الأحزاب {renderSortArrow('hizbs')}
                </th>
                <th
                  className="py-2 px-2"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('status')}
                >
                  الحالة {renderSortArrow('status')}
                </th>
                <th className="py-2 px-2">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((r) => {
                const pill = STATUS_PILL[r.status] || { label: r.status, variant: 'mute' };
                const hizbCount = Array.isArray(r.hizbs) ? r.hizbs.length : (r.hizbsCount ?? 0);
                const hasPhone = Boolean(r.parentPhone && formatSaudiPhone(r.parentPhone));
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 px-2 font-semibold">{r.name}</td>
                    <td className="py-2 px-2"><span className="u-muted">{r.nationalId || '—'}</span></td>
                    <td className="py-2 px-2"><span className="u-muted" dir="ltr">{r.parentPhone || '—'}</span></td>
                    <td className="py-2 px-2">{r.level || '—'}</td>
                    <td className="py-2 px-2">{r.circleName || '—'}</td>
                    <td className="py-2 px-2">{r.committeeName || '—'}</td>
                    <td className="py-2 px-2 font-semibold">{hizbCount}/60</td>
                    <td className="py-2 px-2"><span className={`u-pill ${pill.variant}`}>{pill.label}</span></td>
                    <td className="py-2 px-2">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => setEditing(r)} className="u-btn u-btn-s sm">تعديل</button>
                        <button type="button" onClick={() => setConfirmAction({ kind: 'delete', student: r })} className="u-btn u-btn-bad sm">حذف</button>
                        {hasPhone && (
                          <a
                            href={buildWhatsAppUrl(r, whatsappTemplate)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="u-btn u-btn-ok sm"
                          >
                            📱 واتساب
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

      {editing && (
        <EditModal
          row={editing}
          circles={circles}
          committees={committees}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await load();
            setEditing(null);
          }}
        />
      )}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          busy={confirmBusy}
          onCancel={() => !confirmBusy && setConfirmAction(null)}
          onConfirm={executeConfirmedAction}
        />
      )}
      {pwOutput && (
        <PasswordListModal list={pwOutput} onClose={() => setPwOutput(null)} />
      )}
    </div>
  );
}

function ConfirmModal({
  action,
  busy,
  onCancel,
  onConfirm
}: {
  action: ConfirmAction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  const isDelete = action.kind === 'delete';
  const title = isDelete ? 'تأكيد حذف الطالب' : 'تأكيد توليد كلمات المرور';
  const desc = isDelete
    ? `هل أنت متأكد من حذف الطالب "${action.student.name}"؟`
    : `سيُعاد توليد كلمات مرور كل الطلاب (${action.mode === 'numeric' ? 'قصيرة' : 'قوية'}). هل تريد المتابعة؟`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 grid place-items-center p-4 z-50"
      style={{ background: 'var(--overlay)' }}
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        className="w-full max-w-md flex flex-col"
        style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)' }}
      >
        <div className="shrink-0 flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 className="font-bold">{title}</h3>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="إغلاق" className="u-icon-btn">✕</button>
        </div>
        <div className="p-4">
          <p>{desc}</p>
        </div>
        <div className="shrink-0 flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onCancel} disabled={busy} className="u-btn u-btn-g">إلغاء</button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`u-btn ${isDelete ? 'u-btn-bad' : 'u-btn-p'}`}
          >
            {busy ? 'جاري الحفظ...' : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  row,
  circles,
  committees,
  onClose,
  onSaved
}: {
  row: Row;
  circles: any[];
  committees: any[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [nationalId, setNationalId] = useState(row.nationalId || '');
  const [parentPhone, setParentPhone] = useState(row.parentPhone || '');
  const [level, setLevel] = useState(row.level || '');
  const [circleId, setCircleId] = useState(row.circleId ? String(row.circleId) : '');
  const [committeeId, setCommitteeId] = useState(row.committeeId ? String(row.committeeId) : '');
  const [password, setPassword] = useState('');
  const [hizbs, setHizbs] = useState<number[]>(() => (Array.isArray(row.hizbs) ? [...row.hizbs] : []));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const userTouchedHizbsRef = useRef(false);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saving, onClose]);

  useEffect(() => {
    let active = true;
    fetch(`/api/students/${row.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active && !userTouchedHizbsRef.current && Array.isArray(d?.hizbs)) {
          setHizbs(d.hizbs);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [row.id]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      const hizbsRes = await fetch(`/api/students/${row.id}/hizbs`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hizbs })
      });
      if (!hizbsRes.ok) {
        const hData = await hizbsRes.json().catch(() => ({}));
        setErr(hData.error || 'فشل حفظ الأحزاب');
        return;
      }

      const res = await fetch(`/api/students/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          nationalId,
          parentPhone,
          level,
          circleId: circleId ? Number(circleId) : null,
          committeeId: committeeId ? Number(committeeId) : null,
          password: password || undefined,
          hizbs
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'خطأ في الحفظ');
        return;
      }

      await onSaved();
    } catch (e: any) {
      setErr(e?.message || 'فشل الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  function toggleHizb(n: number) {
    userTouchedHizbsRef.current = true;
    setHizbs((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));
  }

  function selectAllHizbs() {
    userTouchedHizbsRef.current = true;
    setHizbs(Array.from({ length: 60 }, (_, i) => i + 1));
  }

  function clearAllHizbs() {
    userTouchedHizbsRef.current = true;
    setHizbs([]);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 grid place-items-center p-4 z-50"
      style={{ background: 'var(--overlay)' }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col" style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)' }}>
        <div className="shrink-0 flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 className="font-bold">تعديل طالب</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="إغلاق" className="u-icon-btn">✕</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="u-field" style={{ marginBottom: 0 }}>
              <label>الاسم</label>
              <input ref={firstInputRef} value={name} onChange={(e) => setName(e.target.value)} className="u-input" />
            </div>
            <div className="u-field" style={{ marginBottom: 0 }}>
              <label>رقم الهوية (هو كلمة مرور الطالب)</label>
              <input dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="u-input" placeholder="10XXXXXXXX" />
            </div>
            <div className="u-field" style={{ marginBottom: 0 }}>
              <label>رقم ولي الأمر</label>
              <input dir="ltr" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className="u-input" />
            </div>
            <div className="u-field" style={{ marginBottom: 0 }}>
              <label>المستوى</label>
              <input value={level} onChange={(e) => setLevel(e.target.value)} className="u-input" />
            </div>
            <div className="u-field" style={{ marginBottom: 0 }}>
              <label>الحلقة</label>
              <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="u-input">
                <option value="">—</option>
                {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="u-field" style={{ marginBottom: 0 }}>
              <label>اللجنة</label>
              <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} className="u-input">
                <option value="">—</option>
                {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="u-muted" style={{ marginTop: 10 }}>
            يدخل الطالب إلى حسابه مباشرةً باستخدام <b>رقم هويته</b> ككلمة مرور.
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <label className="block text-sm font-semibold">الأحزاب المطلوبة ({hizbs.length}/60)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={selectAllHizbs} className="u-btn u-btn-s sm">تحديد الكل</button>
                <button type="button" onClick={clearAllHizbs} className="u-btn u-btn-g sm">إلغاء الكل</button>
              </div>
            </div>
            <div className="th-hizb-grid">
              {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => toggleHizb(n)} className={`th-h ${hizbs.includes(n) ? 'on' : ''}`}>
                  <span className="th-h-num">{n}</span>
                </button>
              ))}
            </div>
          </div>

          {err && <div role="alert" className="u-note bad" style={{ marginTop: 12 }}>{err}</div>}
        </div>
        <div className="shrink-0 flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)', background: 'var(--card)', borderRadius: '0 0 18px 18px' }}>
          <button type="button" onClick={onClose} disabled={saving} className="u-btn u-btn-g">إلغاء</button>
          <button type="button" onClick={save} disabled={saving} className="u-btn u-btn-p">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordListModal({ list, onClose }: { list: { id: number; name: string; password: string }[]; onClose: () => void }) {
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function download() {
    const XLSX = await import('xlsx');
    const rows: any[][] = [['الاسم', 'كلمة المرور'], ...list.map((r) => [r.name, r.password])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    (ws as any)['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كلمات المرور');
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'كلمات-المرور.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 grid place-items-center p-4 z-50"
      style={{ background: 'var(--overlay)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md max-h-[90vh] flex flex-col" style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)' }}>
        <div className="shrink-0 flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 className="font-bold">كلمات المرور الجديدة</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="u-icon-btn">✕</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <button ref={firstBtnRef} type="button" onClick={download} className="u-btn u-btn-p w">📥 تنزيل كـ Excel</button>
          <div className="u-card" style={{ padding: 0, margin: 0 }}>
            <table className="w-full text-sm">
              <thead><tr><th className="p-2 text-right">الاسم</th><th className="p-2">كلمة المرور</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 text-right">{r.name}</td>
                    <td className="p-2 font-mono text-center">{r.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
