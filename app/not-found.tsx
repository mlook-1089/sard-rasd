export const metadata = { title: 'الصفحة غير موجودة — منصة رصد' };

export default function NotFound() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 16 }}>
      <div className="u-card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', margin: 0 }}>
        <div style={{ width: 72, height: 72, margin: '0 auto', borderRadius: 18, background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center' }}>
          <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: '12px 0 6px' }}>
          الصفحة غير موجودة
        </h1>
        <p style={{ color: 'var(--ink2)', marginBottom: 16, lineHeight: 1.7 }}>
          الرابط الذي تحاول فتحه غير صحيح أو حُذف.
        </p>
        <a href="/" className="u-btn u-btn-p" style={{ textDecoration: 'none' }}>العودة للرئيسية</a>
      </div>
    </main>
  );
}
