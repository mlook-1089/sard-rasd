function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export const HIZB_PRESETS = [
  { id: 'amma', label: 'جزء عمّ', detail: '59–60', hizbs: range(59, 60) },
  { id: 'tabarak', label: 'تبارك', detail: '57–58', hizbs: range(57, 58) },
  { id: 'mufassal', label: 'المفصّل', detail: '52–60', hizbs: range(52, 60) },
  { id: 'first-half', label: 'الأجزاء 1–15', detail: '1–30', hizbs: range(1, 30) },
  { id: 'second-half', label: 'الأجزاء 15–30', detail: '29–60', hizbs: range(29, 60) }
] as const;

export const JUZ_PRESETS = [
  { id: 'amma', label: 'عمّ', detail: '30', juzs: [30] },
  { id: 'tabarak', label: 'تبارك', detail: '29', juzs: [29] },
  { id: 'mufassal', label: 'المفصّل', detail: '27–30', juzs: range(27, 30) },
  { id: 'first-half', label: 'النصف الأول', detail: '1–15', juzs: range(1, 15) },
  { id: 'second-half', label: 'النصف الثاني', detail: '16–30', juzs: range(16, 30) }
] as const;

export function juzForHizb(hizbNumber: number): number {
  return Math.ceil(hizbNumber / 2);
}

export function hizbsForJuz(juzNumber: number): [number, number] {
  return [juzNumber * 2 - 1, juzNumber * 2];
}

export function juzsForHizbs(hizbs: readonly number[]): number[] {
  return Array.from(new Set(hizbs.map(juzForHizb))).sort((a, b) => a - b);
}
