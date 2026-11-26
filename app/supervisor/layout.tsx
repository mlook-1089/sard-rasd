import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { committees, supervisors } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import AppShell from '@/components/AppShell';
import { icons } from '@/components/icons';
import ActiveProgramBanner from '@/components/ActiveProgramBanner';

export const dynamic = 'force-dynamic';

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s || s.role !== 'supervisor') redirect('/');

  let committeeName = '';
  if (s.committeeId) {
    const [c] = await db.select().from(committees).where(eq(committees.id, s.committeeId)).limit(1);
    committeeName = c?.name || '';
  }

  // Resolve the actual supervisor name (displayName || username) so the sidebar user card shows
  // the person, not the committee.
  let supervisorName = 'مشرف';
  if (s.id) {
    const [sup] = await db.select().from(supervisors).where(eq(supervisors.id, s.id)).limit(1);
    supervisorName = sup?.displayName?.trim() || sup?.username?.trim() || 'مشرف';
  }

  const nav = [
    { href: '/supervisor', label: 'الرئيسية', icon: icons.home, mobile: true },
    { href: '/supervisor/record', label: 'رصد التسميع', icon: icons.mic, mobile: true },
    { href: '/supervisor/attendance', label: 'التحضير', icon: icons.checkList, mobile: true },
    { href: '/supervisor/students', label: 'تقارير الطلاب', icon: icons.chart, mobile: true },
    { href: '/supervisor/sessions', label: 'سجل اللجنة', icon: icons.list }
  ];

  return (
    <AppShell
      title={`مشرف اللجنة${committeeName ? ` — ${committeeName}` : ''}`}
      subtitle="بوابة التسميع والتحضير"
      role="supervisor"
      userName={supervisorName}
      userRoleLabel={committeeName || 'مشرف لجنة'}
      nav={nav}
      hideBottomNav
    >
      <ActiveProgramBanner />
      {children}
    </AppShell>
  );
}
