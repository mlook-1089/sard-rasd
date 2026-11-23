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

export function juzForHizb(hizbNumber: number): number {
  return Math.ceil(hizbNumber / 2);
}
