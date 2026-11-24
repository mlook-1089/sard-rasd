'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [hizb, setHizb] = useState(1);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [sheetFor, setSheetFor] = useState<{ surah: number; ayah: number } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [fitReady, setFitReady] = useState(false);
  const mushafTextRef = useRef<HTMLDivElement | null>(null);

  // Load Amiri font once
  useEffect(() => {
    if (document.getElementById('amiri-font')) return;
    const link = document.createElement('link');
    link.id = 'amiri-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@700&display=swap';
    document.head.appendChild(link);
  }, []);

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

  const marksFor = (s: number, a: number) =>
    marks.filter((m) => m.surah === s && m.ayah === a);

  const addMark = (type: MarkType) => {
    if (!sheetFor) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMarks((p) => [...p, { id, surah: sheetFor.surah, ayah: sheetFor.ayah, type }]);
    setSheetFor(null);
  };
  const undoLastForAyah = () => {
    if (!sheetFor) return;
    const existing = marksFor(sheetFor.surah, sheetFor.ayah);
    if (existing.length === 0) { setSheetFor(null); return; }
    const last = existing[existing.length - 1];
    setMarks((p) => p.filter((m) => m.id !== last.id));
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

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pages.length - 1;

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

  const pageFontFamily = page
    ? `"QCF_P${String(page.pageNumber).padStart(3, '0')}", 'Amiri Quran', 'Amiri', serif`
    : 'serif';

  return (
    <div className="u-page" style={{ paddingBottom: 160 }}>
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
          gap: 10px;
          position: relative;
          background: var(--mus-band);
          color: var(--mus-band-ink);
          padding: 10px 12px;
          min-height: 40px;
          border-bottom: 2px solid var(--mus-gold);
        }
        .mus-band .mus-orn { color: var(--mus-gold); font-size: 14px; line-height: 1; opacity: .9; }
        .mus-band .mus-sura { font-family: 'IBM Plex Sans Arabic', serif; font-size: 17px; font-weight: 700; }
        .mus-band .mus-page-num {
          position: absolute;
          inset-inline-end: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          font-weight: 700;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          background: color-mix(in srgb, var(--mus-gold) 22%, transparent);
          border: 1px solid color-mix(in srgb, var(--mus-gold) 60%, transparent);
          color: var(--mus-band-ink);
          padding: 4px 10px;
          border-radius: 9px;
        }

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

        .mus-foot {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 12px;
          border-top: 1px dashed var(--mus-line);
          background: color-mix(in srgb, var(--mus-gold) 8%, var(--mus-paper));
          font-size: 11.5px;
          color: color-mix(in srgb, var(--mus-ink) 65%, transparent);
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .mus-nav { display: inline-flex; gap: 6px; }
        .mus-nav button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--mus-paper);
          color: var(--mus-ink);
          border: 1px solid var(--mus-line);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          min-height: 34px;
        }
        .mus-nav button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--mus-gold) 16%, var(--mus-paper));
          border-color: var(--mus-gold);
        }
        .mus-nav button:disabled { opacity: .35; cursor: not-allowed; }
        .mus-nav button svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .mus-progress { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--mus-ink); }

        .counter-fab {
          position: fixed;
          bottom: calc(76px + env(safe-area-inset-bottom));
          right: 12px;
          left: 12px;
          z-index: 45;
          display: flex;
          gap: 8px;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 10px 14px;
          box-shadow: var(--shadow-lg);
          justify-content: space-between;
          align-items: center;
        }
        @media (min-width: 768px) {
          .counter-fab { bottom: 16px; right: auto; left: 50%; transform: translateX(-50%); min-width: 360px; }
        }
        .counter-fab .pills { display: flex; gap: 6px; }
        .counter-fab .pill {
          display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px;
          border-radius: 99px; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
        }
        .counter-fab .pill.error { background: var(--bad-soft); color: var(--bad); }
        .counter-fab .pill.alert { background: var(--warn-soft); color: var(--warn); }
      ` }} />

      <div className="u-top">
        <div>
          <div className="u-sub">شكل تجريبي · لا يحفظ شيئاً</div>
          <h1>تسميع على المصحف</h1>
        </div>
      </div>

      <div className="u-card">
        <div className="u-field" style={{ marginBottom: 0 }}>
          <label>الحزب المسموع</label>
          <select
            className="u-input"
            value={hizb}
            onChange={(e) => setHizb(Number(e.target.value))}
          >
            {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>الحزب {toArabicDigits(n)}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="u-btn u-btn-g sm" onClick={resetAll} disabled={marks.length === 0}>
            مسح جميع العلامات
          </button>
          <button className="u-btn u-btn-s sm" onClick={() => setShowJson(true)} disabled={marks.length === 0}>
            عرض البيانات (JSON)
          </button>
          <div style={{ marginRight: 'auto', color: 'var(--ink3)', fontSize: 12, alignSelf: 'center' }}>
            اضغط على الآية لتسجيل خطأ أو تنبيه
          </div>
        </div>
      </div>

      {loading && (
        <div className="u-card" style={{ padding: 60, textAlign: 'center', color: 'var(--ink2)' }}>
          جاري تحميل الحزب…
        </div>
      )}
      {error && (
        <div className="u-card" style={{ padding: 40, textAlign: 'center', color: 'var(--bad)' }}>
          {error}
        </div>
      )}

      {!loading && !error && page && (
        <div className="mushaf-card">
          <div className="mus-band">
            <span className="mus-orn">۞</span>
            <span className="mus-sura">سورة {page.primarySurah.name}</span>
            <span className="mus-orn">۞</span>
            <span className="mus-page-num">صفحة {toArabicDigits(page.pageNumber)}</span>
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
                      hasErr && hasAlt && 'm-both',
                      hasErr && !hasAlt && 'm-error',
                      hasAlt && !hasErr && 'm-alert'
                    ].filter(Boolean).join(' ');
                    const segText = seg.codes.join('') + (seg.endMarker && seg.endCode ? seg.endCode : '');
                    return (
                      <span
                        key={`seg-${line.lineNumber}-${si}`}
                        className={cls}
                        onClick={() => setSheetFor({ surah: seg.surah, ayah: seg.ayah })}
                      >
                        {segText}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="mus-foot">
            <div className="mus-nav">
              <button
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
              >
                <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
                السابقة
              </button>
              <button
                onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                disabled={!canNext}
              >
                التالية
                <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
            <span className="mus-progress">
              {toArabicDigits(pageIndex + 1)} / {toArabicDigits(pages.length || 1)}
            </span>
          </div>
        </div>
      )}

      <div className="counter-fab">
        <div className="pills">
          <span className="pill error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
            {toArabicDigits(errorCount)} خطأ
          </span>
          <span className="pill alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {toArabicDigits(alertCount)} تنبيه
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>
          {pages.length > 0 && `صفحة ${toArabicDigits(page?.pageNumber || 0)}`}
        </span>
      </div>

      <div
        className={`u-sheet-bg ${sheetFor ? 'show' : ''}`}
        onClick={() => setSheetFor(null)}
      />
      <div className={`u-sheet ${sheetFor ? 'show' : ''}`}>
        <div className="grab" />
        {sheetFor && (
          <>
            <div style={{
              textAlign: 'center', padding: '4px 0 14px', fontSize: 14,
              color: 'var(--ink2)', fontWeight: 600
            }}>
              الآية {toArabicDigits(sheetFor.ayah)} · سورة {sheetMeta?.surahName}
              {activeAyahMarks.length > 0 && (
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--ink3)' }}>
                  مسجّل عليها: {toArabicDigits(activeAyahMarks.filter((m) => m.type === 'error').length)} خطأ ·{' '}
                  {toArabicDigits(activeAyahMarks.filter((m) => m.type === 'alert').length)} تنبيه
                </div>
              )}
            </div>
            <div className="u-menu">
              <button onClick={() => addMark('error')}>
                <span className="ic" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </span>
                <span>تسجيل خطأ</span>
              </button>
              <button onClick={() => addMark('alert')}>
                <span className="ic" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </span>
                <span>تسجيل تنبيه</span>
              </button>
              {activeAyahMarks.length > 0 && (
                <>
                  <button onClick={undoLastForAyah} className="danger">
                    <span className="ic">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>تراجع عن آخر علامة</span>
                  </button>
                  {activeAyahMarks.length > 1 && (
                    <button onClick={clearAyahMarks} className="danger">
                      <span className="ic">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>مسح جميع علامات هذه الآية</span>
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setSheetFor(null)}>
                <span className="ic">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </span>
                <span>إلغاء</span>
              </button>
            </div>
          </>
        )}
      </div>

      {showJson && (
        <>
          <div className="u-sheet-bg show" onClick={() => setShowJson(false)} />
          <div className="u-sheet show">
            <div className="grab" />
            <h3 style={{ textAlign: 'center', fontSize: 15, margin: '0 0 12px', fontWeight: 700 }}>
              بيانات العلامات (ستُحفظ مع الجلسة لاحقاً)
            </h3>
            <pre style={{
              background: 'var(--muted-bg)', padding: 12, borderRadius: 10, fontSize: 12,
              direction: 'ltr', textAlign: 'left', overflow: 'auto', maxHeight: '55vh', margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace'
            }}>
              {JSON.stringify(
                {
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
          </div>
        </>
      )}
    </div>
  );
}
