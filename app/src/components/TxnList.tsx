import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, Repeat } from 'lucide-react';
import { useMemo } from 'react';
import type { Txn } from '../types';
import { sortTxns } from '../lib/analytics';
import { fmtTime, fmtWeekday, relativeDay } from '../lib/dates';
import { money } from '../lib/format';
import { openEdit, useData } from '../lib/hooks';
import { Icon, IconTile } from './Icon';
import { spring } from './ui';

export function TxnRow({ t, showDate = true }: { t: Txn; showDate?: boolean }) {
  const { cat, acc, accIcon } = useData();
  const c = cat(t.category);
  const a = acc(t.account);
  return (
    <button className="list-row" onClick={() => openEdit(t)}>
      <IconTile icon={c.icon} color={c.color} />
      <div className="main-col">
        <div className="title">{t.note || c.name}</div>
        <div className="meta">
          {t.note ? <span>{c.name}</span> : null}
          {t.note && t.account ? <span>·</span> : null}
          {t.account && (
            <span className="row" style={{ gap: 4 }}>
              <Icon name={accIcon(a)} size={12} /> {a.name}
            </span>
          )}
          {t.source.startsWith('scheduled') && <Repeat size={12} aria-label="Recurring" />}
          {t.receipt && <Paperclip size={12} aria-label="Has receipt" />}
        </div>
      </div>
      <div className="amt num">
        {money(t.amount)}
        <span className="sub">{showDate ? relativeDay(t.date) : fmtTime(t.time)}</span>
      </div>
    </button>
  );
}

/** Flat list (used for "Recent"). */
export function TxnList({ txns, showDate = true }: { txns: Txn[]; showDate?: boolean }) {
  return (
    <div className="card flush list">
      <AnimatePresence initial={false}>
        {txns.map((t) => (
          <motion.div key={t.id} layout="position" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
            <TxnRow t={t} showDate={showDate} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Day-grouped list with day totals. */
export function DayGroups({ txns, limit, presorted }: { txns: Txn[]; limit?: number; presorted?: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<string, Txn[]>();
    for (const t of presorted ? txns : sortTxns(txns)) {
      const arr = m.get(t.date) || [];
      arr.push(t);
      m.set(t.date, arr);
    }
    const all = [...m.entries()];
    return limit ? all.slice(0, limit) : all;
  }, [txns, limit, presorted]);
  return (
    <div>
      {groups.map(([date, list]) => (
        <section key={date}>
          <div className="day-head">
            <span>
              {relativeDay(date)} <span className="faint" style={{ fontWeight: 500 }}>· {fmtWeekday(date)}</span>
            </span>
            <span className="num">{money(list.reduce((a, t) => a + t.amount, 0))}</span>
          </div>
          <div className="card flush list">
            {list.map((t) => (
              <TxnRow key={t.id} t={t} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
