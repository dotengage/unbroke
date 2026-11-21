import { useSyncExternalStore } from 'react';
import type { Connection, Op, Snapshot, SyncStatus, Table } from '../types';
import { api, ApiError, normaliseUrl } from './api';
import { demoSnapshot, emptySnapshot } from './demo';
import { runDue } from './schedule';
import { setCurrency } from './format';
import { compressImage } from './image';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  tone?: 'default' | 'error';
}

export interface State {
  conn: Connection | null;
  data: Snapshot;
  pending: Op[];
  status: SyncStatus;
  lastSync: number | null;
  error: string | null;
  theme: ThemePref;
  toast: Toast | null;
}

const KEY = 'unbroke:v1';
const POLL_MS = 12000;

function load(): State {
  const base: State = { conn: null, data: emptySnapshot(), pending: [], status: 'idle', lastSync: null, error: null, theme: 'system', toast: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...base, conn: s.conn ?? null, data: { ...emptySnapshot(), ...s.data }, pending: s.pending ?? [], lastSync: s.lastSync ?? null, theme: s.theme ?? 'system' };
    }
  } catch {
    /* storage unavailable */
  }
  return base;
}

let state: State = load();
setCurrency(state.data.settings.currency || 'INR');
const listeners = new Set<() => void>();

let persistTimer: number | undefined;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      const { conn, data, pending, lastSync, theme } = state;
      localStorage.setItem(KEY, JSON.stringify({ conn, data, pending, lastSync, theme }));
    } catch {
      /* quota or private mode — the sheet is the source of truth anyway */
    }
  }, 150);
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  if (patch.data) setCurrency(state.data.settings.currency || 'INR');
  listeners.forEach((l) => l());
  persist();
}

export const getState = () => state;

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => sel(state),
  );
}

/* ───────── Applying ops locally (optimistic UI) ───────── */

const TABLE_KEY: Record<Exclude<Table, 'Settings'>, keyof Snapshot> = {
  Transactions: 'transactions',
  Categories: 'categories',
  Accounts: 'accounts',
  Budgets: 'budgets',
  Scheduled: 'scheduled',
};

function applyOp(d: Snapshot, op: Op): Snapshot {
  if (op.op === 'rename') {
    const field = op.table === 'Categories' ? 'category' : 'account';
    const swap = <T,>(arr: T[]): T[] => arr.map((r) => ((r as Record<string, unknown>)[field] === op.from ? { ...r, [field]: op.to } : r));
    return { ...d, transactions: swap(d.transactions), scheduled: swap(d.scheduled), budgets: field === 'category' ? swap(d.budgets) : d.budgets };
  }
  if (op.table === 'Settings') {
    if (op.op === 'upsert') return { ...d, settings: { ...d.settings, [String(op.row.key)]: String(op.row.value) } };
    const s = { ...d.settings };
    delete s[op.id];
    return { ...d, settings: s };
  }
  const k = TABLE_KEY[op.table];
  const arr = d[k] as unknown as { id: string }[];
  if (op.op === 'delete') return { ...d, [k]: arr.filter((r) => r.id !== op.id) };
  const i = arr.findIndex((r) => r.id === op.row.id);
  const next = arr.slice();
  if (i >= 0) next[i] = { ...next[i], ...op.row } as never;
  else next.push(op.row as never);
  return { ...d, [k]: next };
}

const reapply = (d: Snapshot, ops: Op[]) => ops.reduce(applyOp, d);

/* ───────── Sync engine ───────── */

let inflight: Promise<void> | null = null;
let flushTimer: number | undefined;

function scheduleFlush(delay = 400) {
  clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flush(), delay);
}

function handleError(e: unknown) {
  if (e instanceof ApiError && e.kind === 'network') set({ status: 'offline', error: null });
  else set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
}

export async function flush(): Promise<void> {
  const conn = state.conn;
  if (!conn || conn.mode !== 'sheet') return;
  if (inflight) return inflight;
  if (!state.pending.length) return;
  const sending = state.pending.slice();
  set({ status: 'syncing' });
  inflight = (async () => {
    try {
      const snap = await api.batch(conn.url, sending);
      const rest = state.pending.slice(sending.length);
      set({ data: reapply(snap, rest), pending: rest, status: 'idle', error: null, lastSync: Date.now() });
    } catch (e) {
      handleError(e);
    } finally {
      inflight = null;
    }
  })();
  await inflight;
  if (state.pending.length && state.status === 'idle') scheduleFlush(100);
}

export async function pull(force = false): Promise<void> {
  const conn = state.conn;
  if (!conn) return;
  if (conn.mode === 'demo') {
    runLocalSchedules();
    return;
  }
  if (state.pending.length) return flush();
  if (inflight) return inflight;
  try {
    if (!force) {
      const v = await api.version(conn.url);
      if (v === state.data.version) {
        if (state.status !== 'idle') set({ status: 'idle', error: null });
        set({ lastSync: Date.now() });
        return;
      }
    }
    set({ status: 'syncing' });
    inflight = (async () => {
      const snap = await api.pull(conn.url);
      set({ data: reapply(snap, state.pending), status: 'idle', error: null, lastSync: Date.now() });
    })();
    await inflight;
  } catch (e) {
    handleError(e);
  } finally {
    inflight = null;
  }
}

function runLocalSchedules() {
  const { scheduled, created } = runDue(state.data.scheduled);
  if (created.length || scheduled !== state.data.scheduled) {
    const changed = scheduled.some((s, i) => s !== state.data.scheduled[i]);
    if (created.length || changed) set({ data: { ...state.data, scheduled, transactions: [...state.data.transactions, ...created] } });
  }
}

let pollTimer: number | undefined;
export function startSync() {
  stopSync();
  const tick = () => {
    if (document.visibilityState === 'visible') void pull();
  };
  pollTimer = window.setInterval(tick, POLL_MS);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('online', tick);
  window.addEventListener('focus', tick);
  tick();
  stopFns = [() => document.removeEventListener('visibilitychange', tick), () => window.removeEventListener('online', tick), () => window.removeEventListener('focus', tick)];
}
let stopFns: (() => void)[] = [];
export function stopSync() {
  clearInterval(pollTimer);
  stopFns.forEach((f) => f());
  stopFns = [];
}

/* ───────── Public actions ───────── */

export function mutate(ops: Op[]) {
  if (!ops.length) return;
  const data = reapply(state.data, ops);
  if (state.conn?.mode === 'demo') {
    set({ data });
    runLocalSchedules();
    return;
  }
  set({ data, pending: [...state.pending, ...ops] });
  scheduleFlush();
}

export const upsert = (table: Table, row: object) => mutate([{ op: 'upsert', table, row: row as Record<string, unknown> }]);
export const remove = (table: Table, id: string) => mutate([{ op: 'delete', table, id }]);
export const setSetting = (key: string, value: string) => upsert('Settings', { key, value });

export async function connect(input: string, sheetUrl?: string): Promise<void> {
  const url = normaliseUrl(input);
  const snap = await api.init(url);
  set({ conn: { mode: 'sheet', url, sheetUrl: sheetUrl?.trim() || undefined }, data: snap, pending: [], status: 'idle', error: null, lastSync: Date.now() });
  startSync();
}

export function startDemo() {
  set({ conn: { mode: 'demo' }, data: demoSnapshot(), pending: [], status: 'idle', error: null });
  runLocalSchedules();
  startSync();
}

export function disconnect() {
  stopSync();
  set({ conn: null, data: emptySnapshot(), pending: [], status: 'idle', error: null, lastSync: null });
}

export function discardPending() {
  set({ pending: [], status: 'idle', error: null });
  void pull(true);
}

export function setConnMeta(patch: { sheetUrl?: string }) {
  if (state.conn?.mode === 'sheet') set({ conn: { ...state.conn, ...patch } });
}

export const setTheme = (theme: ThemePref) => set({ theme });

let toastId = 0;
let toastTimer: number | undefined;
export function toast(text: string, opts: Partial<Omit<Toast, 'id' | 'text'>> & { duration?: number } = {}) {
  clearTimeout(toastTimer);
  const t: Toast = { id: ++toastId, text, action: opts.action, tone: opts.tone };
  set({ toast: t });
  toastTimer = window.setTimeout(() => {
    if (state.toast?.id === t.id) set({ toast: null });
  }, opts.duration ?? 3800);
}
export const dismissToast = () => set({ toast: null });

/** Compresses an image and stores it in Drive (or inline in demo mode). Returns the URL to save. */
export async function uploadReceipt(file: File): Promise<string> {
  const conn = state.conn;
  if (!conn) throw new Error('Not connected');
  if (conn.mode === 'demo') return compressImage(file, 700, 0.7).then((r) => r.dataUrl);
  const { base64 } = await compressImage(file, 1600, 0.8);
  const res = await api.upload(conn.url, { name: `receipt-${Date.now()}.jpg`, mime: 'image/jpeg', data: base64 });
  return res.url;
}
