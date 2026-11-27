'use client';
import { usePathname } from 'next/navigation';

export default function ActiveProgramBannerClient({
  variant,
  children
}: {
  variant: 'brand' | 'bad';
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '';
  // The reciter is focused on the mushaf — no top banner there.
  if (pathname.includes('/mushaf-preview')) return null;
  return <div className={`u-note ${variant}`}>{children}</div>;
}
