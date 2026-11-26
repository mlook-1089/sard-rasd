'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HIZB_PRESETS, juzForHizb } from '@/lib/hizbPresets';

export type TeacherStudentRow = {
  id: number;
  name: string;
  nationalId: string | null;
  parentPhone: string | null;
  committeeId?: number | null;
  status: string;
  hizbsSet: number[];
  mandatoryHizbs: number[];
  hizbsLocked: boolean;
  target: number;
  memorized: number;
  errors: number;
  alerts: number;
  completion: number;
  avgScore: number;
  scoredCount: number;
};

// Color tier based on the average score (aligned with the grading threshold pass=60)
function pctColor(p: number): string {
  if (p >= 85) return 'var(--ok)';
  if (p >= 60) return 'var(--warn)';
  if (p > 0) return '#D9551F';
  return 'var(--bad)';
}

type StudentSessionResult = {
  id: number;
  hizbNumber: number;
  reciterName: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  errors: number;
  alerts: number;
  score: number | null;
  passed: boolean | null;
};

type HizbResultRow = {
  hizbNumber: number;
  latest: StudentSessionResult | null;
  attempts: number;
};

function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '966' + d.slice(1);
  return d;
}

function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function formatResultDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

// ======================================================
// Student Detail — hizb grid view with colors + reciter
// Full-page inline view (same model as the supervisor report)
// ======================================================
type HizbStat = {
  hizb: number;
  attempts: number;
  passed: boolean;
  bestScore: number | null;
  lastDate: string | null;
  lastReciter: string | null;
  isAssigned: boolean;
};

function StudentDetail({
  token,
  student,
  circleName,
  waTemplate,
  onBack,
  onSaved
}: {
  token: string;
  student: TeacherStudentRow;
  circleName: string;
  waTemplate: string;
  onBack: () => void;
  onSaved: (newHizbs: number[], newStatus?: string) => void;
}) {
  const [sessions, setSessions] = useState<StudentSessionResult[]>([]);
  const [assigned, setAssigned] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusHizb, setFocusHizb] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/teacher/${token}/students/${student.id}/results`, { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'تعذر تحميل نتائج الطالب');
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        setAssigned(Array.isArray(data.assignedHizbs) ? data.assignedHizbs : []);
      })
      .catch((e: any) => setError(e?.message || 'تعذر تحميل النتائج'))
      .finally(() => setLoading(false));
  }, [token, student.id]);

  const hizbStats: HizbStat[] = useMemo(() => {
    const assignedSet = new Set(assigned);
    const byHizb = new Map<number, HizbStat>();
    for (const h of assigned) {
      byHizb.set(h, { hizb: h, attempts: 0, passed: false, bestScore: null, lastDate: null, lastReciter: null, isAssigned: true });
    }
    const sorted = [...sessions].sort((a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    for (const r of sorted) {
      let stat = byHizb.get(r.hizbNumber);
      if (!stat) {
        stat = { hizb: r.hizbNumber, attempts: 0, passed: false, bestScore: null, lastDate: null, lastReciter: null, isAssigned: assignedSet.has(r.hizbNumber) };
        byHizb.set(r.hizbNumber, stat);
      }
      stat.attempts++;
      if (r.passed === true) stat.passed = true;
      if (r.score != null && (stat.bestScore == null || r.score > stat.bestScore)) {
        stat.bestScore = r.score;
      }
      stat.lastDate = r.startedAt;
      stat.lastReciter = r.reciterName || stat.lastReciter;
    }
    return Array.from(byHizb.values()).sort((a, b) => a.hizb - b.hizb);
  }, [assigned, sessions]);

  const focusSessions = useMemo(() => {
    if (focusHizb == null) return [];
    return sessions
      .filter((r) => r.hizbNumber === focusHizb)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions, focusHizb]);

  const wa = waNumber(student.parentPhone);
  const waText = fillTemplate(waTemplate, {
    name: student.name,
    memorized: student.memorized,
    hizbs: student.target,
    errors: student.errors,
    alerts: student.alerts,
    completion: student.completion
  });
  const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(waText)}` : null;

  return (
    <div style={{ maxWidth: 1120, width: '100%', margin: '0 auto', padding: '12px', boxSizing: 'border-box' }} className="u-page">
      <TeacherReportStyles />

      <div className="u-top">
        <div>
          <div className="u-sub">تقرير الحلقة · حلقة {circleName}</div>
          <h1>{student.name}</h1>
        </div>
        <div className="u-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <HizbsEditor
            token={token}
            studentId={student.id}
            initial={student.hizbsSet}
            mandatory={student.mandatoryHizbs}
            studentName={student.name}
            editingLocked={student.hizbsLocked}
            compact
            onSaved={onSaved}
          />
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="u-icon-btn u-icon-btn-whatsapp"
              title={`إرسال تقرير ${student.name} عبر واتساب`}
              aria-label={`إرسال تقرير ${student.name} عبر واتساب`}
              style={{ textDecoration: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.11 4.9A10.14 10.14 0 0 0 11.9 2a10.08 10.08 0 0 0-8.7 15.17L2 22l4.95-1.17A10.07 10.07 0 0 0 11.9 22a10.08 10.08 0 0 0 7.21-17.1zM11.9 20.14a8.37 8.37 0 0 1-4.27-1.17l-.3-.18-3.1.73.82-3.04-.2-.31a8.37 8.37 0 0 1 7.05-12.83 8.3 8.3 0 0 1 5.9 2.45 8.3 8.3 0 0 1-5.9 14.35zm4.57-6.26c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.56.13s-.65.8-.8.97c-.14.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.1-.5.1-.1.23-.3.34-.44.11-.14.14-.25.21-.42.07-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.44.06-.67.31-.22.25-.87.85-.87 2.07 0 1.22.9 2.4 1.02 2.57.12.17 1.77 2.72 4.3 3.81.6.26 1.07.42 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.14-1.19-.06-.1-.23-.16-.47-.28z"/></svg>
            </a>
          )}
          <button type="button" onClick={onBack} className="u-btn u-btn-g sm">← رجوع</button>
        </div>
      </div>

      <div className="u-card">
        <div className="u-card-h">
          <h3>سجل الأحزاب</h3>
          <span className="u-pill mute">اضغط على الحزب لتفاصيله</span>
        </div>

        {loading ? (
          <div className="u-empty">...جاري التحميل</div>
        ) : error ? (
          <div className="u-note bad">{error}</div>
        ) : hizbStats.length === 0 ? (
          <div className="u-empty">لا توجد أحزاب مسندة ولا جلسات مسجّلة لهذا الطالب</div>
        ) : (
          <>
            <div className="hz-grid">
              {hizbStats.map((h) => {
                const cls = h.passed ? 'passed' : (h.attempts > 0 ? 'attempted' : 'pending');
                const status = h.passed ? 'منجز' : (h.attempts > 0 ? 'لم يُجتز' : 'لم يُسمّع');
                return (
                  <div
                    key={h.hizb}
                    className={`hz-card ${cls} ${!h.isAssigned ? 'extra' : ''}`}
                    onClick={() => setFocusHizb(h.hizb)}
                  >
                    {h.attempts > 0 && <span className="hz-attempts">×{h.attempts}</span>}
                    {!h.isAssigned && <span className="hz-extra-tag">خارج المسند</span>}
                    <div className="hz-num">{h.hizb}</div>
                    <div className="hz-label">الحزب</div>
                    <span className="hz-status">{status}</span>
                    {h.bestScore != null && (
                      <div className="hz-score">الدرجة: {h.bestScore}</div>
                    )}
                    {h.lastReciter && (
                      <div className="hz-reciter" title={`آخر مسمع: ${h.lastReciter}`}>
                        {h.lastReciter}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="hz-legend">
              <span className="leg"><span className="dot ok" />منجز</span>
              <span className="leg"><span className="dot warn" />لم يُجتز بعد</span>
              <span className="leg"><span className="dot mute" />لم يُسمّع</span>
            </div>
          </>
        )}
      </div>

      {/* Hizb detail bottom sheet */}
      <div className={`u-sheet-bg ${focusHizb != null ? 'show' : ''}`} onClick={() => setFocusHizb(null)} />
      <div className={`u-sheet ${focusHizb != null ? 'show' : ''}`}>
        <div className="grab" />
        {focusHizb != null && (
          <>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              الحزب {focusHizb} · {student.name}
            </div>
            {focusSessions.length === 0 ? (
              <div className="u-empty" style={{ margin: '20px 0' }}>لم يُسمَّع هذا الحزب بعد</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
                {focusSessions.map((r) => {
                  const cls = r.passed === true ? 'passed' : r.passed === false ? 'failed' : 'open';
                  return (
                    <div key={r.id} className={`sess-card ${cls}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                        <b style={{ fontSize: 13 }}>{formatResultDate(r.startedAt)}</b>
                        {r.score != null ? (
                          <span className={`u-pill ${r.passed ? 'ok' : 'bad'}`}>{r.score}</span>
                        ) : (
                          <span className="u-pill mute">مفتوحة</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 12, flexWrap: 'wrap', color: 'var(--ink2)' }}>
                        <span style={{ color: 'var(--bad)' }}>أخطاء: <b>{r.errors}</b></span>
                        <span style={{ color: 'var(--warn)' }}>تنبيهات: <b>{r.alerts}</b></span>
                      </div>
                      <div>
                        <span className="sess-reciter">
                          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a2 2 0 10-4 0v4M5 11h14l-1 10H6L5 11z"/>
                          </svg>
                          المسمع: {r.reciterName || 'بدون اسم'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="u-btn u-btn-g w sm" onClick={() => setFocusHizb(null)} style={{ marginTop: 6 }}>
              إغلاق
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Shared styles block used by the teacher report table + student detail view
function TeacherReportStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .st-rpt-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow); }
      .st-rpt-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .st-rpt-scroll::-webkit-scrollbar { height: 4px; }
      .st-rpt-scroll::-webkit-scrollbar-thumb { background: var(--line2); border-radius: 4px; }
      .st-rpt-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); gap: 10px; background: linear-gradient(0deg, var(--card2), var(--card)); }
      .st-rpt-title { font-weight: 800; font-size: 15.5px; color: var(--ink); }
      .st-rpt-count { background: var(--brand-soft); color: var(--brand-ink); padding: 4px 11px; border-radius: 99px; font-weight: 800; font-size: 12.5px; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 4px; }
      .st-rpt-table { width: 100%; border-collapse: collapse; }
      .st-rpt-table th { padding: 10px 12px; text-align: center; font-size: 12.5px; font-weight: 700; color: var(--ink3); border-bottom: 1px solid var(--line); background: var(--card2); cursor: pointer; user-select: none; white-space: nowrap; }
      .st-rpt-table th:first-child { text-align: start; padding-inline-start: 16px; }
      .st-rpt-table th:hover { color: var(--brand-ink); }
      .st-rpt-table td { padding: 12px; text-align: center; font-size: 14px; border-bottom: 1px solid var(--line); color: var(--ink); font-variant-numeric: tabular-nums; }
      .st-rpt-table td:first-child { text-align: start; padding-inline-start: 16px; }
      .st-rpt-table td:last-child { padding-inline-end: 10px; }
      .st-rpt-table tr:last-child td { border-bottom: 0; }
      .st-rpt-table tr:hover td { background: var(--card2); }
      .st-rpt-link { color: var(--brand-ink); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--brand-ink) 40%, transparent); text-underline-offset: 3px; font-weight: 700; background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit; font-size: 14.5px; text-align: start; }
      .st-rpt-link:hover { text-decoration-color: var(--brand-ink); }
      .st-pct { display: inline-block; font-weight: 800; font-size: 15px; font-variant-numeric: tabular-nums; }
      .st-sort { display: inline-block; margin-inline-start: 2px; font-size: 10px; }
      .st-sort.muted { color: var(--ink3); opacity: .5; }
      .st-sort.on { color: var(--brand-ink); }
      .st-row-actions { display: inline-flex; gap: 6px; justify-content: center; align-items: center; flex-wrap: wrap; }

      /* === Mobile (≤ 640px): switch from a cramped table to per-student cards === */
      .st-desktop-view { display: block; }
      .st-mobile-view { display: none; }
      @media (max-width: 640px) {
        .st-desktop-view { display: none !important; }
        .st-mobile-view { display: block !important; }
        .st-rpt-head { padding: 12px 14px; }
      }

      .st-cards-list {
        display: flex;
        flex-direction: column;
      }
      .st-stu-card {
        background: var(--card);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 9px;
        border-bottom: 1px solid var(--line);
      }
      .st-stu-card:last-child { border-bottom: 0; }
      .st-stu-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .st-stu-name {
        background: none;
        border: 0;
        color: var(--brand-ink);
        font-weight: 800;
        font-size: 15px;
        text-align: start;
        padding: 0;
        text-decoration: underline;
        text-decoration-color: color-mix(in srgb, var(--brand-ink) 40%, transparent);
        text-underline-offset: 3px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: inherit;
        cursor: pointer;
      }
      .st-stu-pct {
        font-weight: 800;
        font-size: 14.5px;
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
        padding: 4px 11px;
        border-radius: 99px;
        background: color-mix(in srgb, currentColor 12%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
      }
      .st-stu-meta {
        color: var(--ink2);
        font-size: 12.5px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .st-stu-meta .sep { color: var(--ink3); opacity: .5; }
      .st-stu-meta b { color: var(--ink); font-weight: 700; margin-inline-start: 3px; }
      .st-stu-actions {
        display: flex;
        gap: 8px;
        align-items: stretch;
        padding-top: 2px;
      }
      .st-stu-actions .teacher-hizbs-btn,
      .st-stu-actions > button,
      .st-stu-actions > .u-btn { flex: 1; min-height: 40px; }
      .st-stu-actions .u-icon-btn { flex-shrink: 0; width: 40px !important; height: 40px !important; min-width: 40px !important; min-height: 40px !important; }

      .hz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
      .hz-card { background: var(--card); border: 1.5px solid var(--line); border-radius: 14px; padding: 10px 8px 9px; text-align: center; cursor: pointer; transition: transform .12s, box-shadow .12s, border-color .12s; position: relative; overflow: hidden; }
      .hz-card:hover { transform: translateY(-1px); box-shadow: var(--shadow); }
      .hz-card .hz-num { font-size: 22px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
      .hz-card .hz-label { font-size: 10.5px; color: var(--ink3); margin-top: 1px; }
      .hz-card .hz-status { display: inline-block; margin-top: 7px; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
      .hz-card.passed { background: linear-gradient(0deg, color-mix(in srgb, var(--ok) 11%, var(--card)), var(--card)); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
      .hz-card.passed .hz-num { color: var(--ok); }
      .hz-card.passed .hz-status { background: var(--ok-soft); color: var(--ok); }
      .hz-card.attempted { background: linear-gradient(0deg, color-mix(in srgb, var(--warn) 11%, var(--card)), var(--card)); border-color: color-mix(in srgb, var(--warn) 45%, var(--line)); }
      .hz-card.attempted .hz-num { color: var(--warn); }
      .hz-card.attempted .hz-status { background: var(--warn-soft); color: var(--warn); }
      .hz-card.pending .hz-num { color: var(--ink3); }
      .hz-card.pending .hz-status { background: var(--muted-bg); color: var(--ink3); }
      .hz-card.extra { border-style: dashed; border-color: color-mix(in srgb, var(--brand-ink) 35%, var(--line)); }
      .hz-score { font-size: 12px; font-weight: 700; margin-top: 4px; color: var(--ink2); }
      .hz-reciter { font-size: 10.5px; margin-top: 5px; color: var(--ink2); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--muted-bg); padding: 2px 6px; border-radius: 6px; }
      .hz-attempts { position: absolute; top: 6px; inset-inline-end: 6px; font-size: 10px; color: var(--ink3); font-weight: 700; background: var(--muted-bg); padding: 1px 6px; border-radius: 99px; }
      .hz-extra-tag { position: absolute; top: 6px; inset-inline-start: 6px; font-size: 9.5px; color: var(--brand-ink); font-weight: 700; background: var(--brand-soft); padding: 1px 6px; border-radius: 99px; }
      .hz-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; margin-top: 12px; color: var(--ink2); }
      .hz-legend .leg { display: inline-flex; align-items: center; gap: 5px; }
      .hz-legend .dot { width: 10px; height: 10px; border-radius: 50%; }
      .hz-legend .dot.ok { background: var(--ok); }
      .hz-legend .dot.warn { background: var(--warn); }
      .hz-legend .dot.mute { background: var(--ink3); }

      .sess-card { border: 1px solid var(--line); border-radius: 11px; padding: 10px 12px; }
      .sess-card.passed { background: var(--ok-soft); border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); }
      .sess-card.failed { background: var(--bad-soft); border-color: color-mix(in srgb, var(--bad) 35%, var(--line)); }
      .sess-card.open { background: var(--muted-bg); }
      .sess-reciter { display: inline-flex; align-items: center; gap: 4px; background: var(--card); border: 1px solid var(--line); padding: 3px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 700; color: var(--brand-ink); margin-top: 6px; }
    ` }} />
  );
}

export default function HizbsEditor({
  token,
  studentId,
  initial,
  mandatory,
  studentName,
  editingLocked = false,
  compact = false,
  onSaved
}: {
  token: string;
  studentId: number;
  initial: number[];
  mandatory: number[];
  studentName: string;
  editingLocked?: boolean;
  compact?: boolean;
  onSaved?: (newHizbs: number[], newStatus?: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [savedHizbs, setSavedHizbs] = useState<number[]>(initial);
  const [sel, setSel] = useState<Set<number>>(new Set(initial));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const selectionRef = useRef<Set<number>>(new Set(initial));
  const touchStartsRef = useRef(new Map<number, { x: number; y: number }>());
  const suppressedTouchClicksRef = useRef(new Map<number, number>());

  function replaceSelection(next: Set<number>) {
    selectionRef.current = next;
    setSel(next);
  }

  useEffect(() => {
    setSavedHizbs(initial);
    replaceSelection(new Set(initial));
  }, [initial]);

  function openModal() {
    replaceSelection(new Set(savedHizbs));
    setErr(null);
    setOpen(true);
  }

  function toggle(n: number) {
    if (saving) return;
    if (mandatory.includes(n)) return;
    // Keep an immediate source of truth in addition to React state. This makes
    // consecutive mobile taps (and an immediate Save tap) deterministic even
    // before React has painted the previous selection.
    const next = new Set(selectionRef.current);
    if (next.has(n)) next.delete(n); else next.add(n);
    replaceSelection(next);
  }

  function beginTouchTap(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'touch') return;
    touchStartsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function finishTouchTap(event: React.PointerEvent<HTMLButtonElement>, n: number) {
    if (event.pointerType !== 'touch') return;
    const start = touchStartsRef.current.get(event.pointerId);
    touchStartsRef.current.delete(event.pointerId);
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > 12) return;

    // Handle the touch immediately instead of waiting for the compatibility
    // click. Suppress that later click so one tap can never toggle twice.
    event.preventDefault();
    suppressedTouchClicksRef.current.set(n, Date.now() + 700);
    toggle(n);
  }

  function handleHizbClick(event: React.MouseEvent<HTMLButtonElement>, n: number) {
    const suppressUntil = suppressedTouchClicksRef.current.get(n) || 0;
    if (Date.now() < suppressUntil) {
      event.preventDefault();
      return;
    }
    suppressedTouchClicksRef.current.delete(n);
    toggle(n);
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving]);

  function selectAll() {
    if (saving) return;
    replaceSelection(new Set(Array.from({ length: 60 }, (_, i) => i + 1)));
  }

  function clearAll() {
    if (saving) return;
    replaceSelection(new Set(mandatory));
  }

  function togglePreset(hizbs: readonly number[]) {
    if (saving) return;
    const current = selectionRef.current;
    const complete = hizbs.every((n) => current.has(n));
    if (!complete) {
      replaceSelection(new Set([...current, ...hizbs]));
      return;
    }
    const next = new Set(current);
    for (const n of hizbs) {
      if (!mandatory.includes(n)) next.delete(n);
    }
    replaceSelection(next);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    const chosen = Array.from(selectionRef.current).sort((a, b) => a - b);
    try {
      const res = await fetch(`/api/teacher/${token}/students/${studentId}/hizbs`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ hizbs: chosen })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error || 'فشل الحفظ');
      }
      const nextHizbs: number[] = Array.isArray(d.hizbs) ? d.hizbs : chosen;
      setSavedHizbs(nextHizbs);
      replaceSelection(new Set(nextHizbs));
      onSaved?.(nextHizbs, d.status);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={editingLocked}
        className={`u-btn ${editingLocked ? 'u-btn-g' : 'u-btn-p'}${compact ? ' sm teacher-hizbs-btn' : ''}`}
        title={editingLocked ? 'تعديل الأحزاب مقفل من الإدارة' : `تحديد أحزاب ${studentName}`}
      >
        <span aria-hidden="true" style={{ fontSize: 13 }}>{editingLocked ? '🔒' : '📚'}</span><span>{editingLocked ? `مقفلة (${savedHizbs.length})` : compact ? `الأحزاب (${savedHizbs.length})` : `تحديد الأحزاب (${savedHizbs.length})`}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 hizb-editor-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`أحزاب ${studentName}`}
          style={{ background: 'var(--overlay)', display: 'grid', placeItems: 'center', padding: 16, overflow: 'hidden' }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="hizb-editor-panel"
            style={{
              background: 'var(--card)',
              borderRadius: 20,
              maxWidth: 760,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="hizb-editor-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div className="u-row u-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="hizb-editor-title">
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>أحزاب {studentName}</h3>
                  <p className="u-muted" style={{ margin: '2px 0 0' }}>الحالي: <b>{savedHizbs.length}</b> · بعد الحفظ: <b>{sel.size}</b></p>
                </div>
                <div className="hizb-editor-toolbar" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={saving}
                    className="u-btn u-btn-s sm"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={saving}
                    className="u-btn u-btn-g sm"
                  >
                    إلغاء تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => !saving && setOpen(false)}
                    disabled={saving}
                    aria-label="إغلاق"
                    className="u-icon-btn"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="hizb-editor-body" style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              <div className="hizb-presets">
                <div className="hizb-presets-title">
                  <div><b>اختيارات سريعة</b><span>اضغط مرة للإضافة ومرة أخرى للإلغاء</span></div>
                </div>
                <div className="hizb-presets-grid">
                  {HIZB_PRESETS.map((preset) => {
                    const complete = preset.hizbs.every((n) => sel.has(n));
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={saving}
                        className={`hizb-preset${complete ? ' complete' : ''}`}
                        onClick={() => togglePreset(preset.hizbs)}
                      >
                        <span>{complete ? '✓' : '+'}</span>
                        <b>{preset.label}</b>
                        <small>الأحزاب {preset.detail}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="hizb-lock-legend" aria-label="مفتاح حالات الأحزاب">
                <span><i className="mandatory" /> إلزامي من الإدارة</span>
                <span><i className="saved" /> مضاف سابقاً</span>
                <span><i className="new" /> إضافة جديدة</span>
                {savedHizbs.some((n) => !mandatory.includes(n) && !sel.has(n)) && <span><i className="remove" /> سيُحذف عند الحفظ</span>}
              </div>
              <div className="th-hizb-grid">
                {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => {
                  const on = sel.has(n);
                  const isMandatory = mandatory.includes(n);
                  const isSaved = savedHizbs.includes(n);
                  const willBeRemoved = isSaved && !isMandatory && !on;
                  const stateClass = isMandatory
                    ? ' locked'
                    : willBeRemoved
                      ? ' removed'
                      : isSaved && on
                        ? ' saved'
                        : on
                          ? ' on'
                          : '';
                  return (
                    <button
                      key={n}
                      onPointerDown={beginTouchTap}
                      onPointerUp={(event) => finishTouchTap(event, n)}
                      onPointerCancel={(event) => touchStartsRef.current.delete(event.pointerId)}
                      onClick={(event) => handleHizbClick(event, n)}
                      disabled={saving || isMandatory}
                      className={`th-h${stateClass}`}
                      type="button"
                      aria-pressed={on}
                      title={isMandatory ? 'حزب إلزامي مقفل من الإدارة' : willBeRemoved ? 'سيُحذف عند الحفظ' : isSaved ? 'محفوظ سابقاً ويمكن إلغاء اختياره' : undefined}
                    >
                      {isMandatory && <span className="th-h-lock" aria-hidden="true">🔒</span>}
                      {willBeRemoved && <span className="th-h-remove" aria-hidden="true">×</span>}
                      <span className="th-h-num">{n}</span>
                      <span className="th-h-sub">جزء {juzForHizb(n)}</span>
                    </button>
                  );
                })}
              </div>

              {err && (
                <div className="u-note bad" style={{ marginTop: 14, marginBottom: 0 }}>{err}</div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="hizb-editor-footer" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--card)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => !saving && setOpen(false)}
                disabled={saving}
                className="u-btn u-btn-g"
                style={{ minWidth: 72 }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="u-btn u-btn-p"
                style={{ minWidth: 96 }}
              >
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function TeacherPortalClient({
  token,
  circleName,
  teacherName,
  waTemplate,
  initialRows
}: {
  token: string;
  circleName: string;
  teacherName: string | null;
  waTemplate: string;
  initialRows: TeacherStudentRow[];
}) {
  const [rows, setRows] = useState<TeacherStudentRow[]>(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  function handleStudentSaved(studentId: number, newHizbs: number[], newStatus?: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== studentId) return r;
        const target = newHizbs.length;
        const completion = target > 0 ? Math.round((r.memorized / target) * 100) : 0;
        const status =
          newStatus ??
          (target === 0
            ? 'waiting_hizbs'
            : r.committeeId
              ? 'active'
              : r.status === 'active'
                ? 'active'
                : 'waiting_committee');
        return {
          ...r,
          hizbsSet: newHizbs,
          target,
          completion,
          status
        };
      })
    );
  }

  const [sel, setSel] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<'name' | 'target' | 'memorized' | 'avgScore'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: 'name' | 'target' | 'memorized' | 'avgScore') {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  }
  function sortGlyph(key: 'name' | 'target' | 'memorized' | 'avgScore') {
    if (sortKey !== key) return <span className="st-sort muted">▾</span>;
    return <span className="st-sort on">{sortDir === 'asc' ? '▴' : '▾'}</span>;
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = (a.name || '').localeCompare(b.name || '', 'ar');
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  // Dashboard aggregates
  const totalTarget = rows.reduce((a, r) => a + r.target, 0);
  const totalMem = rows.reduce((a, r) => a + r.memorized, 0);
  const scoredRows = rows.filter((r) => r.scoredCount > 0);
  const circleAvg = scoredRows.length
    ? Math.round(scoredRows.reduce((a, r) => a + r.avgScore, 0) / scoredRows.length)
    : 0;

  if (sel != null) {
    const student = rows.find((r) => r.id === sel);
    if (!student) {
      setSel(null);
      return null;
    }
    return (
      <StudentDetail
        token={token}
        student={student}
        circleName={circleName}
        waTemplate={waTemplate}
        onBack={() => setSel(null)}
        onSaved={(newHizbs, newStatus) => handleStudentSaved(student.id, newHizbs, newStatus)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1120, width: '100%', margin: '0 auto', padding: '12px', boxSizing: 'border-box' }} className="u-page">
      <TeacherReportStyles />

      <div className="u-hero">
        <div className="l">السلام عليكم ورحمة الله</div>
        <div className="big">{teacherName ? `أهلاً ${teacherName}` : 'أهلاً بك'}</div>
        <div className="meta"><span>حلقة <b>{circleName}</b></span></div>
      </div>

      <div className="u-grid3">
        <div className="u-stat">
          <div className="l">عدد الطلاب</div>
          <div className="v">{rows.length}</div>
        </div>
        <div className="u-stat">
          <div className="l">المنجز / الهدف</div>
          <div className="v sm"><span className="u-num">{totalMem}</span> / <span className="u-num">{totalTarget}</span></div>
        </div>
        <div className="u-stat">
          <div className="l">متوسط الحلقة</div>
          <div className="v" style={{ color: pctColor(circleAvg) }}>
            {scoredRows.length > 0 ? `${circleAvg}%` : '—'}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="u-empty">لا يوجد طلاب بعد</div>
      ) : (
        <div className="st-rpt-card">
          <div className="st-rpt-head">
            <div className="st-rpt-title">تقرير الحلقة</div>
            <div className="st-rpt-count">
              <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l7 10H5z"/></svg>
              {rows.length} {rows.length === 1 ? 'طالب' : 'طلاب'}
            </div>
          </div>

          <div className="st-rpt-scroll st-desktop-view">
          <table className="st-rpt-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')}>الطالب{sortGlyph('name')}</th>
                <th onClick={() => toggleSort('target')}>الأحزاب{sortGlyph('target')}</th>
                <th onClick={() => toggleSort('memorized')}>المرصود{sortGlyph('memorized')}</th>
                <th onClick={() => toggleSort('avgScore')}>النسبة{sortGlyph('avgScore')}</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const wa = waNumber(r.parentPhone);
                const waText = fillTemplate(waTemplate, {
                  name: r.name,
                  memorized: r.memorized,
                  hizbs: r.target,
                  errors: r.errors,
                  alerts: r.alerts,
                  completion: r.completion
                });
                const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(waText)}` : null;
                return (
                  <tr key={r.id}>
                    <td>
                      <button type="button" onClick={() => setSel(r.id)} className="st-rpt-link">
                        {r.name}
                      </button>
                    </td>
                    <td>{r.target}</td>
                    <td>{r.memorized}</td>
                    <td>
                      <span className="st-pct" style={{ color: pctColor(r.avgScore) }}>
                        {r.avgScore}%
                      </span>
                    </td>
                    <td>
                      <div className="st-row-actions">
                        <HizbsEditor
                          token={token}
                          studentId={r.id}
                          initial={r.hizbsSet}
                          mandatory={r.mandatoryHizbs}
                          studentName={r.name}
                          editingLocked={r.hizbsLocked}
                          compact
                          onSaved={(newHizbs, newStatus) => handleStudentSaved(r.id, newHizbs, newStatus)}
                        />
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="u-icon-btn u-icon-btn-whatsapp"
                            title={`إرسال تقرير ${r.name} عبر واتساب`}
                            aria-label={`إرسال تقرير ${r.name} عبر واتساب`}
                            style={{ textDecoration: 'none' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.11 4.9A10.14 10.14 0 0 0 11.9 2a10.08 10.08 0 0 0-8.7 15.17L2 22l4.95-1.17A10.07 10.07 0 0 0 11.9 22a10.08 10.08 0 0 0 7.21-17.1zM11.9 20.14a8.37 8.37 0 0 1-4.27-1.17l-.3-.18-3.1.73.82-3.04-.2-.31a8.37 8.37 0 0 1 7.05-12.83 8.3 8.3 0 0 1 5.9 2.45 8.3 8.3 0 0 1-5.9 14.35zm4.57-6.26c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.56.13s-.65.8-.8.97c-.14.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.1-.5.1-.1.23-.3.34-.44.11-.14.14-.25.21-.42.07-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.44.06-.67.31-.22.25-.87.85-.87 2.07 0 1.22.9 2.4 1.02 2.57.12.17 1.77 2.72 4.3 3.81.6.26 1.07.42 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.14-1.19-.06-.1-.23-.16-.47-.28z"/></svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="st-mobile-view st-cards-list">
            {sortedRows.map((r) => {
              const wa = waNumber(r.parentPhone);
              const waText = fillTemplate(waTemplate, {
                name: r.name,
                memorized: r.memorized,
                hizbs: r.target,
                errors: r.errors,
                alerts: r.alerts,
                completion: r.completion
              });
              const waUrl = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(waText)}` : null;
              return (
                <div key={r.id} className="st-stu-card">
                  <div className="st-stu-head">
                    <button type="button" onClick={() => setSel(r.id)} className="st-stu-name">
                      {r.name}
                    </button>
                    <span className="st-stu-pct" style={{ color: pctColor(r.avgScore) }}>{r.avgScore}%</span>
                  </div>
                  <div className="st-stu-meta">
                    <span>الأحزاب <b>{r.target}</b></span>
                    <span className="sep">·</span>
                    <span>المرصود <b>{r.memorized}</b></span>
                  </div>
                  <div className="st-stu-actions">
                    <HizbsEditor
                      token={token}
                      studentId={r.id}
                      initial={r.hizbsSet}
                      mandatory={r.mandatoryHizbs}
                      studentName={r.name}
                      editingLocked={r.hizbsLocked}
                      compact
                      onSaved={(newHizbs, newStatus) => handleStudentSaved(r.id, newHizbs, newStatus)}
                    />
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="u-icon-btn u-icon-btn-whatsapp"
                        title={`إرسال تقرير ${r.name} عبر واتساب`}
                        aria-label={`إرسال تقرير ${r.name} عبر واتساب`}
                        style={{ textDecoration: 'none' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.11 4.9A10.14 10.14 0 0 0 11.9 2a10.08 10.08 0 0 0-8.7 15.17L2 22l4.95-1.17A10.07 10.07 0 0 0 11.9 22a10.08 10.08 0 0 0 7.21-17.1zM11.9 20.14a8.37 8.37 0 0 1-4.27-1.17l-.3-.18-3.1.73.82-3.04-.2-.31a8.37 8.37 0 0 1 7.05-12.83 8.3 8.3 0 0 1 5.9 2.45 8.3 8.3 0 0 1-5.9 14.35zm4.57-6.26c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.56.13s-.65.8-.8.97c-.14.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.1-.5.1-.1.23-.3.34-.44.11-.14.14-.25.21-.42.07-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.44.06-.67.31-.22.25-.87.85-.87 2.07 0 1.22.9 2.4 1.02 2.57.12.17 1.77 2.72 4.3 3.81.6.26 1.07.42 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.14-1.19-.06-.1-.23-.16-.47-.28z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
