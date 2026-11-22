'use client';
import { useEffect, useState } from 'react';

export default function ReciterHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(curTag?: string, curName?: string) {
    const t = curTag ?? tag;
    const n = curName ?? name;
    const params = new URLSearchParams();
    if (t) params.set('deviceTag', t);
    if (n) params.set('reciterName', n);
    const qs = params.toString();
    const d = await fetch(`/api/sessions${qs ? `?${qs}` : ''}`, { cache: 'no-store' }).then((r) => r.json());
    setRows(d.rows || []);
    setLoading(false);
  }

  useEffect(() => {
    let t = '';
    let n = '';
    try {
      t = localStorage.getItem('sard_device_tag') || '';
      if (!t) {
        t = 'dev_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('sard_device_tag', t);
      }
      const setup = JSON.parse(localStorage.getItem('sard_reciter_setup') || '{}');
      n = (setup.name || '').trim();
      setTag(t);
      setName(n);
    } catch {}
    load(t, n);
  }, []);

  const mine = rows.filter((r) =>
    (tag && r.deviceTag === tag) || (name && r.reciterName === name)
  );

  return (
    <div className="u-page">
      <div className="u-top">
        <div><h1>سجلاتي من هذا الجهاز</h1></div>
      </div>

      <div className={`u-note ${name || tag ? 'info' : 'warn'}`}>
        {name
          ? <>ترى جميع سجلاتك المرصودة من هذا الجهاز (أو باسم <b>{name}</b>) حتى عند تعديل الاسم. لا يمكن الحذف.</>
          : <>لم تكتب اسم مسمع على هذا الجهاز بعد — افتح <b>الإعدادات</b> لتسجيل الاسم ثم ابدأ الرصد.</>
        }
      </div>

      {err && <div className="u-note bad" style={{ position: 'sticky', top: 8, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}>⚠ {err}</div>}

      <div className="u-card">
        {loading ? (
          <div className="u-empty">...جاري التحميل</div>
        ) : mine.length === 0 ? (
          <div className="u-empty">لا توجد سجلات من هذا الجهاز بعد</div>
        ) : (
          <div className="th-rpt-table-wrap">
            <table className="th-rpt-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الطالب</th>
                  <th>الحزب</th>
                  <th>الأخطاء</th>
                  <th>التنبيهات</th>
                  <th>الدرجة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.startedAt).toLocaleDateString('ar')}</td>
                    <td><b>{r.studentName}</b></td>
                    <td>{r.hizbNumber}</td>
                    <td style={{ color: 'var(--bad)' }}>{r.errors}</td>
                    <td style={{ color: 'var(--warn)' }}>{r.alerts}</td>
                    <td>
                      {r.score != null ? (
                        <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>{r.score}</span>
                      ) : '—'}
                    </td>
                    <td>
                      <button onClick={() => setEditing(r)} className="u-btn u-btn-s sm">تعديل</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditRecordModal
          row={editing}
          deviceTag={tag}
          reciterName={name}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(tag, name); }}
          onError={(m) => { setErr(m); setTimeout(() => setErr(null), 3200); }}
        />
      )}
    </div>
  );
}

function EditRecordModal({ row, deviceTag, reciterName, onClose, onSaved, onError }: {
  row: any;
  deviceTag: string;
  reciterName: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [errors, setErrors] = useState<string>(String(row.errors ?? 0));
  const [alerts, setAlerts] = useState<string>(String(row.alerts ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function clamp(s: string) {
    const n = Math.floor(Number(s));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${row.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'edit', errors: clamp(errors), alerts: clamp(alerts), deviceTag, reciterName })
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'var(--overlay)' }}
    >
      <div className="u-card" style={{ margin: 0, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="u-card-h" style={{ marginBottom: 10 }}>
          <h3>تعديل الأخطاء والتنبيهات</h3>
          <button onClick={onClose} className="u-icon-btn" aria-label="إغلاق">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div className="u-muted" style={{ marginBottom: 10 }}>الطالب: <b>{row.studentName}</b> · الحزب <b>{row.hizbNumber}</b></div>
          <div className="u-field">
            <label>عدد الأخطاء</label>
            <input type="number" min={0} step={1} value={errors} onChange={(e) => setErrors(e.target.value)} className="u-input" autoFocus />
          </div>
          <div className="u-field">
            <label>عدد التنبيهات</label>
            <input type="number" min={0} step={1} value={alerts} onChange={(e) => setAlerts(e.target.value)} className="u-input" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <button onClick={onClose} className="u-btn u-btn-g" disabled={saving}>إلغاء</button>
          <button onClick={save} className="u-btn u-btn-p" disabled={saving}>{saving ? '...جاري الحفظ' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
