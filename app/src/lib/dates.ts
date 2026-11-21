// All dates in the app are local calendar days encoded as 'yyyy-MM-dd' strings.

export const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const todayKey = () => toKey(new Date());

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(k: string, n: number): string {
  const d = parseKey(k);
  const day = d.getDate();
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toKey(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last)));
}

export function startOfWeek(k: string, weekStart = 1): string {
  const d = parseKey(k);
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDays(k, -diff);
}
export const endOfWeek = (k: string, ws = 1) => addDays(startOfWeek(k, ws), 6);

export function startOfMonth(k: string): string {
  return k.slice(0, 8) + '01';
}
export function endOfMonth(k: string): string {
  const d = parseKey(k);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export const startOfYear = (k: string) => k.slice(0, 4) + '-01-01';
export const endOfYear = (k: string) => k.slice(0, 4) + '-12-31';

/** Inclusive number of days between two keys. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000) + 1;
}

export function eachDay(a: string, b: string): string[] {
  const out: string[] = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}

export const minKey = (a: string, b: string) => (a < b ? a : b);
export const maxKey = (a: string, b: string) => (a > b ? a : b);

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', o);
const F = {
  dayMonth: fmt({ day: 'numeric', month: 'short' }),
  dayMonthYear: fmt({ day: 'numeric', month: 'short', year: 'numeric' }),
  monthYear: fmt({ month: 'long', year: 'numeric' }),
  monthShort: fmt({ month: 'short' }),
  weekday: fmt({ weekday: 'long' }),
  weekdayShort: fmt({ weekday: 'short' }),
};

export const fmtDayMonth = (k: string) => F.dayMonth.format(parseKey(k));
export const fmtFull = (k: string) => F.dayMonthYear.format(parseKey(k));
export const fmtMonthYear = (k: string) => F.monthYear.format(parseKey(k));
export const fmtMonthShort = (k: string) => F.monthShort.format(parseKey(k));
export const fmtWeekday = (k: string) => F.weekday.format(parseKey(k));
export const fmtWeekdayShort = (k: string) => F.weekdayShort.format(parseKey(k));

export function relativeDay(k: string): string {
  const t = todayKey();
  if (k === t) return 'Today';
  if (k === addDays(t, -1)) return 'Yesterday';
  if (k === addDays(t, 1)) return 'Tomorrow';
  const diff = daysBetween(t, k) - 1;
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (k.slice(0, 4) === t.slice(0, 4)) return fmtDayMonth(k);
  return fmtFull(k);
}

export function fmtTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m || 0)} ${ap}`;
}

/* ───────── Periods ───────── */

export type Preset = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface Period {
  preset: Preset;
  start: string;
  end: string;
  label: string;
}

export function periodFor(preset: Preset, offset = 0, weekStart = 1, custom?: { start: string; end: string }): Period {
  const t = todayKey();
  switch (preset) {
    case 'today': {
      const k = addDays(t, offset);
      return { preset, start: k, end: k, label: offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : fmtFull(k) };
    }
    case 'week': {
      const s = addDays(startOfWeek(t, weekStart), offset * 7);
      const e = addDays(s, 6);
      return { preset, start: s, end: e, label: offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${fmtDayMonth(s)} – ${fmtDayMonth(e)}` };
    }
    case 'year': {
      const y = Number(t.slice(0, 4)) + offset;
      return { preset, start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
    }
    case 'custom': {
      const s = custom?.start || startOfMonth(t);
      const e = custom?.end || t;
      return { preset, start: s, end: e, label: `${fmtDayMonth(s)} – ${fmtDayMonth(e)}` };
    }
    case 'month':
    default: {
      const s = startOfMonth(addMonths(startOfMonth(t), offset));
      return { preset: 'month', start: s, end: endOfMonth(s), label: offset === 0 ? 'This month' : fmtMonthYear(s) };
    }
  }
}

/** The period of equal length immediately before. */
export function previousPeriod(p: Period, weekStart = 1): Period {
  if (p.preset === 'month') {
    const s = addMonths(p.start, -1);
    return { ...p, start: s, end: endOfMonth(s) };
  }
  if (p.preset === 'year') {
    const y = Number(p.start.slice(0, 4)) - 1;
    return { ...p, start: `${y}-01-01`, end: `${y}-12-31` };
  }
  const len = daysBetween(p.start, p.end);
  void weekStart;
  return { ...p, start: addDays(p.start, -len), end: addDays(p.start, -1) };
}
