import { ChevronRight, Plus, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Account } from '../types';
import { EntityEditor } from '../components/EntityEditor';
import { IconTile } from '../components/Icon';
import { AnimatedMoney, Empty, Reveal } from '../components/ui';
import { endOfMonth, startOfMonth, todayKey } from '../lib/dates';
import { money } from '../lib/format';
import { go, useData } from '../lib/hooks';
import { setSetting, toast } from '../lib/store';
import { Icon } from '../components/Icon';

const TYPE_LABEL: Record<string, string> = { cash: 'Cash', bank: 'Bank accounts', card: 'Credit cards', upi: 'UPI', wallet: 'Wallets', other: 'Other' };

export function Accounts() {
  const { accounts, activeAccounts, defaultAccount, txns, accIcon } = useData();
  const [editing, setEditing] = useState<Account | null | undefined>(undefined);
  const t = todayKey();
  const ms = startOfMonth(t);
  const me = endOfMonth(t);

  const usage = useMemo(() => {
    const m = new Map<string, { month: number; all: number; count: number }>();
    for (const x of txns) {
      const k = (x.account || '').toLowerCase();
      const u = m.get(k) || { month: 0, all: 0, count: 0 };
      u.all += x.amount;
      u.count++;
      if (x.date >= ms && x.date <= me) u.month += x.amount;
      m.set(k, u);
    }
    return m;
  }, [txns, ms, me]);

  const monthTotal = txns.filter((x) => x.date >= ms && x.date <= me).reduce((a, x) => a + x.amount, 0);
  const grouped = useMemo(() => {
    const g = new Map<string, Account[]>();
    for (const a of accounts) {
      const k = a.type in TYPE_LABEL ? a.type : 'other';
      g.set(k, [...(g.get(k) || []), a]);
    }
    return Object.keys(TYPE_LABEL).filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const);
  }, [accounts]);

  return (
    <div className="page">
      <header className="header">
        <h1 className="large-title grow">Accounts</h1>
        <button className="btn sm" onClick={() => setEditing(null)}>
          <Plus size={16} /> Add account
        </button>
      </header>
      <p className="small muted" style={{ margin: '0 2px 14px' }}>Where your money is spent from. Add as many as you like: cash, each bank, cards, UPI.</p>

      <Reveal>
        <div className="card">
          <span className="card-label">Spent this month · all accounts</span>
          <div><AnimatedMoney value={monthTotal} className="hero-amount" /></div>
          {monthTotal > 0 && (
            <div className="row" style={{ gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10 }}>
              {accounts
                .map((a) => ({ a, v: usage.get(a.name.toLowerCase())?.month || 0 }))
                .filter((x) => x.v > 0)
                .sort((x, y) => y.v - x.v)
                .map(({ a, v }) => (
                  <span key={a.id} title={`${a.name}: ${money(v)}`} style={{ flex: v, background: a.color || '#8e8e93', height: '100%' }} />
                ))}
            </div>
          )}
        </div>
      </Reveal>

      {activeAccounts.length > 1 && (
        <Reveal delay={0.02}>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="card-label">Default account</span>
              <span className="tiny faint">Used unless you choose another</span>
            </div>
            <div className="chips wrap">
              {activeAccounts.map((a) => (
                <button
                  key={a.id}
                  className={`chip ${defaultAccount === a.name ? 'on' : ''}`}
                  onClick={() => {
                    if (defaultAccount === a.name) return;
                    setSetting('defaultAccount', a.name);
                    toast(`${a.name} is now your default account`);
                  }}
                >
                  <Icon name={accIcon(a)} size={14} /> {a.name}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {accounts.length === 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <Empty icon={<Wallet size={28} />} title="No accounts yet">Add Cash, a bank or a card to track where money goes out from.</Empty>
        </div>
      )}

      {grouped.map(([type, list], gi) => (
        <Reveal key={type} delay={0.03 * (gi + 1)}>
          <div className="section-title">
            <h2>{TYPE_LABEL[type]}</h2>
          </div>
          <div className="card flush list">
            {list.map((a) => {
              const u = usage.get(a.name.toLowerCase());
              return (
                <div key={a.id} className="row" style={{ gap: 0 }}>
                  <button className="list-row" style={{ opacity: a.archived ? 0.5 : 1 }} onClick={() => go('transactions', { view: 'custom', acc: a.name, from: ms, to: me })}>
                    <IconTile icon={accIcon(a)} color={a.color} />
                    <div className="main-col">
                      <div className="title row" style={{ gap: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}{a.archived ? ' (hidden)' : ''}</span>
                        {a.name === defaultAccount && <span className="tiny" style={{ fontWeight: 650, color: 'var(--accent-ink)', background: 'var(--accent-soft)', padding: '1px 7px', borderRadius: 999 }}>Default</span>}
                      </div>
                      <div className="meta">{u?.count || 0} expenses all time</div>
                    </div>
                    <div className="amt num">
                      {money(u?.month || 0)}
                      <span className="sub">this month</span>
                    </div>
                  </button>
                  <button className="icon-btn plain" style={{ marginRight: 8 }} onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                    <ChevronRight size={18} className="faint" />
                  </button>
                </div>
              );
            })}
          </div>
        </Reveal>
      ))}

      <EntityEditor
        kind="account"
        open={editing !== undefined}
        item={editing}
        onClose={() => setEditing(undefined)}
        existing={accounts.map((a) => a.name)}
        usage={editing ? usage.get(editing.name.toLowerCase())?.count || 0 : 0}
      />
    </div>
  );
}
