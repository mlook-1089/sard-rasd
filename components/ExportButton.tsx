'use client';
export default function ExportButton({ href, label = 'تصدير إكسل' }: { href: string; label?: string }) {
  return (
    <a href={href} className="u-btn u-btn-ok sm" style={{ textDecoration: 'none' }}>
      <span>📥</span><span>{label}</span>
    </a>
  );
}
