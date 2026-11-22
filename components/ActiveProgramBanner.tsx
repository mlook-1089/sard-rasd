import { getActiveProgram } from '@/lib/activeProgram';

export default async function ActiveProgramBanner() {
  const p = await getActiveProgram();
  if (!p) {
    return (
      <div className="u-note bad">
        لا يوجد برنامج نشط — راجع <a href="/admin/programs" style={{ color: 'inherit', textDecoration: 'underline' }}>/admin/programs</a>
      </div>
    );
  }
  return (
    <div className="u-note brand">
      البرنامج النشط: <b>{p.name}</b>
    </div>
  );
}
