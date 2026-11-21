import type { Account, Category } from '../types';
import { addDays, addMonths, pad, parseKey, toKey, todayKey } from './dates';
import { evalAmount } from './format';

export interface Parsed {
  amount: number | null;
  category: string | null;
  account: string | null;
  date: string;
  time: string | null; // HH:mm when the text mentions a time
  dateFound: boolean;
  note: string;
  explicitNote: boolean; // the user wrote "note …"
}

// Keyword hints for common Indian merchants and words → default category names
const HINTS: Record<string, string[]> = {
  'Food & Dining': ['swiggy', 'zomato', 'lunch', 'dinner', 'breakfast', 'coffee', 'starbucks', 'cafe', 'restaurant', 'pizza', 'burger', 'food', 'tea', 'chai', 'snacks', 'dominos', 'kfc', 'mcd', 'biryani'],
  Groceries: ['blinkit', 'zepto', 'bigbasket', 'grocery', 'groceries', 'vegetables', 'fruits', 'milk', 'instamart', 'dmart'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'clothes', 'shoes', 'shopping', 'nykaa'],
  Transport: ['uber', 'ola', 'rapido', 'metro', 'auto', 'cab', 'petrol', 'diesel', 'fuel', 'bus', 'parking', 'toll'],
  Travel: ['flight', 'train', 'irctc', 'hotel', 'airbnb', 'trip', 'makemytrip', 'goibibo'],
  'Bills & Utilities': ['electricity', 'water', 'gas', 'internet', 'wifi', 'broadband', 'recharge', 'mobile', 'bill', 'jio', 'airtel'],
  Rent: ['rent'],
  Entertainment: ['movie', 'pvr', 'inox', 'concert', 'game', 'bookmyshow', 'party'],
  Subscriptions: ['netflix', 'spotify', 'prime', 'hotstar', 'youtube', 'subscription', 'icloud', 'chatgpt'],
  Health: ['medicine', 'pharmacy', 'doctor', 'hospital', 'gym', 'apollo', 'pharmeasy', 'health'],
  'Personal Care': ['haircut', 'salon', 'spa', 'grooming'],
  Education: ['course', 'books', 'book', 'udemy', 'tuition', 'fees'],
  Gifts: ['gift', 'donation', 'charity'],
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const FILLER = new Set(['add', 'added', 'spent', 'spend', 'paid', 'pay', 'bought', 'for', 'on', 'at', 'via', 'from', 'by', 'using', 'with', 'the', 'rs', 'rs.', 'inr', '₹']);

/** Builds a date from day + month (0-based) with no year: picks the most recent past occurrence. */
function recentDate(day: number, month: number, year?: number): string | null {
  if (month < 0 || month > 11) return null;
  const t = parseKey(todayKey());
  let y = year ?? t.getFullYear();
  if (year !== undefined && year < 100) y = 2000 + year;
  const last = new Date(y, month + 1, 0).getDate();
  if (day < 1 || day > last) return null;
  let d = new Date(y, month, day);
  if (year === undefined && d > t) d = new Date(y - 1, month, day);
  return toKey(d);
}

function to24(h: number, m: number, ap?: string): string | null {
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  }
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Pulls dates and times out of the text first (so "21 nov" or "8pm" are never mistaken for the
 * amount), then the amount, account and category. Whatever is left becomes the note.
 */
export function parseQuick(input: string, categories: Category[], accounts: Account[]): Parsed {
  const today = todayKey();
  // everything after the word "note" (or "note:") is kept as-is as the note, never parsed
  let explicitNote = '';
  let body = input.trim();
  const nm = body.match(/(?:^|\s)notes?\s*[:\-–]?\s+(.*)$/i) || body.match(/(?:^|\s)notes?\s*:\s*(.*)$/i);
  if (nm && nm.index !== undefined) {
    explicitNote = nm[1].trim();
    body = body.slice(0, nm.index).trim();
  }
  let s = ` ${body} `;
  let date = today;
  let dateFound = false;
  let time: string | null = null;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => {
    const m = s.match(re);
    if (m && fn(m)) {
      s = s.replace(m[0], ' ');
      return true;
    }
    return false;
  };
  const setDate = (k: string | null) => {
    if (!k) return false;
    date = k;
    dateFound = true;
    return true;
  };

  /* ── time ── */
  take(/\s(?:at\s+|@\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i, (m) => !!(time = to24(+m[1], +(m[2] || 0), m[3].toLowerCase())));
  if (!time) take(/\s(?:at\s+|@\s*)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, (m) => !!(time = to24(+m[1], +m[2])));
  if (!time)
    take(/\s(?:at\s+|@\s*)(\d{1,2})(?=\s)/i, (m) => {
      const h = +m[1];
      // "at 8" → evening for 1–7, and for 8–11 when the text sounds like an evening thing
      const evening = /dinner|night|party|drinks|beer|bar|movie|pub|club/i.test(input);
      return !!(time = to24((h >= 1 && h <= 7) || (evening && h >= 8 && h <= 11) ? h + 12 : h, 0));
    });
  if (!time) {
    const words: [RegExp, string][] = [[/\s(?:this\s+)?morning(?=\s)/i, '09:00'], [/\s(?:at\s+)?noon(?=\s)/i, '12:00'], [/\s(?:this\s+)?afternoon(?=\s)/i, '14:00'], [/\s(?:this\s+)?evening(?=\s)/i, '19:00'], [/\stonight(?=\s)/i, '21:00'], [/\s(?:at\s+)?night(?=\s)/i, '21:00'], [/\s(?:at\s+)?midnight(?=\s)/i, '00:00']];
    for (const [re, v] of words) if (take(re, () => !!(time = v))) break;
  }

  /* ── date ── */
  const found =
    take(/\s(?:on\s+)?(?:the\s+)?day\s+before\s+yesterday(?=\s)/i, () => setDate(addDays(today, -2))) ||
    take(/\s(?:on\s+)?(yesterday|yday|ytd)(?=\s)/i, () => setDate(addDays(today, -1))) ||
    take(/\s(?:on\s+)?today(?=\s)/i, () => setDate(today)) ||
    take(/\s(\d{1,3})\s+days?\s+ago(?=\s)/i, (m) => setDate(addDays(today, -+m[1]))) ||
    take(/\s(?:a\s+|1\s+)?week\s+ago(?=\s)/i, () => setDate(addDays(today, -7))) ||
    take(/\slast\s+week(?=\s)/i, () => setDate(addDays(today, -7))) ||
    // 21 nov, 21st november 2026
    take(new RegExp(`\\s(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH_RE}\\.?(?:,?\\s+(\\d{2,4}))?(?=\\s)`, 'i'), (m) =>
      setDate(recentDate(+m[1], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), m[3] ? +m[3] : undefined)),
    ) ||
    // nov 21, november 21st 2026
    take(new RegExp(`\\s(?:on\\s+)?${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?=\\s)`, 'i'), (m) =>
      setDate(recentDate(+m[2], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), m[3] ? +m[3] : undefined)),
    ) ||
    // 21/11, 21-11-2026, 21.11.26
    take(/\s(?:on\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?=\s)/, (m) => setDate(recentDate(+m[1], +m[2] - 1, m[3] ? +m[3] : undefined))) ||
    // dotted dates need a year, so "12.50" stays an amount
    take(/\s(?:on\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?=\s)/, (m) => setDate(recentDate(+m[1], +m[2] - 1, +m[3]))) ||
    // 2026-11-21
    take(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/, (m) => setDate(recentDate(+m[3], +m[2] - 1, +m[1]))) ||
    // last friday / friday / fri
    take(/\s(?:on\s+)?(last\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|urday|sday)?(?=\s)/i, (m) => {
      const wi = WEEKDAYS.findIndex((d) => d.startsWith(m[2].toLowerCase().slice(0, 3)));
      if (wi < 0) return false;
      const diff = (parseKey(today).getDay() - wi + 7) % 7 || 7;
      return setDate(addDays(today, -diff));
    }) ||
    // "on the 5th" / "5th" → that day this month (or last month if still ahead)
    take(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(st|nd|rd|th)(?=\s)/i, (m) => {
      const t = parseKey(today);
      let k = recentDate(+m[1], t.getMonth(), t.getFullYear());
      if (k && k > today) k = recentDate(+m[1], parseKey(addMonths(today, -1)).getMonth(), parseKey(addMonths(today, -1)).getFullYear());
      return setDate(k);
    });
  void found;

  /* ── amount ── */
  let words = s.trim().split(/\s+/).filter(Boolean);
  let amount: number | null = null;
  const amountIdx = () => {
    // prefer a token with a currency marker, else the first number
    const marked = words.findIndex((w) => /^(₹|rs\.?|inr)\s*\d/i.test(w) || /\d(₹|\/-|rs)$/i.test(w));
    if (marked >= 0) return marked;
    return words.findIndex((w) => /^[\d.,+\-*/x×()]+$/i.test(w) && /\d/.test(w));
  };
  for (let tries = 0; tries < 3 && amount === null; tries++) {
    const i = amountIdx();
    if (i < 0) break;
    const raw = words[i].replace(/^(₹|rs\.?|inr)/i, '').replace(/(₹|rs\.?|\/-)$/i, '');
    const v = evalAmount(raw);
    if (!isNaN(v) && v > 0) amount = v;
    else words[i] = words[i] + '​'; // not a number after all; skip it next time
    if (amount !== null) words.splice(i, 1);
  }
  words = words.map((w) => w.replace('​', ''));
  // a lone currency word left before/after the amount ("rs 250")
  words = words.filter((w) => !/^(₹|rs\.?|inr|\/-)$/i.test(w));

  const lower = (x: string) => x.toLowerCase();
  const activeCats = categories.filter((c) => !c.archived);
  const activeAccs = accounts.filter((a) => !a.archived);
  let account: string | null = null;
  let category: string | null = null;

  /* ── account ── (full multi-word name first, then first word or type) */
  const joined = ` ${lower(words.join(' '))} `;
  const full = activeAccs.slice().sort((a, b) => b.name.length - a.name.length).find((a) => joined.includes(` ${lower(a.name)} `));
  if (full) {
    account = full.name;
    const n = full.name.split(/\s+/).length;
    const i = words.findIndex((_, k) => lower(words.slice(k, k + n).join(' ')) === lower(full.name));
    if (i >= 0) words.splice(i, n);
  } else {
    for (let i = 0; i < words.length && !account; i++) {
      const w = lower(words[i]);
      const acc = activeAccs.find((a) => lower(a.name).split(/\s+/)[0] === w || lower(a.type) === w);
      if (acc) {
        account = acc.name;
        words.splice(i, 1);
      }
    }
  }

  /* ── category ── explicit name first, then keyword hints */
  for (let i = 0; i < words.length && !category; i++) {
    const w = lower(words[i]).replace(/^#/, '');
    const c = activeCats.find((c) => lower(c.name) === w || lower(c.name).split(/[\s&]+/)[0] === w);
    if (c) {
      category = c.name;
      words.splice(i, 1); // a word used as the category never ends up in the note
    }
  }
  if (!category) {
    const all = lower(`${words.join(' ')} ${explicitNote}`);
    outer: for (const [cat, keys] of Object.entries(HINTS)) {
      for (const k of keys) {
        if (new RegExp(`\\b${k}\\b`).test(all)) {
          const exists = activeCats.find((c) => lower(c.name) === lower(cat));
          if (exists) {
            category = exists.name;
            break outer;
          }
        }
      }
    }
  }

  const noteWords = words.filter((w) => !FILLER.has(lower(w)));
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const rest = cap(noteWords.join(' '));
  // "swiggy 340 note team dinner" → "Swiggy · team dinner" so the merchant isn't lost
  const note = explicitNote ? (rest ? `${rest} · ${explicitNote}` : cap(explicitNote)) : rest;
  return { amount, category, account, date, time, dateFound, note, explicitNote: !!explicitNote };
}
