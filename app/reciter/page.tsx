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

  const ready = Boolean(committeeId && reciterName.trim());

  return (
    <div className="u-page" style={{ maxWidth: 520, marginInline: 'auto', paddingTop: 18 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .reciter-setup-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 14px 14px 12px;
          box-shadow: var(--shadow);
        }
        .reciter-setup-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        .reciter-setup-row .u-field {
          margin-bottom: 0;
        }
        .reciter-setup-row .u-field > label {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 5px;
          color: var(--ink2);
        }
        .reciter-setup-row .u-input {
          height: 42px;
          font-size: 14.5px;
          padding: 0 11px;
          border-radius: 11px;
        }
        .reciter-setup-card .u-btn {
          height: 46px;
          border-radius: 13px;
          font-size: 14.5px;
        }
      ` }} />

      <div className="reciter-setup-card">
        <div className="reciter-setup-row">
          <div className="u-field">
            <label>اسم المسمع</label>
            <input
              value={reciterName}
              onChange={(e) => setReciterName(e.target.value)}
              className="u-input"
              placeholder="أبو عبدالله"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="u-field">
            <label>اللجنة</label>
            <select
              value={committeeId}
              onChange={(e) => setCommitteeId(e.target.value)}
              className="u-input"
            >
              <option value="">—</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={save}
          disabled={!ready}
          className="u-btn u-btn-p w"
        >
          ابدأ الرصد
        </button>
      </div>
    </div>
  );
}
