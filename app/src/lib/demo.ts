import type { Account, Category, Scheduled, Snapshot, Txn } from '../types';
import { addDays, addMonths, startOfMonth, todayKey } from './dates';
import { uid } from './format';

export const DEFAULT_CATEGORIES: [string, string, string][] = [
  ['Food & Dining', 'utensils', '#eb6834'],
  ['Groceries', 'shopping-basket', '#1baf7a'],
  ['Shopping', 'shopping-bag', '#2a78d6'],
  ['Transport', 'car', '#eda100'],
  ['Travel', 'plane', '#6250d6'],
  ['Bills & Utilities', 'receipt', '#e34948'],
  ['Rent', 'home', '#008300'],
  ['Entertainment', 'clapperboard', '#e87ba4'],
  ['Subscriptions', 'repeat', '#2a78d6'],
  ['Health', 'heart-pulse', '#e34948'],
  ['Personal Care', 'sparkles', '#e87ba4'],
  ['Education', 'graduation-cap', '#6250d6'],
  ['Gifts', 'gift', '#1baf7a'],
  ['Others', 'circle-ellipsis', '#8e8e93'],
];

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map(([name, icon, color], i) => ({ id: uid(), name, icon, color, order: i, archived: false }));
}

export function defaultAccounts(): Account[] {
  return [
    { id: uid(), name: 'Cash', type: 'cash', icon: 'banknote', color: '#1baf7a', order: 0, archived: false },
    { id: uid(), name: 'HDFC Bank', type: 'bank', icon: 'landmark', color: '#2a78d6', order: 1, archived: false },
    { id: uid(), name: 'Credit Card', type: 'card', icon: 'credit-card', color: '#6250d6', order: 2, archived: false },
    { id: uid(), name: 'UPI', type: 'upi', icon: 'smartphone', color: '#eb6834', order: 3, archived: false },
  ];
}

export function emptySnapshot(): Snapshot {
  return { version: '0', transactions: [], categories: [], accounts: [], budgets: [], scheduled: [], settings: { currency: 'INR', weekStart: '1' } };
}

// deterministic pseudo random so the demo looks the same each time
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function demoSnapshot(): Snapshot {
  const r = rng(42);
  const categories = defaultCategories();
  const accounts = defaultAccounts();
  const today = todayKey();
  const start = addMonths(startOfMonth(today), -5);
  const tx: Txn[] = [];
  const merchants: Record<string, [string, number, number][]> = {
    'Food & Dining': [['Swiggy', 180, 650], ['Zomato', 200, 700], ['Starbucks', 250, 450], ['Lunch', 120, 300]],
    Groceries: [['Blinkit', 150, 900], ['BigBasket', 400, 2200], ['Vegetables', 80, 300]],
    Shopping: [['Amazon', 300, 3500], ['Myntra', 700, 2800], ['Decathlon', 500, 2500]],
    Transport: [['Uber', 120, 450], ['Metro', 30, 80], ['Petrol', 500, 1500], ['Rapido', 60, 180]],
    Entertainment: [['PVR Movie', 300, 900], ['Concert', 1200, 2500], ['Bowling', 400, 800]],
    Health: [['Pharmacy', 150, 900], ['Doctor visit', 500, 1200]],
    'Personal Care': [['Haircut', 200, 500], ['Salon', 600, 1500]],
    Gifts: [['Birthday gift', 500, 2000]],
  };
  const weights: [string, number][] = [
    ['Food & Dining', 9], ['Groceries', 4], ['Transport', 6], ['Shopping', 2], ['Entertainment', 1.2], ['Health', 0.6], ['Personal Care', 0.6], ['Gifts', 0.3],
  ];
  const total = weights.reduce((a, [, w]) => a + w, 0);
  const accNames = accounts.map((a) => a.name);
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const n = Math.floor(r() * 3) + (r() > 0.7 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      let x = r() * total;
      let cat = weights[0][0];
      for (const [c, w] of weights) {
        if ((x -= w) <= 0) {
          cat = c;
          break;
        }
      }
      const opts = merchants[cat];
      const [name, lo, hi] = opts[Math.floor(r() * opts.length)];
      const amount = Math.round((lo + r() * (hi - lo)) / 10) * 10;
      const h = 8 + Math.floor(r() * 14);
      const now = new Date().toISOString();
      tx.push({
        id: uid(), date: d, time: `${String(h).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`,
        amount, category: cat, account: accNames[cat === 'Transport' && name === 'Metro' ? 0 : Math.floor(r() * accNames.length)],
        note: name, receipt: '', source: '', created: now, updated: now,
      });
    }
  }
  const mk = (title: string, amount: number, category: string, account: string, day: number, frequency: Scheduled['frequency'] = 'monthly'): Scheduled => {
    const s = addMonths(start, 0).slice(0, 8) + String(day).padStart(2, '0');
    return { id: uid(), title, amount, category, account, note: '', frequency, interval: 1, startDate: s, endDate: '', maxRuns: null, runs: 0, nextDate: '', active: true, lastRun: '', created: new Date().toISOString() };
  };
  const scheduled: Scheduled[] = [
    mk('Rent', 18000, 'Rent', 'HDFC Bank', 1),
    mk('Netflix', 649, 'Subscriptions', 'Credit Card', 7),
    mk('Spotify', 119, 'Subscriptions', 'Credit Card', 12),
    mk('Electricity', 1400, 'Bills & Utilities', 'UPI', 18),
    mk('Phone & internet', 999, 'Bills & Utilities', 'Credit Card', 24),
    mk('Gym membership', 1500, 'Health', 'UPI', 3),
  ];
  return {
    version: 'demo',
    transactions: tx,
    categories,
    accounts,
    budgets: [
      { id: uid(), name: 'Monthly budget', period: 'monthly', amount: 45000, category: '', created: new Date().toISOString() },
      { id: uid(), name: 'Eating out', period: 'weekly', amount: 2000, category: 'Food & Dining', created: new Date().toISOString() },
      { id: uid(), name: 'Shopping', period: 'monthly', amount: 4000, category: 'Shopping', created: new Date().toISOString() },
    ],
    scheduled,
    settings: { currency: 'INR', weekStart: '1' },
  };
}
