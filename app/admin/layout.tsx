import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { icons } from '@/components/icons';
import ActiveProgramBanner from '@/components/ActiveProgramBanner';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s || s.role !== 'admin') redirect('/');

  const nav = [
    { href: '/admin', label: 'الرئيسية', icon: icons.home, mobile: true },
    {
      href: '/admin/students',
      label: 'الطلاب',
      icon: icons.users,
      mobile: true,
      sections: [
        { href: '/admin/students', label: 'قائمة الطلاب', icon: icons.users },
        { href: '/admin/students/new', label: 'إضافة طلاب', icon: icons.addUser },
        { href: '/admin/waiting-hizbs', label: 'بانتظار الأحزاب', icon: icons.hourglass },
        { href: '/admin/waiting-committee', label: 'بانتظار اللجنة', icon: icons.swap }
      ]
    },
    {
      href: '/admin/circles',
      label: 'الحلقات واللجان',
      icon: icons.group,
      mobile: true,
      sections: [
        { href: '/admin/circles', label: 'الحلقات والمعلمون', icon: icons.book },
        { href: '/admin/committees', label: 'اللجان', icon: icons.group },
        { href: '/admin/users', label: 'المستخدمون والمشرفون', icon: icons.users }
      ]
    },
    {
      href: '/admin/sessions',
      label: 'الرصد والتحضير',
      icon: icons.list,
      mobile: true,
      sections: [
        { href: '/admin/sessions', label: 'سجل الرصد', icon: icons.list },
        { href: '/admin/attendance', label: 'التحضير', icon: icons.checkList }
      ]
    },
    {
      href: '/admin/reports/students',
      label: 'التقارير',
      icon: icons.chart,
      sections: [
        { href: '/admin/reports/students', label: 'تقرير الطلاب', icon: icons.chart },
        { href: '/admin/reports/circles', label: 'تقرير الحلقات', icon: icons.chart },
        { href: '/honor', label: 'لوحة الشرف', icon: icons.chart }
      ]
    },
    {
      href: '/honor',
      label: 'لوحة الشرف',
      icon: icons.chart
    },
    {
      href: '/admin/settings',
      label: 'البرامج والإعدادات',
      icon: icons.settings,
      sections: [
        { href: '/admin/settings', label: 'الإعدادات العامة', icon: icons.settings },
        { href: '/admin/programs', label: 'برامج السرد', icon: icons.calendar }
      ]
    }
  ];

  return (
    <AppShell
      title="لوحة المدير"
      subtitle="منصة رصد — برنامج السرد"
      role="admin"
      userName="المدير"
      userRoleLabel="صلاحيات كاملة"
      nav={nav}
    >
      <ActiveProgramBanner />
      {children}
    </AppShell>
  );
}
