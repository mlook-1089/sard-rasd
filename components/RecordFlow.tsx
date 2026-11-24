'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type AttendanceStatus = 'present' | 'absent' | 'unset';

type HizbResult = {
  sessionId: number;
  score: number;
  passed: boolean;
  errors: number;
  alerts: number;
};

type Student = {
  id: number;
  name: string;
  level: string | null;
  circleName?: string | null;
  assigned?: number[];
  recited?: number[];
  remaining: number[];
  memorized: number;
  target: number;
  hizbResults?: Record<number, HizbResult>;
  attendanceStatus?: AttendanceStatus;
  activeSession?: {
    id: number;
    hizbNumber: number;
    reciterName: string;
    deviceTag: string | null;
    startedAt: string;
  } | null;
};

type ActiveSession = {
  id: number;
  startedAt: string;
  studentId: number;
  hizbNumber: number;
};

type PersistedActiveSession = {
  sessionId: number;
  studentId: number;
  studentName?: string;
  studentLevel?: string | null;
  committeeId?: number;
  hizbNumber: number;
  startedAt: string;
  errors: number;
  alerts: number;
  pausedMs: number;
  isPaused: boolean;
  pausedAt: number | null;
  notes: string;
  actionHistory: ('err' | 'alt')[];
  reciterName?: string;
};

type SavedResult = {
  text: string;
  score: number;
  passed: boolean;
  studentId: number;
  studentName: string;
  hizbNumber: number;
  notes?: string;
};

const ACTIVE_SESSION_STORAGE_KEY = 'rasd_active_session';
const SESSION_NOTES_STORAGE_KEY = 'sard_session_notes';
const QUICK_NOTE_TAGS = [
  'تردد في المتشابهات',
  'أحكام التجويد',
  'حفظ متقن',
  'يحتاج مراجعة'
];

export default function RecordFlow({
  committeeId,
  defaultReciterName,
  committeeIdRequired = false,
  committeesForReciter = []
}: {
  committeeId?: number;
  defaultReciterName?: string;
  committeeIdRequired?: boolean;
  committeesForReciter?: { id: number; name: string }[];
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [chosenCommittee, setChosenCommittee] = useState<number | undefined>(committeeId);
  const [reciterName, setReciterName] = useState(defaultReciterName || '');
  const [q, setQ] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'non_absent'>('all');
  const [selected, setSelected] = useState<Student | null>(null);
  const [chosenHizb, setChosenHizb] = useState<number | null>(null);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [errors, setErrors] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const [actionHistory, setActionHistory] = useState<('err' | 'alt')[]>([]);
  const [pausedMs, setPausedMs] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [pulse, setPulse] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const [tick, setTick] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);
  const [savingEnd, setSavingEnd] = useState(false);
  const [savingCancel, setSavingCancel] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editingRecordedHizb, setEditingRecordedHizb] = useState<{
    hizbNumber: number;
    sessionId: number;
    errors: number;
    alerts: number;
  } | null>(null);
  const [savingRecordedEdit, setSavingRecordedEdit] = useState(false);

  const hizbCardRef = useRef<HTMLDivElement | null>(null);
  const restoredOnceRef = useRef(false);

  // Sync props when parent updates committeeId or defaultReciterName
  useEffect(() => {
    if (committeeId && !active) {
      setChosenCommittee(committeeId);
    }
  }, [committeeId, active]);

  useEffect(() => {
    if (defaultReciterName) {
      setReciterName(defaultReciterName);
    }
  }, [defaultReciterName]);

  useEffect(() => {
    const iv = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const liveCommitteeId = chosenCommittee;

  const loadStudents = useCallback(async (cId?: number): Promise<Student[]> => {
    const targetCommittee = cId ?? liveCommitteeId;
    if (!targetCommittee && committeeIdRequired) return [];
    const url = committeeIdRequired
      ? `/api/students/for-record?committeeId=${targetCommittee}`
      : `/api/students/for-record`;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const d = await r.json();
      const list: Student[] = d.students || [];
      setStudents(list);
      return list;
    } catch {
      return [];
    }
  }, [liveCommitteeId, committeeIdRequired]);

  useEffect(() => {
    if (committeeIdRequired && !liveCommitteeId) return;
    loadStudents(liveCommitteeId);
    if (active) return;
    const iv = setInterval(() => {
      loadStudents(liveCommitteeId);
    }, 8000);
    return () => clearInterval(iv);
  }, [liveCommitteeId, committeeIdRequired, loadStudents, active]);

  // Restore active session on mount from localStorage or server so navigation never orphans a session
  useEffect(() => {
    if (restoredOnceRef.current) return;
    restoredOnceRef.current = true;

    async function tryRestore() {
      try {
        const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (raw) {
          const saved: PersistedActiveSession = JSON.parse(raw);
          if (saved && saved.sessionId && saved.studentId && saved.hizbNumber) {
            if (saved.committeeId && !chosenCommittee) {
              setChosenCommittee(saved.committeeId);
            }
            if (saved.reciterName && !reciterName) {
              setReciterName(saved.reciterName);
            }
            setActive({
              id: saved.sessionId,
              startedAt: saved.startedAt,
              studentId: saved.studentId,
              hizbNumber: saved.hizbNumber
            });
            setChosenHizb(saved.hizbNumber);
            setErrors(Math.max(0, Math.floor(Number(saved.errors) || 0)));
            setAlerts(Math.max(0, Math.floor(Number(saved.alerts) || 0)));
            setPausedMs(Math.max(0, Math.floor(Number(saved.pausedMs) || 0)));
            setIsPaused(Boolean(saved.isPaused));
            setPausedAt(saved.pausedAt ? Number(saved.pausedAt) : null);
            setNotes(saved.notes || '');
            setActionHistory(Array.isArray(saved.actionHistory) ? saved.actionHistory : []);
            setSelected((prev) => prev ?? {
              id: saved.studentId,
              name: saved.studentName || 'طالب',
              level: saved.studentLevel ?? null,
              remaining: [saved.hizbNumber],
              memorized: 0,
              target: 1,
              attendanceStatus: 'present'
            });

            // Verify on server that the session is still open
            const checkRes = await fetch(`/api/sessions?activeOnly=1&studentId=${saved.studentId}`, { cache: 'no-store' });
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              const stillOpen = (checkData.rows || []).some((r: any) => Number(r.id) === Number(saved.sessionId));
              if (!stillOpen) {
                localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
                setActive(null);
              }
            }
            return;
          }
        }

        // Fallback: check server for an un-ended session from this device/reciter within last 2 hours
        const tag = getOrSetDeviceTag();
        const params = new URLSearchParams({ activeOnly: '1', deviceTag: tag });
        if (defaultReciterName) params.set('reciterName', defaultReciterName);
        const res = await fetch(`/api/sessions?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const openRow = (data.rows || []).find((r: any) =>
          !r.endedAt &&
          !r.cancelled &&
          new Date(r.startedAt).getTime() > twoHoursAgo &&
          (!committeeId || !r.committeeId || Number(r.committeeId) === Number(committeeId))
        );
        if (openRow) {
          if (openRow.committeeId && !chosenCommittee) {
            setChosenCommittee(Number(openRow.committeeId));
          }
          setActive({
            id: openRow.id,
            startedAt: openRow.startedAt,
            studentId: openRow.studentId,
            hizbNumber: openRow.hizbNumber
          });
          setChosenHizb(openRow.hizbNumber);
          setErrors(Math.max(0, Number(openRow.errors) || 0));
          setAlerts(Math.max(0, Number(openRow.alerts) || 0));
          setSelected((prev) => prev ?? {
            id: openRow.studentId,
            name: openRow.studentName || 'طالب',
            level: null,
            remaining: [openRow.hizbNumber],
            memorized: 0,
            target: 1,
            attendanceStatus: 'present'
          });
        }
      } catch {}
    }

    tryRestore();
  }, [chosenCommittee, committeeId, defaultReciterName, reciterName]);

  // Once students list loads, sync full student object into `selected` if active or selected matches by id
  useEffect(() => {
    if (students.length === 0) return;
    if (active) {
      const match = students.find((s) => s.id === active.studentId);
      if (match && (!selected || selected.id !== match.id || selected.name !== match.name)) {
        setSelected(match);
      }
    } else if (selected) {
      const match = students.find((s) => s.id === selected.id);
      if (match && match !== selected) {
        setSelected(match);
      }
    }
  }, [students, active, selected]);

  // Persist active session state to localStorage whenever it changes
  useEffect(() => {
    if (!active) return;
    try {
      const payload: PersistedActiveSession = {
        sessionId: active.id,
        studentId: active.studentId,
        studentName: selected?.name,
        studentLevel: selected?.level,
        committeeId: liveCommitteeId,
        hizbNumber: active.hizbNumber,
        startedAt: active.startedAt,
        errors,
        alerts,
        pausedMs,
        isPaused,
        pausedAt,
        notes,
        actionHistory,
        reciterName
      };
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [active, selected, liveCommitteeId, errors, alerts, pausedMs, isPaused, pausedAt, notes, actionHistory, reciterName]);

  // Warn before closing/reloading browser tab while a session is active
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  useEffect(() => {
    if (!selected) { setHistory([]); return; }
    fetch(`/api/sessions?studentId=${selected.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setHistory(d.rows || []))
      .catch(() => {});
  }, [selected]);

  const filtered = students.filter((s) => {
    if (q && !s.name.includes(q)) return false;
    const att = s.attendanceStatus ?? 'unset';
    if (attendanceFilter === 'present') return att === 'present';
    if (attendanceFilter === 'non_absent') return att !== 'absent';
    return true;
  });

  // Compute active elapsed timer seconds (accounting for pauses)
  const nowMs = isPaused && pausedAt ? pausedAt : Date.now();
  const elapsedMs = active ? Math.max(0, nowMs - new Date(active.startedAt).getTime() - pausedMs) : 0;
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  void tick;

  function togglePause() {
    if (!active) return;
    if (!isPaused) {
      setIsPaused(true);
      setPausedAt(Date.now());
    } else {
      const extra = pausedAt ? Math.max(0, Date.now() - pausedAt) : 0;
      setPausedMs((prev) => prev + extra);
      setIsPaused(false);
      setPausedAt(null);
    }
  }

  const bumpCounter = useCallback((kind: 'err' | 'alt', delta: number) => {
    if (kind === 'err') {
      setErrors((v) => Math.max(0, v + delta));
    } else {
      setAlerts((v) => Math.max(0, v + delta));
    }

    if (delta > 0) {
      setActionHistory((prev) => [...prev, kind]);
      setPulse(true);
      setTimeout(() => setPulse(false), 360);
      if (kind === 'err') {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try { navigator.vibrate(60); } catch {}
        }
        setErrorFlash(true);
        setTimeout(() => setErrorFlash(false), 380);
      }
    } else if (delta < 0) {
      setActionHistory((prev) => {
        const idx = prev.lastIndexOf(kind);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      });
    }
  }, []);

  const undoLastAction = useCallback(() => {
    setActionHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last === 'err') {
        setErrors((v) => Math.max(0, v - 1));
      } else {
        setAlerts((v) => Math.max(0, v - 1));
      }
      return prev.slice(0, -1);
    });
  }, []);

  function toggleQuickNoteTag(tag: string) {
    setNotes((prev) => {
      const parts = prev
        .split('،')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.includes(tag)) {
        return parts.filter((p) => p !== tag).join('، ');
      }
      return [...parts, tag].join('، ');
    });
  }

  async function start(hizbOverride?: number) {
    const targetHizb = hizbOverride ?? chosenHizb;
    if (!selected || !targetHizb || starting) return;
    if (!reciterName.trim()) {
      setChosenHizb(targetHizb);
      setErrorMsg('يرجى كتابة اسمك كمسمع أولاً قبل بدء الرصد');
      return;
    }
    if (selected.attendanceStatus === 'absent') {
      setErrorMsg('لا يمكن تسميع طالب مسجل غائباً في التحضير');
      return;
    }
    setChosenHizb(targetHizb);
    setStarting(true);
    setErrorMsg(null);
    setSavedResult(null);

    try {
      const body: any = {
        studentId: selected.id,
        hizbNumber: Math.max(1, Math.floor(Number(targetHizb) || 1)),
        reciterName: reciterName.trim(),
        deviceTag: getOrSetDeviceTag()
      };
      if (committeeIdRequired || liveCommitteeId) body.committeeId = liveCommitteeId;

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'تعذر بدء جلسة التسميع');
        setStarting(false);
        return;
      }
      setActive({
        id: data.id,
        startedAt: data.startedAt,
        studentId: selected.id,
        hizbNumber: targetHizb
      });
      setErrors(0);
      setAlerts(0);
      setActionHistory([]);
      setPausedMs(0);
      setIsPaused(false);
      setPausedAt(null);
      setNotes('');
    } catch {
      setErrorMsg('خطأ في الاتصال بالخادم');
    } finally {
      setStarting(false);
    }
  }

  function openEditRecordedHizbModal(hizbNumber: number, res: HizbResult) {
    setChosenHizb(null);
    setErrorMsg(null);
    setEditingRecordedHizb({
      hizbNumber,
      sessionId: res.sessionId,
      errors: Math.max(0, Math.floor(Number(res.errors) || 0)),
      alerts: Math.max(0, Math.floor(Number(res.alerts) || 0))
    });
  }

  async function saveEditedRecordedHizb() {
    if (!selected || !editingRecordedHizb || savingRecordedEdit) return;
    setSavingRecordedEdit(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/sessions/${editingRecordedHizb.sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          errors: Math.max(0, Math.floor(Number(editingRecordedHizb.errors) || 0)),
          alerts: Math.max(0, Math.floor(Number(editingRecordedHizb.alerts) || 0)),
          deviceTag: getOrSetDeviceTag(),
          reciterName: reciterName.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'تعذر حفظ تعديل الحزب');
        setSavingRecordedEdit(false);
        return;
      }
      const updatedList = await loadStudents(liveCommitteeId);
      const refreshed = updatedList.find((s) => s.id === selected.id);
      if (refreshed) setSelected(refreshed);
      setEditingRecordedHizb(null);
    } catch {
      setErrorMsg('خطأ في الاتصال بالخادم أثناء تعديل الرصد');
    } finally {
      setSavingRecordedEdit(false);
    }
  }

  const end = useCallback(async () => {
    if (!active || savingEnd || savingCancel) return;
    setSavingEnd(true);
    setErrorMsg(null);

    const finishedSessionId = active.id;
    const finishedStudentId = active.studentId;
    const finishedStudentName = selected?.name || 'الطالب';
    const finishedHizb = active.hizbNumber;
    const trimmedNotes = notes.trim();

    try {
      const res = await fetch(`/api/sessions/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          errors: Math.max(0, Math.floor(errors)),
          alerts: Math.max(0, Math.floor(alerts)),
          durationSeconds: Math.max(0, Math.floor(seconds))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'تعذر حفظ الجلسة');
        setSavingEnd(false);
        return;
      }

      try {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        if (trimmedNotes) {
          const existingNotes = JSON.parse(localStorage.getItem(SESSION_NOTES_STORAGE_KEY) || '{}');
          existingNotes[String(finishedSessionId)] = trimmedNotes;
          localStorage.setItem(SESSION_NOTES_STORAGE_KEY, JSON.stringify(existingNotes));
        }
      } catch {}

      setSavedResult({
        text: `تم الحفظ. الدرجة: ${data.score} ${data.passed ? '(ناجح)' : '(راسب)'}`,
        score: data.score,
        passed: Boolean(data.passed),
        studentId: finishedStudentId,
        studentName: finishedStudentName,
        hizbNumber: finishedHizb,
        notes: trimmedNotes || undefined
      });
      setActive(null);
      setChosenHizb(null);
      setErrors(0);
      setAlerts(0);
      setActionHistory([]);
      setPausedMs(0);
      setIsPaused(false);
      setPausedAt(null);
      setNotes('');

      if (liveCommitteeId || !committeeIdRequired) {
        const refreshedList = await loadStudents(liveCommitteeId);
        const updatedStudent = refreshedList.find((s) => s.id === finishedStudentId);
        if (updatedStudent) setSelected(updatedStudent);
      }
    } catch {
      setErrorMsg('خطأ في الاتصال بالخادم أثناء الحفظ');
    } finally {
      setSavingEnd(false);
    }
  }, [active, savingEnd, savingCancel, selected, notes, errors, alerts, seconds, liveCommitteeId, committeeIdRequired, loadStudents]);

  async function confirmCancelSession() {
    if (!active || savingCancel || savingEnd) return;
    setSavingCancel(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/sessions/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          durationSeconds: Math.max(0, Math.floor(seconds))
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || 'تعذر إلغاء الجلسة');
        setSavingCancel(false);
        return;
      }
      try { localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY); } catch {}
      setActive(null);
      setErrors(0);
      setAlerts(0);
      setActionHistory([]);
      setPausedMs(0);
      setIsPaused(false);
      setPausedAt(null);
      setNotes('');
      setConfirmCancelOpen(false);
    } catch {
      setErrorMsg('خطأ في الاتصال بالخادم أثناء إلغاء الجلسة');
    } finally {
      setSavingCancel(false);
    }
  }

  // Keyboard shortcuts during an active session (when focus is not in an input/textarea/select)
  useEffect(() => {
    if (!active || confirmCancelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          // Still allow Ctrl+Enter / Cmd+Enter to finish even from notes input
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            end();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoLastAction();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        end();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        e.preventDefault();
        bumpCounter('err', +1);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        bumpCounter('alt', +1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, confirmCancelOpen, bumpCounter, undoLastAction, end]);

  // Escape key closes the cancel confirmation modal
  useEffect(() => {
    if (!confirmCancelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingCancel) {
        setConfirmCancelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmCancelOpen, savingCancel]);

  function isMyActiveSession(act?: Student['activeSession']) {
    if (!act) return false;
    const myTag = getOrSetDeviceTag();
    if (myTag && act.deviceTag && act.deviceTag === myTag) return true;
    if (!act.deviceTag && reciterName.trim() && act.reciterName === reciterName.trim()) return true;
    return false;
  }

  function handleSelectStudent(s: Student) {
    setSavedResult(null);
    if (s.attendanceStatus === 'absent') {
      setErrorMsg('لا يمكن تسميع طالب مسجل غائباً في التحضير');
      return;
    }
    if (s.activeSession) {
      if (isMyActiveSession(s.activeSession)) {
        setErrorMsg(null);
        setSelected(s);
        setChosenHizb(s.activeSession.hizbNumber);
        setActive({
          id: s.activeSession.id,
          startedAt: s.activeSession.startedAt,
          studentId: s.id,
          hizbNumber: s.activeSession.hizbNumber
        });
        return;
      }
      setErrorMsg(`الطالب (${s.name}) في جلسة تسميع جارية حالياً (الحزب ${s.activeSession.hizbNumber} مع المسمع: ${s.activeSession.reciterName}). لا يمكن فتح جلستين لنفس الطالب في نفس الوقت.`);
      return;
    }
      setErrorMsg(null);
      setSelected(s);
      setChosenHizb(null);
      setShowPicker(false);
  }

  function handleNextHizbSameStudent() {
    if (!savedResult) return;
    const st = students.find((s) => s.id === savedResult.studentId);
    setSavedResult(null);
    setErrorMsg(null);
    if (!st) return;
    if (st.attendanceStatus === 'absent') {
      setErrorMsg('لا يمكن تسميع طالب مسجل غائباً في التحضير');
      return;
    }
    setSelected(st);
    setChosenHizb(st.remaining.length > 0 ? st.remaining[0] : null);
    setTimeout(() => {
      hizbCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  function handleNextStudent() {
    if (!savedResult) return;
    const currentIdx = students.findIndex((s) => s.id === savedResult.studentId);
    setSavedResult(null);
    setErrorMsg(null);
    if (students.length === 0) return;

    const ordered = currentIdx >= 0
      ? [...students.slice(currentIdx + 1), ...students.slice(0, currentIdx)]
      : students;
    const nextCandidate =
      ordered.find((s) => s.attendanceStatus !== 'absent' && s.remaining.length > 0) ||
      ordered.find((s) => s.attendanceStatus !== 'absent');

    if (!nextCandidate) {
      setErrorMsg('لا يوجد طالب تالٍ متاح للتسميع في هذه اللجنة');
      return;
    }
    setSelected(nextCandidate);
    setChosenHizb(null);
    setTimeout(() => {
      hizbCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  const total = 100;
  const score = Math.max(0, total - errors * 2 - alerts * 1);
  const failing = score < 60;
  const scoreColor = score >= 70 ? 'var(--ok)' : score >= 60 ? 'var(--warn)' : 'var(--bad)';
  const scoreStatusText = score >= 70 ? 'ناجح' : score >= 60 ? 'ناجح (على الحافة)' : 'راسب';

  const timerPillClass = seconds >= 600 ? 'u-pill bad' : seconds >= 300 ? 'u-pill warn' : 'u-pill ok';
  const timerPillStyle: React.CSSProperties = seconds >= 600
    ? { fontSize: 16, padding: '8px 14px', background: '#fee2e2', color: '#7f1d1d', border: '1.5px solid #ef4444', fontWeight: 800 }
    : { fontSize: 16, padding: '8px 14px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {errorMsg && (
        <div className="u-note bad" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>⚠ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="u-btn u-btn-g sm"
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
          >
            إغلاق
          </button>
        </div>
      )}

      {savedResult && !active && (
        <div className="u-note ok" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>
              ✓ {savedResult.text} — {savedResult.studentName} (الحزب {savedResult.hizbNumber})
            </span>
            {savedResult.notes && (
              <span style={{ fontSize: 12, opacity: 0.9 }}>ملاحظة: {savedResult.notes}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={handleNextHizbSameStudent}
              className="u-btn u-btn-ok sm"
            >
              تسميع حزب تالٍ لنفس الطالب
            </button>
            <button
              type="button"
              onClick={handleNextStudent}
              className="u-btn u-btn-p sm"
            >
              الطالب التالي ←
            </button>
          </div>
        </div>
      )}

      {committeeIdRequired && !chosenCommittee && (
        <div className="u-card">
          <div className="u-card-h"><h3>١) اختر اللجنة</h3></div>
          <div className="u-field">
            <label>اللجنة</label>
            <select
              disabled={!!active}
              onChange={(e) => {
                if (active) return;
                setChosenCommittee(Number(e.target.value));
              }}
              className="u-input"
            >
              <option value="">—</option>
              {committeesForReciter.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="u-field" style={{ marginBottom: 0 }}>
            <label>اسمك كمسمع</label>
            <input value={reciterName} onChange={(e) => setReciterName(e.target.value)} placeholder="أبو عبدالله" className="u-input" />
          </div>
        </div>
      )}

      {!!liveCommitteeId && !active && (
        <>
          {selected && (() => {
            const assignedList = (Array.isArray(selected.assigned) && selected.assigned.length > 0
              ? selected.assigned
              : selected.remaining || []
            ).slice().sort((a, b) => a - b);
            const hizbResults = selected.hizbResults || {};
            const passedCount = assignedList.filter((h) => hizbResults[h]?.passed === true).length;
            const failedCount = assignedList.filter((h) => hizbResults[h] && hizbResults[h].passed === false).length;
            const gradedCount = passedCount + failedCount;
            const circleOrLevel = selected.circleName || selected.level || 'بدون حلقة';
            return (
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 14,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>
                    {selected.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginTop: 2 }}>
                    {circleOrLevel} · {assignedList.length} أحزاب · <span dir="ltr">{assignedList.length}/{gradedCount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker((v) => !v)}
                  style={{
                    background: '#07476e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '7px 13px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    flexShrink: 0,
                    minHeight: 34
                  }}
                >
                  {showPicker ? 'إخفاء القائمة' : 'تبديل الطالب'}
                </button>
              </div>
            );
          })()}

          {(!selected || showPicker) && (
          <div className="u-card">
            <div className="u-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
              <h3>١) اختر الطالب</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setAttendanceFilter('all')}
                  className={`u-chip ${attendanceFilter === 'all' ? 'on' : ''}`}
                  style={{ padding: '5px 10px', fontSize: 11.5 }}
                >
                  الكل ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceFilter('present')}
                  className={`u-chip ${attendanceFilter === 'present' ? 'on' : ''}`}
                  style={{ padding: '5px 10px', fontSize: 11.5 }}
                >
                  الحاضرون فقط ({students.filter((s) => s.attendanceStatus === 'present').length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceFilter('non_absent')}
                  className={`u-chip ${attendanceFilter === 'non_absent' ? 'on' : ''}`}
                  style={{ padding: '5px 10px', fontSize: 11.5 }}
                >
                  غير الغائبين ({students.filter((s) => s.attendanceStatus !== 'absent').length})
                </button>
              </div>
            </div>

            <div className="u-search">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث عن طالب..." />
            </div>

            {filtered.length === 0 ? (
              <div className="u-empty">لا يوجد طلاب مطابقين للبحث أو الفلتر</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                {filtered.map((s) => {
                  const on = selected?.id === s.id;
                  const att = s.attendanceStatus ?? 'unset';
                  const isAbsent = att === 'absent';
                  const inOtherSession = Boolean(s.activeSession && !isMyActiveSession(s.activeSession));
                  const inMySession = Boolean(s.activeSession && isMyActiveSession(s.activeSession));
                  const blocked = isAbsent || inOtherSession;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStudent(s)}
                      aria-disabled={blocked}
                      className="u-btn"
                      style={{
                        height: 'auto',
                        padding: '12px 14px',
                        justifyContent: 'flex-start',
                        textAlign: 'start',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 6,
                        opacity: blocked ? 0.65 : 1,
                        cursor: blocked ? 'not-allowed' : 'pointer',
                        background: on ? 'var(--brand-soft)' : 'var(--card2)',
                        color: on ? 'var(--brand-ink)' : 'var(--ink)',
                        border: on ? '2px solid var(--brand)' : blocked ? '1.5px dashed var(--bad)' : inMySession ? '2px solid var(--warn)' : '2px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                        {att === 'present' && (
                          <span className="u-pill ok" style={{ fontSize: 10.5, padding: '2px 8px', flexShrink: 0 }}>حاضر</span>
                        )}
                        {att === 'unset' && (
                          <span className="u-pill mute" style={{ fontSize: 10.5, padding: '2px 8px', flexShrink: 0 }}>غير محدد</span>
                        )}
                        {att === 'absent' && (
                          <span className="u-pill bad" style={{ fontSize: 10.5, padding: '2px 8px', flexShrink: 0 }}>غائب</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
                        {s.circleName || s.level || '—'} · متبقي: {s.remaining.length}
                      </span>
                      {s.activeSession && (
                        <span
                          className={`u-pill ${inMySession ? 'warn' : 'bad'}`}
                          style={{ fontSize: 10.5, padding: '3px 8px', alignSelf: 'flex-start' }}
                        >
                          {inMySession
                            ? `▶ استئناف جلستك (حزب ${s.activeSession.hizbNumber})`
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--bad)' }} />
                                يسمّع الآن: حزب {s.activeSession.hizbNumber} ({s.activeSession.reciterName})
                              </span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {selected && (() => {
            const assignedList = (Array.isArray(selected.assigned) && selected.assigned.length > 0
              ? selected.assigned
              : selected.remaining || []
            ).slice().sort((a, b) => a - b);
            const hizbResults = selected.hizbResults || {};
            const passedCount = assignedList.filter((h) => hizbResults[h]?.passed === true).length;
            const failedCount = assignedList.filter((h) => hizbResults[h] && hizbResults[h].passed === false).length;
            const gradedCount = passedCount + failedCount;
            const totalPossible = assignedList.length * 100;
            const earnedSum = assignedList.reduce((acc, h) => acc + (hizbResults[h]?.score ?? 0), 0);
            const rawPct = totalPossible > 0 ? Math.round((earnedSum / totalPossible) * 1000) / 10 : 0;
            const pctText = rawPct % 1 === 0 ? rawPct.toFixed(0) : rawPct.toFixed(1);
            const pctColor = rawPct >= 70 ? '#15803d' : rawPct >= 60 ? '#d97706' : '#b91c1c';
            const circleOrLevel = selected.circleName || selected.level || 'بدون حلقة';

            return (
              <div
                ref={hizbCardRef}
                style={{
                  borderRadius: 18,
                  border: '1.5px solid #cbd5e1',
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)'
                }}
              >
                {/* Top Summary Banner */}
                <div
                  style={{
                    background: 'linear-gradient(180deg, #e4eff8 0%, #f4f9fd 65%, #ffffff 100%)',
                    borderInlineStart: '4px solid #60a5fa',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#07476e', marginBottom: 2 }}>
                      {circleOrLevel}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                      {selected.name}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b', marginTop: 3 }}>
                      {assignedList.length} أحزاب · <span dir="ltr">{assignedList.length}/{gradedCount}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span
                        style={{
                          background: '#d1fae5',
                          color: '#15803d',
                          borderRadius: 999,
                          padding: '2px 10px',
                          fontSize: 11.5,
                          fontWeight: 800,
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ناجح {passedCount}
                      </span>
                      <span
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          borderRadius: 999,
                          padding: '2px 10px',
                          fontSize: 11.5,
                          fontWeight: 800,
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        راسب {failedCount}
                      </span>
                    </div>

                    <div
                      dir="ltr"
                      style={{
                        fontSize: 26,
                        fontWeight: 900,
                        color: pctColor,
                        lineHeight: 1,
                        letterSpacing: '-0.5px'
                      }}
                    >
                      {pctText}%
                    </div>
                  </div>
                </div>

                {/* Dark Navy Section Bar */}
                <div
                  style={{
                    background: '#063954',
                    color: '#ffffff',
                    padding: '9px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 800 }}>الأحزاب المحددة</span>
                </div>

                {/* Hizb Cards Grid */}
                <div style={{ padding: '12px 14px', background: '#ffffff' }}>
                  {!defaultReciterName && (
                    <div className="u-field" style={{ marginBottom: 12 }}>
                      <label>اسمك كمسمع</label>
                      <input
                        value={reciterName}
                        onChange={(e) => setReciterName(e.target.value)}
                        placeholder="أبو عبدالله"
                        className="u-input"
                      />
                    </div>
                  )}

                  {selected.attendanceStatus === 'absent' ? (
                    <div className="u-note bad" style={{ marginBottom: 0 }}>
                      لا يمكن تسميع طالب مسجل غائباً في التحضير
                    </div>
                  ) : assignedList.length === 0 ? (
                    <div className="u-empty">
                      لم تُحدد أحزاب لهذا الطالب بعد من قِبل المدير أو معلم الحلقة.
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(94px, 1fr))',
                          gap: 8
                        }}
                      >
                        {assignedList.map((n) => {
                          const res = hizbResults[n];
                          const isPassed = Boolean(res && res.passed);
                          const isFailed = Boolean(res && !res.passed);
                          const isChosen = chosenHizb === n;
                          const errLabel = res
                            ? `${res.errors}خ${res.alerts > 0 ? ` · ${res.alerts}ت` : ''}`
                            : 'رصد';

                          if (isPassed && res) {
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => openEditRecordedHizbModal(n, res)}
                                title="اضغط لتعديل رصد هذا الحزب"
                                style={{
                                  background: '#e6f4ea',
                                  border: '1.5px solid #a7f3d0',
                                  borderRadius: 11,
                                  padding: '8px 10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  minHeight: 72,
                                  cursor: 'pointer',
                                  textAlign: 'start'
                                }}
                              >
                                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b' }}>
                                  الحزب {n}
                                </span>
                                <span
                                  className="u-num"
                                  style={{
                                    fontSize: 20,
                                    fontWeight: 900,
                                    color: '#15803d',
                                    lineHeight: 1.15,
                                    margin: '2px 0'
                                  }}
                                >
                                  {res.score}
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                                  {errLabel}
                                </span>
                              </button>
                            );
                          }

                          if (isFailed && res) {
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => openEditRecordedHizbModal(n, res)}
                                title="اضغط لتعديل رصد هذا الحزب"
                                style={{
                                  background: '#fdecec',
                                  border: '1.5px solid #f5c2c7',
                                  borderRadius: 11,
                                  padding: '8px 10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  minHeight: 72,
                                  cursor: 'pointer',
                                  textAlign: 'start'
                                }}
                              >
                                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b' }}>
                                  الحزب {n}
                                </span>
                                <span
                                  className="u-num"
                                  style={{
                                    fontSize: 20,
                                    fontWeight: 900,
                                    color: '#b91c1c',
                                    lineHeight: 1.15,
                                    margin: '2px 0'
                                  }}
                                >
                                  {res.score}
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                                  {errLabel}
                                </span>
                              </button>
                            );
                          }

                          return (
                            <button
                              key={n}
                              type="button"
                              disabled={starting}
                              onClick={() => {
                                setChosenHizb(n);
                                setErrorMsg(null);
                              }}
                              style={{
                                background: isChosen ? '#e0f2fe' : '#f8fafc',
                                border: isChosen ? '2px solid #07476e' : '1.5px dashed #cbd5e1',
                                boxShadow: isChosen ? '0 0 0 2px rgba(7, 71, 110, 0.14)' : 'none',
                                borderRadius: 11,
                                padding: '8px 10px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                minHeight: 72,
                                cursor: 'pointer',
                                textAlign: 'start'
                              }}
                            >
                              <span style={{ fontSize: 12.5, fontWeight: 800, color: isChosen ? '#07476e' : '#334155' }}>
                                الحزب {n}
                              </span>
                              <span
                                style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: isChosen ? '#07476e' : '#64748b',
                                  lineHeight: 1.15,
                                  margin: '2px 0'
                                }}
                              >
                                —
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: isChosen ? '#07476e' : '#64748b' }}>
                                {isChosen ? 'محدّد ✓' : 'رصد'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {chosenHizb && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                          <button
                            type="button"
                            onClick={() => start(chosenHizb)}
                            disabled={!chosenHizb || !reciterName.trim() || starting}
                            className="u-btn u-btn-p lg w"
                          >
                            <span>{starting ? 'جاري البدء...' : `بدء التسميع — الحزب ${chosenHizb}`}</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {editingRecordedHizb && selected && (() => {
            const previewScore = Math.max(0, 100 - editingRecordedHizb.errors * 2 - editingRecordedHizb.alerts * 1);
            const previewPassed = previewScore >= 60;
            return (
              <div
                onClick={(e) => {
                  if (e.target === e.currentTarget && !savingRecordedEdit) setEditingRecordedHizb(null);
                }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 75,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 16,
                  background: 'var(--overlay)'
                }}
              >
                <div
                  className="u-card"
                  role="dialog"
                  aria-modal="true"
                  style={{ margin: 0, width: '100%', maxWidth: 440 }}
                >
                  <div className="u-card-h" style={{ marginBottom: 12 }}>
                    <h3>تعديل رصد الحزب {editingRecordedHizb.hizbNumber} — {selected.name}</h3>
                    <button
                      type="button"
                      onClick={() => setEditingRecordedHizb(null)}
                      disabled={savingRecordedEdit}
                      className="u-icon-btn"
                      aria-label="إغلاق"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div
                    style={{
                      background: previewPassed ? '#e6f4ea' : '#fdecec',
                      border: `1.5px solid ${previewPassed ? '#a7f3d0' : '#f5c2c7'}`,
                      borderRadius: 14,
                      padding: '12px 16px',
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b' }}>الدرجة بعد التعديل</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: previewPassed ? '#15803d' : '#b91c1c' }}>
                        {previewPassed ? 'ناجح' : 'راسب'}
                      </div>
                    </div>
                    <div
                      className="u-num"
                      style={{
                        fontSize: 32,
                        fontWeight: 900,
                        color: previewPassed ? '#15803d' : '#b91c1c'
                      }}
                    >
                      {previewScore}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div className="u-field" style={{ marginBottom: 0 }}>
                      <label htmlFor="edit-hizb-errors">عدد الأخطاء (−2)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setEditingRecordedHizb((prev) => prev ? { ...prev, errors: prev.errors + 1 } : prev)}
                          className="u-btn u-btn-g"
                          style={{ width: 42, minWidth: 42, height: 42, padding: 0, fontSize: 20, fontWeight: 800 }}
                        >
                          +
                        </button>
                        <input
                          id="edit-hizb-errors"
                          type="number"
                          min={0}
                          value={editingRecordedHizb.errors}
                          onChange={(e) => {
                            const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            setEditingRecordedHizb((prev) => prev ? { ...prev, errors: val } : prev);
                          }}
                          className="u-input"
                          style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}
                        />
                        <button
                          type="button"
                          disabled={editingRecordedHizb.errors <= 0}
                          onClick={() => setEditingRecordedHizb((prev) => prev ? { ...prev, errors: Math.max(0, prev.errors - 1) } : prev)}
                          className="u-btn u-btn-g"
                          style={{ width: 42, minWidth: 42, height: 42, padding: 0, fontSize: 20, fontWeight: 800 }}
                        >
                          −
                        </button>
                      </div>
                    </div>

                    <div className="u-field" style={{ marginBottom: 0 }}>
                      <label htmlFor="edit-hizb-alerts">عدد التنبيهات (−1)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setEditingRecordedHizb((prev) => prev ? { ...prev, alerts: prev.alerts + 1 } : prev)}
                          className="u-btn u-btn-g"
                          style={{ width: 42, minWidth: 42, height: 42, padding: 0, fontSize: 20, fontWeight: 800 }}
                        >
                          +
                        </button>
                        <input
                          id="edit-hizb-alerts"
                          type="number"
                          min={0}
                          value={editingRecordedHizb.alerts}
                          onChange={(e) => {
                            const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            setEditingRecordedHizb((prev) => prev ? { ...prev, alerts: val } : prev);
                          }}
                          className="u-input"
                          style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}
                        />
                        <button
                          type="button"
                          disabled={editingRecordedHizb.alerts <= 0}
                          onClick={() => setEditingRecordedHizb((prev) => prev ? { ...prev, alerts: Math.max(0, prev.alerts - 1) } : prev)}
                          className="u-btn u-btn-g"
                          style={{ width: 42, minWidth: 42, height: 42, padding: 0, fontSize: 20, fontWeight: 800 }}
                        >
                          −
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setEditingRecordedHizb(null)}
                      disabled={savingRecordedEdit}
                      className="u-btn u-btn-g"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={saveEditedRecordedHizb}
                      disabled={savingRecordedEdit}
                      className="u-btn u-btn-p"
                    >
                      {savingRecordedEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {active && selected && (
        <>
          <div
            className="u-card"
            style={{
              transition: 'background-color 0.25s, border-color 0.25s',
              background: errorFlash ? '#fee2e2' : undefined,
              borderColor: errorFlash ? '#ef4444' : undefined
            }}
          >
            <div className="u-row u-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div className="u-name" style={{ fontSize: 18 }}>{selected.name}</div>
                <div className="u-muted">الحزب {active.hizbNumber}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={togglePause}
                  className={`u-btn sm ${isPaused ? 'u-btn-p' : 'u-btn-g'}`}
                  style={{ height: 36, padding: '0 12px', fontSize: 12.5 }}
                >
                  {isPaused ? '▶ استئناف' : '⏸ إيقاف مؤقت'}
                </button>
                <span className={timerPillClass} style={timerPillStyle}>
                  <span className="u-num">
                    {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
                  </span>
                  {isPaused && <span style={{ fontSize: 11, marginInlineStart: 4 }}>(متوقف)</span>}
                </span>
              </div>
            </div>

            <div className="th-rec-hizb-lbl">الحزب {active.hizbNumber}</div>
            <div
              className={`th-rec-score-big ${pulse ? 'pulse' : ''}`}
              style={{ color: scoreColor }}
            >
              {score}
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: scoreColor, marginTop: 4 }}>
              {scoreStatusText}
            </div>
            <div className="u-muted" style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, marginTop: 6 }}>
              المعادلة: 100 − (2 × خطأ) − (1 × تنبيه) · درجة الاجتياز: 60
            </div>
          </div>

          <div className="u-card">
            <div className="u-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
              <h3>٤) الأخطاء والتنبيهات</h3>
              <button
                type="button"
                onClick={undoLastAction}
                disabled={actionHistory.length === 0 || savingEnd || savingCancel}
                className="u-btn u-btn-g sm"
                style={{ height: 34, padding: '0 12px', fontSize: 12.5 }}
              >
                ↩ تراجع {actionHistory.length > 0 ? `(${actionHistory[actionHistory.length - 1] === 'err' ? 'خطأ' : 'تنبيه'})` : ''}
              </button>
            </div>

            <div className="th-rec-counters">
              <ThCounter
                kind="mistake"
                label="الأخطاء"
                value={errors}
                onDec={() => bumpCounter('err', -1)}
                onInc={() => bumpCounter('err', +1)}
                deduct="−2 لكل خطأ"
              />
              <ThCounter
                kind="warning"
                label="التنبيهات"
                value={alerts}
                onDec={() => bumpCounter('alt', -1)}
                onInc={() => bumpCounter('alt', +1)}
                deduct="−1 لكل تنبيه"
              />
            </div>

            <div className="u-muted" style={{ marginTop: 10, fontSize: 11.5, textAlign: 'center' }}>
              اختصارات لوحة المفاتيح: <kbd>Space</kbd> أو <kbd>E</kbd> = +1 خطأ · <kbd>A</kbd> = +1 تنبيه · <kbd>Ctrl+Z</kbd> = تراجع · <kbd>Ctrl+Enter</kbd> = إنهاء وحفظ
            </div>

            <div className="u-row" style={{ gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={end}
                disabled={savingEnd || savingCancel}
                className="u-btn u-btn-ok lg"
                style={{ flex: 1 }}
              >
                {savingEnd ? 'جاري الحفظ...' : 'إنهاء وحفظ'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={savingEnd || savingCancel}
                className="u-btn u-btn-bad lg"
              >
                {savingCancel ? 'جاري الحفظ...' : 'إلغاء الجلسة'}
              </button>
            </div>
          </div>
        </>
      )}

      {confirmCancelOpen && active && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingCancel) setConfirmCancelOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            background: 'var(--overlay)'
          }}
        >
          <div
            className="u-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-session-title"
            style={{ margin: 0, width: '100%', maxWidth: 400 }}
          >
            <div className="u-card-h" style={{ marginBottom: 8 }}>
              <h3 id="cancel-session-title">تأكيد إلغاء الجلسة</h3>
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                disabled={savingCancel}
                className="u-icon-btn"
                aria-label="إغلاق"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 16 }}>
              هل أنت متأكد من إلغاء جلسة التسميع الحالية للطالب <b>{selected?.name}</b> (الحزب <b>{active.hizbNumber}</b>)؟ لن يتم حفظ أو احتساب الدرجة.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                disabled={savingCancel}
                className="u-btn u-btn-g"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmCancelSession}
                disabled={savingCancel}
                className="u-btn u-btn-bad"
              >
                {savingCancel ? 'جاري الحفظ...' : 'نعم، إلغاء الجلسة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThCounter({ kind, label, value, onDec, onInc, deduct }: {
  kind: 'mistake' | 'warning';
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  deduct: string;
}) {
  return (
    <div
      className={`th-cnt ${kind}`}
      onClick={onInc}
      style={{
        position: 'relative',
        padding: '10px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 108
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onInc(); }}
          aria-label={`إضافة ${label}`}
          className="shrink-0"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.45)',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer'
          }}
        >
          +
        </button>

        <span className="th-cnt-num" style={{ flex: 1, textAlign: 'center' }}>{value}</span>

        <button
          type="button"
          disabled={value <= 0}
          onClick={(e) => {
            e.stopPropagation();
            if (value > 0) onDec();
          }}
          aria-label={`إنقاص ${label}`}
          className="shrink-0"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.28)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
            fontSize: 18,
            lineHeight: 1,
            cursor: value <= 0 ? 'not-allowed' : 'pointer',
            opacity: value <= 0 ? 0.38 : 1
          }}
        >
          −
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 2 }}>
        <div className="th-cnt-label">{label}</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.82 }}>{deduct}</div>
      </div>
    </div>
  );
}

function getOrSetDeviceTag(): string {
  try {
    let t = localStorage.getItem('sard_device_tag');
    if (!t) {
      t = 'dev_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('sard_device_tag', t);
    }
    return t;
  } catch { return 'dev_anon'; }
}
