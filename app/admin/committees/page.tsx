'use client';
import { useEffect, useRef, useState } from 'react';

export default function CommitteesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string; studentsCount?: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const d = await fetch('/api/committees').then((r) => r.json());
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
      setErr('يرجى إدخال اسم اللجنة (لا يمكن أن يكون فارغاً)');
      return;
    }
    if (rows.some((r) => (r.name || '').trim() === trimmed)) {
      setErr('اسم اللجنة موجود مسبقاً');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/committees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error || `فشل إضافة اللجنة (HTTP ${res.status})`);
        return;
      }
      setName('');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function rename(id: number, rawName: string, inputEl: HTMLInputElement, originalName: string) {
    setErr(null);
    const trimmed = rawName.trim();
    if (!trimmed) {
      inputEl.value = originalName;
      setErr('لا يمكن ترك اسم اللجنة فارغاً');
      return;
    }
    if (trimmed === originalName) {
      inputEl.value = originalName;
      return;
    }
    if (rows.some((r) => r.id !== id && (r.name || '').trim() === trimmed)) {
      inputEl.value = originalName;
      setErr('اسم اللجنة موجود مسبقاً');
      return;
    }
    setSavingId(id);
    try {
      const res = await fetch(`/api/committees/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        inputEl.value = originalName;
        setErr(d.error || `فشل التعديل (HTTP ${res.status})`);
        return;
      }
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function confirmAndDelete() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/committees/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || `فشل حذف اللجنة (HTTP ${res.status})`);
      }
      setConfirmDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="u-page">
      <div className="u-top"><div><h1>اللجان</h1></div></div>

      {err && (
        <div className="u-note bad" role="alert" style={{ marginBottom: 12 }}>
          ⚠ {err}
        </div>
      )}

      <form onSubmit={add} className="u-card" noValidate>
        <div className="u-row" style={{ gap: 8 }}>
          <input
            required
            value={name}
            onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
            placeholder="اسم اللجنة"
            aria-label="اسم اللجنة الجديدة"
            className="u-input"
            style={{ flex: 1, minHeight: 46 }}
          />
          <button
            type="submit"
            disabled={adding}
            className="u-btn u-btn-p"
            style={{ minHeight: 46, minWidth: 88 }}
          >
            {adding ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : rows.length === 0 ? (
        <div className="u-empty">لا توجد لجان بعد. أضف أولى اللجان أعلاه.</div>
      ) : (
        <div className="u-grid3">
          {rows.map((r) => (
            <div key={r.id} className="u-card" style={{ marginBottom: 0 }}>
              <input
                defaultValue={r.name}
                aria-label={`اسم اللجنة ${r.name}`}
                disabled={savingId === r.id}
                onBlur={(e) => rename(r.id, e.target.value, e.currentTarget, r.name)}
                className="u-input"
                style={{ fontWeight: 700, height: 44, minHeight: 44 }}
              />
              <div className="u-between" style={{ marginTop: 8 }}>
                <div className="u-muted"><span className="u-num">{r.studentsCount}</span> طالب</div>
                {savingId === r.id && <span className="u-pill mute">جاري الحفظ...</span>}
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete({ id: r.id, name: r.name, studentsCount: r.studentsCount })}
                className="u-btn u-btn-bad"
                style={{ marginTop: 10, minHeight: 44, minWidth: 80 }}
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDeleteCommitteeModal
          target={confirmDelete}
          saving={deleting}
          onConfirm={confirmAndDelete}
          onCancel={() => !deleting && setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function ConfirmDeleteCommitteeModal({
  target,
  saving,
  onConfirm,
  onCancel
}: {
  target: { id: number; name: string; studentsCount?: number };
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

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
      aria-labelledby="del-committee-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}
    >
      <div
        className="w-full max-w-md flex flex-col"
        style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 id="del-committee-title" className="font-bold">تأكيد حذف اللجنة</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="إغلاق"
            className="u-icon-btn"
            style={{ width: 44, height: 44 }}
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink)' }}>
            هل أنت متأكد من حذف اللجنة «{target.name}»؟
            {target.studentsCount ? ` (مرتبط بها ${target.studentsCount} طالب)` : ''}
          </p>
        </div>
        <div className="flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onCancel} disabled={saving} className="u-btn u-btn-g" style={{ minHeight: 44 }}>إلغاء</button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="u-btn u-btn-bad"
            style={{ minHeight: 44 }}
          >
            {saving ? 'جاري الحفظ...' : 'تأكيد الحذف'}
          </button>
        </div>
      </div>
    </div>
  );
}
