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
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px'
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Hero banner matching internal u-hero */}
        <div
          className="u-hero"
          style={{
            textAlign: 'center',
            padding: '22px 20px',
            marginBottom: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.14)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="font-title" style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>
            منصة رصد
          </h1>
          <div className="l" style={{ fontSize: 13 }}>
            برنامج السرد — تحفيظ القرآن الكريم
          </div>
        </div>

        {/* Form card matching internal u-card */}
        <div className="u-card" style={{ padding: '20px 18px', marginBottom: 0 }}>
          <div className="u-card-h" style={{ marginBottom: 12 }}>
            <h2>تسجيل الدخول</h2>
            {loading && !success && (
              <span className="u-pill brand" style={{ fontSize: 11 }}>
                جاري التحقق...
              </span>
            )}
          </div>

          <form onSubmit={onFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="u-field" style={{ marginBottom: 0 }}>
              <label htmlFor="sard-pw">كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="sard-pw"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={success}
                  className="u-input"
                  style={{
                    paddingInlineEnd: '14px',
                    paddingInlineStart: '48px',
                    direction: 'ltr',
                    textAlign: 'start',
                    letterSpacing: showPw ? 'normal' : '0.1em',
                    borderColor: success ? 'var(--ok)' : error ? 'var(--bad)' : undefined
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
                    position: 'absolute',
                    left: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    border: 0,
                    background: 'transparent',
                    color: 'var(--ink2)',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center'
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
              <div className="u-muted" style={{ marginTop: 8 }}>
                أدخل كلمة المرور وسيتم الدخول تلقائياً مباشرة.
              </div>
            </div>

            {success && (
              <div className="u-note ok" style={{ marginBottom: 0, textAlign: 'center' }}>
                ✓ تم التحقق — جاري الدخول...
              </div>
            )}

            {error && !success && (
              <div className="u-note bad" role="alert" style={{ marginBottom: 0, textAlign: 'center' }}>
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
