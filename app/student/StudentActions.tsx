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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={openCertificate} className="u-btn u-btn-s sm">
        <span>📄</span><span>تحميل الشهادة PDF</span>
      </button>
      <button onClick={logout} className="u-btn u-btn-bad sm">
        خروج
      </button>
    </div>
  );
}
