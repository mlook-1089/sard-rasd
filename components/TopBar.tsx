'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TopBar({
  title,
  subtitle,
  links = [],
  role
}: {
  title: string;
  subtitle?: string;
  links?: { href: string; label: string }[];
  role?: 'admin' | 'supervisor' | 'reciter' | 'student';
}) {
  const router = useRouter();

  async function logout() {
    // Warn if an active in-flight session may be in progress for this role.
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
          const ok = confirm(`⚠ لديك ${relevant.length} جلسة تسميع غير منتهية. هل فعلاً تريد الخروج؟`);
          if (!ok) return;
        }
      } catch {}
    }
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white grid place-items-center font-bold shrink-0">۞</div>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
        </div>
        <nav className="flex items-center gap-1 flex-wrap text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className="px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-teal-700">
              {l.label}
            </Link>
          ))}
          <button onClick={logout}
            className="px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50">
            خروج
          </button>
        </nav>
      </div>
    </header>
  );
}
