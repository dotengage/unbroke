import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Account, Category, Op } from '../types';
import { uid } from '../lib/format';
import { useData } from '../lib/hooks';
import { mutate, toast } from '../lib/store';
import { ACCOUNT_TYPE_ICON, Icon, IconTile, PALETTE, PICKABLE_ICONS, suggestAccountType, suggestIcon } from './Icon';
import { Sheet, spring, Switch } from './ui';

type Kind = 'category' | 'account';
const TYPES = [
  ['cash', 'Cash'], ['bank', 'Bank'], ['card', 'Credit card'], ['upi', 'UPI'], ['wallet', 'Wallet'], ['other', 'Other'],
] as const;

export function EntityEditor({ kind, open, item, onClose, existing, usage }: {
  kind: Kind;
  open: boolean;
  item?: Category | Account | null;
  onClose: () => void;
  existing: string[];
  usage: number;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={item ? `Edit ${kind}` : `New ${kind}`}>
      {open && <Form key={item?.id || 'new'} kind={kind} item={item || undefined} onClose={onClose} existing={existing} usage={usage} />}
    </Sheet>
  );
}

function Form({ kind, item, onClose, existing, usage }: { kind: Kind; item?: Category | Account; onClose: () => void; existing: string[]; usage: number }) {
  const table = kind === 'category' ? 'Categories' : 'Accounts';
  const { budgets, scheduled, defaultAccount } = useData();
  const wasDefault = kind === 'account' && !!item && item.name === defaultAccount;
  const [isDefault, setIsDefault] = useState(wasDefault);
  const [name, setName] = useState(item?.name || '');
  const [type, setType] = useState<string>((item as Account | undefined)?.type || 'bank');
  const [typeTouched, setTypeTouched] = useState(!!item);
  const [icon, setIcon] = useState(item?.icon || (kind === 'account' ? ACCOUNT_TYPE_ICON.bank : 'tag'));
  const [iconTouched, setIconTouched] = useState(!!item);
  const [color, setColor] = useState(item?.color || PALETTE[existing.length % 8]);
  const [confirmDel, setConfirmDel] = useState(false);
  const others = existing.filter((e) => e.toLowerCase() !== (item?.name || '').toLowerCase());
  const [moveTo, setMoveTo] = useState(kind === 'category' ? others.find((o) => o.toLowerCase() === 'others') || others[0] || '' : '');

  const trimmed = name.trim();
  const dup = existing.some((e) => e.toLowerCase() === trimmed.toLowerCase() && e.toLowerCase() !== (item?.name || '').toLowerCase());
  const valid = trimmed.length > 0 && !dup;
  const suggestion = suggestIcon(trimmed);

  const onName = (v: string) => {
    setName(v);
    // follow the name with a suggested icon/type until the user picks one themselves
    if (kind === 'account' && !typeTouched) {
      const t = suggestAccountType(v);
      if (t) {
        setType(t);
        if (!iconTouched) setIcon(ACCOUNT_TYPE_ICON[t]);
      }
    }
    if (!iconTouched) {
      const s = suggestIcon(v);
      if (s && (kind === 'category' || !suggestAccountType(v))) setIcon(s);
    }
  };

  const save = () => {
    if (!valid) return;
    const ops: Op[] = [];
    if (item && item.name !== trimmed) ops.push({ op: 'rename', table, from: item.name, to: trimmed });
    const row: Record<string, unknown> = { id: item?.id || uid(), name: trimmed, icon, color, order: item?.order ?? existing.length, archived: item?.archived ?? false };
    if (kind === 'account') row.type = type;
    ops.push({ op: 'upsert', table, row });
    // keep the default pointing at this account through renames, and honour the switch
    if (kind === 'account' && (isDefault ? !wasDefault || item?.name !== trimmed : wasDefault))
      ops.push({ op: 'upsert', table: 'Settings', row: { key: 'defaultAccount', value: isDefault ? trimmed : '' } });
    mutate(ops);
    toast(item ? `${trimmed} updated` : `${trimmed} added`);
    onClose();
  };

  const linkedBudgets = kind === 'category' && item ? budgets.filter((b) => b.category === item.name) : [];
  const linkedSchedules = item ? scheduled.filter((s) => (kind === 'category' ? s.category : s.account) === item.name).length : 0;

  // categories that already hold expenses (or feed a schedule) can only be hidden
  const categoryLocked = kind === 'category' && (usage > 0 || linkedSchedules > 0);

  const doDelete = () => {
    if (!item) return;
    const ops: Op[] = [];
    if (usage > 0 || linkedSchedules > 0) ops.push({ op: 'rename', table, from: item.name, to: moveTo });
    // a budget for a deleted category no longer means anything
    linkedBudgets.forEach((b) => ops.push({ op: 'delete', table: 'Budgets', id: b.id }));
    ops.push({ op: 'delete', table, id: item.id });
    if (wasDefault) ops.push({ op: 'upsert', table: 'Settings', row: { key: 'defaultAccount', value: moveTo } });
    mutate(ops);
    toast(usage > 0 ? `${item.name} deleted · ${usage} expense${usage === 1 ? '' : 's'} moved to ${moveTo || 'no account'}` : `${item.name} deleted`);
    onClose();
  };

  const toggleHidden = () => {
    if (!item) return;
    mutate([{ op: 'upsert', table, row: { id: item.id, archived: !item.archived } }]);
    toast(item.archived ? `${item.name} is visible again` : `${item.name} hidden. Past expenses keep it.`);
    onClose();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
        <motion.div key={icon + color} initial={{ scale: 0.85, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}>
          <IconTile icon={icon} color={color} size="lg" />
        </motion.div>
      </div>
      <label className="field">
        <span>Name</span>
        <input className="input" autoFocus value={name} onChange={(e) => onName(e.target.value)} placeholder={kind === 'category' ? 'e.g. Coffee' : 'e.g. HDFC Savings'} onKeyDown={(e) => e.key === 'Enter' && save()} />
        {dup && <span style={{ color: 'var(--danger)' }}>That name is already used.</span>}
        {item && trimmed && item.name !== trimmed && usage > 0 && <span>Renaming updates {usage} past expense{usage === 1 ? '' : 's'} in your sheet too.</span>}
      </label>
      {kind === 'account' && (
        <div className="field">
          <span>Type</span>
          <div className="chips wrap">
            {TYPES.map(([v, l]) => (
              <button
                key={v}
                className={`chip ${type === v ? 'on' : ''}`}
                onClick={() => {
                  setType(v);
                  setTypeTouched(true);
                  if (!iconTouched) setIcon(ACCOUNT_TYPE_ICON[v]);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <span>Color</span>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {PALETTE.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} style={{ width: 32, height: 32, borderRadius: '50%', background: c, display: 'grid', placeItems: 'center', color: '#fff', boxShadow: color === c ? `0 0 0 2px var(--bg-elev), 0 0 0 4px ${c}` : 'none' }}>
              {color === c && <Check size={16} />}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="row" style={{ justifyContent: 'space-between' }}>
          Icon
          {suggestion && suggestion !== icon && (
            <button
              className="row tiny"
              style={{ gap: 4, color: 'var(--accent-ink)', fontWeight: 650 }}
              onClick={() => {
                setIcon(suggestion);
                setIconTouched(true);
              }}
            >
              <Sparkles size={12} /> Use suggested <Icon name={suggestion} size={14} />
            </button>
          )}
          {suggestion && suggestion === icon && !iconTouched && (
            <span className="row tiny" style={{ gap: 4, color: 'var(--accent-ink)', fontWeight: 650 }}>
              <Sparkles size={12} /> Suggested from the name
            </span>
          )}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 6 }}>
          {PICKABLE_ICONS.map((k) => (
            <button
              key={k}
              onClick={() => {
                setIcon(k);
                setIconTouched(true);
              }}
              aria-label={k}
              style={{ height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: icon === k ? color : 'var(--fill-2)', color: icon === k ? '#fff' : 'var(--text-2)', transition: 'background .15s', position: 'relative' }}
            >
              <Icon name={k} size={19} />
              {k === suggestion && icon !== k && <i style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, background: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      </div>
      {kind === 'account' && (
        <div className="row between">
          <div>
            <div style={{ fontWeight: 600 }}>Default account</div>
            <div className="tiny faint">Used for new expenses unless you pick another</div>
          </div>
          <Switch on={isDefault} onChange={setIsDefault} label="Default account" />
        </div>
      )}
      <button className="btn primary block" style={{ height: 50 }} disabled={!valid} onClick={save}>
        {item ? 'Save' : `Add ${kind}`}
      </button>

      {item && (
        <>
          <AnimatePresence initial={false} mode="popLayout">
            {confirmDel ? (
              <motion.div key="confirm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
                <div className="stack" style={{ gap: 12, background: 'var(--danger-soft)', borderRadius: 16, padding: 14 }}>
                  <div style={{ fontWeight: 650 }}>Delete “{item.name}”?</div>
                  {usage > 0 || linkedSchedules > 0 ? (
                    <label className="field">
                      <span style={{ color: 'var(--text-2)' }}>
                        {[usage > 0 && `${usage} expense${usage === 1 ? '' : 's'}`, linkedSchedules > 0 && `${linkedSchedules} scheduled`].filter(Boolean).join(' and ')} use{usage + linkedSchedules === 1 ? 's' : ''} it. Move them to:
                      </span>
                      <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                        {kind === 'account' && <option value="">No account</option>}
                        {others.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="small muted">Nothing uses it yet.</div>
                  )}
                  {linkedBudgets.length > 0 && <div className="small muted">Its budget{linkedBudgets.length > 1 ? 's' : ''} ({linkedBudgets.map((b) => b.name).join(', ')}) will be removed too.</div>}
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" style={{ flex: 1 }} onClick={() => setConfirmDel(false)}>Cancel</button>
                    <button className="btn" style={{ flex: 1, background: 'var(--danger)', color: '#fff' }} onClick={doDelete} disabled={kind === 'category' && (usage > 0 || linkedSchedules > 0) && !moveTo}>
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="actions" className="row" style={{ gap: 8 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button className="btn" style={{ flex: 1 }} onClick={toggleHidden}>{item.archived ? 'Show again' : 'Hide'}</button>
                <button className="btn danger" style={{ flex: 1 }} onClick={() => setConfirmDel(true)} disabled={categoryLocked}>
                  <Trash2 size={15} /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {!confirmDel && (
            <div className="tiny faint" style={{ marginTop: -8, textAlign: 'center' }}>
              {categoryLocked
                ? usage > 0
                  ? `Has ${usage} expense${usage === 1 ? '' : 's'}, so it can’t be deleted. Hide it to remove it from the picker.`
                  : `Used by ${linkedSchedules} scheduled expense${linkedSchedules === 1 ? '' : 's'}. Change those first to delete it.`
                : kind === 'category'
                  ? 'Hide keeps it for past records. Delete removes it for good.'
                  : 'Hide keeps past expenses as they are. Delete moves them to another account.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
