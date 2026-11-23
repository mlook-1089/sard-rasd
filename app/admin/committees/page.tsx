'use client';
import { useEffect, useRef, useState } from 'react';

type Committee = {
  id: number;
  name: string;
  studentsCount: number;
  hizbsCount: number;
  maxStudents: number | null;
  minStudents: number | null;
  maxHizbs: number | null;
  minHizbs: number | null;
  maxPerCircle: number | null;
};

type PlanRow = {
  studentId: number;
  studentName: string;
  fromCommitteeId: number | null;
  toCommitteeId: number | null;
  toCommitteeName: string | null;
  reason: string;
};
type Plan = {
  rows: PlanRow[];
  summary: { assigned: number; moved: number; kept: number; unassignable: number };
  committeesAfter: Array<{ id: number; name: string; studentsBefore: number; studentsAfter: number; hizbsBefore: number; hizbsAfter: number; maxStudents: number | null; maxHizbs: number | null }>;
};

export default function CommitteesPage() {
  const [rows, setRows] = useState<Committee[]>([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string; studentsCount?: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const [showBulkLimits, setShowBulkLimits] = useState(false);

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
    if (!trimmed) { setErr('يرجى إدخال اسم اللجنة'); return; }
    if (rows.some((r) => (r.name || '').trim() === trimmed)) { setErr('اسم اللجنة موجود مسبقاً'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/committees', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || `فشل الإضافة (HTTP ${res.status})`); return; }
      setName('');
      await load();
    } finally { setAdding(false); }
  }

  async function rename(id: number, rawName: string, inputEl: HTMLInputElement, originalName: string) {
    setErr(null);
    const trimmed = rawName.trim();
    if (!trimmed) { inputEl.value = originalName; setErr('لا يمكن ترك الاسم فارغاً'); return; }
    if (trimmed === originalName) { inputEl.value = originalName; return; }
    if (rows.some((r) => r.id !== id && (r.name || '').trim() === trimmed)) {
      inputEl.value = originalName; setErr('اسم اللجنة موجود مسبقاً'); return;
    }
    setSavingId(id);
    try {
      const res = await fetch(`/api/committees/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { inputEl.value = originalName; setErr(d.error || `فشل التعديل (HTTP ${res.status})`); return; }
      await load();
    } finally { setSavingId(null); }
  }

  async function setLimit(id: number, field: 'maxStudents' | 'minStudents' | 'maxHizbs' | 'minHizbs' | 'maxPerCircle', valueStr: string) {
    setErr(null);
    const value = valueStr.trim() === '' ? null : Math.max(0, Math.floor(Number(valueStr) || 0));
    setSavingId(id);
    try {
      const res = await fetch(`/api/committees/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setErr(d.error || `فشل التعديل (HTTP ${res.status})`);
      await load();
    } finally { setSavingId(null); }
  }

  async function confirmAndDelete() {
    if (!confirmDelete || deleting) return;
    setDeleting(true); setErr(null);
    try {
      const res = await fetch(`/api/committees/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || `فشل الحذف (HTTP ${res.status})`); }
      setConfirmDelete(null);
      await load();
    } finally { setDeleting(false); }
  }

  return (
    <div className="u-page">
      <div className="u-top">
        <div><h1>اللجان</h1></div>
        <div className="u-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowBulkLimits(true)}
            disabled={rows.length === 0}
            className="u-btn u-btn-s"
            style={{ minHeight: 44 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>ضبط حدود السعة لكل اللجان</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAutoAssign(true)}
            disabled={rows.length === 0}
            className="u-btn u-btn-p"
            style={{ minHeight: 44 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>توزيع تلقائي ذكي</span>
          </button>
        </div>
      </div>

      {err && <div className="u-note bad" role="alert" style={{ marginBottom: 12 }}>⚠ {err}</div>}

      <form onSubmit={add} className="u-card" noValidate>
        <div className="u-row" style={{ gap: 8 }}>
          <input required value={name} onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
            placeholder="اسم اللجنة" aria-label="اسم اللجنة الجديدة" className="u-input" style={{ flex: 1, minHeight: 46 }} />
          <button type="submit" disabled={adding} className="u-btn u-btn-p" style={{ minHeight: 46, minWidth: 88 }}>
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
            <CommitteeCard
              key={r.id}
              row={r}
              saving={savingId === r.id}
              onRename={(val, el) => rename(r.id, val, el, r.name)}
              onLimit={(field, val) => setLimit(r.id, field, val)}
              onDelete={() => setConfirmDelete({ id: r.id, name: r.name, studentsCount: r.studentsCount })}
            />
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

      {showAutoAssign && (
        <AutoAssignModal
          committees={rows}
          onClose={() => setShowAutoAssign(false)}
          onApplied={async () => { setShowAutoAssign(false); await load(); }}
        />
      )}

      {showBulkLimits && (
        <BulkLimitsModal
          count={rows.length}
          onClose={() => setShowBulkLimits(false)}
          onApplied={async () => { setShowBulkLimits(false); await load(); }}
        />
      )}
    </div>
  );
}

function BulkLimitsModal({
  count, onClose, onApplied
}: {
  count: number;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [maxStudents, setMaxStudents] = useState('');
  const [minStudents, setMinStudents] = useState('');
  const [maxHizbs, setMaxHizbs] = useState('');
  const [minHizbs, setMinHizbs] = useState('');
  const [maxPerCircle, setMaxPerCircle] = useState('');
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { updated: number }>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !applying) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, applying]);

  function toValue(s: string): number | null | undefined {
    if (s === '') return undefined;  // ignore field entirely
    const n = Math.max(0, Math.floor(Number(s) || 0));
    return n;
  }

  async function apply() {
    setErr(null);
    const payload: any = {};
    const m1 = toValue(maxStudents); if (m1 !== undefined) payload.maxStudents = m1;
    const m2 = toValue(minStudents); if (m2 !== undefined) payload.minStudents = m2;
    const m3 = toValue(maxHizbs);    if (m3 !== undefined) payload.maxHizbs = m3;
    const m4 = toValue(minHizbs);    if (m4 !== undefined) payload.minHizbs = m4;
    const m5 = toValue(maxPerCircle); if (m5 !== undefined) payload.maxPerCircle = m5;
    if (Object.keys(payload).length === 0) {
      setErr('اكتب قيمة في حقل واحد على الأقل');
      return;
    }
    setApplying(true);
    try {
      const res = await fetch('/api/committees/bulk-limits', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || `فشل التطبيق (HTTP ${res.status})`); return; }
      setDone({ updated: d.updated });
      setTimeout(onApplied, 1200);
    } finally { setApplying(false); }
  }

  return (
    <div className="fixed inset-0 grid place-items-center p-4 z-50" style={{ background: 'var(--overlay)' }}
      role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && !applying && onClose()}>
      <div className="w-full flex flex-col" style={{
        maxWidth: 520, maxHeight: '92vh',
        background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)'
      }}>
        <div className="flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 className="font-bold" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>ضبط حدود السعة على {count} لجنة</span>
          </h3>
          <button type="button" onClick={onClose} disabled={applying} aria-label="إغلاق" className="u-icon-btn" style={{ width: 40, height: 40 }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto" style={{ flex: 1 }}>
          <div className="u-note brand" style={{ marginBottom: 14 }}>
            اترك أي حقل فارغاً لتجاهله. القيمة الصفر = بلا حد في ذلك الحقل. التعديل يُطبَّق على كل اللجان مرة واحدة ويستبدل قيمها الحالية.
          </div>

          <div className="u-grid2" style={{ gap: 10, marginBottom: 10 }}>
            <label className="u-field" style={{ marginBottom: 0 }}>
              <span>الحد الأدنى للطلاب</span>
              <input type="number" min={0} step={1} value={minStudents} onChange={(e) => setMinStudents(e.target.value)} className="u-input" placeholder="اتركه فارغاً" />
            </label>
            <label className="u-field" style={{ marginBottom: 0 }}>
              <span>الحد الأعلى للطلاب</span>
              <input type="number" min={0} step={1} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} className="u-input" placeholder="اتركه فارغاً" />
            </label>
            <label className="u-field" style={{ marginBottom: 0 }}>
              <span>الحد الأدنى للأحزاب</span>
              <input type="number" min={0} step={1} value={minHizbs} onChange={(e) => setMinHizbs(e.target.value)} className="u-input" placeholder="اتركه فارغاً" />
            </label>
            <label className="u-field" style={{ marginBottom: 0 }}>
              <span>الحد الأعلى للأحزاب</span>
              <input type="number" min={0} step={1} value={maxHizbs} onChange={(e) => setMaxHizbs(e.target.value)} className="u-input" placeholder="اتركه فارغاً" />
            </label>
          </div>

          <label className="u-field">
            <span>أعلى طلاب من كل حلقة في اللجنة (للتنوع)</span>
            <input type="number" min={0} step={1} value={maxPerCircle} onChange={(e) => setMaxPerCircle(e.target.value)} className="u-input" placeholder="مثلاً 3 = لا تجمع أكثر من 3 من نفس الحلقة" />
            <p className="u-muted" style={{ marginTop: 6, fontSize: 12 }}>
              قيد <b>صلب</b>: الخوارزمية لن تضع في لجنة واحدة طلاباً أكثر من هذا من نفس الحلقة. اترك فارغاً لإلغاء القيد.
            </p>
          </label>

          {err && <div className="u-note bad" style={{ marginTop: 10 }}>⚠ {err}</div>}
          {done && <div className="u-note ok" style={{ marginTop: 10 }}>✓ طُبِّق على <b>{done.updated}</b> لجنة</div>}
        </div>
        <div className="flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onClose} disabled={applying} className="u-btn u-btn-g" style={{ minHeight: 44 }}>
            {done ? 'إغلاق' : 'إلغاء'}
          </button>
          {!done && (
            <button type="button" onClick={apply} disabled={applying} className="u-btn u-btn-p" style={{ minHeight: 44 }}>
              {applying ? 'يُطبَّق...' : 'تطبيق على الكل'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommitteeCard({
  row, saving, onRename, onLimit, onDelete
}: {
  row: Committee;
  saving: boolean;
  onRename: (val: string, el: HTMLInputElement) => void;
  onLimit: (field: 'maxStudents' | 'minStudents' | 'maxHizbs' | 'minHizbs' | 'maxPerCircle', val: string) => void;
  onDelete: () => void;
}) {
  const studentsPct = row.maxStudents ? Math.min(100, Math.round((row.studentsCount / row.maxStudents) * 100)) : 0;
  const hizbsPct = row.maxHizbs ? Math.min(100, Math.round((row.hizbsCount / row.maxHizbs) * 100)) : 0;
  const barColor = (pct: number) => pct >= 100 ? 'var(--bad)' : pct >= 80 ? 'var(--warn)' : 'var(--ok)';

  return (
    <div className="u-card" style={{ marginBottom: 0 }}>
      <input defaultValue={row.name} aria-label={`اسم ${row.name}`} disabled={saving}
        onBlur={(e) => onRename(e.target.value, e.currentTarget)}
        className="u-input" style={{ fontWeight: 700, height: 44, minHeight: 44 }} />

      <div className="u-between" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
        <div className="u-muted">
          <span className="u-num">{row.studentsCount}</span> طالب
          {row.maxStudents ? <> / <span className="u-num">{row.maxStudents}</span></> : ''} ·
          <span className="u-num" style={{ marginInlineStart: 4 }}>{row.hizbsCount}</span> حزب
          {row.maxHizbs ? <> / <span className="u-num">{row.maxHizbs}</span></> : ''}
        </div>
        {saving && <span className="u-pill mute">يُحفظ...</span>}
      </div>

      {(row.maxStudents || row.maxHizbs) && (
        <div style={{ marginTop: 8 }}>
          {row.maxStudents != null && (
            <div className="u-bar light" style={{ marginBottom: 6 }}>
              <i style={{ width: `${studentsPct}%`, background: barColor(studentsPct) }} />
            </div>
          )}
          {row.maxHizbs != null && (
            <div className="u-bar light">
              <i style={{ width: `${hizbsPct}%`, background: barColor(hizbsPct) }} />
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, padding: 10, background: 'var(--card2)', borderRadius: 12, border: '1px solid var(--line)' }}>
        <div className="u-muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--brand-ink)' }}>
          <svg width="14" height="14" style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          حدود السعة (تُستخدم في التوزيع الذكي)
        </div>
        <div className="u-grid2" style={{ gap: 8, marginBottom: 8 }}>
          <LimitField label="أدنى طلاب" value={row.minStudents} onSave={(v) => onLimit('minStudents', v)} />
          <LimitField label="أعلى طلاب" value={row.maxStudents} onSave={(v) => onLimit('maxStudents', v)} />
          <LimitField label="أدنى أحزاب" value={row.minHizbs} onSave={(v) => onLimit('minHizbs', v)} />
          <LimitField label="أعلى أحزاب" value={row.maxHizbs} onSave={(v) => onLimit('maxHizbs', v)} />
        </div>
        <LimitField
          label="أعلى طلاب من كل حلقة (للتنوع)"
          value={row.maxPerCircle}
          onSave={(v) => onLimit('maxPerCircle', v)}
        />
      </div>

      <button type="button" onClick={onDelete} className="u-btn u-btn-bad sm" style={{ marginTop: 10 }}>حذف</button>
    </div>
  );
}

function LimitField({ label, value, onSave }: { label: string; value: number | null; onSave: (v: string) => void }) {
  return (
    <label className="u-field" style={{ marginBottom: 0 }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink2)', fontWeight: 600 }}>{label}</span>
      <input
        type="number" min={0} step={1} defaultValue={value ?? ''}
        placeholder="بدون حد"
        onBlur={(e) => onSave(e.target.value)}
        className="u-input"
        style={{ height: 38, fontSize: 14 }}
      />
    </label>
  );
}

function AutoAssignModal({
  committees, onClose, onApplied
}: {
  committees: Committee[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [includeActive, setIncludeActive] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [applied, setApplied] = useState<null | { assigned: number; moved: number }>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !applying) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, applying]);

  async function preview() {
    setErr(null); setLoading(true); setPlan(null); setApplied(null);
    try {
      const res = await fetch('/api/committees/auto-assign', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun: true, includeActive })
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'فشل المعاينة'); return; }
      setPlan(d.plan);
    } finally { setLoading(false); }
  }

  async function apply() {
    if (!plan || applying) return;
    setApplying(true); setErr(null);
    try {
      const res = await fetch('/api/committees/auto-assign', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun: false, includeActive })
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'فشل التطبيق'); return; }
      setApplied({ assigned: d.plan.summary.assigned, moved: d.plan.summary.moved });
      setTimeout(onApplied, 1200);
    } finally { setApplying(false); }
  }

  return (
    <div className="fixed inset-0 grid place-items-center p-4 z-50" style={{ background: 'var(--overlay)' }}
      role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && !applying && onClose()}>
      <div className="flex flex-col w-full" style={{
        maxWidth: 720, maxHeight: '90vh', background: 'var(--card)',
        borderRadius: 18, border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)'
      }}>
        <div className="flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 className="font-bold" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>توزيع تلقائي ذكي للطلاب</span>
          </h3>
          <button type="button" onClick={onClose} disabled={applying} aria-label="إغلاق"
            className="u-icon-btn" style={{ width: 40, height: 40 }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ flex: 1 }}>
          <div className="u-note brand" style={{ marginBottom: 12 }}>
            <b>كيف يعمل التوزيع؟</b><br />
            يحترم القيود (أدنى/أعلى طلاب وأحزاب) + ينوّع بين الحلقات + يوازن المستويات + يفضّل اللجان الأقل حملاً.
          </div>

          <label className="u-field" style={{ marginBottom: 12 }}>
            <div className="u-row" style={{ gap: 10 }}>
              <input type="checkbox" checked={includeActive} onChange={(e) => setIncludeActive(e.target.checked)} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>إعادة توزيع الطلاب النشطين أيضاً</div>
                <div className="u-muted" style={{ marginTop: 2 }}>
                  افتراضياً يُوزّع فقط من "بانتظار اللجنة". فعّل هذا لإعادة توزيع كل الطلاب الجاهزين.
                </div>
              </div>
            </div>
          </label>

          {!plan && !loading && (
            <button type="button" onClick={preview} className="u-btn u-btn-s w">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <span>معاينة الاقتراح</span>
            </button>
          )}

          {loading && <div className="u-empty">...جاري الحساب</div>}

          {err && <div className="u-note bad" style={{ marginTop: 10 }}>⚠ {err}</div>}

          {applied && (
            <div className="u-note ok" style={{ marginTop: 10 }}>
              ✓ تم التطبيق — أُسنِد <b>{applied.assigned}</b> طالب
              {applied.moved > 0 && <> (منهم <b>{applied.moved}</b> نُقلوا من لجنة لأخرى)</>}
            </div>
          )}

          {plan && (
            <>
              <div className="u-grid3" style={{ marginTop: 14, marginBottom: 8 }}>
                <div className="u-stat"><div className="l">مُعيَّن</div><div className="v" style={{ color: 'var(--ok)' }}>{plan.summary.assigned}</div></div>
                <div className="u-stat"><div className="l">مُنقَل</div><div className="v" style={{ color: 'var(--info)' }}>{plan.summary.moved}</div></div>
                <div className="u-stat"><div className="l">متعذّر</div><div className="v" style={{ color: 'var(--bad)' }}>{plan.summary.unassignable}</div></div>
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '14px 0 6px' }}>الحمل بعد التطبيق</h4>
              <div className="u-list">
                {plan.committeesAfter.map((c) => (
                  <div key={c.id} className="u-item">
                    <div className="u-grow">
                      <div className="u-name">{c.name}</div>
                      <div className="u-muted">
                        طلاب: {c.studentsBefore} → <b>{c.studentsAfter}</b>
                        {c.maxStudents ? ` / ${c.maxStudents}` : ''} ·
                        أحزاب: {c.hizbsBefore} → <b>{c.hizbsAfter}</b>
                        {c.maxHizbs ? ` / ${c.maxHizbs}` : ''}
                      </div>
                    </div>
                    <span className="u-pill brand">+{c.studentsAfter - c.studentsBefore}</span>
                  </div>
                ))}
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '14px 0 6px' }}>تفاصيل التعيين</h4>
              <div className="th-rpt-table-wrap mobile-card-table">
                <table className="th-rpt-table">
                  <thead>
                    <tr>
                      <th>الطالب</th>
                      <th>اللجنة الحالية</th>
                      <th>←</th>
                      <th>اللجنة المقترحة</th>
                      <th>السبب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((r) => (
                      <tr key={r.studentId}>
                        <td data-label="الطالب" className="mobile-card-title" style={{ textAlign: 'right' }}><b>{r.studentName}</b></td>
                        <td data-label="اللجنة الحالية">{r.fromCommitteeId ? committees.find((c) => c.id === r.fromCommitteeId)?.name || '—' : '—'}</td>
                        <td data-label="النقل">←</td>
                        <td data-label="اللجنة المقترحة" style={{ color: r.toCommitteeId ? 'var(--brand-ink)' : 'var(--bad)' }}>
                          <b>{r.toCommitteeName || 'غير قابل للتعيين'}</b>
                        </td>
                        <td data-label="السبب" data-wide="true" style={{ fontSize: 11.5, color: 'var(--ink2)' }}>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={onClose} disabled={applying} className="u-btn u-btn-g" style={{ minHeight: 44 }}>
            {applied ? 'إغلاق' : 'إلغاء'}
          </button>
          {plan && !applied && (
            <>
              <button type="button" onClick={preview} disabled={applying} className="u-btn u-btn-s" style={{ minHeight: 44 }}>
                🔄 إعادة المعاينة
              </button>
              <button type="button" onClick={apply} disabled={applying || plan.summary.assigned === 0}
                className="u-btn u-btn-p" style={{ minHeight: 44 }}>
                {applying ? 'يُطبَّق...' : '✓ تطبيق التوزيع'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteCommitteeModal({
  target, saving, onConfirm, onCancel
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
      if (e.key === 'Escape' && !saving) { e.stopPropagation(); onCancel(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, saving]);

  return (
    <div className="fixed inset-0 grid place-items-center p-4 z-50" style={{ background: 'var(--overlay)' }}
      role="dialog" aria-modal="true" aria-labelledby="del-committee-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}>
      <div className="w-full max-w-md flex flex-col"
        style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex justify-between items-center" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <h3 id="del-committee-title" className="font-bold">تأكيد حذف اللجنة</h3>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="إغلاق" className="u-icon-btn" style={{ width: 44, height: 44 }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
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
          <button ref={confirmBtnRef} type="button" onClick={onConfirm} disabled={saving} className="u-btn u-btn-bad" style={{ minHeight: 44 }}>
            {saving ? 'جاري الحفظ...' : 'تأكيد الحذف'}
          </button>
        </div>
      </div>
    </div>
  );
}
