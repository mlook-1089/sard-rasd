import type { CSSProperties } from 'react';

export const BRAND_LOGO_SRC = '/brand-logo.png';

export default function BrandLogo({
  className = '',
  style,
  alt = 'شعار منصة رصد'
}: {
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      style={style}
      width={2595}
      height={1000}
      draggable={false}
    />
  );
}
