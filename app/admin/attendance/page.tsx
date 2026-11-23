'use client';
import { useEffect, useMemo, useState } from 'react';

type Status = 'present' | 'absent' | 'unset';
type Student = { id: number; name: string; committeeId: number | null; committeeName: string | null };

export default function AdminAttendance() {
  const [committees, setCommittees] = useState<any[]>([]);
  const [committeeId, setCommitteeId] = useState('');
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [savedPing, setSavedPing] = useState<Record<number, number>>({});
  const [program, setProgram] = useState<{ id: number; name: string } | null>(null);
  const [programLoaded, setProgramLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState<Status | null>(null);
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch('/api/committees').then((r) => r.json()).then((d) => setCommittees(d.rows || [])).catch(() => {});
    fetch('/api/programs/active')
      .then((r) => r.json())
      .then((d) => setProgram(d && d.id ? d : null))
      .catch(() => setProgram(null))
      .finally(() => setProgramLoaded(true));
  }, []);

  useEffect(() => {
    setLoading(true);
    const studentsPromise = fetch('/api/students')
      .then((r) => r.json())
      .then((d) => {
        const active = (d.rows || []).filter((s: any) => s.status === 'active');
        setStudents(active);
      })
      .catch(() => setStudents([]));

    const url = committeeId ? `/api/attendance?committeeId=${committeeId}` : '/api/attendance';
    const attPromise = fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<number, Status> = {};
        (d.rows || []).forEach((r: any) => { map[r.studentId] = r.status; });
        setStatuses(map);
      })
      .catch(() => {});

    Promise.all([studentsPromise, attPromise]).finally(() => setLoading(false));
  }, [committeeId]);

  const filteredStudents = useMemo(() => {
    const query = q.trim().toLowerCase();
    return students.filter((s) => {
      if (committeeId && String(s.committeeId) !== committeeId) return false;
      if (query && !(s.name || '').toLowerCase().includes(query) && !(s.committeeName || '').toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [students, committeeId, q]);

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
    const prevStatus = statuses[studentId] || 'unset';
    // Optimistic update
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    setSavingIds((prev) => ({ ...prev, [studentId]: true }));
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId, status })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Rollback optimistic update
        setStatuses((prev) => ({ ...prev, [studentId]: prevStatus }));
        setErrorMsg(data.error || `فشل الحفظ (HTTP ${res.status})`);
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
      setStatuses((prev) => ({ ...prev, [studentId]: prevStatus }));
      setErrorMsg('خطأ في الاتصال بالخادم');
      setTimeout(() => setErrorMsg(null), 4000);
      return false;
    } finally {
      setSavingIds((prev) => {
        const next = { ...prev };
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

  function clearFilters() {
    setQ('');
    setCommitteeId('');
  }

  return (
    <div className="u-page">
      <div className="u-top">
        <div>
          <h1>التحضير الشامل</h1>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="u-note bad"
          style={{ position: 'sticky', top: 8, zIndex: 20, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span>⚠ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} aria-label="إغلاق" className="u-btn u-btn-g sm" style={{ padding: '2px 8px' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Live Stats Bar */}
      <div
        className="u-card"
        data-testid="attendance-live-stats"
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

      {/* Filters & Bulk Actions */}
      <div className="u-card">
        <div className="u-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div className="u-field" style={{ margin: 0, flex: '1 1 200px' }}>
            <label>بحث باسم الطالب</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم الطالب..."
              className="u-input"
            />
          </div>

          <div className="u-field" style={{ margin: 0, flex: '1 1 180px' }}>
            <label>تصفية باللجنة</label>
            <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} className="u-input">
              <option value="">كل اللجان</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="u-btn u-btn-g sm"
            style={{ height: 38 }}
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
        <div className="u-note bad">يجب تفعيل برنامج أولاً من "برامج السرد".</div>
      ) : students.length === 0 ? (
        <div className="u-empty">لا يوجد طلاب نشطين</div>
      ) : filteredStudents.length === 0 ? (
        <div className="u-empty">لا توجد نتائج مطابقة للبحث</div>
      ) : (
        <div className="u-card">
          <style>{`
            .adm-att-row .u-grow {
              min-width: 140px;
              word-break: normal;
              overflow-wrap: break-word;
            }
            @media (max-width: 768px) {
              .adm-att-row.u-item {
                flex-wrap: wrap;
                row-gap: 10px;
              }
              .adm-att-row .u-seg {
                width: 100%;
                flex-basis: 100%;
                min-width: 0 !important;
                order: 10;
              }
            }
          `}</style>
          <div className="u-list">
            {filteredStudents.map((s) => (
              <AttRow
                key={s.id}
                student={s}
                status={statuses[s.id] || 'unset'}
                saved={!!savedPing[s.id]}
                saving={!!savingIds[s.id] || bulkSaving !== null}
                onChange={(st) => setStatus(s.id, st)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttRow({
  student,
  status,
  saved,
  saving,
  onChange
}: {
  student: Student;
  status: Status;
  saved: boolean;
  saving: boolean;
  onChange: (s: Status) => void;
}) {
  return (
    <div className="u-item adm-att-row">
      <div className="u-avatar">{student.name?.[0] || '؟'}</div>
      <div className="u-grow">
        <div className="u-name">{student.name}</div>
        {student.committeeName && <div className="u-muted">{student.committeeName}</div>}
      </div>
      {saved && <span className="u-pill ok" style={{ opacity: 0.9 }}>✓ حُفظ</span>}
      <div className="u-seg" style={{ minWidth: 220 }}>
        <button type="button" disabled={saving} onClick={() => onChange('present')} className={status === 'present' ? 'on-ok' : ''}>حاضر</button>
        <button type="button" disabled={saving} onClick={() => onChange('unset')} className={status === 'unset' ? 'on' : ''}>غير محدد</button>
        <button type="button" disabled={saving} onClick={() => onChange('absent')} className={status === 'absent' ? 'on-bad' : ''}>غائب</button>
      </div>
    </div>
  );
}
