export type Table = 'Transactions' | 'Categories' | 'Accounts' | 'Budgets' | 'Scheduled' | 'Settings';

export interface Txn {
  id: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  amount: number;
  category: string; // category name (human readable in the sheet)
  account: string; // account name
  note: string;
  receipt: string;
  source: string; // '' | 'quick' | 'scheduled:<id>'
  created: string;
  updated: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number | null;
  archived: boolean;
}

export type AccountType = 'cash' | 'bank' | 'card' | 'wallet' | 'upi' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType | string;
  icon: string;
  color: string;
  order: number | null;
  archived: boolean;
}

export type BudgetPeriod = 'weekly' | 'monthly';

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  amount: number;
  category: string; // '' = all spending
  created: string;
}

export type Frequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Scheduled {
  id: string;
  title: string;
  amount: number;
  category: string;
  account: string;
  note: string;
  frequency: Frequency;
  interval: number | null;
  startDate: string;
  endDate: string;
  maxRuns: number | null;
  runs: number | null;
  nextDate: string;
  active: boolean;
  lastRun: string;
  created: string;
}

export interface Snapshot {
  version: string;
  api?: number; // backend script version (2+ supports the Back Tap shortcut)
  timeZone?: string;
  transactions: Txn[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  scheduled: Scheduled[];
  settings: Record<string, string>;
}

export type Op =
  | { op: 'upsert'; table: Table; row: Record<string, unknown> }
  | { op: 'delete'; table: Table; id: string }
  | { op: 'rename'; table: 'Categories' | 'Accounts'; from: string; to: string };

export type Connection = { mode: 'sheet'; url: string; sheetUrl?: string } | { mode: 'demo' };

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
