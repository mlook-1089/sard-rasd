'use client';
import { useEffect, useRef, useState } from 'react';

type ConfirmAction = {
  kind: 'regenerate' | 'delete';
  id: number;
  name: string;
};

export default function CirclesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const d = await fetch('/api/circles', { cache: 'no-store' }).then((r) => r.json());
      setRows(d.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
  }, []);

  // Auto-focus confirm button & handle Escape key when confirmation modal is open
  useEffect(() => {
    if (!confirmModal) return;
    const t = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmBusy) {
        setConfirmModal(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [confirmModal, confirmBusy]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (adding || !name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), teacherName: teacherName.trim(), teacherPhone: teacherPhone.trim(), generateLink: true })
      });
      if (res.ok) {
        setName('');
        setTeacherName('');
        setTeacherPhone('');
        await load(false);
      }
    } finally {
      setAdding(false);
    }
  }

  async function autoLinks() {
    if (autoLinking) return;
    setAutoLinking(true);
    try {
      await fetch('/api/circles/auto-tokens', { method: 'POST' });
      await load(false);
    } finally {
      setAutoLinking(false);
    }
  }

  async function patch(id: number, patchBody: any) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/circles/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patchBody)
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.row) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...d.row } : r)));
        setSavedId(id);
        setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1800);
      }
      await load(false);
    } finally {
      setBusyId(null);
    }
  }

  async function executeConfirmedAction() {
    if (!confirmModal || confirmBusy) return;
    setConfirmBusy(true);
    setBusyId(confirmModal.id);
    try {
      if (confirmModal.kind === 'regenerate') {
        const res = await fetch(`/api/circles/${confirmModal.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'regenerate_token' })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.row) {
          setRows((prev) => prev.map((r) => (r.id === confirmModal.id ? { ...r, ...d.row } : r)));
        }
      } else if (confirmModal.kind === 'delete') {
        await fetch(`/api/circles/${confirmModal.id}`, { method: 'DELETE' });
        setRows((prev) => prev.filter((r) => r.id !== confirmModal.id));
      }
      setConfirmModal(null);
      await load(false);
    } finally {
      setConfirmBusy(false);
      setBusyId(null);
    }
  }

  function copyUrl(id: number, url: string) {
    const markCopied = () => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(markCopied).catch(() => {
        fallbackCopy(url);
        markCopied();
      });
    } else {
      fallbackCopy(url);
      markCopied();
    }
  }

  function fallbackCopy(text: string) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      // ignore
    }
  }

  function waLink(phone: string | null, url: string) {
    if (!phone) return null;
    let p = phone.replace(/\D/g, '');
    if (!p) return null;
    if (p.startsWith('00')) p = p.slice(2);
    if (p.startsWith('0')) p = '966' + p.slice(1);
    const text = encodeURIComponent(`السلام عليكم، هذا رابطكم لإدارة أحزاب طلاب حلقتكم:\n${url}`);
    return `https://wa.me/${p}?text=${text}`;
  }

  return (
    <div className="u-page">
      <div className="u-top" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1>الحلقات والمعلمون</h1>
          <div className="u-sub">إدارة حلقات المجمع وبيانات المعلمين وروابط تحديد الأحزاب</div>
        </div>
        <div className="u-actions">
          <button
            type="button"
            onClick={autoLinks}
            disabled={autoLinking}
            className="u-btn u-btn-s"
            style={{ minHeight: 44, minWidth: 44, padding: '0 16px' }}
          >
            {autoLinking ? 'جاري الحفظ...' : 'إنشاء روابط تلقائياً'}
          </button>
        </div>
      </div>

      <form onSubmit={add} className="u-card">
        <div className="u-card-h">
          <h2>إضافة حلقة جديدة</h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 10,
            alignItems: 'end'
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>اسم الحلقة</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الحلقة"
              className="u-input"
              style={{ width: '100%', minWidth: 0, height: 46 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>اسم المعلم</label>
            <input
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="اسم المعلم"
              className="u-input"
              style={{ width: '100%', minWidth: 0, height: 46 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>جوال المعلم</label>
            <input
              dir="ltr"
              value={teacherPhone}
              onChange={(e) => setTeacherPhone(e.target.value)}
              placeholder="05XXXXXXXX"
              className="u-input"
              style={{ width: '100%', minWidth: 0, height: 46 }}
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="u-btn u-btn-p"
            style={{ minHeight: 46, minWidth: 110, width: '100%' }}
          >
            {adding ? 'جاري الحفظ...' : 'إضافة'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : rows.length === 0 ? (
        <div className="u-empty">لا توجد حلقات بعد. أضف أولى الحلقات أعلاه.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const url = r.linkToken ? `${origin}/teacher/${r.linkToken}` : null;
            const isBusy = busyId === r.id;
            const isCopied = copiedId === r.id;
            const wa = url ? waLink(r.teacherPhone, url) : null;

            return (
              <div key={r.id} className="u-card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="u-name" style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</span>
                    <span className="u-pill brand">
                      <span className="u-num">{r.studentsCount ?? 0}</span>
                      <span>طلاب</span>
                    </span>
                    {savedId === r.id && <span className="u-pill ok">تم الحفظ ✓</span>}
                  </div>
                  {r.linkToken ? (
                    <span className="u-pill ok">الرابط مفعل</span>
                  ) : (
                    <span className="u-pill mute">بدون رابط</span>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 10
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>الحلقة</label>
                    <input
                      key={`name-${r.id}-${r.name}`}
                      defaultValue={r.name}
                      disabled={isBusy}
                      aria-label={`اسم الحلقة ${r.name}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== r.name) patch(r.id, { name: val });
                      }}
                      className="u-input"
                      style={{ width: '100%', minWidth: 0, height: 44 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>المعلم</label>
                    <input
                      key={`teacher-${r.id}-${r.teacherName || ''}`}
                      defaultValue={r.teacherName || ''}
                      disabled={isBusy}
                      placeholder="اسم المعلم"
                      aria-label={`معلم الحلقة ${r.name}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (r.teacherName || '')) patch(r.id, { teacherName: val });
                      }}
                      className="u-input"
                      style={{ width: '100%', minWidth: 0, height: 44 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>الجوال</label>
                    <input
                      key={`phone-${r.id}-${r.teacherPhone || ''}`}
                      dir="ltr"
                      defaultValue={r.teacherPhone || ''}
                      disabled={isBusy}
                      placeholder="05XXXXXXXX"
                      aria-label={`جوال معلم الحلقة ${r.name}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (r.teacherPhone || '')) patch(r.id, { teacherPhone: val });
                      }}
                      className="u-input"
                      style={{ width: '100%', minWidth: 0, height: 44 }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--line)'
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {url ? (
                      <>
                        <button
                          type="button"
                          onClick={() => copyUrl(r.id, url)}
                          className={`u-btn ${isCopied ? 'u-btn-ok' : 'u-btn-g'}`}
                          style={{ minHeight: 44, minWidth: 76, padding: '0 14px' }}
                        >
                          {isCopied ? 'تم النسخ ✓' : 'نسخ'}
                        </button>
                        <a
                          href={`/teacher/${r.linkToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="u-btn u-btn-g"
                          style={{ textDecoration: 'none', minHeight: 44, minWidth: 68, padding: '0 14px' }}
                        >
                          فتح
                        </a>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="u-btn u-btn-ok"
                            style={{ textDecoration: 'none', minHeight: 44, minWidth: 76, padding: '0 14px' }}
                          >
                            واتساب
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmModal({ kind: 'regenerate', id: r.id, name: r.name })}
                          className="u-btn u-btn-s"
                          style={{ minHeight: 44, minWidth: 76, padding: '0 14px' }}
                        >
                          {isBusy ? 'جاري الحفظ...' : 'تجديد'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => patch(r.id, { action: 'regenerate_token' })}
                        className="u-btn u-btn-p"
                        style={{ minHeight: 44, minWidth: 100, padding: '0 14px' }}
                      >
                        {isBusy ? 'جاري الحفظ...' : 'إنشاء رابط'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmModal({ kind: 'delete', id: r.id, name: r.name })}
                    className="u-btn u-btn-bad"
                    style={{ minHeight: 44, minWidth: 72, padding: '0 14px' }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-UI Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          style={{
            background: 'var(--overlay)',
            display: 'grid',
            placeItems: 'center',
            padding: 16
          }}
          onClick={() => !confirmBusy && setConfirmModal(null)}
        >
          <div
            className="u-card"
            style={{
              maxWidth: 420,
              width: '100%',
              margin: 0,
              padding: 20,
              borderRadius: 20,
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="confirm-modal-title"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: confirmModal.kind === 'delete' ? 'var(--bad)' : 'var(--ink)',
                margin: '0 0 8px'
              }}
            >
              {confirmModal.kind === 'regenerate' ? 'تأكيد تجديد رابط المعلم' : 'تأكيد حذف الحلقة'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, margin: '0 0 18px' }}>
              {confirmModal.kind === 'regenerate'
                ? `سيتم إبطال الرابط الحالي فوراً وتوليد رابط جديد لحلقة «${confirmModal.name}». هل تريد المتابعة؟`
                : `هل أنت متأكد من حذف حلقة «${confirmModal.name}»؟ لا يمكن التراجع عن هذا الإجراء.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmModal(null)}
                className="u-btn u-btn-g"
                style={{ minHeight: 44, minWidth: 84, padding: '0 16px' }}
              >
                إلغاء
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                disabled={confirmBusy}
                onClick={executeConfirmedAction}
                className={`u-btn ${confirmModal.kind === 'delete' ? 'u-btn-bad' : 'u-btn-p'}`}
                style={{ minHeight: 44, minWidth: 110, padding: '0 16px' }}
              >
                {confirmBusy
                  ? 'جاري الحفظ...'
                  : confirmModal.kind === 'regenerate'
                    ? 'تأكيد التجديد'
                    : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
