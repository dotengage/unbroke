import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Bucket } from '../lib/analytics';
import { money, moneyShort } from '../lib/format';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ───────── Donut ───────── */
export interface Slice {
  name: string;
  value: number;
  color: string;
}

export function Donut({ data, size = 200, center }: { data: Slice[]; size?: number; center?: ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const total = data.reduce((a, d) => a + d.value, 0);
  const stroke = size * 0.13;
  const r = (size - stroke) / 2 - 4;
  const C = 2 * Math.PI * r;
  const gap = data.length > 1 ? 3 : 0; // surface gap between fills
  let acc = 0;
  const h = hover !== null ? data[hover] : null;
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }} role="img" aria-label="Spending by category">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-2)" strokeWidth={stroke} />
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * C;
            const dash = Math.max(0.001, len - gap);
            const off = -acc;
            acc += len;
            return (
              <motion.circle
                key={d.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={hover === i ? stroke + 6 : stroke}
                strokeDasharray={`${dash} ${C}`}
                strokeDashoffset={off}
                strokeLinecap="butt"
                initial={reduce ? false : { strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${dash} ${C}`, opacity: hover === null || hover === i ? 1 : 0.35 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.8, delay: reduce ? 0 : i * 0.04 }}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
                style={{ cursor: 'pointer', transition: 'stroke-width .15s' }}
              />
            );
          })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none', padding: stroke + 8 }}>
        {h ? (
          <div>
            <div className="small muted" style={{ fontWeight: 600 }}>{h.name}</div>
            <div className="mid-amount num">{money(h.value)}</div>
            <div className="tiny faint">{Math.round((h.value / total) * 100)}% of total</div>
          </div>
        ) : (
          center
        )}
      </div>
    </div>
  );
}

/* ───────── Bar trend ───────── */
export function Bars({ buckets, height = 180, avg, highlight }: { buckets: Bucket[]; height?: number; avg?: number; highlight?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const padL = 40;
  const padB = 22;
  const padT = 8;
  const max = Math.max(1, ...buckets.map((b) => b.total), avg || 0);
  const nice = niceMax(max);
  const plotW = Math.max(0, w - padL);
  const plotH = height - padB - padT;
  const n = buckets.length || 1;
  const slot = plotW / n;
  const barW = Math.max(3, Math.min(28, slot * 0.62));
  const yOf = (v: number) => padT + plotH - (v / nice) * plotH;
  const labelEvery = Math.ceil(n / Math.max(1, Math.floor(plotW / 34)));
  const hb = hover !== null ? buckets[hover] : null;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height }} onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Spending trend">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={padL} x2={w} y1={yOf(nice * f)} y2={yOf(nice * f)} stroke="var(--line)" strokeDasharray={f === 0 ? '' : '2 4'} />
              <text x={padL - 8} y={yOf(nice * f) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-3)" className="num">
                {moneyShort(nice * f)}
              </text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const x = padL + i * slot + (slot - barW) / 2;
            const hgt = Math.max(b.total > 0 ? 2 : 0, (b.total / nice) * plotH);
            const isH = hover === i || highlight === b.key;
            return (
              <g key={b.key}>
                <rect x={padL + i * slot} y={padT} width={slot} height={plotH + padB} fill="transparent" onPointerEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: 'pointer' }} />
                <motion.path
                  d={roundedTop(x, yOf(0), barW, hgt, Math.min(4, barW / 2))}
                  fill={b.future ? 'var(--fill)' : 'var(--accent)'}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1, opacity: hover === null || isH ? 1 : 0.45 }}
                  style={{ originY: 1, transformBox: 'fill-box', pointerEvents: 'none' }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.6, delay: reduce ? 0 : Math.min(0.3, i * 0.012) }}
                />
                {i % labelEvery === 0 && (
                  <text x={padL + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize="10.5" fill={isH ? 'var(--text)' : 'var(--text-3)'} fontWeight={isH ? 650 : 500}>
                    {b.short}
                  </text>
                )}
              </g>
            );
          })}
          {avg ? (
            <g pointerEvents="none">
              <line x1={padL} x2={w} y1={yOf(avg)} y2={yOf(avg)} stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="4 4" />
            </g>
          ) : null}
        </svg>
      )}
      {hb && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(padL + hover! * slot + slot / 2, 70), w - 70), top: Math.max(30, yOf(hb.total) - 6) }}>
          <div className="faint">{hb.label}</div>
          <div className="num">{money(hb.total)}</div>
        </div>
      )}
    </div>
  );
}

function roundedTop(x: number, base: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  r = Math.min(r, h);
  const top = base - h;
  return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${base} Z`;
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * p;
}

/* ───────── Budget gauge (240° arc) ───────── */
export function Gauge({ pct, size = 220, children }: { pct: number; size?: number; children?: ReactNode }) {
  const reduce = useReducedMotion();
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const sweep = 240;
  const startA = 150; // degrees, measured clockwise from +x
  const arc = (frac: number) => {
    const a0 = (startA * Math.PI) / 180;
    const a1 = ((startA + sweep * frac) * Math.PI) / 180;
    const large = sweep * frac > 180 ? 1 : 0;
    return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
  };
  const clamped = Math.max(0, Math.min(1, pct));
  const color = pct >= 1 ? 'var(--danger)' : pct >= 0.85 ? 'var(--warn)' : 'var(--accent)';
  const h = size * 0.82;
  return (
    <div style={{ position: 'relative', width: size, height: h, margin: '0 auto' }}>
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
        <path d={arc(1)} fill="none" stroke="var(--fill-2)" strokeWidth={stroke} strokeLinecap="round" />
        {clamped > 0.001 && (
          <motion.path
            d={arc(1)}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={reduce ? false : ({ pathLength: 0 } as never)}
            animate={{ pathLength: clamped } as never}
            transition={{ type: 'spring', bounce: 0, duration: 1 }}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', paddingTop: size * 0.06 }}>{children}</div>
    </div>
  );
}

/* ───────── Ring (small progress) ───────── */
export function Ring({ pct, size = 40, color }: { pct: number; size?: number; color?: string }) {
  const s = 4;
  const r = (size - s) / 2;
  const c = pct >= 1 ? 'var(--danger)' : pct >= 0.85 ? 'var(--warn)' : color || 'var(--accent)';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-2)" strokeWidth={s} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" initial={{ pathLength: 0 } as never} animate={{ pathLength: Math.min(1, pct) } as never} transition={{ type: 'spring', bounce: 0, duration: 0.8 }} />
    </svg>
  );
}

/* ───────── Sparkline ───────── */
export function Sparkline({ values, height = 44 }: { values: number[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * w : 0, height - 3 - (v / max) * (height - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <div ref={ref} style={{ height }}>
      {w > 0 && values.length > 1 && (
        <svg width={w} height={height}>
          <defs>
            <linearGradient id="spk" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L${w},${height} L0,${height} Z`} fill="url(#spk)" />
          <motion.path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 } as never} animate={{ pathLength: 1 } as never} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
        </svg>
      )}
    </div>
  );
}
