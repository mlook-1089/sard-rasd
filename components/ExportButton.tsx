'use client';
import { icons } from './icons';

export default function ExportButton({ href, label = 'تصدير إكسل' }: { href: string; label?: string }) {
  return (
    <a href={href} className="u-btn u-btn-ok sm" style={{ textDecoration: 'none' }} title={label}>
      {icons.download}
      <span>{label}</span>
    </a>
  );
}
