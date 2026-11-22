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
        background:
          'radial-gradient(circle at 85% 15%, rgba(11, 59, 92, 0.10) 0%, transparent 45%), radial-gradient(circle at 15% 85%, rgba(168, 132, 31, 0.10) 0%, transparent 45%), linear-gradient(180deg, #EEF2F6 0%, #F6F8FA 50%, #ECEFF4 100%)',
        color: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Subtle decorative background rings */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          border: '1px solid rgba(11, 59, 92, 0.06)',
          pointerEvents: 'none'
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-140px',
          left: '-140px',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          border: '1px solid rgba(168, 132, 31, 0.08)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: '0 24px 60px -12px rgba(11, 59, 92, 0.16), 0 4px 16px -2px rgba(15, 27, 45, 0.06)',
          border: '1px solid rgba(11, 59, 92, 0.10)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Integrated Royal Navy & Gold Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #07283F 0%, #0B3B5C 55%, #11517A 100%)',
            padding: '34px 28px 28px',
            textAlign: 'center',
            position: 'relative',
            color: '#FFFFFF'
          }}
        >
          {/* Top thin gold shimmer */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #A8841F 0%, #E3C170 50%, #A8841F 100%)'
            }}
          />

          {/* Emblem Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: 'linear-gradient(145deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%)',
              border: '1.5px solid rgba(227, 193, 112, 0.45)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              color: '#F3D78B'
            }}
          >
            <svg width="34" height="34" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <h1
            className="font-title"
            style={{
              fontSize: 27,
              fontWeight: 900,
              margin: 0,
              lineHeight: 1.25,
              color: '#FFFFFF',
              letterSpacing: '-0.3px'
            }}
          >
            منصة رصد
          </h1>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              padding: '5px 14px',
              borderRadius: 999,
              background: 'rgba(227, 193, 112, 0.15)',
              border: '1px solid rgba(227, 193, 112, 0.30)',
              color: '#F5DD98',
              fontSize: 12.5,
              fontWeight: 700
            }}
          >
            <span>برنامج السرد — تحفيظ القرآن الكريم</span>
          </div>

          {/* Bottom gold divider line */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '15%',
              right: '15%',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(227, 193, 112, 0.55), transparent)'
            }}
          />
        </div>

        {/* Card Body */}
        <div style={{ padding: '26px 26px 28px' }}>
          <form onSubmit={onFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px'
                }}
              >
                <label
                  htmlFor="sard-pw"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#0F1B2D'
                  }}
                >
                  <svg width="16" height="16" fill="none" stroke="#0B3B5C" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>كلمة المرور</span>
                </label>

                {loading && !success && (
                  <span className="u-pill brand" style={{ fontSize: 11.5, padding: '3px 10px' }}>
                    جاري التحقق...
                  </span>
                )}
                {success && (
                  <span className="u-pill ok" style={{ fontSize: 11.5, padding: '3px 10px' }}>
                    ✓ تم الدخول
                  </span>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  id="sard-pw"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={success}
                  className="u-input"
                  style={{
                    height: '54px',
                    borderRadius: '15px',
                    paddingInlineEnd: '16px',
                    paddingInlineStart: '50px',
                    fontSize: '17px',
                    fontWeight: 700,
                    background: success ? '#F0FDF4' : '#F8FAFC',
                    border: success
                      ? '2px solid #1F8A5B'
                      : error
                      ? '2px solid #C0443C'
                      : '1.5px solid #D9DDE4',
                    direction: 'ltr',
                    textAlign: 'start',
                    letterSpacing: showPw ? 'normal' : '0.14em',
                    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s'
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
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '38px',
                    height: '38px',
                    borderRadius: '11px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#5B6475',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 1px 2px rgba(15, 27, 45, 0.04)'
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
            </div>

            {success && (
              <div className="u-note ok" style={{ marginBottom: 0, textAlign: 'center', fontWeight: 700 }}>
                ✓ تم التحقق بنجاح — جاري توجيهك...
              </div>
            )}

            {error && !success && (
              <div className="u-note bad" role="alert" style={{ marginBottom: 0, textAlign: 'center', fontWeight: 700 }}>
                {error}
              </div>
            )}

            {/* Helper footer box */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E7E9EE',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '2px'
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#5B6475', textAlign: 'center' }}>
                دخول فوري تلقائي بمجرد كتابة كلمة المرور
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="u-pill mute" style={{ fontSize: 11 }}>المدير</span>
                <span className="u-pill mute" style={{ fontSize: 11 }}>مشرف اللجنة</span>
                <span className="u-pill mute" style={{ fontSize: 11 }}>المسمّع</span>
                <span className="u-pill mute" style={{ fontSize: 11 }}>الطالب</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
