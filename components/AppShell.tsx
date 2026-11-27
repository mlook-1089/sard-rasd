'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { icons } from './icons';
import BrandLogo from './BrandLogo';

export type NavSection = { href: string; label: string; icon?: React.ReactNode };
export type NavItem = { href: string; label: string; icon: React.ReactNode; mobile?: boolean; sections?: NavSection[] };

export default function AppShell({
  title,
  subtitle,
  role,
  userName,
  userRoleLabel,
  nav,
  children,
  hideBottomNav = false
}: {
  title: string;
  subtitle?: string;
  role?: 'admin' | 'supervisor' | 'reciter' | 'student';
  userName?: string;
  userRoleLabel?: string;
  nav: NavItem[];
  children: React.ReactNode;
  /** When true, hide the mobile bottom nav and position the hamburger on the right (start in RTL). */
  hideBottomNav?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [sheetOpen, setSheetOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkNavScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    setCanScrollDown(remaining > 6);
  }, []);

  useEffect(() => {
    checkNavScroll();
    const el = navRef.current;
    const ro = typeof ResizeObserver !== 'undefined' && el
      ? new ResizeObserver(() => checkNavScroll())
      : null;
    if (ro && el) ro.observe(el);
    window.addEventListener('resize', checkNavScroll);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', checkNavScroll);
    };
  }, [checkNavScroll, nav.length, pathname]);

  async function logout() {
    if (role === 'supervisor' || role === 'reciter') {
      try {
        const res = await fetch('/api/sessions/live?scope=' + (role === 'supervisor' ? 'mine' : 'all'), { cache: 'no-store' });
        const data = await res.json();
        const rows: any[] = data.rows || [];
        let relevant = rows;
        if (role === 'reciter') {
          const myTag = typeof window !== 'undefined' ? localStorage.getItem('sard_device_tag') : null;
          relevant = rows.filter((r) => myTag && r.deviceTag === myTag);
        }
        if (relevant.length > 0) {
          const ok = confirm(`⚠ لديك ${relevant.length} جلسة تسميع غير منتهية. هل تريد الخروج فعلاً؟`);
          if (!ok) return;
        }
      } catch {}
    }
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  // Helper to score a target href against the current clean pathname:
  // Exact match gets 10000 + length; prefix match (for non-root paths) gets length; otherwise -1.
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  function scoreHref(targetHref: string): number {
    const th = targetHref.replace(/\/+$/, '') || '/';
    if (th === cleanPath) return 10000 + th.length;
    if (th === '/admin' || th === '/supervisor' || th === '/reciter' || th === '/') return -1;
    if (cleanPath.startsWith(th + '/')) return th.length;
    return -1;
  }

  // Active top-level nav item = the item whose href or any of its sections has the highest match score.
  const activeNav: NavItem | null = (() => {
    let bestItem: NavItem | null = null;
    let bestScore = -1;
    for (const n of nav) {
      const candidates = [n.href, ...(n.sections?.map((s) => s.href) || [])];
      for (const c of candidates) {
        const sc = scoreHref(c);
        if (sc > bestScore) {
          bestScore = sc;
          bestItem = n;
        }
      }
    }
    return bestItem;
  })();

  // Active sub-section within activeNav (exact match beats prefix match, preventing /admin/students & /admin/students/new from both lighting up)
  const activeSectionHref: string | null = (() => {
    if (!activeNav?.sections || activeNav.sections.length === 0) return null;
    let bestHref: string | null = null;
    let bestScore = -1;
    for (const sec of activeNav.sections) {
      const sc = scoreHref(sec.href);
      if (sc > bestScore) {
        bestScore = sc;
        bestHref = sec.href;
      }
    }
    return bestHref;
  })();

  const activeHref = activeNav?.href ?? null;
  const isActive = (href: string) => href === activeHref;
  const isSectionActive = (href: string) => href === activeSectionHref;
  const mobileItems = nav.filter((n) => n.mobile);

  // Close mobile drawer when route changes
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Close the mobile sheet when pressing Escape
  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  // Close the mobile sheet automatically when the viewport grows to desktop (>= 768px / >= 960px),
  // so an old drawer never hangs on the screen after a resize.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqMd = window.matchMedia('(min-width: 768px)');
    const mqLg = window.matchMedia('(min-width: 960px)');
    const onResize = () => {
      if (window.innerWidth >= 768 || mqMd.matches || mqLg.matches) {
        setSheetOpen(false);
      }
    };
    mqMd.addEventListener?.('change', onResize);
    mqLg.addEventListener?.('change', onResize);
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      mqMd.removeEventListener?.('change', onResize);
      mqLg.removeEventListener?.('change', onResize);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="app-shell">
      {/* Desktop sidebar — RTL: start-0 puts it on the RIGHT side where Arabic readers expect it */}
      <aside
        className="app-sidebar hidden md:flex fixed inset-y-0 start-0 z-40 flex-col"
        style={{ width: 260, background: 'var(--card)', borderInlineEnd: '1px solid var(--line)' }}
      >
        {/* Brand header — fixed */}
        <div className="shrink-0 p-5 text-center" style={{ borderBottom: '1px solid var(--line)' }}>
          <BrandLogo className="brand-logo-sidebar" />
          {subtitle && <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink3)' }}>{subtitle}</p>}
        </div>

        {/* Scrollable nav wrapper with visual scroll indicator for short viewports (< 700px) */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <nav
            ref={navRef}
            onScroll={checkNavScroll}
            className="app-sidebar-nav flex-1 min-h-0 overflow-y-auto pt-3 px-3 space-y-1"
            style={{ paddingBottom: 28, scrollBehavior: 'smooth' }}
          >
            {nav.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition"
                  style={active
                    ? { background: 'var(--brand-soft)', color: 'var(--brand-ink)' }
                    : { color: 'var(--ink2)' }}
                >
                  <span className="app-sidebar-ic w-5 h-5 flex items-center justify-center shrink-0">{n.icon}</span>
                  <span className="flex-1 truncate">{n.label}</span>
                </Link>
              );
            })}
          </nav>
          {canScrollDown && (
            <button
              type="button"
              onClick={() => navRef.current?.scrollBy({ top: 140, behavior: 'smooth' })}
              className="app-sidebar-scroll-hint"
              aria-label="تمرير القائمة لأسفل"
            >
              <span>▼ المزيد</span>
            </button>
          )}
        </div>

        {/* User card — fixed bottom */}
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--line)', background: 'var(--card2)' }}>
          <div className="flex items-center gap-2">
            <div className="u-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{(userName || title)[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{userName || title}</p>
              {userRoleLabel && <p className="text-[10px] truncate" style={{ color: 'var(--ink3)' }}>{userRoleLabel}</p>}
            </div>
            <button onClick={logout} className="p-2 rounded-lg transition" style={{ color: 'var(--ink3)', minWidth: 36, minHeight: 36 }} title="خروج" aria-label="خروج">
              <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="app-main flex flex-col min-h-screen">
        {/* Mobile header */}
        <div className="u-header md:hidden">
          {hideBottomNav && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="u-icon-btn"
              aria-label="قائمة"
              aria-expanded={sheetOpen}
              style={{ marginInlineEnd: 2, flexShrink: 0 }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <BrandLogo className="brand-logo-mobile" />
          <div className="flex-1 min-w-0 overflow-hidden" style={{ minWidth: 0 }}>
            <div className="u-hname truncate">{title}</div>
            {subtitle && <div className="u-hsub truncate">{subtitle}</div>}
          </div>
          {!hideBottomNav && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="u-icon-btn"
              aria-label="قائمة"
              aria-expanded={sheetOpen}
              style={{ marginInlineStart: 2, flexShrink: 0 }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Page content */}
        <main className="flex-1 px-3 pt-1.5 md:p-6 w-full" style={{ maxWidth: '1120px', marginInline: 'auto' }}>
          {activeNav?.sections && activeNav.sections.length > 1 && (
            <nav className="u-subnav" aria-label={`أقسام ${activeNav.label}`}>
              {activeNav.sections.map((sec) => {
                const secActive = isSectionActive(sec.href);
                return (
                  <Link
                    key={sec.href}
                    href={sec.href}
                    aria-current={secActive ? 'page' : undefined}
                    className={`u-subnav-tab ${secActive ? 'on' : ''}`}
                  >
                    {sec.icon && <span className="u-subnav-ic">{sec.icon}</span>}
                    <span>{sec.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
          {children}
        </main>

        {/* Mobile bottom nav */}
        {!hideBottomNav && mobileItems.length > 0 && (
          <nav className="u-nav md:hidden">
            {mobileItems.map((n) => {
              const active = isActive(n.href);
              return (
                <button key={n.href} className={active ? 'on' : ''} onClick={() => router.push(n.href)}>
                  <span className="ic">{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              );
            })}
            <button className={sheetOpen ? 'on' : ''} onClick={() => setSheetOpen(true)}>
              <span className="ic">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </span>
              <span>المزيد</span>
            </button>
          </nav>
        )}

        {/* Mobile bottom sheet */}
        <div className={`u-sheet-bg ${sheetOpen ? 'show' : ''}`} onClick={() => setSheetOpen(false)} />
        <div
          className={`u-sheet ${sheetOpen ? 'show' : ''}`}
          role="dialog"
          aria-modal={sheetOpen ? 'true' : undefined}
          aria-label="القائمة"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className="grab" />
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>القائمة</h3>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="u-icon-btn"
              aria-label="إغلاق"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="u-menu">
            {nav.map((n) => {
              const active = isActive(n.href);
              return (
                <button
                  key={n.href}
                  className={active ? 'on' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => { setSheetOpen(false); router.push(n.href); }}
                >
                  <span className="ic">{n.icon}</span>
                  <span className="flex-1 text-start">{n.label}</span>
                </button>
              );
            })}
            <button className="danger" onClick={() => { setSheetOpen(false); logout(); }}>
              <span className="ic">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              <span className="flex-1 text-start">خروج</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { icons };
