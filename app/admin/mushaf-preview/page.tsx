'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { pagesForHizb } from '@/lib/hizbPages';

type Segment = {
  surah: number;
  ayah: number;
  codes: string[];
  endMarker: boolean;
  endCode: string;
};
type Line = { lineNumber: number; segments: Segment[] };
type Page = {
  pageNumber: number;
  primarySurah: { number: number; name: string };
  surahsOnPage: { number: number; name: string }[];
  startsWithBismillah: { surahNumber: number; surahName: string } | null;
  banners: { afterLine: number; surahNumber: number; surahName: string }[];
  lines: Line[];
};

type MarkType = 'error' | 'alert';
type Mark = { id: string; surah: number; ayah: number; type: MarkType };
type PreviewStudent = {
  id: number;
  name: string;
  level: string | null;
  circleName: string | null;
  assigned: number[];
  remaining: number[];
  attendanceStatus: 'present' | 'absent' | 'unset';
};

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

const loadedFonts = new Set<number>();
function ensurePageFont(pageNum: number): Promise<void> {
  const padded = String(pageNum).padStart(3, '0');
  if (!loadedFonts.has(pageNum)) {
    loadedFonts.add(pageNum);
    const style = document.createElement('style');
    style.setAttribute('data-qcf-page', String(pageNum));
    style.textContent = `
      @font-face {
        font-family: "QCF_P${padded}";
        src: url("/fonts/qcf/QCF_P${padded}.woff2") format("woff2");
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }
  return document.fonts.load(`40px "QCF_P${padded}"`).then(() => {});
}

const pageCache = new Map<number, Page>();
async function fetchPage(pageNum: number): Promise<Page> {
  if (pageCache.has(pageNum)) return pageCache.get(pageNum)!;
  const r = await fetch(`/data/mushaf/page-${pageNum}.json`);
  if (!r.ok) throw new Error(`page ${pageNum} not found`);
  const data: Page = await r.json();
  pageCache.set(pageNum, data);
  return data;
}

export default function MushafPreviewPage() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const isReciterPreview = pathname.startsWith('/reciter/');
  const [hizb, setHizb] = useState(1);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [sheetFor, setSheetFor] = useState<{ surah: number; ayah: number } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [fitReady, setFitReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [previewStudents, setPreviewStudents] = useState<PreviewStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [setupMissing, setSetupMissing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(!isReciterPreview);
  const mushafTextRef = useRef<HTMLDivElement | null>(null);
  const mushafCardRef = useRef<HTMLDivElement | null>(null);
  const swipeRef = useRef({ startX: 0, startY: 0, moved: false });
  const suppressAyahTapUntilRef = useRef(0);

  // Load Amiri font once
  useEffect(() => {
    if (document.getElementById('amiri-font')) return;
    const link = document.createElement('link');
    link.id = 'amiri-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@700&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (!isReciterPreview) return;
    let cancelled = false;
    let committeeId = 0;
    try {
      const setup = JSON.parse(localStorage.getItem('sard_reciter_setup') || '{}');
      committeeId = Math.max(0, Math.floor(Number(setup.committeeId) || 0));
    } catch {}

    if (!committeeId) {
      setSetupMissing(true);
      setStudentsLoading(false);
      return;
    }

    setSetupMissing(false);
    setStudentsLoading(true);
    setStudentsError(null);
    fetch(`/api/students/for-record?committeeId=${committeeId}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'تعذر تحميل الطلاب');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const rows = (data.students || []) as PreviewStudent[];
        setPreviewStudents(rows);
        const first = rows.find((student) => student.assigned.length > 0) || rows[0];
        if (first) {
          setSelectedStudentId(first.id);
          if (first.assigned.length > 0) setHizb(first.remaining[0] || first.assigned[0]);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setStudentsError(loadError?.message || 'تعذر تحميل الطلاب');
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false);
      });

    return () => { cancelled = true; };
  }, [isReciterPreview]);

  // Fetch pages + fonts for selected hizb
  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    setPageIndex(0);
    setFitReady(false);

    const pageNums = pagesForHizb(hizb);
    if (pageNums.length === 0) {
      setError('حزب غير صحيح');
      setLoading(false);
      return;
    }

    // Load first page's font + data in priority, then rest in background
    (async () => {
      try {
        // Load first page quickly
        const firstPage = pageNums[0];
        await Promise.all([fetchPage(firstPage), ensurePageFont(firstPage)]);
        if (abort) return;

        // Set the first page immediately so the user sees content ASAP
        const first = await fetchPage(firstPage);
        setPages([first]);
        setLoading(false);

        // Load the rest in parallel in background
        const rest = await Promise.all(
          pageNums.slice(1).map(async (p) => {
            await ensurePageFont(p);
            return fetchPage(p);
          })
        );
        if (abort) return;
        setPages([first, ...rest]);
      } catch (e: any) {
        if (!abort) {
          setError('تعذّر تحميل الحزب');
          setLoading(false);
        }
      }
    })();

    return () => { abort = true; };
  }, [hizb]);

  const page = pages[pageIndex] || null;

  // Preload adjacent page fonts for smooth navigation
  useEffect(() => {
    if (!page || pages.length === 0) return;
    const next = pages[pageIndex + 1];
    const prev = pages[pageIndex - 1];
    if (next) ensurePageFont(next.pageNumber);
    if (prev) ensurePageFont(prev.pageNumber);
  }, [page, pageIndex, pages]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  // Fast fit: measure ONCE at large font, calc exact scale, apply once.
  useEffect(() => {
    if (!page) return;
    const el = mushafTextRef.current;
    if (!el) return;

    let cancelled = false;
    setFitReady(false);

    const run = async () => {
      const famStr = `"QCF_P${String(page.pageNumber).padStart(3, '0')}"`;
      try { await document.fonts.load(`80px ${famStr}`); } catch {}
      if (cancelled) return;

      const lines = Array.from(el.querySelectorAll<HTMLElement>('.msline'));
      if (lines.length === 0) { setFitReady(true); return; }
      const containerW = el.clientWidth - 28;
      if (containerW < 60) { setFitReady(true); return; }

      const BASE = 80;
      lines.forEach((l) => {
        l.style.whiteSpace = 'nowrap';
        l.style.textAlign = 'center';
        l.style.textAlignLast = 'center';
      });
      el.style.fontSize = `${BASE}px`;
      // Force a reflow and then measure
      void el.offsetWidth;

      let maxW = 0;
      for (const l of lines) if (l.scrollWidth > maxW) maxW = l.scrollWidth;
      if (maxW <= 0) { setFitReady(true); return; }

      const target = Math.max(12, Math.floor(BASE * (containerW / maxW)));
      el.style.fontSize = `${target}px`;
      void el.offsetWidth;

      // Switch to justify for lines that nearly fill, center for short ones
      lines.forEach((l) => {
        l.style.whiteSpace = '';
        const natural = l.scrollWidth;
        if (natural > containerW * 0.55) {
          l.style.textAlign = 'justify';
          l.style.textAlignLast = 'justify';
        } else {
          l.style.textAlign = 'center';
          l.style.textAlignLast = 'center';
        }
      });
      setFitReady(true);
    };

    const r = requestAnimationFrame(run);
    const onResize = () => { setFitReady(false); run(); };
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 120);
    };
    window.addEventListener('resize', debouncedResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(r);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
    };
  }, [page]);

  const errorCount = marks.filter((m) => m.type === 'error').length;
  const alertCount = marks.filter((m) => m.type === 'alert').length;
  const selectedStudent = previewStudents.find((student) => student.id === selectedStudentId) || null;
  const availableHizbs = selectedStudent?.assigned || [];
  const previewReady = !isReciterPreview || Boolean(selectedStudent && availableHizbs.length > 0);

  const marksFor = (s: number, a: number) =>
    marks.filter((m) => m.surah === s && m.ayah === a);

  const addMark = (type: MarkType) => {
    if (!sheetFor) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMarks((p) => [...p, { id, surah: sheetFor.surah, ayah: sheetFor.ayah, type }]);
    setSheetFor(null);
  };
  const removeLastMarkOfType = (type: MarkType) => {
    if (!sheetFor) return;
    setMarks((current) => {
      let removeIndex = -1;
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const mark = current[index];
        if (mark.surah === sheetFor.surah && mark.ayah === sheetFor.ayah && mark.type === type) {
          removeIndex = index;
          break;
        }
      }
      return removeIndex === -1
        ? current
        : current.filter((_, index) => index !== removeIndex);
    });
    setSheetFor(null);
  };
  const clearAyahMarks = () => {
    if (!sheetFor) return;
    setMarks((p) => p.filter((m) => !(m.surah === sheetFor.surah && m.ayah === sheetFor.ayah)));
    setSheetFor(null);
  };
  const resetAll = () => {
    if (marks.length === 0) return;
    if (!confirm('مسح جميع العلامات المسجّلة لهذه الجلسة التجريبية؟')) return;
    setMarks([]);
  };

  const changeHizb = (nextHizb: number) => {
    setHizb(nextHizb);
    setSessionStarted(!isReciterPreview);
    setMarks([]);
    setSheetFor(null);
    setElapsedSeconds(0);
    setTimerRunning(false);
  };

  const changePreviewStudent = (studentId: number) => {
    setSelectedStudentId(studentId);
    setSessionStarted(false);
    const student = previewStudents.find((row) => row.id === studentId);
    const nextHizb = student?.remaining[0] || student?.assigned[0];
    if (nextHizb) changeHizb(nextHizb);
    else {
      setMarks([]);
      setSheetFor(null);
      setElapsedSeconds(0);
      setTimerRunning(false);
    }
  };

  const startPreviewSession = () => {
    if (!previewReady || loading || error) return;
    setMarks([]);
    setSheetFor(null);
    setPageIndex(0);
    setElapsedSeconds(0);
    setSessionStarted(true);
    setTimerRunning(true);
    window.setTimeout(() => mushafCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const returnToPreviewSetup = () => {
    if (marks.length > 0 && !confirm('العودة لاختيار الطالب؟ ستُمسح علامات التجربة الحالية.')) return;
    setSessionStarted(false);
    setTimerRunning(false);
    setElapsedSeconds(0);
    setMarks([]);
    setSheetFor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formattedTime = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pages.length - 1;
  const showMushaf = previewReady && (!isReciterPreview || sessionStarted);

  const changePage = (direction: 'next' | 'previous') => {
    setSheetFor(null);
    setPageIndex((current) => {
      if (direction === 'next') return Math.min(pages.length - 1, current + 1);
      return Math.max(0, current - 1);
    });
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, moved: false };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - swipeRef.current.startX;
    const deltaY = touch.clientY - swipeRef.current.startY;
    if (Math.abs(deltaX) > 14 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      swipeRef.current.moved = true;
      suppressAyahTapUntilRef.current = Date.now() + 450;
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const { startX, startY, moved } = swipeRef.current;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (!moved || Math.abs(deltaX) < 58 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

    suppressAyahTapUntilRef.current = Date.now() + 450;
    // اتجاه المصحف عربي: السحب يميناً يتقدم، والسحب يساراً يرجع للصفحة السابقة.
    if (deltaX > 0 && canNext) changePage('next');
    if (deltaX < 0 && canPrev) changePage('previous');
  };

  const linesWithBanners = useMemo(() => {
    if (!page) return [] as { kind: 'line' | 'banner'; data: any }[];
    const out: { kind: 'line' | 'banner'; data: any }[] = [];
    for (const line of page.lines) {
      const bannerBefore = page.banners.find((b) => b.afterLine === line.lineNumber - 1);
      if (bannerBefore) out.push({ kind: 'banner', data: bannerBefore });
      out.push({ kind: 'line', data: line });
    }
    return out;
  }, [page]);

  const sheetMeta = sheetFor
    ? { surahName: page?.surahsOnPage.find((s) => s.number === sheetFor.surah)?.name || `سورة ${sheetFor.surah}` }
    : null;
  const activeAyahMarks = sheetFor ? marksFor(sheetFor.surah, sheetFor.ayah) : [];
  const activeErrorMarks = activeAyahMarks.filter((mark) => mark.type === 'error').length;
  const activeAlertMarks = activeAyahMarks.filter((mark) => mark.type === 'alert').length;

  const pageFontFamily = page
    ? `"QCF_P${String(page.pageNumber).padStart(3, '0')}", 'Amiri Quran', 'Amiri', serif`
    : 'serif';

  return (
    <div className="u-page" style={{ paddingBottom: 40 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mushaf-card {
          --mus-paper: #FBF6E9;
          --mus-ink: #1E2A22;
          --mus-gold: #A6832B;
          --mus-line: #E0D2A9;
          --mus-band: #0E4437;
          --mus-band-ink: #F3E7C6;
          background: var(--mus-paper);
          color: var(--mus-ink);
          border: 1px solid var(--mus-gold);
          border-radius: 13px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 3px rgba(15,27,45,.08), 0 0 0 1px rgba(166,131,43,.1);
        }
        html.dark .mushaf-card {
          --mus-paper: #10201B;
          --mus-ink: #E8E2CE;
          --mus-gold: #C9A44C;
          --mus-line: #2C4438;
          --mus-band: #0A2C24;
          --mus-band-ink: #E8D9AC;
        }
        .mus-band {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: var(--mus-band);
          color: var(--mus-band-ink);
          padding: 8px 134px 8px 108px;
          min-height: 58px;
          border-bottom: 2px solid var(--mus-gold);
        }
        .mus-band .mus-orn { color: var(--mus-gold); font-size: 14px; line-height: 1; opacity: .9; }
        .mus-band .mus-sura { font-family: 'IBM Plex Sans Arabic', serif; font-size: 17px; font-weight: 700; }
        .mus-band-center { display: flex; flex-direction: column; align-items: center; min-width: 0; }
        .mus-band-title { display: flex; align-items: center; justify-content: center; gap: 9px; white-space: nowrap; }
        .mus-band-counts {
          position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
          display: flex; align-items: center; justify-content: center; gap: 4px;
        }
        .mus-band-count {
          display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 99px;
          font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 10px; font-weight: 800;
          font-variant-numeric: tabular-nums; border: 1px solid rgba(255,255,255,.12);
        }
        .mus-band-count.error { color: #FFD8D5; background: rgba(176,48,56,.3); }
        .mus-band-count.alert { color: #FFE6B2; background: rgba(183,121,31,.3); }
        .mus-band-timer {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          direction: ltr; display: flex; align-items: center; gap: 4px; padding: 4px;
          border-radius: 12px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.16);
          font-family: 'IBM Plex Sans Arabic', sans-serif;
        }
        .mus-band-timer time { min-width: 48px; text-align: center; color: var(--mus-band-ink); font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: .03em; }
        .mus-band-timer button {
          width: 30px; height: 30px; min-width: 30px; min-height: 30px; display: grid; place-items: center;
          border: 0; border-radius: 9px; cursor: pointer; background: rgba(255,255,255,.12); color: var(--mus-band-ink);
        }
        .mus-band-timer button.primary { background: var(--mus-gold); color: #fff; }
        .mus-band-timer button:disabled { opacity: .35; cursor: not-allowed; }
        .mus-band-timer svg { width: 15px; height: 15px; }
        .mus-band-timer.running { box-shadow: 0 0 0 2px rgba(176,48,56,.28); }

        .mus-text {
          margin: 0;
          padding: 18px 14px;
          color: var(--mus-ink);
          direction: rtl;
          font-size: 40px;
          line-height: 2.0;
          text-align: center;
          transition: opacity .15s ease;
        }
        .mus-text.fitting { opacity: 0; }
        .mus-text.ready { opacity: 1; }
        .mus-text .msline,
        .mus-text .msline * {
          font-family: inherit !important;
        }
        .mus-text .mus-sep {
          font-family: 'Amiri', 'IBM Plex Sans Arabic', serif !important;
        }
        .mus-text .mus-bism {
          font-family: 'Amiri Quran', 'Amiri', serif !important;
          font-size: 0.78em;
          text-align: center;
          padding: 2px 0 6px;
          color: var(--mus-ink);
          line-height: 1.5;
          letter-spacing: .02em;
        }

        .msline {
          text-align: justify;
          text-align-last: justify;
          padding: 0;
          min-height: 1.6em;
          display: block;
          word-spacing: 0;
        }
        .msline.loose { text-align: center; text-align-last: center; }

        .ms-seg {
          cursor: pointer;
          padding: 0 1px;
          border-radius: 4px;
          transition: background-color .12s ease;
          -webkit-tap-highlight-color: transparent;
          display: inline;
        }
        .ms-seg:active { background: rgba(166,131,43,.14); }
        .ms-seg.m-error { background: rgba(192,68,60,.16); box-shadow: inset 0 -2px 0 var(--bad); }
        .ms-seg.m-alert { background: rgba(183,121,31,.2); box-shadow: inset 0 -2px 0 var(--warn); }
        .ms-seg.m-both {
          background: linear-gradient(to left, rgba(183,121,31,.2), rgba(192,68,60,.16));
          box-shadow: inset 0 -2px 0 var(--bad);
        }

        .mus-sep {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: .5em 0 .35em;
          font-size: 15px;
          font-weight: 700;
          color: var(--mus-gold);
          white-space: nowrap;
          justify-content: center;
        }
        .mus-sep i {
          flex: 1;
          height: 1px;
          background: linear-gradient(to left, transparent, var(--mus-gold), transparent);
        }

        .preview-workspace { max-width: 780px; margin-inline: auto; }
        .preview-setup { max-width: 780px; margin-inline: auto; }
        .preview-record-section { margin: 14px -16px -16px; overflow: hidden; border-radius: 0 0 16px 16px; }
        .preview-record-bar { padding: 9px 14px; background: #063954; color: #fff; font-size: 14px; font-weight: 800; }
        .preview-hizb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(94px, 1fr)); gap: 8px; padding: 12px 14px; background: var(--card); }
        .preview-hizb-option {
          min-height: 72px; padding: 8px 10px; border-radius: 11px; text-align: start; cursor: pointer;
          display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
          color: var(--ink2); background: var(--muted-bg); border: 1.5px dashed var(--line2); font-family: inherit;
        }
        .preview-hizb-option.selected { color: var(--brand-ink); background: var(--brand-soft); border: 2px solid var(--brand-ink); box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 14%, transparent); }
        .preview-hizb-option.passed:not(.selected) { color: var(--good); background: var(--good-soft); border: 1.5px solid color-mix(in srgb, var(--good) 32%, transparent); }
        .preview-hizb-option b { font-size: 13px; }
        .preview-hizb-option strong { font-size: 18px; line-height: 1.15; }
        .preview-hizb-option small { font-size: 11px; font-weight: 700; }
        .preview-start-wrap { grid-column: 1 / -1; padding-top: 8px; border-top: 1px solid var(--line); }
        .preview-session-info {
          max-width: 780px; margin-inline: auto; display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 10px 14px;
        }
        .preview-session-info b { display: block; color: var(--ink); font-size: 14px; }
        .preview-session-info small { color: var(--ink3); font-size: 12px; }

        .mus-pagination {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid var(--mus-line);
          background: color-mix(in srgb, var(--mus-gold) 8%, var(--mus-paper));
          font-family: 'IBM Plex Sans Arabic', sans-serif;
        }
        .mus-page-button {
          min-height: 46px; padding: 7px 12px; border-radius: 13px; border: 1px solid var(--mus-line);
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: var(--mus-paper); color: var(--mus-ink); font-family: inherit;
          font-size: 13px; font-weight: 800; cursor: pointer;
        }
        .mus-page-button:hover:not(:disabled) { border-color: var(--mus-gold); background: color-mix(in srgb, var(--mus-gold) 15%, var(--mus-paper)); }
        .mus-page-button:disabled { opacity: .35; cursor: not-allowed; }
        .mus-page-button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .mus-progress { min-width: 62px; text-align: center; color: var(--mus-ink); }
        .mus-progress b { display: block; font-size: 13px; font-variant-numeric: tabular-nums; }
        .mus-progress small { display: block; margin-top: 1px; font-size: 10px; opacity: .65; }
        .mus-swipe-zone { touch-action: pan-y; }
        .mus-swipe-hint {
          padding: 5px 10px 7px; color: color-mix(in srgb, var(--mus-ink) 65%, transparent);
          text-align: center; font-family: 'IBM Plex Sans Arabic', sans-serif; font-size: 10px; font-weight: 700;
        }

        .ms-seg.is-selected {
          background: color-mix(in srgb, var(--brand-soft) 72%, transparent);
          outline: 2px solid var(--brand-ink); outline-offset: 2px;
          border-radius: 5px;
        }
        .ms-seg:focus-visible { outline: 2px solid var(--brand-ink); outline-offset: 2px; }

        .preview-sheet-backdrop { position: fixed; inset: 0; z-index: 65; background: var(--overlay); }
        .preview-sheet {
          position: fixed; right: 0; left: 0; bottom: 0; z-index: 66;
          max-height: 86dvh; overflow-y: auto; padding: 8px 14px calc(16px + env(safe-area-inset-bottom));
          border-radius: 24px 24px 0 0; background: var(--card); box-shadow: var(--shadow-lg);
        }
        .preview-sheet .grab { width: 42px; height: 4px; border-radius: 99px; background: var(--line2); margin: 3px auto 12px; }
        .mark-sheet-head { text-align: center; margin-bottom: 12px; }
        .mark-sheet-head h3 { margin: 0; color: var(--ink); font-size: 16px; }
        .mark-sheet-head p { margin: 3px 0 0; color: var(--ink3); font-size: 12px; }
        .mark-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .mark-action {
          min-height: 76px; border: 0; border-radius: 16px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 6px; font-family: inherit; font-size: 14px;
          font-weight: 800; cursor: pointer;
        }
        .mark-action svg { width: 25px; height: 25px; }
        .mark-action.error { background: var(--bad-soft); color: var(--bad); }
        .mark-action.alert { background: var(--warn-soft); color: var(--warn); }
        .mark-secondary { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .mark-secondary .u-btn { flex: 1 1 150px; }
        .mark-delete-alert { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
        @media (min-width: 768px) {
          .preview-sheet { right: auto; left: 50%; width: min(520px, calc(100vw - 32px)); transform: translateX(-50%); }
        }
        @media (max-width: 520px) {
          .mus-band { padding: 8px 122px 8px 102px; }
          .mus-band .mus-sura { font-size: 14px; }
          .mus-band-timer { right: 6px; }
          .mus-band-counts { left: 6px; gap: 3px; }
          .mus-band-timer time { min-width: 42px; font-size: 13px; }
          .mus-band-timer button { width: 27px; height: 27px; min-width: 27px; min-height: 27px; }
          .mus-band-count { padding: 1px 6px; font-size: 9px; }
          .mus-page-button { padding-inline: 8px; }
        }
      ` }} />

      <div className="u-top">
        <div>
          <div className="u-sub">
            {isReciterPreview ? 'تجربة على طلاب اللجنة · لا يحفظ شيئاً' : 'شكل تجريبي · لا يحفظ شيئاً'}
          </div>
          <h1>تسميع على المصحف</h1>
        </div>
      </div>

      {isReciterPreview && sessionStarted ? (
        <div className="u-card preview-session-info">
          <div>
            <b>{selectedStudent?.name}</b>
            <small>الحزب {toArabicDigits(hizb)} · تجربة لا تُحفظ</small>
          </div>
          <button type="button" className="u-btn u-btn-g sm" onClick={returnToPreviewSetup}>تغيير الطالب أو الحزب</button>
        </div>
      ) : (
        <div className="u-card preview-setup">
          {isReciterPreview && setupMissing ? (
          <div style={{ textAlign: 'center' }}>
            <div className="u-note warn">اختر اللجنة واكتب اسم المسمّع أولاً لعرض طلابها.</div>
            <button className="u-btn u-btn-p" onClick={() => router.push('/reciter')}>فتح إعدادات المسمّع</button>
          </div>
        ) : isReciterPreview && studentsLoading ? (
          <div className="u-muted" style={{ textAlign: 'center', padding: 12 }}>جاري تحميل طلاب اللجنة…</div>
        ) : isReciterPreview && studentsError ? (
          <div className="u-note bad">{studentsError}</div>
        ) : isReciterPreview && previewStudents.length === 0 ? (
          <div className="u-empty">لا يوجد طلاب نشطون في اللجنة المحددة.</div>
          ) : isReciterPreview ? (
            <>
              <div className="u-field">
                <label>الطالب</label>
                <select
                  className="u-input"
                  value={selectedStudentId}
                  onChange={(event) => changePreviewStudent(Number(event.target.value))}
                >
                  {previewStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}{student.circleName ? ` — ${student.circleName}` : ''}{student.assigned.length === 0 ? ' — بدون أحزاب' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedStudent && availableHizbs.length === 0 ? (
                <div className="u-note warn" style={{ marginBottom: 0 }}>لا توجد أحزاب مسجلة لهذا الطالب.</div>
              ) : (
                <div className="preview-record-section">
                  <div className="preview-record-bar">الأحزاب المحددة</div>
                  <div className="preview-hizb-grid">
                    {availableHizbs.map((number) => {
                      const passed = Boolean(selectedStudent && !selectedStudent.remaining.includes(number));
                      const selected = hizb === number;
                      return (
                        <button
                          key={number}
                          type="button"
                          className={`preview-hizb-option${selected ? ' selected' : ''}${passed ? ' passed' : ''}`}
                          onClick={() => changeHizb(number)}
                        >
                          <b>الحزب {toArabicDigits(number)}</b>
                          <strong>{passed ? '✓' : '—'}</strong>
                          <small>{selected ? 'محدّد ✓' : passed ? 'مجتاز' : 'رصد'}</small>
                        </button>
                      );
                    })}
                    <div className="preview-start-wrap">
                      <button
                        type="button"
                        className="u-btn u-btn-p lg w"
                        onClick={startPreviewSession}
                        disabled={!previewReady || loading || Boolean(error)}
                      >
                        {loading ? 'جاري تجهيز المصحف…' : `بدء التسميع — الحزب ${toArabicDigits(hizb)}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="u-field" style={{ marginBottom: 0 }}>
                <label>الحزب المسموع</label>
                <select className="u-input" value={hizb} onChange={(event) => changeHizb(Number(event.target.value))}>
                  {Array.from({ length: 60 }, (_, index) => index + 1).map((number) => (
                    <option key={number} value={number}>الحزب {toArabicDigits(number)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="u-btn u-btn-g sm" onClick={resetAll} disabled={marks.length === 0}>مسح جميع العلامات</button>
                <button className="u-btn u-btn-s sm" onClick={() => setShowJson(true)} disabled={marks.length === 0}>عرض البيانات (JSON)</button>
                <div style={{ width: '100%', color: 'var(--ink3)', fontSize: 12 }}>اضغط على الآية لتسجيل خطأ أو تنبيه</div>
              </div>
            </>
          )}
        </div>
      )}

      {showMushaf && loading && (
        <div className="u-card" style={{ padding: 60, textAlign: 'center', color: 'var(--ink2)' }}>
          جاري تحميل الحزب…
        </div>
      )}
      {showMushaf && error && (
        <div className="u-card" style={{ padding: 40, textAlign: 'center', color: 'var(--bad)' }}>
          {error}
        </div>
      )}

      {showMushaf && !loading && !error && page && (
        <div
          className="mushaf-card preview-workspace mus-swipe-zone"
          ref={mushafCardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mus-band">
            <div className={`mus-band-timer ${timerRunning ? 'running' : ''}`} aria-label="مؤقت التسميع">
              <button
                type="button"
                className="primary"
                onClick={() => setTimerRunning((running) => !running)}
                aria-label={timerRunning ? 'إيقاف مؤقت التسميع مؤقتاً' : 'بدء مؤقت التسميع'}
                title={timerRunning ? 'إيقاف مؤقت' : 'بدء'}
              >
                {timerRunning ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>
                )}
              </button>
              <time>{formattedTime}</time>
            </div>
            <div className="mus-band-center">
              <div className="mus-band-title">
                <span className="mus-orn">۞</span>
                <span className="mus-sura">سورة {page.primarySurah.name}</span>
                <span className="mus-orn">۞</span>
              </div>
            </div>
            <div className="mus-band-counts" aria-label="عداد العلامات">
              <span className="mus-band-count error">{toArabicDigits(errorCount)} خطأ</span>
              <span className="mus-band-count alert">{toArabicDigits(alertCount)} تنبيه</span>
            </div>
          </div>

          <div
            className={`mus-text ${fitReady ? 'ready' : 'fitting'}`}
            ref={mushafTextRef}
            style={{ fontFamily: pageFontFamily }}
          >
            {page.startsWithBismillah && (
              <div className="mus-bism">
                بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
              </div>
            )}
            {linesWithBanners.map((item, idx) => {
              if (item.kind === 'banner') {
                const b = item.data;
                return (
                  <div key={`banner-${b.surahNumber}-${idx}`}>
                    <div className="mus-sep">
                      <i /> سورة {b.surahName} <i />
                    </div>
                    {b.surahNumber !== 9 && (
                      <div className="mus-bism">
                        بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                      </div>
                    )}
                  </div>
                );
              }
              const line: Line = item.data;
              return (
                <div key={`line-${line.lineNumber}`} className="msline">
                  {line.segments.map((seg, si) => {
                    const ms = marksFor(seg.surah, seg.ayah);
                    const hasErr = ms.some((m) => m.type === 'error');
                    const hasAlt = ms.some((m) => m.type === 'alert');
                    const cls = [
                      'ms-seg',
                      sheetFor?.surah === seg.surah && sheetFor?.ayah === seg.ayah && 'is-selected',
                      hasErr && hasAlt && 'm-both',
                      hasErr && !hasAlt && 'm-error',
                      hasAlt && !hasErr && 'm-alert'
                    ].filter(Boolean).join(' ');
                    const segText = seg.codes.join('') + (seg.endMarker && seg.endCode ? seg.endCode : '');
                    return (
                      <span
                        key={`seg-${line.lineNumber}-${si}`}
                        className={cls}
                        onClick={() => {
                          if (Date.now() < suppressAyahTapUntilRef.current) return;
                          setSheetFor({ surah: seg.surah, ayah: seg.ayah });
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`سورة ${page.surahsOnPage.find((s) => s.number === seg.surah)?.name || seg.surah}، الآية ${seg.ayah}`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSheetFor({ surah: seg.surah, ayah: seg.ayah });
                          }
                        }}
                      >
                        {segText}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="mus-swipe-hint">اسحب يميناً للصفحة التالية · ويساراً للصفحة السابقة</div>

          <div className="mus-pagination">
            <button
              className="mus-page-button"
              onClick={() => changePage('previous')}
              disabled={!canPrev}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              السابقة
            </button>
            <div className="mus-progress" aria-label={`الصفحة ${pageIndex + 1} من ${pages.length || 1}`}>
              <b>{toArabicDigits(pageIndex + 1)} / {toArabicDigits(pages.length || 1)}</b>
              <small>صفحة {toArabicDigits(page.pageNumber)}</small>
            </div>
            <button
              className="mus-page-button"
              onClick={() => changePage('next')}
              disabled={!canNext}
            >
              التالية
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          </div>
        </div>
      )}

      {sheetFor && (
        <>
          <div className="preview-sheet-backdrop" onClick={() => setSheetFor(null)} />
          <section className="preview-sheet" role="dialog" aria-modal="true" aria-labelledby="mark-sheet-title">
            <div className="grab" />
            <div className="mark-sheet-head">
              <h3 id="mark-sheet-title">سورة {sheetMeta?.surahName} · الآية {toArabicDigits(sheetFor.ayah)}</h3>
              <p>
                صفحة {toArabicDigits(page?.pageNumber || 0)}
                {activeAyahMarks.length > 0 && (
                  <> · مسجّل {toArabicDigits(activeErrorMarks)} خطأ و{toArabicDigits(activeAlertMarks)} تنبيه</>
                )}
              </p>
            </div>
            <div className="mark-action-grid">
              <button className="mark-action error" onClick={() => addMark('error')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
                تسجيل خطأ
              </button>
              <button className="mark-action alert" onClick={() => addMark('alert')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinejoin="round" strokeLinecap="round" /></svg>
                تسجيل تنبيه
              </button>
            </div>
            <div className="mark-secondary">
              {activeErrorMarks > 0 && (
                <button className="u-btn u-btn-bad" onClick={() => removeLastMarkOfType('error')}>حذف الخطأ</button>
              )}
              {activeAlertMarks > 0 && (
                <button className="u-btn mark-delete-alert" onClick={() => removeLastMarkOfType('alert')}>حذف التنبيه</button>
              )}
              {activeAyahMarks.length > 1 && (
                <button className="u-btn u-btn-g" onClick={clearAyahMarks}>مسح كل علامات الآية</button>
              )}
              <button className="u-btn u-btn-g" onClick={() => setSheetFor(null)}>إلغاء</button>
            </div>
          </section>
        </>
      )}

      {showJson && (
        <>
          <div className="preview-sheet-backdrop" onClick={() => setShowJson(false)} />
          <section className="preview-sheet" role="dialog" aria-modal="true" aria-labelledby="json-sheet-title">
            <div className="grab" />
            <h3 id="json-sheet-title" style={{ textAlign: 'center', fontSize: 15, margin: '0 0 12px', fontWeight: 700 }}>
              بيانات العلامات (ستُحفظ مع الجلسة لاحقاً)
            </h3>
            <pre style={{
              background: 'var(--muted-bg)', padding: 12, borderRadius: 10, fontSize: 12,
              direction: 'ltr', textAlign: 'left', overflow: 'auto', maxHeight: '55vh', margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace'
            }}>
              {JSON.stringify(
                {
                  student: isReciterPreview && selectedStudent
                    ? { id: selectedStudent.id, name: selectedStudent.name }
                    : undefined,
                  hizb,
                  totals: { errors: errorCount, alerts: alertCount },
                  marks: marks.map(({ surah, ayah, type }) => ({ surah, ayah, type }))
                },
                null,
                2
              )}
            </pre>
            <button className="u-btn u-btn-p w" onClick={() => setShowJson(false)} style={{ marginTop: 12 }}>
              إغلاق
            </button>
          </section>
        </>
      )}
    </div>
  );
}
