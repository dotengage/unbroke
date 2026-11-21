import type { Budget, Scheduled, Txn } from '../types';
import {
  addDays, daysBetween, eachDay, endOfMonth, endOfWeek, fmtDayMonth, fmtMonthShort, fmtWeekday, fmtWeekdayShort, minKey,
  parseKey, startOfMonth, startOfWeek, todayKey, type Period, addMonths,
} from './dates';
import { money } from './format';
import { upcoming } from './schedule';

export const inRange = (txns: Txn[], start: string, end: string) => txns.filter((t) => t.date >= start && t.date <= end);
export const sum = (txns: Txn[]) => txns.reduce((a, t) => a + (Number(t.amount) || 0), 0);

export function sortTxns(txns: Txn[]): Txn[] {
  return txns.slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || (b.created || '').localeCompare(a.created || ''));
}

export interface Group {
  name: string;
  total: number;
  count: number;
  share: number;
}

function groupBy(txns: Txn[], key: (t: Txn) => string): Group[] {
  const m = new Map<string, Group>();
  let total = 0;
  for (const t of txns) {
    const k = key(t) || 'Uncategorised';
    const g = m.get(k) || { name: k, total: 0, count: 0, share: 0 };
    g.total += Number(t.amount) || 0;
    g.count++;
    total += Number(t.amount) || 0;
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, share: total ? g.total / total : 0 })).sort((a, b) => b.total - a.total);
}
export const byCategory = (t: Txn[]) => groupBy(t, (x) => x.category);
export const byAccount = (t: Txn[]) => groupBy(t, (x) => x.account || 'No account');

export function byDay(txns: Txn[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txns) m.set(t.date, (m.get(t.date) || 0) + (Number(t.amount) || 0));
  return m;
}

export interface Bucket {
  key: string;
  label: string;
  short: string;
  start: string;
  end: string;
  total: number;
  future: boolean;
}

export function series(txns: Txn[], p: Period, weekStart = 1): { buckets: Bucket[]; unit: 'day' | 'week' | 'month' } {
  const days = daysBetween(p.start, p.end);
  const today = todayKey();
  const daily = byDay(txns);
  const total = (a: string, b: string) => {
    let s = 0;
    for (const [k, v] of daily) if (k >= a && k <= b) s += v;
    return s;
  };
  if (p.preset !== 'year' && days <= 62) {
    return {
      unit: 'day',
      buckets: eachDay(p.start, p.end).map((k) => ({
        key: k, start: k, end: k, total: daily.get(k) || 0, future: k > today,
        label: `${fmtWeekday(k)}, ${fmtDayMonth(k)}`,
        short: days <= 7 ? fmtWeekdayShort(k).slice(0, 1) : String(parseKey(k).getDate()),
      })),
    };
  }
  if (p.preset !== 'year' && days <= 26 * 7) {
    const out: Bucket[] = [];
    for (let s = startOfWeek(p.start, weekStart); s <= p.end; s = addDays(s, 7)) {
      const e = addDays(s, 6);
      out.push({ key: s, start: s, end: e, total: total(s, e), future: s > today, label: `${fmtDayMonth(s)} – ${fmtDayMonth(e)}`, short: fmtDayMonth(s) });
    }
    return { unit: 'week', buckets: out };
  }
  const out: Bucket[] = [];
  for (let s = startOfMonth(p.start); s <= p.end; s = addMonths(s, 1)) {
    const e = endOfMonth(s);
    out.push({ key: s, start: s, end: e, total: total(s, e), future: s > today, label: `${fmtMonthShort(s)} ${s.slice(0, 4)}`, short: fmtMonthShort(s).slice(0, 3) });
  }
  return { unit: 'month', buckets: out };
}

export interface Stats {
  total: number;
  count: number;
  elapsedDays: number;
  avgPerDay: number;
  avgPerTxn: number;
  largest: Txn | null;
  peakDay: { date: string; total: number } | null;
  noSpendDays: number;
  projected: number | null;
}

export function stats(txns: Txn[], p: Period): Stats {
  const today = todayKey();
  const total = sum(txns);
  const count = txns.length;
  const endEff = p.start > today ? p.end : minKey(p.end, today);
  const elapsedDays = Math.max(1, daysBetween(p.start, endEff));
  const daily = byDay(txns);
  let peakDay: Stats['peakDay'] = null;
  for (const [date, v] of daily) if (!peakDay || v > peakDay.total) peakDay = { date, total: v };
  let largest: Txn | null = null;
  for (const t of txns) if (!largest || t.amount > largest.amount) largest = t;
  let noSpend = 0;
  for (const k of eachDay(p.start, endEff)) if (!daily.get(k)) noSpend++;
  const fullDays = daysBetween(p.start, p.end);
  const ongoing = p.start <= today && p.end > today;
  return {
    total, count, elapsedDays,
    avgPerDay: total / elapsedDays,
    avgPerTxn: count ? total / count : 0,
    largest, peakDay, noSpendDays: noSpend,
    projected: ongoing && elapsedDays >= 3 ? (total / elapsedDays) * fullDays : null,
  };
}

export interface Insight {
  icon: string;
  title: string;
  detail: string;
  tone: 'up' | 'down' | 'neutral';
}

export function insights(curr: Txn[], prev: Txn[], p: Period, scheduled: Scheduled[]): Insight[] {
  const out: Insight[] = [];
  const ct = sum(curr);
  const pt = sum(prev);
  if (!curr.length) return out;

  // 1. Category movers vs previous period
  if (prev.length) {
    const pc = new Map(byCategory(prev).map((g) => [g.name, g.total]));
    const movers = byCategory(curr)
      .map((g) => ({ name: g.name, now: g.total, before: pc.get(g.name) || 0 }))
      .map((m) => ({ ...m, delta: m.now - m.before }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const top = movers[0];
    if (top && Math.abs(top.delta) > Math.max(200, pt * 0.05)) {
      const up = top.delta > 0;
      out.push({
        icon: up ? 'trending-up' : 'trending-down',
        tone: up ? 'up' : 'down',
        title: `${top.name} ${up ? 'up' : 'down'} ${money(Math.abs(top.delta))}`,
        detail: top.before ? `${money(top.now)} vs ${money(top.before)} in the previous period.` : `New this period, ${money(top.now)} so far.`,
      });
    }
  }

  // 2. Weekday pattern
  const wd = new Array(7).fill(0);
  const wdDays = new Array(7).fill(0);
  const today = todayKey();
  for (const k of eachDay(p.start, minKey(p.end, today))) wdDays[parseKey(k).getDay()]++;
  for (const t of curr) wd[parseKey(t.date).getDay()] += t.amount;
  const avg = wd.map((v, i) => (wdDays[i] ? v / wdDays[i] : 0));
  const maxI = avg.indexOf(Math.max(...avg));
  const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const overall = avg.reduce((a, b) => a + b, 0) / 7;
  if (overall > 0 && avg[maxI] > overall * 1.4 && daysBetween(p.start, minKey(p.end, today)) >= 14) {
    out.push({ icon: 'calendar-days', tone: 'neutral', title: `You spend most on ${names[maxI]}`, detail: `${money(avg[maxI])} on average, ${Math.round((avg[maxI] / overall - 1) * 100)}% above a typical day.` });
  }

  // 3. Weekend vs weekday
  const wkend = (avg[0] + avg[6]) / 2;
  const wkday = (avg[1] + avg[2] + avg[3] + avg[4] + avg[5]) / 5;
  if (wkday > 0 && wkend > wkday * 1.5 && maxI !== 0 && maxI !== 6) {
    out.push({ icon: 'sun', tone: 'neutral', title: 'Weekends cost more', detail: `${money(wkend)}/day on weekends vs ${money(wkday)}/day on weekdays.` });
  }

  // 4. Unusual expense
  const sorted = curr.map((t) => t.amount).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const big = curr.filter((t) => !t.source.startsWith('scheduled') && t.amount > Math.max(median * 5, 1000)).sort((a, b) => b.amount - a.amount)[0];
  if (big) {
    out.push({ icon: 'zap', tone: 'neutral', title: `Unusual: ${money(big.amount)} on ${big.note || big.category}`, detail: `About ${Math.round(big.amount / Math.max(1, median))}× your typical expense (${fmtDayMonth(big.date)}).` });
  }

  // 5. Recurring share
  const rec = sum(curr.filter((t) => t.source.startsWith('scheduled')));
  if (rec > 0 && ct > 0) {
    out.push({ icon: 'repeat', tone: 'neutral', title: `${Math.round((rec / ct) * 100)}% went to scheduled bills`, detail: `${money(rec)} was recorded automatically from ${scheduled.filter((s) => s.active).length} active schedules.` });
  }

  // 6. Overall pace
  if (pt > 0) {
    const change = ((ct - pt) / pt) * 100;
    if (!ongoing(p) && Math.abs(change) >= 5) {
      out.push({ icon: change > 0 ? 'arrow-up-right' : 'arrow-down-right', tone: change > 0 ? 'up' : 'down', title: `${Math.abs(Math.round(change))}% ${change > 0 ? 'more' : 'less'} than the previous period`, detail: `${money(ct)} vs ${money(pt)}.` });
    }
  }
  return out.slice(0, 5);
}

const ongoing = (p: Period) => {
  const t = todayKey();
  return p.start <= t && p.end > t;
};

/* ───────── Budgets ───────── */

export interface BudgetStatus {
  budget: Budget;
  start: string;
  end: string;
  spent: number;
  remaining: number;
  pct: number;
  daysLeft: number;
  upcomingBills: number;
  safePerDay: number;
  label: string;
}

export function budgetWindow(b: Budget, weekStart = 1, ref = todayKey()) {
  if (b.period === 'weekly') return { start: startOfWeek(ref, weekStart), end: endOfWeek(ref, weekStart) };
  return { start: startOfMonth(ref), end: endOfMonth(ref) };
}

export function budgetStatus(b: Budget, txns: Txn[], scheduled: Scheduled[], weekStart = 1): BudgetStatus {
  const today = todayKey();
  const { start, end } = budgetWindow(b, weekStart);
  const rel = txns.filter((t) => t.date >= start && t.date <= end && (!b.category || t.category === b.category));
  const spent = sum(rel);
  const remaining = b.amount - spent;
  const daysLeft = daysBetween(today, end);
  const bills = upcoming(scheduled.filter((s) => !b.category || s.category === b.category), addDays(today, 1), end).reduce((a, u) => a + Number(u.s.amount || 0), 0);
  const safe = Math.max(0, remaining - bills) / Math.max(1, daysLeft);
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(parseKey(start));
  return {
    budget: b, start, end, spent, remaining,
    pct: b.amount > 0 ? spent / b.amount : 0,
    daysLeft, upcomingBills: bills, safePerDay: safe,
    label: b.period === 'weekly' ? 'this week' : monthName,
  };
}
