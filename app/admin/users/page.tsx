'use client';
import { useEffect, useRef, useState } from 'react';

export default function UsersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; username: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [autoResult, setAutoResult] = useState<any[] | null>(null);
  const [autoRows, setAutoRows] = useState<any[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [a, b] = await Promise.all([
      fetch('/api/supervisors').then((r) => r.json()),
      fetch('/api/committees').then((r) => r.json())
    ]);
    setRows(a.rows || []);
    setCommittees(b.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function confirmAndDelete() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/supervisors/${confirmDelete.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  async function startAuto() {
    const d = await fetch('/api/supervisors/auto-create').then((r) => r.json());
    setAutoRows((d.rows || []).map((c: any) => ({
      committeeId: c.id,
      committeeName: c.name,
      username: `sup_${c.id}`,
      password: ''
    })));
  }

  async function runAuto() {
    if (autoRunning) return;
    setAutoRunning(true);
    try {
      const d = await fetch('/api/supervisors/auto-create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entries: autoRows.map((r) => ({
            committeeId: r.committeeId,
            username: r.username,
            password: r.password || undefined
          }))
        })
      }).then((r) => r.json());
      setAutoResult(d.created || []);
      setAutoRows([]);
      await load();
    } finally {
      setAutoRunning(false);
    }
  }

  return (
    <div className="u-page">
      <div className="u-top">
        <div><h1>المستخدمون</h1></div>
        <div className="u-actions">
          <button onClick={() => setShowAdd(true)} className="u-btn u-btn-p sm" style={{ minHeight: 44 }}>إضافة مشرف</button>
          <button onClick={startAuto} className="u-btn u-btn-s sm" style={{ minHeight: 44 }}>إنشاء تلقائي للجان</button>
        </div>
      </div>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : (
        <div className="u-grid3">
          <ReciterSharedCard />
          {rows.length === 0 ? (
            <div className="u-note mute" style={{ gridColumn: '1 / -1' }}>لا يوجد مشرفون بعد — أضف مشرفاً أو استخدم &quot;إنشاء تلقائي للجان&quot;.</div>
          ) : rows.map((r) => (
            <SupervisorCard
              key={r.id}
              row={r}
              committees={committees}
              onChanged={load}
              onDelete={() => setConfirmDelete({ id: r.id, username: r.username })}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddSupervisor
          committees={committees}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="تأكيد حذف مشرف اللجنة"
          message={`هل أنت متأكد من حذف مشرف اللجنة «${confirmDelete.username}»؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmLabel="تأكيد الحذف"
          saving={deleting}
          onConfirm={confirmAndDelete}
          onCancel={() => !deleting && setConfirmDelete(null)}
        />
      )}

      {autoRows.length > 0 && (
        <AutoCreate
          rows={autoRows}
          setRows={setAutoRows}
          running={autoRunning}
          onRun={runAuto}
          onCancel={() => !autoRunning && setAutoRows([])}
        />
      )}
      {autoResult && (
        <div className="u-card">
          <div className="u-card-h"><h3>تم إنشاء <span className="u-num">{autoResult.length}</span> حساب</h3></div>
          <ul className="u-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {autoResult.map((r: any) => (
              <li key={r.committeeId} className="u-item">
                <div className="u-grow">
                  <div className="u-name">{r.username}</div>
                  <div className="u-muted">كلمة المرور: <code>{r.password}</code></div>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={() => setAutoResult(null)} className="u-btn u-btn-g sm" style={{ marginTop: 10 }}>إغلاق</button>
        </div>
      )}
    </div>
  );
}

function ReciterSharedCard() {
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!pw.trim() || saving) return;
    setStatus(null);
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reciterPassword: pw })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ ok: false, text: data.error || `فشل التحديث (HTTP ${res.status})` });
        return;
      }
      setStatus({ ok: true, text: '✓ تم التحديث' });
      setPw('');
      setTimeout(() => setStatus(null), 2200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="u-card" style={{ marginBottom: 0, border: '2px dashed var(--gold)', background: 'var(--gold-soft)', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="u-row" style={{ minWidth: 0 }}>
        <div className="u-avatar" style={{ background: 'var(--gold)', color: '#fff' }}>🎤</div>
        <div className="u-grow">
          <div className="u-name" style={{ minWidth: 0 }}>المسمع المشترك</div>
          <div className="u-muted">حساب موحّد لجميع المسمعين</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <span className="u-pill gold">دور: مسمع</span>
        <span className="u-pill mute">كلمة مرور واحدة</span>
      </div>
      <div className="u-row" style={{ gap: 6, marginTop: 10, minWidth: 0 }}>
        <input
          value={pw}
          onChange={(e) => { setPw(e.target.value); setStatus(null); }}
          placeholder="كلمة مرور جديدة"
          aria-label="كلمة مرور المسمع المشترك الجديدة"
          className="u-input"
          style={{ flex: '1 1 0', minWidth: 0, height: 40 }}
        />
        <button onClick={save} disabled={!pw.trim() || saving} className="u-btn u-btn-p sm" style={{ flexShrink: 0, minHeight: 40 }}>
          {saving ? 'جاري الحفظ...' : 'تحديث'}
        </button>
      </div>
      {status && (
        status.ok
          ? <div className="u-pill ok" style={{ marginTop: 8 }}>{status.text}</div>
          : <div className="u-note bad" role="alert" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>{status.text}</div>
      )}
    </div>
  );
}

function SupervisorCard({ row, committees, onChanged, onDelete }: any) {
  const [pw, setPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [savingPatch, setSavingPatch] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

  async function save(patch: any): Promise<Response> {
    setSavingPatch(true);
    try {
      const res = await fetch(`/api/supervisors/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch)
      });
      await onChanged();
      return res;
    } finally {
      setSavingPatch(false);
    }
  }

  async function updatePassword() {
    setPwErr(null);
    setPwOk(null);
    if (!pw.trim() || savingPw) return;
    setSavingPw(true);
    try {
      const res = await fetch(`/api/supervisors/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPwErr(d.error || (res.status === 409 ? 'كلمة المرور مستخدمة بالفعل لمستخدم آخر' : `فشل التحديث (HTTP ${res.status})`));
        return;
      }
      setPw('');
      setPwOk('✓ تم تحديث كلمة المرور');
      setTimeout(() => setPwOk(null), 2500);
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="u-card" style={{ marginBottom: 0, minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="u-row" style={{ minWidth: 0 }}>
        <div className="u-avatar">{row.username?.[0]?.toUpperCase() || '?'}</div>
        <div className="u-grow">
          <div className="u-name" style={{ minWidth: 0 }}>{row.username}</div>
          <div className="u-muted">{row.committeeName || 'بدون لجنة'}</div>
        </div>
        {savingPatch && <span className="u-pill mute" style={{ fontSize: 11 }}>جاري الحفظ...</span>}
      </div>
      {/* Committee select on its own row (full width) */}
      <div style={{ marginTop: 10 }}>
        <select
          aria-label={`لجنة المشرف ${row.username}`}
          value={row.committeeId || ''}
          disabled={savingPatch}
          onChange={(e) => save({ committeeId: e.target.value ? Number(e.target.value) : null })}
          className="u-input"
          style={{ height: 40, boxSizing: 'border-box', width: '100%' }}
        >
          <option value="">— بدون لجنة —</option>
          {committees.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {/* Checkboxes on their own row */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--ink2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 32 }}>
          <input
            type="checkbox"
            disabled={savingPatch}
            defaultChecked={row.canEditRecords}
            onChange={(e) => save({ canEditRecords: e.target.checked })}
          />
          يستطيع التعديل
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 32 }}>
          <input
            type="checkbox"
            disabled={savingPatch}
            defaultChecked={row.canDeleteRecords}
            onChange={(e) => save({ canDeleteRecords: e.target.checked })}
          />
          يستطيع الحذف
        </label>
      </div>
      <div className="u-row" style={{ gap: 6, marginTop: 10, minWidth: 0 }}>
        <input
          value={pw}
          onChange={(e) => { setPw(e.target.value); setPwErr(null); setPwOk(null); }}
          placeholder="كلمة مرور جديدة"
          aria-label={`كلمة مرور جديدة للمشرف ${row.username}`}
          className="u-input"
          style={{ flex: '1 1 0', minWidth: 0, height: 40 }}
        />
        <button
          onClick={updatePassword}
          disabled={!pw.trim() || savingPw}
          className="u-btn u-btn-p sm"
          style={{ flexShrink: 0, minHeight: 40 }}
        >
          {savingPw ? 'جاري الحفظ...' : 'تحديث'}
        </button>
      </div>
      {pwErr && <div className="u-note bad" role="alert" style={{ marginTop: 6, marginBottom: 0, fontSize: 12 }}>{pwErr}</div>}
      {pwOk && <div className="u-pill ok" style={{ marginTop: 6 }}>{pwOk}</div>}
      <button onClick={onDelete} className="u-btn u-btn-bad sm" style={{ marginTop: 10, minHeight: 40 }}>حذف</button>
    </div>
  );
}

function AddSupervisor({ committees, onClose, onSaved }: { committees: any[]; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [committeeId, setCommitteeId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  async function save(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (saving) return;
    setErr(null);
    if (!username.trim()) {
      setErr('يرجى إدخال اسم المستخدم');
      return;
    }
    if (!password) {
      setErr('يرجى إدخال كلمة المرور');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/supervisors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          committeeId: committeeId ? Number(committeeId) : null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || `فشل الحفظ (HTTP ${res.status})`);
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 grid place-items-center p-4 z-50"
      style={{ background: 'var(--overlay)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-sup-modal-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <form
        onSubmit={save}
        className="w-full max-w-md max-h-[90vh] flex flex-col"
        style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)' }}
      >
        <div className="shrink-0 flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 id="add-sup-modal-title" className="font-bold">إضافة مشرف لجنة</h3>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            aria-label="إغلاق"
            className="u-icon-btn"
            style={{ width: 44, height: 44 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="u-field">
            <label htmlFor="sup-username">اسم المستخدم</label>
            <input
              id="sup-username"
              ref={firstInputRef}
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErr(null); }}
              placeholder="sup_1"
              className="u-input"
              required
            />
          </div>
          <div className="u-field">
            <label htmlFor="sup-password">كلمة المرور</label>
            <input
              id="sup-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErr(null); }}
              placeholder="••••••••"
              className="u-input"
              required
            />
          </div>
          <div className="u-field">
            <label htmlFor="sup-committee">اللجنة المسؤولة</label>
            <select
              id="sup-committee"
              value={committeeId}
              onChange={(e) => setCommitteeId(e.target.value)}
              className="u-input"
            >
              <option value="">— اختر لجنة —</option>
              {committees.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {err && <div className="u-note bad" role="alert">{err}</div>}
        </div>
        <div className="shrink-0 flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onClose} disabled={saving} className="u-btn u-btn-g">إلغاء</button>
          <button type="submit" disabled={saving} className="u-btn u-btn-p">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  saving,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel: string;
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
      aria-labelledby="confirm-modal-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}
    >
      <div
        className="w-full max-w-md flex flex-col"
        style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 id="confirm-modal-title" className="font-bold">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="إغلاق"
            className="u-icon-btn"
            style={{ width: 44, height: 44 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4">
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink)' }}>{message}</p>
        </div>
        <div className="flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onCancel} disabled={saving} className="u-btn u-btn-g">إلغاء</button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="u-btn u-btn-bad"
          >
            {saving ? 'جاري الحفظ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutoCreate({ rows, setRows, running, onRun, onCancel }: any) {
  function update(i: number, patch: any) {
    setRows(rows.map((r: any, idx: number) => idx === i ? { ...r, ...patch } : r));
  }
  function remove(i: number) { setRows(rows.filter((_: any, idx: number) => idx !== i)); }
  return (
    <div className="u-card">
      <div className="u-card-h"><h3>إنشاء تلقائي — <span className="u-num">{rows.length}</span> لجنة</h3></div>
      <p className="u-muted" style={{ marginBottom: 10 }}>اترك كلمة المرور فارغة ليُولد قوية تلقائياً.</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full text-sm">
          <thead><tr><th className="p-2 text-right">اللجنة</th><th className="p-2">اسم المستخدم</th><th className="p-2">كلمة المرور</th><th className="p-2">إجراء</th></tr></thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={r.committeeId} className="border-t">
                <td className="p-2">{r.committeeName}</td>
                <td className="p-2"><input value={r.username} onChange={(e) => update(i, { username: e.target.value })} className="u-input" style={{ height: 38 }} /></td>
                <td className="p-2"><input value={r.password} onChange={(e) => update(i, { password: e.target.value })} placeholder="تلقائي" className="u-input" style={{ height: 38 }} /></td>
                <td className="p-2"><button onClick={() => remove(i)} disabled={running} className="u-btn u-btn-bad sm">استبعاد</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'end', marginTop: 10 }}>
        <button onClick={onCancel} disabled={running} className="u-btn u-btn-g">إلغاء</button>
        <button onClick={onRun} disabled={running} className="u-btn u-btn-p">
          {running ? 'جاري الحفظ...' : 'إنشاء'}
        </button>
      </div>
    </div>
  );
}
