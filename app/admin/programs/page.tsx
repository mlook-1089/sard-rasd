'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = {
  id: number; name: string; isActive: boolean;
  archivedAt: string | null; createdAt: string;
  stats: { sessionsCount: number; attendanceCount: number };
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

export default function ProgramsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState('');
  const [setActive, setSetActive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'archive' | 'delete'; row: Row } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function notifyProgramChanged() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sard:program-changed'));
      window.dispatchEvent(new CustomEvent('active-program-changed'));
    }
    router.refresh();
  }

  async function load() {
    setLoading(true);
    const d = await fetch('/api/programs').then((r) => r.json());
    setRows(d.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setErr(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setErr('يرجى إدخال اسم البرنامج');
      return;
    }
    const wantActive = setActive;
    setAdding(true);
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed, setActive: wantActive })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error || 'خطأ');
        return;
      }
      setName('');
      setSetActive(false);
      await load();
      notifyProgramChanged();
    } finally {
      setAdding(false);
    }
  }

  async function rename(id: number, newName: string, inputEl: HTMLInputElement, originalName: string) {
    const trimmed = newName.trim();
    if (!trimmed) {
      inputEl.value = originalName;
      return;
    }
    if (trimmed === originalName) {
      inputEl.value = originalName;
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/programs/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'rename', name: trimmed })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        inputEl.value = originalName;
        setErr(d.error || `فشل الحفظ (HTTP ${res.status})`);
        setTimeout(() => setErr(null), 3200);
        return;
      }
      await load();
      notifyProgramChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function activate(id: number) {
    if (busyId !== null) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/programs/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'activate' })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error || `فشل التفعيل (HTTP ${res.status})`);
        setTimeout(() => setErr(null), 3200);
        return;
      }
      await load();
      notifyProgramChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function executeConfirmedAction() {
    if (!confirmAction || confirmBusy) return;
    const { type, row } = confirmAction;
    setConfirmBusy(true);
    setErr(null);
    try {
      const res = type === 'archive'
        ? await fetch(`/api/programs/${row.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'archive' })
          })
        : await fetch(`/api/programs/${row.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const label = type === 'archive' ? 'فشل الأرشفة' : 'فشل الحذف';
        setErr(d.error || `${label} (HTTP ${res.status})`);
        setTimeout(() => setErr(null), 3200);
        setConfirmAction(null);
        return;
      }
      setConfirmAction(null);
      await load();
      notifyProgramChanged();
    } finally {
      setConfirmBusy(false);
    }
  }

  const nonArchivedCount = rows.filter((r) => !r.archivedAt).length;

  return (
    <div className="u-page">
      <div className="u-top">
        <div>
          <h1>برامج السرد</h1>
          <div className="u-sub">البرنامج النشط يستقبل كل رصد وتحضير جديد. أرشف القديم ليبقى للعرض فقط.</div>
        </div>
      </div>

      {err && <div className="u-note bad" role="alert" style={{ position: 'sticky', top: 8, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}>⚠ {err}</div>}

      <form onSubmit={add} className="u-card">
        <div className="u-card-h"><h2>إضافة برنامج جديد</h2></div>
        <div className="u-field">
          <label htmlFor="prog-name">اسم البرنامج</label>
          <input
            id="prog-name"
            value={name}
            onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
            required
            className="u-input"
            placeholder="مثال: برنامج السرد — الفصل الدراسي الأول 1447"
          />
        </div>
        <label className="u-row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer', minHeight: 36 }}>
          <input type="checkbox" checked={setActive} onChange={(e) => setSetActive(e.target.checked)} />
          <span>تفعيل مباشرة (سيُلغى تفعيل البرنامج الحالي)</span>
        </label>
        <button type="submit" disabled={adding} className="u-btn u-btn-p w">
          {adding ? 'جاري الحفظ...' : 'إضافة'}
        </button>
      </form>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : rows.length === 0 ? (
        <div className="u-empty">لا توجد برامج بعد. أضف أول برنامج أعلاه.</div>
      ) : (
        <div className="u-grid3">
          {rows.map((r) => {
            const status = r.isActive ? 'active' : r.archivedAt ? 'archived' : 'draft';
            const canArchive = r.isActive && nonArchivedCount > 1;
            const canDelete = !r.isActive && r.stats.sessionsCount === 0 && r.stats.attendanceCount === 0;
            const isBusy = busyId === r.id;
            return (
              <div key={r.id} className="u-card" style={{ marginBottom: 0 }}>
                <div className="u-card-h">
                  <input
                    defaultValue={r.name}
                    aria-label={`اسم البرنامج ${r.name}`}
                    disabled={isBusy}
                    onBlur={(e) => rename(r.id, e.target.value, e.currentTarget, r.name)}
                    className="u-input"
                    style={{ height: 42, fontWeight: 700, flex: 1 }}
                  />
                  {status === 'active' && <span className="u-pill ok">نشط</span>}
                  {status === 'archived' && <span className="u-pill mute">مؤرشف</span>}
                </div>
                <div className="u-muted" style={{ marginBottom: 10 }}>أُنشئ: {fmtDate(r.createdAt)}</div>
                <div className="u-grid2" style={{ marginBottom: 10 }}>
                  <div className="u-stat"><div className="l">عدد الجلسات</div><div className="v">{r.stats.sessionsCount}</div></div>
                  <div className="u-stat"><div className="l">سجلات الحضور</div><div className="v">{r.stats.attendanceCount}</div></div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {status !== 'active' && !r.archivedAt && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => activate(r.id)}
                      className="u-btn u-btn-p sm"
                      style={{ minHeight: 40 }}
                    >
                      {isBusy ? 'جاري الحفظ...' : 'تفعيل'}
                    </button>
                  )}
                  {r.archivedAt && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => activate(r.id)}
                      className="u-btn u-btn-s sm"
                      style={{ minHeight: 40 }}
                    >
                      {isBusy ? 'جاري الحفظ...' : 'إعادة تفعيل'}
                    </button>
                  )}
                  {canArchive && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmAction({ type: 'archive', row: r })}
                      className="u-btn u-btn-g sm"
                      style={{ minHeight: 40 }}
                    >
                      أرشفة
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmAction({ type: 'delete', row: r })}
                      className="u-btn u-btn-bad sm"
                      style={{ minHeight: 40 }}
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmAction && (
        <ConfirmProgramModal
          action={confirmAction}
          saving={confirmBusy}
          onConfirm={executeConfirmedAction}
          onCancel={() => !confirmBusy && setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function ConfirmProgramModal({
  action,
  saving,
  onConfirm,
  onCancel
}: {
  action: { type: 'archive' | 'delete'; row: Row };
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const isArchive = action.type === 'archive';

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, saving]);

  return (
    <div
      className="fixed inset-0 grid place-items-center p-4 z-50"
      style={{ background: 'var(--overlay)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-prog-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}
    >
      <div
        className="w-full max-w-md flex flex-col"
        style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 id="confirm-prog-title" className="font-bold">
            {isArchive ? 'تأكيد أرشفة البرنامج' : 'تأكيد حذف البرنامج'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="إغلاق"
            className="u-icon-btn"
            style={{ width: 44, height: 44 }}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4">
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink)' }}>
            {isArchive
              ? `هل تريد أرشفة برنامج «${action.row.name}»؟ ستبقى بياناته للعرض فقط.`
              : `هل تريد حذف برنامج «${action.row.name}» نهائياً؟ (مسموح فقط لبرنامج فارغ وغير نشط)`}
          </p>
        </div>
        <div className="flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onCancel} disabled={saving} className="u-btn u-btn-g">إلغاء</button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className={`u-btn ${isArchive ? 'u-btn-p' : 'u-btn-bad'}`}
          >
            {saving ? 'جاري الحفظ...' : (isArchive ? 'تأكيد الأرشفة' : 'تأكيد الحذف')}
          </button>
        </div>
      </div>
    </div>
  );
}
