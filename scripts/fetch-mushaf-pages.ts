// Pre-fetches all 604 Madinah Mushaf pages from quran.com and saves them as
// static JSON bundles under public/data/mushaf/. Run once with:
//   npx tsx scripts/fetch-mushaf-pages.ts
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = resolve(process.cwd(), 'public', 'data', 'mushaf');
const CONCURRENCY = 20;

const SURAH_NAMES_AR = [
  '', 'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال',
  'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف',
  'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص',
  'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص',
  'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح',
  'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة',
  'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك',
  'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات',
  'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق',
  'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق',
  'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل',
  'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'
];

async function processPage(pageNum: number) {
  const url =
    `https://api.quran.com/api/v4/verses/by_page/${pageNum}` +
    `?words=true` +
    `&word_fields=code_v1,line_number,page_number,char_type_name` +
    `&fields=verse_key,page_number` +
    `&per_page=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for page ${pageNum}`);
  const data: any = await res.json();
  const verses: any[] = data.verses || [];

  // Group all words into (line → words with surah/ayah)
  const byLine = new Map<number, any[]>();
  for (const v of verses) {
    const [sStr, aStr] = String(v.verse_key).split(':');
    const surah = Number(sStr);
    const ayah = Number(aStr);
    for (const w of v.words || []) {
      const line = w.line_number;
      if (!byLine.has(line)) byLine.set(line, []);
      byLine.get(line)!.push({
        code: w.code_v1 || '',
        surah,
        ayah,
        isEnd: w.char_type_name === 'end'
      });
    }
  }

  const sortedLineNums = Array.from(byLine.keys()).sort((a, b) => a - b);
  const lines = sortedLineNums.map((lineNum) => {
    const ws = byLine.get(lineNum)!;
    const segments: any[] = [];
    for (const w of ws) {
      const last = segments[segments.length - 1];
      if (last && last.surah === w.surah && last.ayah === w.ayah) {
        if (w.isEnd) { last.endMarker = true; last.endCode = w.code; }
        else last.codes.push(w.code);
      } else {
        segments.push({
          surah: w.surah,
          ayah: w.ayah,
          codes: w.isEnd ? [] : [w.code],
          endMarker: w.isEnd,
          endCode: w.isEnd ? w.code : ''
        });
      }
    }
    return { lineNumber: lineNum, segments };
  });

  // Banners (new surah starting mid-page)
  const banners: any[] = [];
  let lastSurah: number | null = null;
  for (const line of lines) {
    for (const seg of line.segments) {
      if (lastSurah !== null && seg.surah !== lastSurah) {
        banners.push({
          afterLine: line.lineNumber - 1,
          surahNumber: seg.surah,
          surahName: SURAH_NAMES_AR[seg.surah] || `سورة ${seg.surah}`
        });
      }
      lastSurah = seg.surah;
    }
  }

  const firstSurah = lines[0]?.segments[0]?.surah ?? 0;
  const firstAyah = lines[0]?.segments[0]?.ayah ?? 0;
  const startsWithBismillah =
    firstSurah && firstSurah !== 1 && firstSurah !== 9 && firstAyah === 1
      ? { surahNumber: firstSurah, surahName: SURAH_NAMES_AR[firstSurah] || '' }
      : null;
  const surahsOnPage = Array.from(
    new Set(lines.flatMap((l) => l.segments.map((s) => s.surah)))
  ).map((s) => ({ number: s, name: SURAH_NAMES_AR[s] || `سورة ${s}` }));

  return {
    pageNumber: pageNum,
    primarySurah: { number: firstSurah, name: SURAH_NAMES_AR[firstSurah] || `سورة ${firstSurah}` },
    surahsOnPage,
    startsWithBismillah,
    banners,
    lines
  };
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const todo: number[] = [];
  for (let p = 1; p <= 604; p++) {
    const file = resolve(OUT_DIR, `page-${p}.json`);
    if (!existsSync(file)) todo.push(p);
  }
  if (todo.length === 0) {
    console.log('All 604 pages already present. Done.');
    return;
  }
  console.log(`Fetching ${todo.length} page(s) with concurrency ${CONCURRENCY}…`);

  let done = 0;
  async function worker() {
    while (todo.length > 0) {
      const p = todo.shift();
      if (p === undefined) return;
      try {
        const data = await processPage(p);
        const file = resolve(OUT_DIR, `page-${p}.json`);
        writeFileSync(file, JSON.stringify(data));
        done++;
        if (done % 25 === 0 || done === todo.length) {
          console.log(`  ${done} page(s) saved`);
        }
      } catch (e: any) {
        console.error(`  page ${p} FAILED:`, e.message);
        // Retry once at the end of the queue
        todo.push(p);
      }
    }
  }
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
