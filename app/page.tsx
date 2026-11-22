'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  async function attemptLogin(trimmed: string, showErrorImmediately: boolean, signal?: AbortSignal) {
    if (!trimmed || redirectingRef.current) return;
    setLoading(true);
    if (showErrorImmediately) setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
        signal
      });
      const data = await res.json().catch(() => ({}));
      if (signal?.aborted) return;
      if (res.ok && data.ok) {
        redirectingRef.current = true;
        setSuccess(true);
        setError(null);
        router.push(data.redirect || '/');
        router.refresh();
        return;
      }
      setLoading(false);
      if (showErrorImmediately) {
        setError(data.error || 'كلمة مرور غير صحيحة');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setLoading(false);
      if (showErrorImmediately) {
        setError('حدث خطأ. حاول مرة أخرى.');
      }
    }
  }

  // Auto-login as soon as the user types a valid password
  useEffect(() => {
    const trimmed = password.trim();
    setError(null);
    if (!trimmed || redirectingRef.current) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    // Fast check after 220ms of typing to log in immediately on match
    const fastTimer = setTimeout(() => {
      attemptLogin(trimmed, false, controller.signal);
    }, 220);

    // If user stops typing for 950ms and password is still wrong, show error feedback
    const errTimer = setTimeout(() => {
      if (!redirectingRef.current) {
        attemptLogin(trimmed, true, controller.signal);
      }
    }, 950);

    return () => {
      clearTimeout(fastTimer);
      clearTimeout(errTimer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) return;
    attemptLogin(trimmed, true);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      backgroundColor: '#013856',
      backgroundImage: 'radial-gradient(#d4af37 0.5px, transparent 0.5px), radial-gradient(#d4af37 0.5px, #013856 0.5px)',
      backgroundSize: '40px 40px',
      backgroundPosition: '0 0, 20px 20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        width: '100%',
        maxWidth: '420px',
        padding: '32px 28px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '8px',
          background: 'linear-gradient(90deg, #d4af37 0%, #e6c05a 100%)',
          borderTopLeftRadius: '2rem', borderTopRightRadius: '2rem'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '80px', height: '80px', borderRadius: '16px', marginBottom: '14px',
            background: '#F0F4F8', color: '#013856'
          }}>
            <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#013856', margin: 0, fontFamily: '"IBM Plex Sans Arabic", "Tajawal", sans-serif' }}>منصة رصد</h1>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#5B6475', marginTop: '6px', margin: '6px 0 0' }}>برنامج السرد — تحفيظ القرآن الكريم</p>
        </div>

        <form onSubmit={onFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="sard-pw" style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>كلمة المرور</label>
            <div style={{ position: 'relative' }}>
              <input
                id="sard-pw"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={success}
                style={{
                  width: '100%', padding: '14px 16px 14px 48px', borderRadius: '12px',
                  border: success ? '2px solid #16a34a' : error ? '1.5px solid #B03038' : '1.5px solid #E2E8F0',
                  background: '#F9FAFB',
                  outline: 'none', fontSize: '16px', boxSizing: 'border-box',
                  fontFamily: 'inherit', textAlign: 'start', direction: 'ltr',
                  letterSpacing: showPw ? 'normal' : '0.1em'
                }}
                autoFocus
                autoComplete="off"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                style={{
                  position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                  width: '32px', height: '32px', borderRadius: '8px', border: 0,
                  background: 'transparent', color: '#5B6475', cursor: 'pointer',
                  display: 'grid', placeItems: 'center'
                }}
              >
                {showPw ? (
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#8F97A6', marginTop: '8px', margin: '8px 0 0' }}>
              أدخل كلمة المرور وسيتم الدخول تلقائياً مباشرة.
            </p>
          </div>

          {success && (
            <div style={{
              background: '#dcfce7', color: '#15803d',
              border: '1px solid rgba(21,128,61,0.25)',
              padding: '10px 12px', borderRadius: '12px',
              fontSize: '14px', fontWeight: 700, textAlign: 'center'
            }}>✓ تم التحقق — جاري الدخول...</div>
          )}

          {error && !success && (
            <div style={{
              background: '#F8E5E6', color: '#B03038',
              border: '1px solid rgba(176,48,56,0.25)',
              padding: '10px 12px', borderRadius: '12px',
              fontSize: '14px', fontWeight: 700, textAlign: 'center'
            }}>{error}</div>
          )}
        </form>
      </div>
    </div>
  );
}
