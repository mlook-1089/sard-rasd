'use client';
import { useRouter } from 'next/navigation';

export default function StudentActions() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  function openCertificate() {
    router.push('/student/certificate');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={openCertificate} className="u-btn u-btn-s sm">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <span>الشهادة PDF</span>
      </button>
      <button onClick={logout} className="u-btn u-btn-bad sm">
        خروج
      </button>
    </div>
  );
}
