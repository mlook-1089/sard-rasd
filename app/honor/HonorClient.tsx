'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';

type Stat = { label: string; value: number };
type Row = { id: number; name: string; memorized: number; target: number };
type Column = { level: string; rows: Row[] };

export type HonorData = {
  stats: {
    hizbs: Stat; pages: Stat; sessions: Stat;
    students: Stat; circles: Stat; completion: Stat;
  };
  columns: Column[];
  settings?: { logoUrl?: string | null; title?: string | null } | null;
};

function useCountUp(target: number, durationMs = 900) {
  const [val, setVal] = useState(target);
  const startedAt = useRef<number | null>(null);
  const prevTarget = useRef<number>(target);
  useEffect(() => {
    if (target === prevTarget.current) {
      if (val !== target) setVal(target);
      return;
    }
    const from = prevTarget.current;
    const to = target;
    prevTarget.current = target;
    startedAt.current = null;
    let raf = 0;
    const tick = (now: number) => {
      if (startedAt.current == null) startedAt.current = now;
      const t = Math.min(1, (now - startedAt.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 4);
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}

// Known level ordering — unknown levels are appended after
const LEVEL_ORDER = ['المبتدئين والتأهيل', 'النجباء', 'الفرسان', 'الحفاظ والخريجين'];
function orderColumns(cols: Column[]): Column[] {
  const known: Column[] = [];
  const other: Column[] = [];
  for (const name of LEVEL_ORDER) {
    const c = cols.find((x) => x.level.trim() === name);
    if (c) known.push(c);
  }
  for (const c of cols) {
    if (!LEVEL_ORDER.includes(c.level.trim()) && !known.includes(c)) other.push(c);
  }
  return [...known, ...other];
}

function StatTile({
  label, value, suffix = '', icon
}: { label: string; value: number; suffix?: string; icon: React.ReactNode }) {
  const v = useCountUp(value);
  return (
    <div className="honor-stat">
      <div className="honor-stat-icon">{icon}</div>
      <div className="honor-stat-label">{label}</div>
      <div className="honor-stat-num" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <bdi>{v.toLocaleString('ar-EG')}{suffix}</bdi>
      </div>
    </div>
  );
}

// Minimal SVG icons (no external icon font)
const Icons = {
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5v-15Z" strokeLinejoin="round"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" strokeLinejoin="round"/><path d="M8 7h8M8 11h6" strokeLinecap="round"/></svg>,
  pages: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5s-3-2-7-2v15c4 0 7 2 7 2M12 5s3-2 7-2v15c-4 0-7 2-7 2M12 5v17" strokeLinejoin="round"/></svg>,
  circles: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-3.5 4-3.5s4 1.5 4 3.5" strokeLinecap="round"/></svg>,
  students: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 2 8l10 5 10-5-10-5Z" strokeLinejoin="round"/><path d="M6 10v5c0 2 3 3 6 3s6-1 6-3v-5" strokeLinejoin="round"/><path d="M22 8v6" strokeLinecap="round"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2v10l8.66-5A10 10 0 0 0 12 2Z" strokeLinejoin="round"/></svg>,
  sessions: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4Z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round"/></svg>
};

export default function HonorClient({ initialData = null }: { initialData?: HonorData | null }) {
  const [data, setData] = useState<HonorData | null>(initialData);
  const [updTime, setUpdTime] = useState<string>('');
  const boardRef = useRef<HTMLDivElement | null>(null);
  const hDirRef = useRef<number>(1);
  const vDirRef = useRef<number>(1);
  const pausedUntilRef = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch('/api/public/honor?_t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' }
        });
        if (!res.ok) return;
        const d = await res.json();
        if (alive && d && d.stats) {
          setData(d);
          const now = new Date();
          setUpdTime(
            ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2)
          );
        }
      } catch {}
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Auto-scroll: vertical inside each .honor-list, horizontal across the board
  useEffect(() => {
    if (!data) return;
    const board = boardRef.current;
    if (!board) return;

    let vTimer: ReturnType<typeof setInterval> | null = null;
    let hTimer: ReturnType<typeof setInterval> | null = null;

    const isPaused = () => performance.now() < pausedUntilRef.current;

    vTimer = setInterval(() => {
      if (isPaused()) return;
      const lists = Array.from(board.querySelectorAll<HTMLElement>('.honor-list'));
      let any = false;
      for (const l of lists) {
        const max = l.scrollHeight - l.clientHeight;
        if (max <= 0) continue;
        if (vDirRef.current > 0) {
          if (l.scrollTop < max) { l.scrollTop += 0.8; any = true; }
        } else {
          if (l.scrollTop > 0) { l.scrollTop -= 0.8; any = true; }
        }
      }
      if (!any) vDirRef.current = -vDirRef.current;
    }, 70);

    hTimer = setInterval(() => {
      if (isPaused()) return;
      const max = board.scrollWidth - board.clientWidth;
      if (max <= 0) return;
      // In RTL, scrollLeft is negative. We flip the direction to feel natural.
      if (hDirRef.current > 0) {
        board.scrollLeft -= 0.6;
        if (Math.abs(board.scrollLeft) >= max - 2) hDirRef.current = -1;
      } else {
        board.scrollLeft += 0.6;
        if (board.scrollLeft >= -2) hDirRef.current = 1;
      }
    }, 80);

    const onPause = () => { pausedUntilRef.current = performance.now() + 5000; };
    board.addEventListener('mousedown', onPause);
    board.addEventListener('touchstart', onPause, { passive: true });

    return () => {
      if (vTimer) clearInterval(vTimer);
      if (hTimer) clearInterval(hTimer);
      board.removeEventListener('mousedown', onPause);
      board.removeEventListener('touchstart', onPause);
    };
  }, [data]);

  const orderedColumns = useMemo(() => (data ? orderColumns(data.columns) : []), [data]);

  // Compute a derived overall completion that averages per-student completion
  // (matches the pasted mockup's logic). Falls back to server-supplied value.
  const avgCompletion = useMemo(() => {
    if (!data) return 0;
    const all = data.columns.flatMap((c) => c.rows);
    if (!all.length) return data.stats.completion.value;
    let sum = 0, n = 0;
    for (const r of all) {
      const pct = r.target > 0 ? Math.round((r.memorized / r.target) * 100) : 0;
      sum += pct;
      n++;
    }
    return n > 0 ? Math.round(sum / n) : data.stats.completion.value;
  }, [data]);

  const titleText = (data?.settings?.title || '').trim() || 'لوحة الشرف';

  if (!data) {
    return (
      <>
        <HonorStyles />
        <main className="honor-root">
          <div className="honor-loading">
            <div className="honor-spinner" />
            <p>جاري تحميل لوحة الشرف…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <HonorStyles />
      <main className="honor-root">
        <a href="/admin" className="honor-back" title="لوحة المدير">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>

        <header className="honor-header">
          <div className="honor-brand">
            <BrandLogo />
          </div>
          <h1 className="honor-title">{titleText}</h1>
          <div className="honor-live">
            <span className="honor-dot" />
            <span>تحديث مباشر</span>
          </div>
        </header>

        <div className="honor-stats">
          <StatTile label={data.stats.hizbs.label} value={data.stats.hizbs.value} icon={Icons.book} />
          <StatTile label={data.stats.pages.label} value={data.stats.pages.value} icon={Icons.pages} />
          <StatTile label={data.stats.circles.label} value={data.stats.circles.value} icon={Icons.circles} />
          <StatTile label={data.stats.students.label} value={data.stats.students.value} icon={Icons.students} />
          <StatTile label={data.stats.completion.label} value={avgCompletion} suffix="%" icon={Icons.chart} />
          <StatTile label={data.stats.sessions.label} value={data.stats.sessions.value} icon={Icons.sessions} />
        </div>

        <div className="honor-board" ref={boardRef}>
          {orderedColumns.length === 0 ? (
            <div className="honor-empty-col">لا توجد مستويات مسجلة</div>
          ) : orderedColumns.map((col) => (
            <div key={col.level} className="honor-col">
              <div className="honor-col-head">{col.level}</div>
              <div className="honor-list">
                {col.rows.length === 0 ? (
                  <div className="honor-row-empty">لا يوجد بيانات</div>
                ) : col.rows.map((r, i) => {
                  const pct = r.target > 0 ? Math.round((r.memorized / r.target) * 100) : 0;
                  return (
                    <div key={r.id} className={`honor-row r${Math.min(i + 1, 3)}`}>
                      <div className="honor-rank">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (
                          <span className="honor-rank-num">{i + 1}</span>
                        )}
                      </div>
                      <div className="honor-name" title={r.name}>{r.name}</div>
                      <div className="honor-score">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <footer className="honor-footer">
          <div>منصة رصد — برنامج السرد</div>
          <div>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: '-1px', marginInlineEnd: 4 }}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round"/></svg>
            آخر تحديث: <bdi dir="ltr">{updTime || '—'}</bdi>
          </div>
        </footer>
      </main>
    </>
  );
}

function HonorStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        --honor-bg: #060E1A;
        --honor-primary: #0A2540;
        --honor-primary-2: #0066CC;
        --honor-accent: #F39C12;
        --honor-card: #0D1F33;
        --honor-card-2: #0F2944;
        --honor-gold: #FFD700;
        --honor-silver: #C0C0C0;
        --honor-bronze: #CD7F32;
        --honor-text: #F8FAFC;
        --honor-muted: rgba(255,255,255,.55);
      }

      .honor-root {
        font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
        background: var(--honor-bg);
        background-image:
          radial-gradient(ellipse at top, rgba(10,37,64,.8), transparent 70%),
          radial-gradient(ellipse at bottom, rgba(0,102,204,.15), transparent 70%);
        color: var(--honor-text);
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        overflow: hidden;
      }

      .honor-back {
        position: fixed;
        top: 10px;
        inset-inline-start: 10px;
        z-index: 40;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: rgba(255,255,255,.08);
        color: #fff;
        text-decoration: none;
        opacity: .35;
        transition: opacity .2s, background .2s;
        backdrop-filter: blur(4px);
      }
      .honor-back:hover { opacity: 1; background: rgba(255,255,255,.18); }

      .honor-header {
        padding: 14px 26px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        background: linear-gradient(180deg, rgba(10,37,64,.9), rgba(6,14,26,.4));
        border-bottom: 1px solid rgba(0,102,204,.25);
        backdrop-filter: blur(6px);
        flex-shrink: 0;
      }
      .honor-brand { display: flex; align-items: center; gap: 14px; flex-shrink: 0; min-width: 70px; }
      .honor-brand img { width: 180px; height: auto; max-width: 22vw; object-fit: contain; }
      .honor-brand-mark {
        width: 52px; height: 52px; border-radius: 14px;
        background: rgba(243,156,18,.15); color: var(--honor-accent);
        display: grid; place-items: center; font-size: 28px; font-weight: 800;
        border: 1px solid rgba(243,156,18,.35);
      }
      .honor-title {
        font-weight: 900;
        font-size: 24px;
        color: var(--honor-accent);
        text-shadow: 0 2px 10px rgba(243,156,18,.25);
        text-align: center;
        flex: 1;
      }
      .honor-live {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(220,53,69,.12);
        border: 1px solid rgba(220,53,69,.35);
        color: #FF8585;
        font-weight: 700;
        font-size: 13px;
        flex-shrink: 0;
      }
      .honor-dot {
        width: 8px; height: 8px; background: #FF6B6B; border-radius: 50%;
        animation: honor-pulse 1.5s ease-in-out infinite;
      }
      @keyframes honor-pulse {
        0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,107,107,.6); }
        50% { opacity: .5; box-shadow: 0 0 0 6px rgba(255,107,107,0); }
      }

      .honor-stats {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 12px;
        padding: 14px 26px;
        flex-shrink: 0;
      }
      .honor-stat {
        position: relative;
        background: linear-gradient(180deg, var(--honor-card), var(--honor-card-2));
        border: 1px solid rgba(0,102,204,.18);
        border-radius: 16px;
        padding: 16px 10px 14px;
        text-align: center;
        overflow: hidden;
      }
      .honor-stat::before {
        content: '';
        position: absolute;
        inset: 0 0 auto 0;
        height: 3px;
        background: linear-gradient(90deg, var(--honor-accent), var(--honor-primary-2));
      }
      .honor-stat-icon {
        display: inline-flex;
        color: var(--honor-accent);
        margin-bottom: 8px;
        opacity: .9;
      }
      .honor-stat-icon svg { width: 28px; height: 28px; }
      .honor-stat-label { font-weight: 700; font-size: 13px; color: var(--honor-muted); margin-bottom: 6px; }
      .honor-stat-num { font-weight: 900; font-size: 32px; color: #fff; line-height: 1.1; }

      .honor-board {
        padding: 4px 26px 24px;
        flex: 1;
        display: flex;
        gap: 14px;
        overflow-x: auto;
        scroll-behavior: smooth;
        scrollbar-width: none;
      }
      .honor-board::-webkit-scrollbar { display: none; }

      .honor-col {
        background: linear-gradient(180deg, var(--honor-card), var(--honor-card-2));
        border: 1px solid rgba(0,102,204,.15);
        border-radius: 16px;
        min-width: 320px;
        max-width: 360px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .honor-col-head {
        background: linear-gradient(135deg, var(--honor-primary-2), #004a99);
        padding: 12px;
        text-align: center;
        font-weight: 800;
        font-size: 17px;
        color: #fff;
        box-shadow: 0 2px 12px rgba(0,102,204,.3);
      }
      .honor-list {
        padding: 10px;
        flex: 1;
        overflow-y: auto;
        max-height: 62vh;
      }
      .honor-list::-webkit-scrollbar { width: 4px; }
      .honor-list::-webkit-scrollbar-thumb { background: var(--honor-accent); border-radius: 10px; }

      .honor-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255,255,255,.03);
        padding: 10px 12px;
        border-radius: 10px;
        margin-bottom: 8px;
        border-inline-end: 3px solid transparent;
      }
      .honor-row.r1 { border-inline-end-color: var(--honor-gold); background: rgba(255,215,0,.07); }
      .honor-row.r2 { border-inline-end-color: var(--honor-silver); background: rgba(192,192,192,.05); }
      .honor-row.r3 { border-inline-end-color: var(--honor-bronze); background: rgba(205,127,50,.05); }
      .honor-rank {
        font-size: 22px;
        width: 36px;
        text-align: center;
        flex-shrink: 0;
      }
      .honor-rank-num {
        display: inline-block;
        width: 28px; height: 28px; line-height: 28px;
        border-radius: 50%;
        background: rgba(255,255,255,.05);
        color: rgba(255,255,255,.5);
        font-weight: 800;
        font-size: 14px;
      }
      .honor-name {
        flex: 1;
        font-weight: 800;
        font-size: 15px;
        color: rgba(255,255,255,.92);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .honor-score {
        background: var(--honor-accent);
        color: #111;
        font-weight: 900;
        font-size: 14px;
        padding: 5px 11px;
        border-radius: 8px;
        min-width: 56px;
        text-align: center;
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
      }
      .honor-row-empty {
        text-align: center;
        color: rgba(255,255,255,.3);
        padding: 40px 10px;
        font-weight: 600;
        font-size: 14px;
      }

      .honor-empty-col {
        text-align: center;
        color: rgba(255,255,255,.4);
        padding: 60px 20px;
        margin: auto;
        width: 100%;
      }

      .honor-loading {
        display: grid;
        place-items: center;
        gap: 14px;
        padding: 80px 20px;
        color: var(--honor-accent);
        margin: auto;
      }
      .honor-spinner {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 3px solid rgba(243,156,18,.2);
        border-top-color: var(--honor-accent);
        animation: honor-spin 1s linear infinite;
      }
      @keyframes honor-spin {
        to { transform: rotate(360deg); }
      }

      .honor-footer {
        background: var(--honor-card);
        padding: 8px 26px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 12px;
        color: var(--honor-muted);
        border-top: 1px solid rgba(0,102,204,.1);
        flex-shrink: 0;
      }

      @media (max-width: 1200px) {
        .honor-stats { grid-template-columns: repeat(3, 1fr); }
        .honor-stat-num { font-size: 28px; }
      }
      @media (max-width: 720px) {
        .honor-header { padding: 12px 14px; flex-wrap: wrap; gap: 10px; }
        .honor-title { font-size: 19px; order: 3; width: 100%; }
        .honor-stats { grid-template-columns: repeat(2, 1fr); padding: 12px 14px; gap: 10px; }
        .honor-stat { padding: 12px 8px 10px; }
        .honor-stat-num { font-size: 24px; }
        .honor-board { padding: 4px 14px 14px; gap: 10px; }
        .honor-col { min-width: 85vw; max-width: 92vw; }
        .honor-footer { padding: 8px 14px; font-size: 11px; }
      }

      /* Load Tajawal font for the honor display even outside the admin app */
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
    ` }} />
  );
}
