import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { icons } from '@/components/icons';
import ActiveProgramBanner from '@/components/ActiveProgramBanner';

export const dynamic = 'force-dynamic';

export default async function ReciterLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s || s.role !== 'reciter') redirect('/');

  const nav = [
    { href: '/reciter', label: 'الإعدادات', icon: icons.settings, mobile: true },
    { href: '/reciter/record', label: 'رصد التسميع', icon: icons.mic, mobile: true },
    { href: '/reciter/history', label: 'سجلاتي', icon: icons.list, mobile: true }
  ];

  return (
    <AppShell
      title="بوابة المسمع"
      subtitle="حساب موحّد"
      role="reciter"
      userName="المسمع"
      userRoleLabel="حساب موحّد"
      nav={nav}
    >
      <ActiveProgramBanner />
      {children}
    </AppShell>
  );
}
