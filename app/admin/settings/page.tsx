'use client';
import { useEffect, useState } from 'react';
import BrandLogo, { announceBrandLogoChange } from '@/components/BrandLogo';

export default function SettingsPage() {
  const [s, setS] = useState<any | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [reciterPassword, setReciterPassword] = useState('');
  const [savingAdminPw, setSavingAdminPw] = useState(false);
  const [savingReciterPw, setSavingReciterPw] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [msg, setMsg] = useState<null | { ok: boolean; text: string }>(null);

  async function load() {
    const d = await fetch('/api/settings').then((r) => r.json());
    setS(d.settings);
  }
  useEffect(() => { load(); }, []);

  async function save(patch: any): Promise<boolean> {
    setMsg(null);
    setSavingField(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'خطأ في الحفظ' });
        return false;
      }
      setMsg({ ok: true, text: '✓ تم الحفظ' });
      await load();
      setTimeout(() => setMsg(null), 2200);
      return true;
    } finally {
      setSavingField(false);
    }
  }

  function handleNumericBlur(field: string, e: React.FocusEvent<HTMLInputElement>) {
    const clean = Math.max(0, Math.floor(Number(e.target.value) || 0));
    e.target.value = String(clean);
    if (s && clean === s[field]) return;
    save({ [field]: clean });
  }

  async function updateAdminPassword() {
    if (!adminPassword.trim() || savingAdminPw) return;
    setSavingAdminPw(true);
    try {
      const ok = await save({ adminPassword });
      if (ok) setAdminPassword('');
    } finally {
      setSavingAdminPw(false);
    }
  }

  async function updateReciterPassword() {
    if (!reciterPassword.trim() || savingReciterPw) return;
    setSavingReciterPw(true);
    try {
      const ok = await save({ reciterPassword });
      if (ok) setReciterPassword('');
    } finally {
      setSavingReciterPw(false);
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file || uploadingLogo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMsg({ ok: false, text: 'صيغة الشعار يجب أن تكون PNG أو JPG أو WebP' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ ok: false, text: 'حجم الشعار يجب ألا يتجاوز 2 ميجابايت' });
      return;
    }

    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const saved = await save({ logoUrl: dataUrl });
      if (saved) announceBrandLogoChange(dataUrl);
    } catch {
      setMsg({ ok: false, text: 'تعذر قراءة ملف الشعار' });
    } finally {
      setUploadingLogo(false);
    }
  }

  if (!s) return <div className="u-page"><div className="u-empty">...جاري التحميل</div></div>;

  return (
    <div className="u-page" style={{ maxWidth: 820, marginInline: 'auto' }}>
      <div className="u-top">
        <div>
          <h1>الإعدادات</h1>
          <div className="u-sub">التعديلات تُحفظ تلقائياً عند الخروج من الحقل. ستظهر رسالة تأكيد في الأعلى.</div>
        </div>
        {savingField && <span className="u-pill brand">جاري الحفظ...</span>}
      </div>

      {msg && (
        <div style={{ position: 'sticky', top: 8, zIndex: 30, marginBottom: 12 }}>
          <div className={`u-note ${msg.ok ? 'ok' : 'bad'}`} role="alert" style={{ marginBottom: 0, boxShadow: 'var(--shadow-lg)' }}>{msg.text}</div>
        </div>
      )}

      <Section title="الهوية والشعار">
        <div className="u-field"><label>اسم المؤسسة</label>
          <input defaultValue={s.institutionName} onBlur={(e) => e.target.value !== s.institutionName && save({ institutionName: e.target.value })} className="u-input" />
        </div>
        <div className="u-field"><label>الشعار المعتمد</label>
          <div style={{ width: 'min(280px, 100%)', marginTop: 8, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent' }}>
            {s.logoUrl
              ? <BrandLogo src={s.logoUrl} />
              : <div className="u-muted" style={{ textAlign: 'center', padding: '12px 6px', fontSize: 13 }}>لا يوجد شعار مرفوع</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <label className="u-btn u-btn-p sm" style={{ cursor: uploadingLogo ? 'wait' : 'pointer' }}>
              {uploadingLogo ? 'جاري رفع الشعار…' : 'رفع شعار من الجهاز'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadingLogo}
                onChange={(event) => {
                  uploadLogo(event.target.files?.[0]);
                  event.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>
            {s.logoUrl && (
              <button
                type="button"
                className="u-btn u-btn-bad sm"
                onClick={async () => {
                  const saved = await save({ logoUrl: null });
                  if (saved) announceBrandLogoChange(null);
                }}
              >
                حذف الشعار
              </button>
            )}
          </div>
          <div className="u-muted" style={{ marginTop: 6, fontSize: 11.5 }}>PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت. عند الحذف لن يظهر شعار في الواجهات أو الشهادات.</div>
        </div>
        <div className="u-field"><label>رابط صورة الدخول</label>
          <input dir="ltr" defaultValue={s.loginImageUrl || ''} onBlur={(e) => (e.target.value || null) !== (s.loginImageUrl || null) && save({ loginImageUrl: e.target.value || null })} className="u-input" />
          {s.loginImageUrl && <img src={s.loginImageUrl} alt="" style={{ height: 64, marginTop: 8, borderRadius: 10, border: '1px solid var(--line)' }} />}
        </div>
        <div className="u-field"><label>رابط خلفية الشهادة</label>
          <input dir="ltr" defaultValue={s.certificateBgUrl || ''} onBlur={(e) => (e.target.value || null) !== (s.certificateBgUrl || null) && save({ certificateBgUrl: e.target.value || null })} className="u-input" />
          {s.certificateBgUrl && <img src={s.certificateBgUrl} alt="" style={{ height: 80, marginTop: 8, borderRadius: 10, border: '1px solid var(--line)' }} />}
        </div>
      </Section>

      <Section title="الدرجات والخصومات">
        <div className="u-grid2 md4">
          <div className="u-field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-totalScore">الدرجة الكلية</label>
            <input id="set-totalScore" type="number" min={0} step={1} defaultValue={s.totalScore} onBlur={(e) => handleNumericBlur('totalScore', e)} className="u-input" />
          </div>
          <div className="u-field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-passThreshold">حد الرسوب</label>
            <input id="set-passThreshold" type="number" min={0} step={1} defaultValue={s.passThreshold} onBlur={(e) => handleNumericBlur('passThreshold', e)} className="u-input" />
          </div>
          <div className="u-field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-errorDeduction">خصم الخطأ</label>
            <input id="set-errorDeduction" type="number" min={0} step={1} defaultValue={s.errorDeduction} onBlur={(e) => handleNumericBlur('errorDeduction', e)} className="u-input" />
          </div>
          <div className="u-field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-alertDeduction">خصم التنبيه</label>
            <input id="set-alertDeduction" type="number" min={0} step={1} defaultValue={s.alertDeduction} onBlur={(e) => handleNumericBlur('alertDeduction', e)} className="u-input" />
          </div>
          <div className="u-field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-slowSessionMinutes">دقائق البطء</label>
            <input id="set-slowSessionMinutes" type="number" min={0} step={1} defaultValue={s.slowSessionMinutes} onBlur={(e) => handleNumericBlur('slowSessionMinutes', e)} className="u-input" />
          </div>
          <div className="u-field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-stuckSessionMinutes">دقائق التعثر</label>
            <input id="set-stuckSessionMinutes" type="number" min={0} step={1} defaultValue={s.stuckSessionMinutes} onBlur={(e) => handleNumericBlur('stuckSessionMinutes', e)} className="u-input" />
          </div>
        </div>
      </Section>

      <Section title="لوحة الشرف — تسميات الإحصائيات">
        {([
          ['hizbs', 'الأحزاب المنجزة'],
          ['pages', 'الأوجه المقروءة'],
          ['circles', 'عدد الحلقات'],
          ['students', 'عدد الطلاب'],
          ['completion', 'نسبة الإنجاز'],
          ['sessions', 'جلسات التسميع']
        ] as const).map(([k, defaultLabel]) => (
          <div key={k} className="u-field">
            <label>{defaultLabel}</label>
            <input
              defaultValue={s.honorLabels?.[k] || defaultLabel}
              onBlur={(e) => save({ honorLabels: { ...s.honorLabels, [k]: e.target.value } })}
              className="u-input"
            />
          </div>
        ))}
      </Section>

      <Section title="قالب الواتساب">
        <div className="u-note brand" style={{ marginBottom: 10 }}>
          المتغيرات المتاحة: <code>{'{name} {memorized} {hizbs} {errors} {alerts} {completion}'}</code>
        </div>
        <textarea
          defaultValue={s.whatsappTemplate}
          onBlur={(e) => e.target.value !== s.whatsappTemplate && save({ whatsappTemplate: e.target.value })}
          rows={6}
          className="u-input"
          style={{ height: 'auto', padding: 12, lineHeight: 1.6, fontFamily: 'ui-monospace, monospace' }}
        />
        <div className="u-note ok" style={{ marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          <b>معاينة:</b>{'\n'}
          {(s.whatsappTemplate || '')
            .replace(/\{name\}/g, 'أحمد')
            .replace(/\{memorized\}/g, '18')
            .replace(/\{hizbs\}/g, '30')
            .replace(/\{errors\}/g, '4')
            .replace(/\{alerts\}/g, '2')
            .replace(/\{completion\}/g, '60')}
        </div>
      </Section>

      <Section title="الأمان">
        <div className="u-field">
          <label htmlFor="set-admin-pw">كلمة مرور المدير الجديدة</label>
          <div className="u-row" style={{ gap: 6 }}>
            <input
              id="set-admin-pw"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="كلمة مرور جديدة للمدير"
              className="u-input"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              disabled={!adminPassword.trim() || savingAdminPw}
              onClick={updateAdminPassword}
              className="u-btn u-btn-p"
            >
              {savingAdminPw ? 'جاري الحفظ...' : 'تحديث'}
            </button>
          </div>
        </div>
        <div className="u-field">
          <label htmlFor="set-reciter-pw">كلمة مرور المسمع المشتركة الجديدة</label>
          <div className="u-row" style={{ gap: 6 }}>
            <input
              id="set-reciter-pw"
              value={reciterPassword}
              onChange={(e) => setReciterPassword(e.target.value)}
              placeholder="كلمة مرور جديدة للمسمعين"
              className="u-input"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              disabled={!reciterPassword.trim() || savingReciterPw}
              onClick={updateReciterPassword}
              className="u-btn u-btn-p"
            >
              {savingReciterPw ? 'جاري الحفظ...' : 'تحديث'}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="u-card">
      <div className="u-card-h"><h3>{title}</h3></div>
      <div>{children}</div>
    </section>
  );
}
