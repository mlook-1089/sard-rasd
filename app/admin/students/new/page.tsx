'use client';
import { useEffect, useState } from 'react';

export default function NewStudentPage() {
  const [mode, setMode] = useState<'single' | 'import'>('single');
  const [circles, setCircles] = useState<any[]>([]);
  useEffect(() => { fetch('/api/circles').then((r) => r.json()).then((d) => setCircles(d.rows || [])); }, []);

  return (
    <div className="u-page" style={{ maxWidth: 680, marginInline: 'auto' }}>
      <div className="u-top"><div><h1>إضافة طلاب</h1></div></div>

      <div className="u-seg" style={{ marginBottom: 12 }}>
        <button onClick={() => setMode('single')} className={mode === 'single' ? 'on' : ''}>إضافة فردية</button>
        <button onClick={() => setMode('import')} className={mode === 'import' ? 'on' : ''}>استيراد من إكسل</button>
      </div>

      {mode === 'single' ? <SingleForm circles={circles} /> : <ImportForm />}
    </div>
  );
}

function SingleForm({ circles }: { circles: any[] }) {
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [level, setLevel] = useState('');
  const [circleId, setCircleId] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<null | { ok: boolean; text: string }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          nationalId,
          parentPhone,
          level,
          circleId: circleId ? Number(circleId) : null,
          password: password || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'خطأ في الحفظ' });
        return;
      }
      setMsg({ ok: true, text: `تم. كلمة مرور الطالب: ${data.password}` });
      setName('');
      setNationalId('');
      setParentPhone('');
      setLevel('');
      setPassword('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'فشل الاتصال بالخادم' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="u-card">
      <div className="u-field"><label>الاسم *</label><input required value={name} onChange={(e) => setName(e.target.value)} className="u-input" /></div>
      <div className="u-field"><label>رقم الهوية (هو كلمة مرور دخول الطالب)</label><input dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="u-input" placeholder="10XXXXXXXX" /></div>
      <div className="u-field"><label>رقم ولي الأمر</label><input type="tel" inputMode="tel" dir="ltr" value={parentPhone} onChange={(e) => setParentPhone(e.target.value.replace(/[^0-9+\s-]/g, ''))} className="u-input" placeholder="05XXXXXXXX" /></div>
      <div className="u-field"><label>المستوى</label><input value={level} onChange={(e) => setLevel(e.target.value)} className="u-input" /></div>
      <div className="u-field">
        <label>الحلقة</label>
        <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="u-input">
          <option value="">—</option>
          {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <p className="u-muted" style={{ marginBottom: 12 }}>كلمة مرور دخول الطالب هي رقم هويته تلقائياً. بعد الإضافة سيكون الطالب في حالة "بانتظار الأحزاب".</p>
      {msg && <div role={msg.ok ? 'status' : 'alert'} className={`u-note ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
      <button type="submit" disabled={saving} className="u-btn u-btn-p w">
        {saving ? 'جاري الحفظ...' : 'إضافة'}
      </button>
    </form>
  );
}

function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function upload() {
    if (!file || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const isXlsx = /\.xlsx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const body: any = isXlsx ? await file.arrayBuffer() : await file.text();
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: {
          'content-type': isXlsx
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
          'x-filename': encodeURIComponent(file.name)
        },
        body
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        setError(data?.error || `فشل الاستيراد (HTTP ${res.status})`);
        setResult(null);
      } else if ((!Array.isArray(data?.created) || data.created.length === 0) && (!Array.isArray(data?.skipped) || data.skipped.length === 0)) {
        setError('لم يتم العثور على طلاب صالحين للاستيراد في الملف');
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e?.message || 'فشل الاتصال بالخادم');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setError(null);
      setResult(null);
    }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const headers = ['الاسم', 'الهوية', 'ولي الأمر', 'المستوى', 'الحلقة'];
    const rows = [
      headers,
      ['أحمد محمد', '1234567890', '0501234567', 'متوسط 1', 'حلقة حمزة'],
      ['عبدالله علي', '', '', 'ابتدائي 3', 'حلقة الزبير']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    (ws as any)['!views'] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'نموذج-الطلاب.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="u-card">
      <div className="u-note brand" style={{ marginBottom: 12 }}>
        <div><b>ترتيب الأعمدة:</b> الاسم, الهوية, ولي الأمر, المستوى, الحلقة</div>
        <div style={{ opacity: .85, marginTop: 4 }}>اسم الحلقة يجب أن يطابق حلقة موجودة. يدعم .xlsx أو CSV (UTF-8).</div>
      </div>
      <button type="button" onClick={downloadTemplate} className="u-btn u-btn-s sm" style={{ marginBottom: 12 }}>
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"/></svg>
        <span>تنزيل نموذج Excel فارغ</span>
      </button>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          display: 'block', cursor: 'pointer', textAlign: 'center',
          padding: 32, borderRadius: 14,
          border: `2px dashed ${dragOver ? 'var(--brand)' : 'var(--line2)'}`,
          background: dragOver ? 'var(--brand-soft)' : 'var(--card2)',
          transition: 'background .15s, border-color .15s'
        }}
      >
        <div style={{ width: 56, height: 56, margin: '0 auto 8px', borderRadius: 14, background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center' }}>
          <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <div className="u-name" style={{ marginBottom: 2 }}>اسحب الملف هنا</div>
        <div className="u-muted" style={{ marginBottom: 12 }}>أو انقر لاختيار ملف (.xlsx أو .csv)</div>
        <input
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setError(null);
            setResult(null);
          }}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
        />
        {!file ? (
          <span className="u-btn u-btn-p sm" style={{ display: 'inline-flex' }}>اختر ملفاً</span>
        ) : (
          <span className="u-pill ok">✓ {file.name}</span>
        )}
      </label>

      <button type="button" onClick={upload} disabled={!file || loading} className="u-btn u-btn-p w" style={{ marginTop: 12 }}>
        {loading ? 'جاري الحفظ...' : 'استيراد'}
      </button>

      {error && (
        <div style={{ marginTop: 12 }}>
          <div role="alert" className="u-note bad">⚠ {error}</div>
        </div>
      )}

      {result && !error && (Array.isArray(result.created) || Array.isArray(result.skipped)) && (
        <div style={{ marginTop: 12 }}>
          <div className="u-note ok">✓ أُضيف {result.created?.length || 0} طالب</div>
          {result.skipped?.length > 0 && <div className="u-note warn" style={{ marginTop: 6 }}>⚠ تم تخطي {result.skipped.length} صف (موجود مسبقاً أو فارغ)</div>}
          {result.created?.length > 0 && (
          <details className="u-muted" style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--brand-ink)', fontWeight: 600 }}>عرض أرقام الهوية / كلمات المرور ({result.created.length})</summary>
            <div className="u-card" style={{ padding: 0, marginTop: 8 }}>
              <table className="w-full text-sm">
                <thead><tr><th className="text-right p-1">الاسم</th><th>رقم الهوية / كلمة المرور</th></tr></thead>
                <tbody>{result.created.map((r: any, i: number) => (
                  <tr key={i} className="border-t"><td className="text-right p-1">{r.name}</td><td className="font-mono text-center">{r.password}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
          )}
        </div>
      )}
    </div>
  );
}
