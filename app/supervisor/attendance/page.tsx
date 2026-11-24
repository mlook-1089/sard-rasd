'use client';
import { useEffect, useMemo, useState } from 'react';

type Status = 'present' | 'absent' | 'unset';
type Student = { id: number; name: string; committeeId: number | null; circleName?: string | null };

export default function SupAttendance() {
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [savedPing, setSavedPing] = useState<Record<number, number>>({});
  const [program, setProgram] = useState<{ id: number; name: string } | null>(null);
  const [programLoaded, setProgramLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [bulkSaving, setBulkSaving] = useState<Status | null>(null);
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const [stRes, atRes, pRes] = await Promise.all([
        fetch('/api/students').then((r) => r.json()),
        fetch('/api/attendance').then((r) => r.json()),
        fetch('/api/programs/active').then((r) => r.json())
      ]);
      const active = (stRes.rows || []).filter((s: any) => s.status === 'active');
      setStudents(active);
      const map: Record<number, Status> = {};
      (atRes.rows || []).forEach((r: any) => { map[r.studentId] = r.status; });
      setStatuses(map);
      setProgram(pRes && pRes.id ? pRes : null);
    } catch {
      // handle network failure gracefully
    } finally {
      setProgramLoaded(true);
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filteredStudents = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return students;
    return students.filter((s) => (s.name || '').toLowerCase().includes(query));
  }, [students, q]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let unset = 0;
    for (const s of filteredStudents) {
      const st = statuses[s.id] || 'unset';
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else unset++;
    }
    return { present, absent, unset };
  }, [filteredStudents, statuses]);

  async function setStatus(studentId: number, status: Status): Promise<boolean> {
    const prev = statuses[studentId] || 'unset';
    setStatuses((p) => ({ ...p, [studentId]: status }));
    setSavingIds((p) => ({ ...p, [studentId]: true }));
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId, status })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setStatuses((p) => ({ ...p, [studentId]: prev }));
        setErrorMsg(d.error || `فشل الحفظ (HTTP ${res.status})`);
        setTimeout(() => setErrorMsg(null), 4000);
        return false;
      }
      setSavedPing((p) => ({ ...p, [studentId]: Date.now() }));
      setTimeout(() => setSavedPing((p) => {
        const next = { ...p };
        delete next[studentId];
        return next;
      }), 1200);
      return true;
    } catch {
      setStatuses((p) => ({ ...p, [studentId]: prev }));
      setErrorMsg('خطأ في الاتصال بالخادم');
      setTimeout(() => setErrorMsg(null), 4000);
      return false;
    } finally {
      setSavingIds((p) => {
        const next = { ...p };
        delete next[studentId];
        return next;
      });
    }
  }

  async function bulk(status: Status) {
    if (bulkSaving || filteredStudents.length === 0) return;
    setBulkSaving(status);
    try {
      for (const s of filteredStudents) {
        const ok = await setStatus(s.id, status);
        if (!ok) break;
      }
    } finally {
      setBulkSaving(null);
    }
  }

  return (
    <div className="u-page">
      <div className="u-top">
        <div><h1>التحضير</h1></div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="u-note bad"
          style={{ position: 'sticky', top: 8, zIndex: 20, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span>⚠ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="u-icon-btn" title="إغلاق" aria-label="إغلاق" style={{ width: 32, height: 32 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Live Stats Bar */}
      <div
        className="u-card"
        data-testid="supervisor-attendance-live-stats"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontWeight: 700, fontSize: 14 }}>
          <span className="u-pill ok" style={{ fontSize: 13, padding: '5px 12px' }}>الحاضرون: {stats.present}</span>
          <span className="u-muted">|</span>
          <span className="u-pill bad" style={{ fontSize: 13, padding: '5px 12px' }}>الغائبون: {stats.absent}</span>
          <span className="u-muted">|</span>
          <span className="u-pill" style={{ fontSize: 13, padding: '5px 12px' }}>غير محدد: {stats.unset}</span>
        </div>
        <div className="u-muted" style={{ fontSize: 13 }}>
          الإجمالي: <b className="u-num">{filteredStudents.length}</b>
        </div>
      </div>

      {/* Search & Bulk Actions */}
      <div className="u-card">
        <div className="u-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم الطالب..."
            className="u-input"
            style={{ flex: '1 1 200px' }}
          />
          <button
            type="button"
            onClick={() => setQ('')}
            className="u-btn u-btn-g sm"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>مسح الفلتر</span>
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginInlineStart: 'auto' }}>
            <button
              type="button"
              onClick={() => bulk('present')}
              className="u-btn u-btn-ok sm"
              disabled={!program || filteredStudents.length === 0 || bulkSaving !== null}
            >
              {bulkSaving === 'present' ? 'جاري الحفظ...' : 'الكل حاضر'}
            </button>
            <button
              type="button"
              onClick={() => bulk('absent')}
              className="u-btn u-btn-bad sm"
              disabled={!program || filteredStudents.length === 0 || bulkSaving !== null}
            >
              {bulkSaving === 'absent' ? 'جاري الحفظ...' : 'الكل غائب'}
            </button>
            <button
              type="button"
              onClick={() => bulk('unset')}
              className="u-btn u-btn-g sm"
              disabled={!program || filteredStudents.length === 0 || bulkSaving !== null}
            >
              {bulkSaving === 'unset' ? 'جاري الحفظ...' : 'إعادة'}
            </button>
          </div>
        </div>
      </div>

      {!programLoaded || loading ? (
        <div className="u-empty">...جاري التحميل</div>
      ) : !program ? (
        <div className="u-note bad">يجب تفعيل برنامج أولاً.</div>
      ) : students.length === 0 ? (
        <div className="u-empty">لا يوجد طلاب في لجنتك بعد</div>
      ) : filteredStudents.length === 0 ? (
        <div className="u-empty">لا توجد نتائج مطابقة للبحث</div>
      ) : (
        <div className="u-card">
          <style>{`
            .sup-att-row .u-grow {
              min-width: 140px;
              word-break: normal !important;
              overflow-wrap: break-word;
            }
            .sup-att-row .u-name {
              word-break: normal !important;
              overflow-wrap: break-word;
              white-space: normal;
            }
            @media (max-width: 768px) {
              .sup-att-row.u-item {
                flex-wrap: wrap;
                row-gap: 10px;
              }
              .sup-att-row .u-seg {
                width: 100%;
                flex-basis: 100%;
                min-width: 0 !important;
                order: 10;
              }
            }
          `}</style>
          <div className="u-list">
            {filteredStudents.map((s) => {
              const st: Status = statuses[s.id] || 'unset';
              const isSaving = !!savingIds[s.id] || bulkSaving !== null;
              return (
                <div key={s.id} className="u-item sup-att-row">
                  <div className="u-avatar" style={{ flexShrink: 0 }}>{s.name?.[0] || '؟'}</div>
                  <div className="u-grow">
                    <div className="u-name">{s.name}</div>
                  </div>
                  {savedPing[s.id] && <span className="u-pill ok" style={{ opacity: 0.9 }}>✓ حُفظ</span>}
                  <div className="u-seg" style={{ minWidth: 220 }}>
                    <button type="button" disabled={isSaving} onClick={() => setStatus(s.id, 'present')} className={st === 'present' ? 'on-ok' : ''}>حاضر</button>
                    <button type="button" disabled={isSaving} onClick={() => setStatus(s.id, 'unset')} className={st === 'unset' ? 'on' : ''}>غير محدد</button>
                    <button type="button" disabled={isSaving} onClick={() => setStatus(s.id, 'absent')} className={st === 'absent' ? 'on-bad' : ''}>غائب</button>
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
