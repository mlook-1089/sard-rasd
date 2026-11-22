'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReciterSetup() {
  const router = useRouter();
  const [committees, setCommittees] = useState<any[]>([]);
  const [committeeId, setCommitteeId] = useState('');
  const [reciterName, setReciterName] = useState('');

  useEffect(() => {
    fetch('/api/committees').then((r) => r.json()).then((d) => setCommittees(d.rows || []));
    try {
      let t = localStorage.getItem('sard_device_tag');
      if (!t) {
        t = 'dev_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('sard_device_tag', t);
      }
      const cur = localStorage.getItem('sard_reciter_setup');
      if (cur) { const obj = JSON.parse(cur); setCommitteeId(obj.committeeId || ''); setReciterName(obj.name || ''); }
    } catch {}
  }, []);

  function save() {
    const trimmedName = (reciterName || '').trim();
    if (!committeeId || !trimmedName) return;
    try { localStorage.setItem('sard_reciter_setup', JSON.stringify({ committeeId, name: trimmedName })); } catch {}
    router.push('/reciter/record');
  }

  return (
    <div className="u-page" style={{ maxWidth: 480, marginInline: 'auto' }}>
      <div className="u-top">
        <div>
          <div className="u-sub">قبل بدء التسميع</div>
          <h1>إعدادات جلسة المسمع</h1>
        </div>
      </div>

      <div className="u-note brand">
        يُحفظ هذا الاختيار على هذا الجهاز ويُطبع اسمك مع كل جلسة ترصدها.
      </div>

      <div className="u-card">
        <div className="u-field">
          <label>اختر اللجنة</label>
          <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} className="u-input">
            <option value="">—</option>
            {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="u-field">
          <label>اسمك كمسمع</label>
          <input value={reciterName} onChange={(e) => setReciterName(e.target.value)} className="u-input" placeholder="أبو عبدالله" />
        </div>

        <button disabled={!committeeId || !reciterName.trim()} onClick={save} className="u-btn u-btn-p w lg">
          ابدأ الرصد
        </button>
      </div>
    </div>
  );
}
