'use client';

import { useEffect, useState, type CSSProperties } from 'react';

export const BRAND_LOGO_SRC = '/brand-logo.png';

let cachedUploadedLogo: string | null | undefined;
let brandingRequest: Promise<string | null> | null = null;

export function announceBrandLogoChange(logo: string | null) {
  cachedUploadedLogo = logo;
  brandingRequest = Promise.resolve(logo);
  window.dispatchEvent(new CustomEvent('sard-brand-logo-change', { detail: logo }));
}

async function loadUploadedLogo(): Promise<string | null> {
  if (cachedUploadedLogo !== undefined) return cachedUploadedLogo;
  if (!brandingRequest) {
    brandingRequest = fetch('/api/public/branding', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => typeof data?.logoUrl === 'string' && data.logoUrl ? data.logoUrl : null)
      .catch(() => null)
      .then((logo) => {
        cachedUploadedLogo = logo;
        return logo;
      });
  }
  return brandingRequest;
}

export default function BrandLogo({
  className = '',
  style,
  alt = 'شعار منصة رصد',
  src
}: {
  className?: string;
  style?: CSSProperties;
  alt?: string;
  src?: string | null;
}) {
  const [resolvedSrc, setResolvedSrc] = useState(src || cachedUploadedLogo || BRAND_LOGO_SRC);

  useEffect(() => {
    const onBrandChange = (event: Event) => {
      const logo = (event as CustomEvent<string | null>).detail;
      setResolvedSrc(logo || BRAND_LOGO_SRC);
    };
    window.addEventListener('sard-brand-logo-change', onBrandChange);
    if (src) {
      setResolvedSrc(src);
      return () => window.removeEventListener('sard-brand-logo-change', onBrandChange);
    }
    let alive = true;
    loadUploadedLogo().then((uploadedLogo) => {
      if (alive && uploadedLogo) setResolvedSrc(uploadedLogo);
    });
    return () => {
      alive = false;
      window.removeEventListener('sard-brand-logo-change', onBrandChange);
    };
  }, [src]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      style={style}
      width={2595}
      height={1000}
      draggable={false}
    />
  );
}
