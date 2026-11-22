'use client';
import { useEffect, useState } from 'react';

type Row = {
  id: number;
  studentName: string;
  reciterName: string;
  committeeName: string | null;
  hizbNumber: number;
  startedAt: string;
};

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pillClass(sec: number, slow = 300, stuck = 600) {
  if (sec >= stuck) return 'u-pill bad';
  if (sec >= slow) return 'u-pill warn';
  return 'u-pill ok';
}

function pillStyle(sec: number, stuck = 600): React.CSSProperties | undefined {
  if (sec >= stuck) {
    return {
      background: '#fee2e2',
      color: '#7f1d1d',
      border: '1.5px solid #ef4444',
      fontWeight: 800
    };
  }
  return undefined;
}

export default function LiveSessionsPanel({ scope = 'all' as 'all' | 'mine' }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch('/api/sessions/live?scope=' + scope, { cache: 'no-store' });
        const data = await res.json();
        if (alive) setRows(data.rows || []);
      } catch {}
      if (alive) setLoading(false);
    }
    load();
    const poll = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(poll); };
  }, [scope]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="u-card">
      <div className="u-card-h">
        <h3>🔴 الجلسات المباشرة الآن</h3>
        <span className="u-muted">تحديث كل 10 ثوانٍ</span>
      </div>
      {loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : rows.length === 0 ? (
        <div className="u-empty">لا توجد جلسات نشطة الآن</div>
      ) : (
        <div className="u-list">
          {rows.map((r) => {
            const seconds = Math.max(0, Math.floor((Date.now() - new Date(r.startedAt).getTime()) / 1000));
            void tick;
            return (
              <div key={r.id} className="u-item">
                <div className="u-avatar">{r.studentName[0] || '?'}</div>
                <div className="u-grow">
                  <div className="u-name">{r.studentName}</div>
                  <div className="u-muted">
                    الحزب {r.hizbNumber} · {r.reciterName}
                    {r.committeeName ? ` · ${r.committeeName}` : ''}
                  </div>
                </div>
                <span className={pillClass(seconds)} style={pillStyle(seconds)}>
                  <span className="u-num">{fmt(seconds)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
