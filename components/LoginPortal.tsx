'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BrandLogo from './BrandLogo';

export default function LoginPortal({ audience }: { audience: 'staff' | 'student' }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectingRef = useRef(false);
  const isStudent = audience === 'student';

  async function attemptLogin(value: string, showError: boolean, signal?: AbortSignal) {
    const trimmed = value.trim();
    if (!trimmed || redirectingRef.current) return;
    setLoading(true);
    if (showError) setError(null);
    try {
      const response = await fetch(isStudent ? '/api/login/student' : '/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
        cache: 'no-store',
        signal
      });
      const data = await response.json().catch(() => ({}));
      if (signal?.aborted) return;
      if (response.ok && data.ok) {
        redirectingRef.current = true;
        setSuccess(true);
        setError(null);
        router.replace(data.redirect || (isStudent ? '/student' : '/'));
        router.refresh();
        return;
      }
      setLoading(false);
      if (showError) setError(data.error || 'بيانات الدخول غير صحيحة');
    } catch (loginError: any) {
      if (loginError?.name === 'AbortError') return;
      setLoading(false);
      if (showError) setError('تعذر الدخول الآن. حاول مرة أخرى.');
    }
  }

  useEffect(() => {
    const trimmed = password.trim();
    setError(null);
    if (trimmed.length < 4 || redirectingRef.current) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => attemptLogin(trimmed, true, controller.signal), 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    attemptLogin(password, true);
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <header className="login-card-header">
          <div className="login-logo-frame">
            <BrandLogo className="login-logo" />
          </div>
          <h1>{isStudent ? 'دخول الطلاب' : 'منصة رصد'}</h1>
          <p>{isStudent ? 'بوابة التقارير والنتائج' : 'الإدارة والتسميع والتحضير'}</p>
        </header>

        <div className="login-card-body">
          <form onSubmit={submit}>
            <div className="login-label-row">
              <label htmlFor="sard-password">
                {isStudent ? 'رقم الهوية أو كلمة مرور الطالب' : 'كلمة المرور'}
              </label>
              {loading && !success && <span className="u-pill brand">جاري التحقق…</span>}
              {success && <span className="u-pill ok">✓ تم الدخول</span>}
            </div>

            <div className="login-input-wrap">
              <input
                id="sard-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={success}
                inputMode={isStudent ? 'numeric' : 'text'}
                autoComplete="current-password"
                autoFocus
                className="u-input login-input"
                placeholder="••••••••"
                aria-describedby={error ? 'login-error' : undefined}
              />
              <button
                type="button"
                className="login-show-password"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? 'إخفاء' : 'إظهار'}
              </button>
            </div>

            {error && !success && <div id="login-error" className="u-note bad" role="alert">{error}</div>}

          </form>
        </div>
      </div>
    </main>
  );
}
