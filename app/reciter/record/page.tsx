'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RecordFlow from '@/components/RecordFlow';

export default function ReciterRecord() {
  const router = useRouter();
  const [committees, setCommittees] = useState<any[]>([]);
  const [committeeId, setCommitteeId] = useState<number | undefined>();
  const [reciterName, setReciterName] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Local draft state for the drawer — only committed to the main state on "Save"
  const [draftCommittee, setDraftCommittee] = useState<number | undefined>();
  const [draftName, setDraftName] = useState('');

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
        if (act && act.sessionId) {
          setHasActiveSession(true);
          if (act.committeeId) setCommitteeId(Number(act.committeeId));
        }
      }
    } catch {}
  }, []);

  function openPanel() {
    // Check if an active session is currently persisted
    try {
      const activeRaw = localStorage.getItem('rasd_active_session');
      setHasActiveSession(!!(activeRaw && JSON.parse(activeRaw)?.sessionId));
    } catch {}
    // Seed the draft with current values, then open
    setDraftCommittee(committeeId);
    setDraftName(reciterName);
    setShowPanel(true);
  }

  function save() {
    const trimmed = (draftName || '').trim();
    const nextCommittee = hasActiveSession ? committeeId : draftCommittee;
    if (!nextCommittee || !trimmed) return;
    setCommitteeId(nextCommittee);
    setReciterName(trimmed);
    try { localStorage.setItem('sard_reciter_setup', JSON.stringify({ committeeId: nextCommittee, name: trimmed })); } catch {}
    setShowPanel(false);
    router.refresh();
  }

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

      {/* Floating settings FAB — uses a character glyph that renders in all fonts, not an emoji */}
      <button
        onClick={openPanel}
        aria-label="إعدادات الجلسة"
        className="fixed z-40"
        style={{
          bottom: 'calc(96px + env(safe-area-inset-bottom))',
          insetInlineStart: 16,
          width: 54, height: 54, borderRadius: '50%',
          background: 'var(--brand)', color: 'var(--on-brand)',
          display: 'grid', placeItems: 'center',
          boxShadow: 'var(--shadow-lg)',
          border: 0, cursor: 'pointer'
        }}
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {showPanel && (
        <>
          <div onClick={() => setShowPanel(false)} className="fixed inset-0 z-40" style={{ background: 'var(--overlay)' }} />
          <div
            className="fixed inset-y-0 z-50"
            style={{
              insetInlineEnd: 0,
              width: 320,
              maxWidth: '100%',
              background: 'var(--card)',
              borderInlineStart: '1px solid var(--line)',
              padding: 20,
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div className="u-row u-between" style={{ marginBottom: 12 }}>
              <h3 className="font-bold" style={{ color: 'var(--ink)' }}>إعدادات الجلسة</h3>
              <button onClick={() => setShowPanel(false)} className="u-icon-btn" aria-label="إغلاق">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="u-note brand" style={{ marginBottom: 14 }}>
              <div><b>الحالي:</b> {curCommitteeName} · {reciterName}</div>
            </div>

            <div className="u-field">
              <label>تغيير اللجنة</label>
              <select
                value={draftCommittee ?? ''}
                disabled={hasActiveSession}
                onChange={(e) => setDraftCommittee(e.target.value ? Number(e.target.value) : undefined)}
                className="u-input"
              >
                <option value="">—</option>
                {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {hasActiveSession && (
                <div className="u-note warn" style={{ marginTop: 8, marginBottom: 0 }}>
                  ⚠ لا يمكن تغيير اللجنة أثناء وجود جلسة تسميع نشطة — أنهِ الجلسة أو ألغها أولاً.
                </div>
              )}
            </div>

            <div className="u-field">
              <label>تغيير الاسم</label>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="u-input" />
            </div>

            <button
              onClick={save}
              disabled={!draftCommittee || !draftName.trim()}
              className="u-btn u-btn-p w"
            >
              حفظ وتطبيق
            </button>
            <p className="u-muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
              التعديلات لا تُطبّق إلا بعد الضغط على "حفظ وتطبيق".
            </p>
          </div>
        </>
      )}
    </div>
  );
}
