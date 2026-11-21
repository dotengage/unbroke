import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Camera, Check, Clock, Delete, ExternalLink, Loader2, Repeat, StickyNote, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Frequency, Txn } from '../types';
import { receiptThumb } from '../lib/api';
import { fmtFull, nowTime, todayKey } from '../lib/dates';
import { currencySymbol, evalAmount, money, uid } from '../lib/format';
import { closeAdd, openAdd, pref, setPref, useData, useUI } from '../lib/hooks';
import { describeFrequency } from '../lib/schedule';
import { mutate, toast, uploadReceipt } from '../lib/store';
import { Icon, IconTile } from './Icon';
import { Sheet, spring } from './ui';

const coarse = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** Deletes an expense with an Undo toast. Shared by the header trash button and the form. */
function deleteTxn(t: Txn) {
  mutate([{ op: 'delete', table: 'Transactions', id: t.id }]);
  closeAdd();
  toast('Expense deleted', { action: { label: 'Undo', run: () => mutate([{ op: 'upsert', table: 'Transactions', row: t as unknown as Record<string, unknown> }]) } });
}

export function AddExpenseSheet() {
  const { add } = useUI();
  const edit = add.edit;
  return (
    <Sheet
      open={add.open}
      onClose={closeAdd}
      title={edit ? 'Edit expense' : 'New expense'}
      right={
        edit ? (
          <button className="icon-btn" onClick={() => deleteTxn(edit)} aria-label="Delete expense" title="Delete" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Trash2 size={17} />
          </button>
        ) : undefined
      }
    >
      {add.open && <AddExpenseForm key={add.edit?.id || 'new'} edit={add.edit} />}
    </Sheet>
  );
}

function AddExpenseForm({ edit }: { edit?: Txn }) {
  const { add } = useUI();
  const pre = add.prefill || {};
  const { activeCategories, activeAccounts, defaultAccount } = useData();
  const [expr, setExpr] = useState(edit ? String(edit.amount) : pre.amount ? String(pre.amount) : '');
  const [category, setCategory] = useState(edit?.category || pre.category || pref<string>('lastCategory', '') || activeCategories[0]?.name || 'Others');
  const [account, setAccount] = useState(edit?.account || pre.account || defaultAccount);
  const [date, setDate] = useState(edit?.date || pre.date || todayKey());
  const [time, setTime] = useState(edit?.time || pre.time || nowTime());
  const [note, setNote] = useState(edit?.note || pre.note || '');
  const [receipt, setReceipt] = useState(edit?.receipt || '');
  const [uploading, setUploading] = useState(false);
  const [repeat, setRepeat] = useState<Frequency | 'never'>('never');
  const [allCats, setAllCats] = useState(false);
  const [useKeypad] = useState(coarse);
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = useMemo(() => evalAmount(expr), [expr]);
  const isExpr = /[+\-*/×÷]/.test(expr.slice(1));
  const future = date > todayKey();
  const willSchedule = !edit && (repeat !== 'never' || future);
  const valid = amount > 0 && !!category && !uploading;

  useEffect(() => {
    if (!useKeypad) setTimeout(() => amountRef.current?.focus(), 250);
  }, [useKeypad]);

  // keep the selected category visible in the collapsed grid
  const visibleCats = useMemo(() => {
    if (allCats || activeCategories.length <= 8) return activeCategories;
    const first = activeCategories.slice(0, 7);
    if (!first.find((c) => c.name === category)) {
      const sel = activeCategories.find((c) => c.name === category);
      if (sel) first[6] = sel;
    }
    return first;
  }, [allCats, activeCategories, category]);

  const press = (k: string) => {
    if (navigator.vibrate) navigator.vibrate(4);
    setExpr((e) => {
      if (k === 'del') return e.slice(0, -1);
      if (k === 'C') return '';
      if ('+-×÷'.includes(k)) {
        if (!e) return e;
        return /[+\-×÷]$/.test(e) ? e.slice(0, -1) + k : e + k;
      }
      if (k === '.') {
        const last = e.split(/[+\-×÷]/).pop() || '';
        if (last.includes('.')) return e;
        return e + (last === '' ? '0.' : '.');
      }
      const last = e.split(/[+\-×÷]/).pop() || '';
      if (last.includes('.') && last.split('.')[1].length >= 2) return e;
      if (e.length > 18) return e;
      return last === '0' ? e.slice(0, -1) + k : e + k;
    });
  };

  const onFile = async (f?: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadReceipt(f);
      setReceipt(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', { tone: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!valid) return;
    setPref('lastCategory', category);
    const now = new Date().toISOString();
    if (willSchedule) {
      const freq: Frequency = repeat === 'never' ? 'once' : repeat;
      const s = {
        id: uid(), title: note || category, amount, category, account, note: '',
        frequency: freq, interval: 1, startDate: date, endDate: '', maxRuns: null, runs: 0, nextDate: date, active: true, lastRun: '', created: now,
      };
      mutate([{ op: 'upsert', table: 'Scheduled', row: s }]);
      toast(date <= todayKey() ? `Recurring set up · first ${money(amount)} recorded` : `Scheduled ${money(amount)} for ${fmtFull(date)}`);
      closeAdd();
      return;
    }
    const row: Txn = {
      id: edit?.id || uid(), date, time, amount, category, account, note: note.trim(), receipt,
      source: edit?.source || '', created: edit?.created || now, updated: now,
    };
    mutate([{ op: 'upsert', table: 'Transactions', row: row as unknown as Record<string, unknown> }]);
    closeAdd();
    if (edit) toast('Expense updated');
    else
      toast(`Added ${money(amount)} · ${category}`, {
        action: { label: 'Undo', run: () => mutate([{ op: 'delete', table: 'Transactions', id: row.id }]) },
      });
  };

  const del = () => edit && deleteTxn(edit);

  const editActions = edit ? (
    <div className="row" style={{ marginTop: 10, gap: 8 }}>
      <button className="btn danger" style={{ flex: 1 }} onClick={() => del()}>
        <Trash2 size={16} /> Delete
      </button>
      <button className="btn" style={{ flex: 1 }} onClick={() => duplicate()}>
        Duplicate
      </button>
    </div>
  ) : null;

  const duplicate = () => {
    if (!edit) return;
    closeAdd();
    setTimeout(() => openAdd({ amount: edit.amount, category: edit.category, account: edit.account, note: edit.note }), 320);
  };

  return (
    <div onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && save()}>
      {/* Amount */}
      <div className={`amount-display ${useKeypad ? 'sticky' : ''}`}>
        {useKeypad ? (
          <div className="val num" aria-live="polite">
            <span className="cur">{currencySymbol()}</span>
            {expr || '0'}
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'center', gap: 2 }}>
            <span className="faint" style={{ font: '600 40px var(--font-display)' }}>{currencySymbol()}</span>
            <input
              ref={amountRef}
              className="amount-input num"
              style={{ width: `${Math.max(2, expr.length + 1)}ch`, maxWidth: '100%' }}
              inputMode="decimal"
              placeholder="0"
              value={expr}
              onChange={(e) => setExpr(e.target.value.replace(/[^0-9.+\-*/×÷() ]/g, ''))}
              aria-label="Amount"
            />
          </div>
        )}
        <div className="expr num">{isExpr && !isNaN(amount) ? `= ${money(amount, { decimals: true })}` : useKeypad ? '' : 'Tip: you can type 120+45'}</div>
      </div>

      {/* Category */}
      <div className="row between" style={{ margin: '10px 2px 6px' }}>
        <span className="small faint" style={{ fontWeight: 600 }}>Category</span>
        {activeCategories.length > 8 && (
          <button className="small" style={{ color: 'var(--accent-ink)', fontWeight: 600 }} onClick={() => setAllCats((v) => !v)}>
            {allCats ? 'Less' : `All ${activeCategories.length}`}
          </button>
        )}
      </div>
      <motion.div layout className="cat-grid" transition={spring}>
        {visibleCats.map((c) => (
          <motion.button layout="position" key={c.id || c.name} className={`cat-cell ${category === c.name ? 'on' : ''}`} onClick={() => setCategory(c.name)} style={{ color: category === c.name ? c.color : undefined }}>
            <IconTile icon={c.icon} color={c.color} />
            <span style={{ color: 'var(--text)' }}>{c.name}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Account */}
      {activeAccounts.length > 0 && (
        <>
          <div className="small faint" style={{ fontWeight: 600, margin: '14px 2px 8px' }}>Paid from</div>
          <div className="chips">
            {activeAccounts.map((a) => (
              <button key={a.id || a.name} className={`chip ${account === a.name ? 'on' : ''}`} onClick={() => setAccount(a.name)}>
                <Icon name={a.icon || 'wallet'} size={14} /> {a.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Details */}
      <div style={{ marginTop: 14 }}>
        <div className="opt-row">
          <Calendar size={18} className="faint" />
          <label className="row" style={{ flex: 1, gap: 6 }}>
            <input type="date" className="input" style={{ height: 38 }} value={date} onChange={(e) => setDate(e.target.value || todayKey())} aria-label="Date" />
          </label>
          {!willSchedule && (
            <label className="row" style={{ gap: 6 }}>
              <Clock size={18} className="faint" />
              <input type="time" className="input" style={{ height: 38, width: 120 }} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
            </label>
          )}
        </div>
        <div className="opt-row">
          <StickyNote size={18} className="faint" />
          <input className="input" style={{ height: 38 }} placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {!edit && (
          <div className="opt-row">
            <Repeat size={18} className="faint" />
            <div style={{ flex: 1 }}>
              <select className="input" style={{ height: 38 }} value={repeat} onChange={(e) => setRepeat(e.target.value as Frequency | 'never')} aria-label="Repeat">
                <option value="never">Doesn&rsquo;t repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </div>
          </div>
        )}
        <AnimatePresence>
          {willSchedule && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
              <div className="small" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '10px 12px', borderRadius: 12, margin: '4px 0 6px', fontWeight: 550 }}>
                {repeat === 'never'
                  ? `This will be recorded automatically on ${fmtFull(date)}, even if the app is closed.`
                  : `${describeFrequency({ frequency: repeat, interval: 1, startDate: date })}, recorded automatically starting ${fmtFull(date)}.`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!willSchedule && (
          <div className="opt-row">
            <Camera size={18} className="faint" />
            <div style={{ flex: 1 }} className="row">
              {receipt ? (
                <>
                  <a href={receipt.startsWith('data:') ? undefined : receipt} target="_blank" rel="noreferrer">
                    <img className="receipt-thumb" src={receiptThumb(receipt, 200)} alt="Receipt" />
                  </a>
                  {!receipt.startsWith('data:') && (
                    <a className="btn sm" href={receipt} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Open
                    </a>
                  )}
                  <button className="icon-btn" onClick={() => setReceipt('')} aria-label="Remove receipt">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 size={14} className="spin" /> : null}
                  {uploading ? 'Uploading…' : 'Attach receipt'}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </div>
        )}
      </div>

      {edit?.source.startsWith('scheduled') && <div className="tiny faint" style={{ margin: '6px 2px' }}>Recorded automatically from a scheduled expense.</div>}

      {/* on phones the keypad is pinned to the bottom, so the actions go above it */}
      {useKeypad && editActions}

      {/* Keypad (touch) */}
      {useKeypad ? (
        <div className="keypad">
          {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '.', '0', 'del', '+'].map((k) => (
            <button key={k} className={`key ${'+-×÷'.includes(k) ? 'op' : ''}`} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k}>
              {k === 'del' ? <Delete size={20} /> : k === '-' ? '−' : k}
            </button>
          ))}
          <button className="key go" style={{ gridColumn: '1 / -1' }} onClick={save} disabled={!valid}>
            <span className="row" style={{ gap: 8, opacity: valid ? 1 : 0.5 }}>
              <Check size={18} /> {willSchedule ? 'Schedule' : edit ? 'Save changes' : `Save ${amount > 0 ? money(amount) : ''}`}
            </span>
          </button>
        </div>
      ) : (
        <button className="btn primary block" style={{ marginTop: 16, height: 50 }} onClick={save} disabled={!valid}>
          <Check size={18} /> {willSchedule ? 'Schedule' : edit ? 'Save changes' : `Save ${amount > 0 ? money(amount) : 'expense'}`}
        </button>
      )}

      {/* on desktop the actions sit under Save */}
      {!useKeypad && editActions}
    </div>
  );
}
