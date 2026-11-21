import { motion } from 'framer-motion';
import { ChevronLeft, PiggyBank, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Budget, BudgetPeriod } from '../types';
import { Gauge } from '../components/Charts';
import { IconTile } from '../components/Icon';
import { AnimatedMoney, Empty, Reveal, Segmented, Sheet, spring } from '../components/ui';
import { budgetStatus, type BudgetStatus } from '../lib/analytics';
import { fmtDayMonth } from '../lib/dates';
import { currencySymbol, evalAmount, money, uid } from '../lib/format';
import { back, useData, useRoute } from '../lib/hooks';
import { mutate, toast } from '../lib/store';

export function Budgets() {
  const { budgets, txns, scheduled, weekStart, cat } = useData();
  const { params } = useRoute();
  const [editing, setEditing] = useState<Budget | null | undefined>(undefined);
  useEffect(() => {
    if (params.get('new')) setEditing(null);
  }, [params]);
  const statuses = useMemo(() => budgets.map((b) => budgetStatus(b, txns, scheduled, weekStart)), [budgets, txns, scheduled, weekStart]);
  const overall = statuses.filter((s) => !s.budget.category);
  const perCat = statuses.filter((s) => s.budget.category);

  return (
    <div className="page wide">
      <header className="header">
        <button className="icon-btn" onClick={back} aria-label="Back"><ChevronLeft size={20} /></button>
        <h1 className="large-title grow">Budgets</h1>
        <button className="btn sm" onClick={() => setEditing(null)}><Plus size={16} /> New budget</button>
      </header>

      {statuses.length === 0 ? (
        <div className="card">
          <Empty icon={<PiggyBank size={28} />} title="No budgets yet">
            Create an overall monthly or weekly budget, or limits for single categories like eating out.
            <div><button className="btn primary sm" style={{ marginTop: 14 }} onClick={() => setEditing(null)}>Create a budget</button></div>
          </Empty>
        </div>
      ) : (
        <div className="grid-2">
          <div className="col stack">
            {overall.length > 0 && <div className="section-title" style={{ marginTop: 0 }}><h2>Overall</h2></div>}
            {overall.map((s, i) => (
              <Reveal key={s.budget.id} delay={i * 0.04}>
                <BigBudget s={s} onEdit={() => setEditing(s.budget)} />
              </Reveal>
            ))}
          </div>
          <div className="col">
            {perCat.length > 0 && <div className="section-title" style={{ marginTop: 0 }}><h2>By category</h2></div>}
            <div className="stack">
              {perCat.map((s, i) => {
                const c = cat(s.budget.category);
                const color = s.pct >= 1 ? 'var(--danger)' : s.pct >= 0.85 ? 'var(--warn)' : c.color;
                return (
                  <Reveal key={s.budget.id} delay={i * 0.04}>
                    <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => setEditing(s.budget)}>
                      <div className="row">
                        <IconTile icon={c.icon} color={c.color} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 650 }}>{s.budget.name}</div>
                          <div className="tiny faint">{s.budget.period === 'weekly' ? 'Weekly' : 'Monthly'} · {fmtDayMonth(s.start)} – {fmtDayMonth(s.end)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="num" style={{ fontWeight: 700 }}>{money(s.spent)}</div>
                          <div className="tiny faint num">of {money(s.budget.amount)}</div>
                        </div>
                      </div>
                      <div className="bar" style={{ marginTop: 12, height: 8 }}>
                        <motion.i style={{ background: color }} initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, s.pct) }} transition={{ ...spring, duration: 0.8 }} />
                      </div>
                      <div className="small muted" style={{ marginTop: 8 }}>
                        {s.remaining >= 0 ? <>{money(s.remaining)} left · <b style={{ color: 'var(--accent-ink)' }}>{money(s.safePerDay)}/day</b> for {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'}</> : <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Over by {money(-s.remaining)}</span>}
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Sheet open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Edit budget' : 'New budget'}>
        {editing !== undefined && <BudgetForm key={editing?.id || 'new'} budget={editing} onClose={() => setEditing(undefined)} />}
      </Sheet>
    </div>
  );
}

function BigBudget({ s, onEdit }: { s: BudgetStatus; onEdit: () => void }) {
  const over = s.remaining < 0;
  return (
    <button className="card" style={{ width: '100%' }} onClick={onEdit}>
      <div className="row between">
        <span className="card-label">{s.budget.name}</span>
        <span className="tiny faint">{fmtDayMonth(s.start)} – {fmtDayMonth(s.end)}</span>
      </div>
      <Gauge pct={s.pct} size={240}>
        <div>
          <div className="tiny faint" style={{ letterSpacing: '0.08em', fontWeight: 650 }}>{over ? 'OVER BY' : 'REMAINING'}</div>
          <AnimatedMoney value={Math.abs(s.remaining)} className="mid-amount" />
          <div className="tiny faint">{s.daysLeft} day{s.daysLeft === 1 ? '' : 's'} left</div>
        </div>
      </Gauge>
      <div className="stat-grid" style={{ marginTop: -10, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <MiniStat k="Spent" v={money(s.spent)} />
        <MiniStat k="Limit" v={money(s.budget.amount)} />
        <MiniStat k="Safe / day" v={over ? '—' : money(s.safePerDay)} accent />
      </div>
      {s.upcomingBills > 0 && <div className="small muted" style={{ marginTop: 10, textAlign: 'center' }}>Accounts for {money(s.upcomingBills)} of scheduled bills still due {s.label === 'this week' ? 'this week' : `in ${s.label}`}.</div>}
    </button>
  );
}

function MiniStat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 14, background: 'var(--fill-2)' }}>
      <div className="tiny faint" style={{ fontWeight: 600 }}>{k}</div>
      <div className="num" style={{ fontWeight: 700, color: accent ? 'var(--accent-ink)' : undefined }}>{v}</div>
    </div>
  );
}

function BudgetForm({ budget, onClose }: { budget: Budget | null; onClose: () => void }) {
  const { activeCategories, budgets } = useData();
  const [name, setName] = useState(budget?.name || '');
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period || 'monthly');
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [category, setCategory] = useState(budget?.category || '');
  const amt = evalAmount(amount);
  const valid = amt > 0;
  const autoName = category ? category : period === 'weekly' ? 'Weekly budget' : 'Monthly budget';

  const save = () => {
    if (!valid) return;
    const row: Budget = { id: budget?.id || uid(), name: name.trim() || autoName, period, amount: amt, category, created: budget?.created || new Date().toISOString() };
    mutate([{ op: 'upsert', table: 'Budgets', row: row as unknown as Record<string, unknown> }]);
    toast(budget ? 'Budget updated' : 'Budget created');
    onClose();
  };
  const del = () => {
    if (!budget) return;
    mutate([{ op: 'delete', table: 'Budgets', id: budget.id }]);
    toast('Budget deleted', { action: { label: 'Undo', run: () => mutate([{ op: 'upsert', table: 'Budgets', row: budget as unknown as Record<string, unknown> }]) } });
    onClose();
  };
  const taken = budgets.filter((b) => b.id !== budget?.id && b.period === period && b.category === category).length > 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field">
        <span>Repeats</span>
        <Segmented value={period} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} onChange={setPeriod} />
      </div>
      <label className="field">
        <span>Limit</span>
        <div className="row input" style={{ gap: 6 }}>
          <span className="faint">{currencySymbol()}</span>
          <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20000" style={{ border: 0, background: 'transparent', flex: 1, height: '100%', fontWeight: 650, fontSize: 18 }} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </div>
      </label>
      <div className="field">
        <span>Applies to</span>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All spending</option>
          {activeCategories.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
        </select>
        {taken && <span style={{ color: 'var(--warn-ink)' }}>You already have a {period} budget for this. Both will be shown.</span>}
      </div>
      <label className="field">
        <span>Name (optional)</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={autoName} />
      </label>
      <button className="btn primary block" style={{ height: 50 }} disabled={!valid} onClick={save}>{budget ? 'Save' : 'Create budget'}</button>
      {budget && <button className="btn danger block" onClick={del}>Delete budget</button>}
    </div>
  );
}
