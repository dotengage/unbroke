import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Txn } from '../types';
import { fmtTime, nowTime, relativeDay, todayKey } from '../lib/dates';
import { money, uid } from '../lib/format';
import { openAdd, useData } from '../lib/hooks';
import { parseQuick } from '../lib/quickadd';
import { mutate, toast } from '../lib/store';
import { spring } from './ui';

export function QuickAdd() {
  const { activeCategories, activeAccounts, defaultAccount } = useData();
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseQuick(text, activeCategories, activeAccounts) : null), [text, activeCategories, activeAccounts]);

  const submit = () => {
    if (!parsed) return;
    const category = parsed.category || 'Others';
    const account = parsed.account || defaultAccount;
    if (!parsed.amount) {
      openAdd({ note: parsed.note, category: parsed.category || undefined, account: parsed.account || undefined, date: parsed.date, time: parsed.time || undefined });
      setText('');
      return;
    }
    const now = new Date().toISOString();
    const row: Txn = { id: uid(), date: parsed.date, time: parsed.time || (parsed.date === todayKey() ? nowTime() : '12:00'), amount: parsed.amount, category, account, note: parsed.note, receipt: '', source: 'quick', created: now, updated: now };
    mutate([{ op: 'upsert', table: 'Transactions', row: row as unknown as Record<string, unknown> }]);
    setText('');
    toast(`Added ${money(row.amount)} · ${category}`, { action: { label: 'Undo', run: () => mutate([{ op: 'delete', table: 'Transactions', id: row.id }]) } });
  };

  return (
    <div>
      <form
        className="quick"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Sparkles size={18} className="faint" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Quick add: “Swiggy 340 upi 9pm note team dinner”" aria-label="Quick add expense" enterKeyHint="done" />
        <AnimatePresence>
          {text && (
            <motion.button type="submit" className="icon-btn" style={{ background: 'var(--text)', color: 'var(--ink-inverse)', width: 34, height: 34 }} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={spring} aria-label="Add">
              <ArrowUp size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </form>
      <AnimatePresence>
        {parsed && (
          <motion.div className="parse-chips" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
            <span className={parsed.amount ? 'ok' : ''}>{parsed.amount ? money(parsed.amount) : 'No amount yet'}</span>
            <span className={parsed.category ? 'ok' : ''}>{parsed.category || 'Others'}</span>
            {parsed.account && <span className="ok">{parsed.account}</span>}
            {(parsed.dateFound || parsed.date !== todayKey()) && <span className="ok">{relativeDay(parsed.date)}</span>}
            {parsed.time && <span className="ok">{fmtTime(parsed.time)}</span>}
            {parsed.note && <span className={parsed.explicitNote ? 'ok' : ''}>{parsed.explicitNote ? 'Note: ' : ''}“{parsed.note}”</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
