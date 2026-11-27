import { getActiveProgram } from '@/lib/activeProgram';
import ActiveProgramBannerClient from './ActiveProgramBannerClient';

export default async function ActiveProgramBanner() {
  const p = await getActiveProgram();
  if (!p) {
    return (
      <ActiveProgramBannerClient variant="bad">
        لا يوجد برنامج نشط — راجع <a href="/admin/programs" style={{ color: 'inherit', textDecoration: 'underline' }}>/admin/programs</a>
      </ActiveProgramBannerClient>
    );
  }
  return (
    <ActiveProgramBannerClient variant="brand">
      البرنامج النشط: <b>{p.name}</b>
    </ActiveProgramBannerClient>
  );
}
