import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { supervisors } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import RecordFlow from '@/components/RecordFlow';

export const dynamic = 'force-dynamic';

export default async function SupervisorRecordPage() {
  const s = await getSession();
  if (!s || s.role !== 'supervisor' || !s.committeeId || !s.id) return null;
  const [sup] = await db.select().from(supervisors).where(eq(supervisors.id, s.id)).limit(1);
  return (
    <div className="u-page">
      <div className="u-top">
        <div>
          <div className="u-sub">تدفق التسميع</div>
          <h1>رصد التسميع</h1>
        </div>
      </div>
      <RecordFlow committeeId={s.committeeId} defaultReciterName={sup?.displayName || sup?.username || 'مشرف'} />
    </div>
  );
}
