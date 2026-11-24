'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RecordFlow from '@/components/RecordFlow';

export default function ReciterRecord() {
  const router = useRouter();
  const [committees, setCommittees] = useState<any[]>([]);
  const [committeeId, setCommitteeId] = useState<number | undefined>();
  const [reciterName, setReciterName] = useState('');

  useEffect(() => {
    fetch('/api/committees').then((r) => r.json()).then((d) => setCommittees(d.rows || []));
    try {
      const cur = localStorage.getItem('sard_reciter_setup');
      if (cur) {
        const obj = JSON.parse(cur);
        setCommitteeId(obj.committeeId ? Number(obj.committeeId) : undefined);
        setReciterName(obj.name || '');
      }
      const activeRaw = localStorage.getItem('rasd_active_session');
      if (activeRaw) {
        const act = JSON.parse(activeRaw);
        if (act && act.sessionId && act.committeeId) {
          setCommitteeId(Number(act.committeeId));
        }
      }
    } catch {}
  }, []);

  if (!committeeId || !reciterName) {
    return (
      <div className="u-page" style={{ maxWidth: 480, marginInline: 'auto' }}>
        <div className="u-card" style={{ textAlign: 'center' }}>
          <h3 className="font-bold" style={{ fontSize: 16, marginBottom: 10 }}>يجب اختيار اللجنة وكتابة الاسم أولاً</h3>
          <button onClick={() => router.push('/reciter')} className="u-btn u-btn-p">فتح الإعدادات</button>
        </div>
      </div>
    );
  }

  const curCommitteeName = committees.find((c) => c.id === committeeId)?.name || '—';

  return (
    <div className="u-page">
      <div className="u-top">
        <div>
          <div className="u-sub">{curCommitteeName} · {reciterName}</div>
          <h1>رصد التسميع</h1>
        </div>
      </div>

      <RecordFlow
        committeeId={committeeId}
        defaultReciterName={reciterName}
        committeeIdRequired={true}
        committeesForReciter={committees}
      />
    </div>
  );
}
