const cache = new Map<string, Intl.NumberFormat>();

function nf(currency: string, digits: number) {
  const key = currency + digits;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: 0 });
    cache.set(key, f);
  }
  return f;
}

let CURRENCY = 'INR';
export const setCurrency = (c: string) => {
  try {
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: c });
    CURRENCY = c;
  } catch {
    CURRENCY = 'INR';
  }
};
export const getCurrency = () => CURRENCY;

export function money(n: number, opts: { decimals?: boolean } = {}): string {
  const v = Number(n) || 0;
  const digits = opts.decimals || (Math.abs(v) < 100 && v % 1 !== 0) ? 2 : 0;
  return nf(CURRENCY, digits).format(v);
}

/** Compact money: ₹1.2L, ₹12K */
export function moneyShort(n: number): string {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  const sym = currencySymbol();
  if (CURRENCY === 'INR') {
    if (v >= 1e7) return `${sign}${sym}${trim(v / 1e7)}Cr`;
    if (v >= 1e5) return `${sign}${sym}${trim(v / 1e5)}L`;
  } else if (v >= 1e6) return `${sign}${sym}${trim(v / 1e6)}M`;
  if (v >= 1e3) return `${sign}${sym}${trim(v / 1e3)}K`;
  return `${sign}${sym}${Math.round(v)}`;
}

const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''));

export function currencySymbol(): string {
  const parts = nf(CURRENCY, 0).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value || '₹';
}

export const pct = (n: number) => `${Math.round(n)}%`;

export function uid(): string {
  const a = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Evaluates a simple arithmetic expression like "120+45*2". Returns NaN if invalid. */
export function evalAmount(expr: string): number {
  const s = expr.replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/[,\s]/g, '').replace(/−/g, '-');
  if (!s) return NaN;
  if (!/^[0-9+\-*/.()]+$/.test(s)) return NaN;
  // shunting-yard, no eval
  const out: number[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const apply = () => {
    const op = ops.pop()!;
    const b = out.pop();
    const a = out.pop();
    if (a === undefined || b === undefined) throw new Error('bad');
    out.push(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b);
  };
  try {
    const tokens = s.match(/\d*\.?\d+|[+\-*/()]/g) || [];
    let prevOp = true;
    for (const t of tokens) {
      if (/\d/.test(t)) {
        out.push(parseFloat(t));
        prevOp = false;
      } else if (t === '(') {
        ops.push(t);
        prevOp = true;
      } else if (t === ')') {
        while (ops.length && ops[ops.length - 1] !== '(') apply();
        ops.pop();
        prevOp = false;
      } else {
        if (prevOp && t === '-') out.push(0);
        while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[t]) apply();
        ops.push(t);
        prevOp = true;
      }
    }
    while (ops.length) apply();
    const r = out.length === 1 ? out[0] : NaN;
    return isFinite(r) ? Math.round(r * 100) / 100 : NaN;
  } catch {
    return NaN;
  }
}
