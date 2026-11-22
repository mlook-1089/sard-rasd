'use client';
import { useEffect, useRef, useState } from 'react';

type Stat = { label: string; value: number };
type Row = { id: number; name: string; memorized: number; target: number };
type Column = { level: string; rows: Row[] };

export type HonorData = {
  stats: {
    hizbs: Stat; pages: Stat; sessions: Stat;
    students: Stat; circles: Stat; completion: Stat;
  };
  columns: Column[];
};

function useCountUp(target: number, durationMs = 600) {
  const [val, setVal] = useState(target);
  const startedAt = useRef<number | null>(null);
  const prevTarget = useRef<number>(target);
  useEffect(() => {
    if (target === prevTarget.current) {
      if (val !== target) setVal(target);
      return;
    }
    startedAt.current = performance.now();
    const from = prevTarget.current;
    const to = target;
    prevTarget.current = target;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - (startedAt.current ?? now)) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setVal(to);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}

function StatTile({ stat, suffix = '', color }: { stat: Stat; suffix?: string; color: string }) {
  const v = useCountUp(stat.value);
  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 text-center">
      <div className={`text-4xl md:text-5xl font-extrabold ${color}`} dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <bdi>{v.toLocaleString('en-US')}{suffix}</bdi>
      </div>
      <div className="text-sm md:text-base opacity-80 mt-1">{stat.label}</div>
    </div>
  );
}

function medal(i: number): string {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return '';
}

export default function HonorClient({ initialData = null }: { initialData?: HonorData | null }) {
  const [data, setData] = useState<HonorData | null>(initialData);
  const [colIdx, setColIdx] = useState(0);

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
        if (alive && d && d.stats) setData(d);
      } catch {}
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Horizontal rotate when > 3 columns
  useEffect(() => {
    if (!data || data.columns.length <= 3) return;
    const t = setInterval(() => {
      setColIdx((i) => (i + 1) % Math.max(1, data.columns.length - 2));
    }, 8000);
    return () => clearInterval(t);
  }, [data]);

  if (!data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white grid place-items-center">
        <div className="text-2xl opacity-70">...جاري التحميل</div>
      </main>
    );
  }

  const visible = data.columns.length <= 3 ? data.columns : data.columns.slice(colIdx, colIdx + 3);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white">
      <a
        href="/"
        className="fixed top-3 start-3 z-30 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold backdrop-blur"
        style={{ color: '#fff', textDecoration: 'none' }}
      >
        <span>←</span>
        <span>الرجوع لتسجيل الدخول</span>
      </a>
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 py-8">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-400/40 grid place-items-center text-3xl">۞</div>
            <h1 className="text-3xl md:text-5xl font-extrabold">لوحة الشرف</h1>
          </div>
          <p className="opacity-70 mt-2 text-sm md:text-base">منصة رصد — برنامج السرد</p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-10">
          <StatTile stat={data.stats.hizbs} color="text-emerald-300" />
          <StatTile stat={data.stats.pages} color="text-sky-300" />
          <StatTile stat={data.stats.sessions} color="text-amber-300" />
          <StatTile stat={data.stats.students} color="text-fuchsia-300" />
          <StatTile stat={data.stats.circles} color="text-indigo-300" />
          <StatTile stat={data.stats.completion} suffix="%" color="text-teal-300" />
        </section>

        <section className={`grid gap-4 md:gap-6 ${
          visible.length === 1 ? 'grid-cols-1' :
          visible.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {visible.map((col) => (
            <div key={col.level} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-xl md:text-2xl font-bold text-center mb-4">
                {col.level}
              </h3>
              <div className="h-[55vh] overflow-hidden relative">
                {col.rows.length === 0 ? (
                  <div className="text-center opacity-60 py-10">لا يوجد طلاب</div>
                ) : (
                  <div className={col.rows.length > 8 ? 'marquee-up' : ''}>
                    {(col.rows.length > 8 ? [...col.rows, ...col.rows] : col.rows).map((r, i) => {
                      const idx = i % col.rows.length;
                      const pct = r.target > 0 ? Math.min(100, Math.round((r.memorized / r.target) * 100)) : 0;
                      return (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                          <div className="w-8 text-center text-lg">
                            {medal(idx) || <span className="opacity-60 text-sm">{idx + 1}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{r.name}</div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-sm font-mono opacity-80 shrink-0">
                            {r.memorized}/{r.target}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        {data.columns.length > 3 && (
          <p className="text-center text-xs opacity-60 mt-4">
            صفحة {colIdx + 1} من {Math.max(1, data.columns.length - 2)}
          </p>
        )}
      </div>
    </main>
  );
}
