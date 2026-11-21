import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { money } from '../lib/format';
import { dismissToast, useStore } from '../lib/store';

export const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 };
export const springSheet = { type: 'spring' as const, bounce: 0.12, duration: 0.42 };

/* ───────── Segmented control with a sliding thumb ───────── */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="thumb" transition={spring} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── Animated money number ───────── */
export function AnimatedMoney({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || prev.current === value) {
      el.textContent = money(value);
      prev.current = value;
      return;
    }
    const c = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = money(Math.round(v))),
      onComplete: () => (el.textContent = money(value)),
    });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]);
  return (
    <span ref={ref} className={`num ${className || ''}`}>
      {money(value)}
    </span>
  );
}

/* ───────── Bottom sheet (phone) / centered dialog (desktop) ───────── */
const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 700px)').matches;

export function Sheet({ open, onClose, title, children, left, right, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; left?: ReactNode; right?: ReactNode; wide?: boolean }) {
  const controls = useDragControls();
  const y = useMotionValue(0);
  const [desktop, setDesktop] = useState(isWide);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 700px)');
    const f = () => setDesktop(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // project momentum: a flick down closes even from a short drag
    const projected = info.offset.y + (info.velocity.y / 1000) * (0.998 / (1 - 0.998));
    if (projected > 220 || info.velocity.y > 800) onClose();
    else animate(y, 0, { ...springSheet, velocity: info.velocity.y });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' } as never} transition={{ duration: 0.25 }} />
          <motion.div
            className={`sheet ${wide ? 'wide' : ''}`}
            role="dialog"
            aria-modal="true"
            style={desktop ? { x: '-50%', y: '-50%' } : { y }}
            initial={desktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={(desktop ? { opacity: 0, scale: 0.96, pointerEvents: 'none' } : { y: '100%', pointerEvents: 'none' }) as never}
            transition={desktop ? { type: 'spring', bounce: 0, duration: 0.3 } : springSheet}
            drag={desktop ? false : 'y'}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={onDragEnd}
          >
            <div onPointerDown={(e) => !desktop && controls.start(e)} style={{ touchAction: 'none', cursor: desktop ? 'auto' : 'grab' }}>
              <div className="grabber" />
              <div className="sheet-head">
                <div style={{ width: 38 }}>{left ?? <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>}</div>
                <h3>{title}</h3>
                <div style={{ minWidth: 38, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
              </div>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ───────── Toast ───────── */
export function ToastHost() {
  const t = useStore((s) => s.toast);
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {t && (
          <motion.div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={spring}>
            <span>{t.text}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run();
                  dismissToast();
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <b>{title}</b>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const ch = ((now - before) / before) * 100;
  const cls = Math.abs(ch) < 1 ? 'flat' : ch > 0 ? 'up' : 'down';
  return (
    <span className={`delta ${cls}`} title="Compared with the previous period">
      {ch > 0 ? '↑' : ch < 0 ? '↓' : ''} {Math.abs(Math.round(ch))}%
    </span>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

/** Fade + rise on mount, used for page sections. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay }}>
      {children}
    </motion.div>
  );
}

/** App mark. The dark tile is used everywhere in the app; only the phone home-screen icon is white. */
export function Logo({ size, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return <img src="./icon.svg" alt="" width={size} height={size} className={className} style={style} />;
}
