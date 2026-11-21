import type { Scheduled, Txn } from '../types';
import { addDays, addMonths, parseKey, toKey, todayKey } from './dates';
import { uid } from './format';

/** k-th (0-based) occurrence of a schedule. Mirrors occurrence_() in Code.gs. */
export function occurrence(s: Pick<Scheduled, 'frequency' | 'interval' | 'startDate'>, k: number): string | null {
  if (!s.startDate) return null;
  const iv = Math.max(1, Number(s.interval) || 1);
  switch (s.frequency) {
    case 'once':
      return k === 0 ? s.startDate : null;
    case 'daily':
      return addDays(s.startDate, k * iv);
    case 'weekly':
      return addDays(s.startDate, 7 * k * iv);
    case 'yearly':
      return addMonths(s.startDate, 12 * k * iv);
    case 'monthly':
    default:
      return addMonths(s.startDate, k * iv);
  }
}

export function isFinished(s: Scheduled, runs: number, next: string | null): boolean {
  if (!next) return true;
  if (s.frequency === 'once' && runs >= 1) return true;
  if (s.maxRuns && runs >= s.maxRuns) return true;
  if (s.endDate && next > s.endDate) return true;
  return false;
}

export function nextOf(s: Scheduled): string | null {
  const runs = s.runs || 0;
  const n = occurrence(s, runs);
  return isFinished(s, runs, n) ? null : n;
}

/** Upcoming occurrences between two dates (inclusive), across all active schedules. */
export function upcoming(list: Scheduled[], from: string, to: string, limit = 200) {
  const out: { s: Scheduled; date: string }[] = [];
  for (const s of list) {
    if (!s.active) continue;
    let runs = s.runs || 0;
    let n = occurrence(s, runs);
    let guard = 0;
    while (n && n <= to && !isFinished(s, runs, n) && guard++ < 400) {
      if (n >= from) out.push({ s, date: n });
      runs++;
      if (s.frequency === 'once') break;
      n = occurrence(s, runs);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

/** Local runner used in demo mode (the sheet runs its own hourly trigger). */
export function runDue(list: Scheduled[]): { scheduled: Scheduled[]; created: Txn[] } {
  const today = todayKey();
  const created: Txn[] = [];
  const scheduled = list.map((s) => {
    if (!s.active || !s.startDate || !s.amount) return s;
    let runs = s.runs || 0;
    let n = occurrence(s, runs);
    let changed = false;
    let guard = 0;
    while (n && n <= today && !isFinished(s, runs, n) && guard++ < 500) {
      const now = new Date().toISOString();
      created.push({
        id: uid(),
        date: n,
        time: '09:00',
        amount: Number(s.amount),
        category: s.category || 'Others',
        account: s.account,
        note: s.title + (s.note ? ' · ' + s.note : ''),
        receipt: '',
        source: 'scheduled:' + s.id,
        created: now,
        updated: now,
      });
      runs++;
      changed = true;
      if (s.frequency === 'once') break;
      n = occurrence(s, runs);
    }
    const done = isFinished(s, runs, n);
    const nextDate = done ? '' : n || '';
    if (!changed && nextDate === s.nextDate) return s;
    return { ...s, runs, nextDate, active: done ? false : s.active, lastRun: changed ? new Date().toISOString() : s.lastRun };
  });
  return { scheduled, created };
}

export function describeFrequency(s: Pick<Scheduled, 'frequency' | 'interval' | 'startDate'>): string {
  const iv = Math.max(1, Number(s.interval) || 1);
  const d = s.startDate ? parseKey(s.startDate) : new Date();
  const dayNum = d.getDate();
  const suffix = (n: number) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  switch (s.frequency) {
    case 'once':
      return 'One time';
    case 'daily':
      return iv === 1 ? 'Every day' : `Every ${iv} days`;
    case 'weekly': {
      const wd = new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(d);
      return iv === 1 ? `Every ${wd}` : `Every ${iv} weeks on ${wd}`;
    }
    case 'yearly':
      return iv === 1 ? `Every year on ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d)}` : `Every ${iv} years`;
    case 'monthly':
    default:
      return iv === 1 ? `Monthly on the ${dayNum}${suffix(dayNum)}` : `Every ${iv} months on the ${dayNum}${suffix(dayNum)}`;
  }
}

/** Monthly-equivalent cost, used for the subscriptions total. */
export function monthlyCost(s: Scheduled): number {
  const iv = Math.max(1, Number(s.interval) || 1);
  const a = Number(s.amount) || 0;
  switch (s.frequency) {
    case 'daily':
      return (a * 30.44) / iv;
    case 'weekly':
      return (a * 4.348) / iv;
    case 'yearly':
      return a / 12 / iv;
    case 'once':
      return 0;
    default:
      return a / iv;
  }
}

export { toKey };
