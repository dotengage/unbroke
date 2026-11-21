import { useMemo, useSyncExternalStore } from 'react';
import type { Account, Category, Scheduled, Txn } from '../types';
import { useStore } from './store';
import { ACCOUNT_TYPE_ICON } from '../components/Icon';

const FALLBACK_CAT: Category = { id: '', name: 'Others', icon: 'circle-ellipsis', color: '#8e8e93', order: 999, archived: false };

export function useData() {
  const data = useStore((s) => s.data);
  return useMemo(() => {
    const categories = data.categories.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const accounts = data.accounts.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
    const accMap = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
    const cat = (name: string): Category => catMap.get((name || '').toLowerCase()) || { ...FALLBACK_CAT, name: name || 'Others' };
    const acc = (name: string): Account =>
      accMap.get((name || '').toLowerCase()) || { id: '', name: name || 'No account', type: 'other', icon: 'piggy-bank', color: '#8e8e93', order: 999, archived: false };
    const accIcon = (a: Account) => a.icon || ACCOUNT_TYPE_ICON[a.type] || 'wallet';
    const activeAccounts = accounts.filter((a) => !a.archived);
    // the account used whenever an expense doesn't say otherwise (synced via the Settings tab)
    const chosen = (data.settings.defaultAccount || '').toLowerCase();
    const defaultAccount = activeAccounts.find((a) => a.name.toLowerCase() === chosen)?.name || activeAccounts[0]?.name || '';
    return {
      data,
      txns: data.transactions as Txn[],
      categories,
      accounts,
      activeCategories: categories.filter((c) => !c.archived),
      activeAccounts,
      defaultAccount,
      scheduled: data.scheduled as Scheduled[],
      budgets: data.budgets,
      weekStart: Number(data.settings.weekStart ?? 1) || 0,
      cat,
      acc,
      accIcon,
    };
  }, [data]);
}

/* ───────── Hash router ───────── */
export type Route = { name: string; params: URLSearchParams };

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, q] = h.split('?');
  return { name: name || 'home', params: new URLSearchParams(q || '') };
}
let route = parse();
const rl = new Set<() => void>();
window.addEventListener('hashchange', () => {
  route = parse();
  rl.forEach((l) => l());
  window.scrollTo({ top: 0 });
});
export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      rl.add(cb);
      return () => rl.delete(cb);
    },
    () => route,
  );
}
export function go(name: string, params?: Record<string, string>) {
  const q = params ? new URLSearchParams(params).toString() : '';
  location.hash = `/${name}${q ? '?' + q : ''}`;
}
export const back = () => (history.length > 1 ? history.back() : go('home'));

/* ───────── Global UI state (add/edit sheet etc.) ───────── */
export interface AddPrefill {
  amount?: number;
  category?: string;
  account?: string;
  date?: string;
  time?: string;
  note?: string;
}
interface UI {
  add: { open: boolean; edit?: Txn; prefill?: AddPrefill };
  exportOpen: boolean;
  exportScope?: { start: string; end: string; categories?: string[]; accounts?: string[]; q?: string; label?: string };
}
let ui: UI = { add: { open: false }, exportOpen: false };
const ul = new Set<() => void>();
const setUI = (p: Partial<UI>) => {
  ui = { ...ui, ...p };
  ul.forEach((l) => l());
};
export function useUI(): UI {
  return useSyncExternalStore(
    (cb) => {
      ul.add(cb);
      return () => ul.delete(cb);
    },
    () => ui,
  );
}
export const openAdd = (prefill?: AddPrefill) => setUI({ add: { open: true, prefill } });
export const openEdit = (t: Txn) => setUI({ add: { open: true, edit: t } });
export const closeAdd = () => setUI({ add: { ...ui.add, open: false } });
export const openExport = (scope?: UI['exportScope']) => setUI({ exportOpen: true, exportScope: scope });
export const closeExport = () => setUI({ exportOpen: false });

/* ───────── Small persisted prefs (per device) ───────── */
export function pref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('unbroke:pref:' + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function setPref(key: string, v: unknown) {
  try {
    localStorage.setItem('unbroke:pref:' + key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
