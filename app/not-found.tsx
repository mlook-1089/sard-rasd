export const metadata = { title: 'الصفحة غير موجودة — منصة رصد' };

export default function NotFound() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 16 }}>
      <div className="u-card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', margin: 0 }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>📄</div>
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
