import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, ChevronDown, ChevronRight, PiggyBank, Search, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Gauge, Ring, Sparkline } from '../components/Charts';
import { IconTile } from '../components/Icon';
import { QuickAdd } from '../components/QuickAdd';
import { SyncBadge } from '../components/SyncBadge';
import { TxnList } from '../components/TxnList';
import { AnimatedMoney, Delta, Empty, Reveal, spring } from '../components/ui';
import { budgetStatus, byDay, inRange, sortTxns, stats, sum, type BudgetStatus } from '../lib/analytics';
import { addDays, eachDay, periodFor, previousPeriod, relativeDay, todayKey, type Preset } from '../lib/dates';
import { money } from '../lib/format';
import { go, openAdd, pref, setPref, useData } from '../lib/hooks';
import { describeFrequency, monthlyCost, upcoming } from '../lib/schedule';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

export function Home() {
  const { txns, weekStart, budgets, scheduled, cat } = useData();
  const [preset, setPresetState] = useState<Preset>(() => pref<Preset>('homePreset', 'month'));
  const [custom, setCustom] = useState({ start: addDays(todayKey(), -29), end: todayKey() });
  const [menu, setMenu] = useState(false);
  const setPreset = (p: Preset) => {
    setPresetState(p);
    setPref('homePreset', p);
    setMenu(false);
  };

  const period = periodFor(preset, 0, weekStart, custom);
  const prev = previousPeriod(period, weekStart);
  const cur = useMemo(() => inRange(txns, period.start, period.end), [txns, period.start, period.end]);
  const before = useMemo(() => inRange(txns, prev.start, prev.end), [txns, prev.start, prev.end]);
  const st = stats(cur, period);
  const total = st.total;
  // compare like-for-like: previous period up to the same day offset
  const today = todayKey();
  const elapsed = Math.min(eachDay(period.start, period.end).length, eachDay(period.start, today < period.end ? today : period.end).length);
  const prevSame = sum(before.filter((t) => t.date <= addDays(prev.start, elapsed - 1)));

  const spark = useMemo(() => {
    if (period.start === period.end) return [];
    const d = byDay(cur);
    const end = today < period.end ? today : period.end;
    let run = 0;
    return eachDay(period.start, end).map((k) => (run += d.get(k) || 0));
  }, [cur, period.start, period.end, today]);

  const recent = useMemo(() => sortTxns(txns.filter((t) => t.date <= today)).slice(0, 5), [txns, today]);
  const statuses = useMemo(
    () => budgets.map((b) => budgetStatus(b, txns, scheduled, weekStart)).sort((a, b) => Number(!!a.budget.category) - Number(!!b.budget.category) || (a.budget.period === 'monthly' ? -1 : 1)),
    [budgets, txns, scheduled, weekStart],
  );
  const next = useMemo(() => upcoming(scheduled, today, addDays(today, 45), 5), [scheduled, today]);
  const subsMonthly = scheduled.filter((s) => s.active).reduce((a, s) => a + monthlyCost(s), 0);

  return (
    <div className="page wide">
      <header className="header">
        <div className="grow">
          <div className="subtitle">{greeting()}</div>
          <h1 className="large-title">Overview</h1>
        </div>
        <SyncBadge />
        <button className="icon-btn" onClick={() => go('transactions', { view: 'custom' })} aria-label="Search expenses">
          <Search size={18} />
        </button>
      </header>

      <div className="grid-2">
        <div className="col">
          {/* Cash flow */}
          <Reveal>
            <div className="card" style={{ paddingBottom: spark.length > 1 ? 10 : 18 }}>
              <div className="row between">
                <span className="card-label">Spent</span>
                <div style={{ position: 'relative' }}>
                  <button className="pill-select" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
                    {preset === 'custom' ? period.label : PRESETS.find((p) => p.value === preset)?.label} <ChevronDown size={14} />
                  </button>
                  <AnimatePresence>
                    {menu && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenu(false)} />
                        <motion.div
                          role="menu"
                          className="card"
                          style={{ position: 'absolute', right: 0, top: 36, zIndex: 10, padding: 6, minWidth: 170, boxShadow: 'var(--shadow-lg)', transformOrigin: 'top right' }}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                        >
                          {PRESETS.map((p) => (
                            <button key={p.value} role="menuitem" className={`nav-item ${preset === p.value ? 'active' : ''}`} style={{ padding: '9px 12px' }} onClick={() => setPreset(p.value)}>
                              {p.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="row" style={{ alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <AnimatedMoney value={total} className="hero-amount" />
                <Delta now={total} before={prevSame} />
              </div>
              <div className="small muted">
                {st.count} expense{st.count === 1 ? '' : 's'}
                {period.start !== period.end && st.count > 0 && <> · {money(st.avgPerDay)}/day avg</>}
                {st.projected && preset !== 'today' ? <> · on pace for {money(st.projected)}</> : null}
              </div>
              <AnimatePresence>
                {preset === 'custom' && (
                  <motion.div className="row" style={{ gap: 8, marginTop: 12, overflow: 'hidden' }} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
                    <input type="date" className="input" style={{ height: 38 }} value={custom.start} max={custom.end} onChange={(e) => e.target.value && setCustom({ ...custom, start: e.target.value })} aria-label="From" />
                    <span className="faint">→</span>
                    <input type="date" className="input" style={{ height: 38 }} value={custom.end} min={custom.start} onChange={(e) => e.target.value && setCustom({ ...custom, end: e.target.value })} aria-label="To" />
                  </motion.div>
                )}
              </AnimatePresence>
              {spark.length > 1 && (
                <div style={{ marginTop: 10 }}>
                  <Sparkline values={spark} />
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.04}>
            <div style={{ marginTop: 14 }}>
              <QuickAdd />
            </div>
          </Reveal>

          <div className="section-title">
            <h2>Recent</h2>
            <button className="link" onClick={() => go('transactions')}>See all</button>
          </div>
          <Reveal delay={0.06}>
            {recent.length ? (
              <TxnList txns={recent} />
            ) : (
              <div className="card">
                <Empty icon={<Receipt size={28} />} title="No expenses yet">
                  Tap + to add your first one, or type it in quick add above.
                </Empty>
              </div>
            )}
          </Reveal>
        </div>

        <div className="col">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h2>Budgets</h2>
            <button className="link" onClick={() => go('budgets')}>{statuses.length ? 'Manage' : 'Set up'}</button>
          </div>
          <Reveal delay={0.08}>
            {statuses.length ? (
              <div className="stack" style={{ gap: 12 }}>
                <MainBudget s={statuses[0]} />
                {statuses.length > 1 && (
                  <div className="card flush list">
                    {statuses.slice(1).map((s) => (
                      <BudgetRow key={s.budget.id} s={s} icon={s.budget.category ? cat(s.budget.category).icon : 'piggy-bank'} color={s.budget.category ? cat(s.budget.category).color : undefined} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('budgets', { new: '1' })}>
                <Empty icon={<PiggyBank size={28} />} title="No budget yet">
                  Set a weekly or monthly limit and see how much is safe to spend each day.
                </Empty>
              </button>
            )}
          </Reveal>

          <div className="section-title">
            <h2>Scheduled</h2>
            <button className="link" onClick={() => go('scheduled')}>{scheduled.length ? 'See all' : 'Add'}</button>
          </div>
          <Reveal delay={0.1}>
            {next.length ? (
              <div className="card flush list">
                {next.map(({ s, date }) => {
                  const c = cat(s.category);
                  return (
                    <button key={s.id + date} className="list-row" onClick={() => go('scheduled', { id: s.id })}>
                      <IconTile icon={c.icon} color={c.color} />
                      <div className="main-col">
                        <div className="title">{s.title}</div>
                        <div className="meta">{describeFrequency(s)}</div>
                      </div>
                      <div className="amt num">
                        {money(s.amount)}
                        <span className="sub">{relativeDay(date)}</span>
                      </div>
                    </button>
                  );
                })}
                {subsMonthly > 0 && (
                  <div className="row between small" style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
                    <span className="muted">Recurring per month</span>
                    <b className="num">{money(subsMonthly)}</b>
                  </div>
                )}
              </div>
            ) : (
              <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('scheduled', { new: '1' })}>
                <Empty icon={<CalendarClock size={28} />} title="Nothing scheduled">
                  Add rent, bills and subscriptions once. They&rsquo;re recorded automatically on the day, even when the app is closed.
                </Empty>
              </button>
            )}
          </Reveal>
          <button className="btn block" style={{ marginTop: 16 }} onClick={() => openAdd()}>
            Add an expense
          </button>
        </div>
      </div>
    </div>
  );
}

function MainBudget({ s }: { s: BudgetStatus }) {
  const over = s.remaining < 0;
  return (
    <button className="card" style={{ width: '100%', textAlign: 'center' }} onClick={() => go('budgets')}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <span className="card-label">{s.budget.name}</span>
        <span className="tiny faint" style={{ fontWeight: 600 }}>{s.budget.period === 'weekly' ? 'Weekly' : 'Monthly'}</span>
      </div>
      <Gauge pct={s.pct} size={230}>
        <div>
          <div className="tiny faint" style={{ letterSpacing: '0.08em', fontWeight: 650 }}>{over ? 'OVER BY' : 'REMAINING'}</div>
          <AnimatedMoney value={Math.abs(s.remaining)} className="mid-amount" />
          <div className="tiny faint">{Math.round(s.pct * 100)}% used</div>
        </div>
      </Gauge>
      <div className="row between small" style={{ marginTop: -18, padding: '0 6px' }}>
        <div style={{ textAlign: 'left' }}>
          <div className="faint tiny">Spent</div>
          <b className="num">{money(s.spent)}</b>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="faint tiny">Limit</div>
          <b className="num">{money(s.budget.amount)}</b>
        </div>
      </div>
      <div className="small" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: over ? 'var(--danger-soft)' : 'var(--accent-soft)', color: over ? 'var(--danger)' : 'var(--accent-ink)', fontWeight: 600 }}>
        {over ? (
          <>You&rsquo;re over budget for {s.label}.</>
        ) : (
          <>
            Safe to spend <span className="num">{money(s.safePerDay)}</span>/day for the rest of {s.label}
            {s.upcomingBills > 0 && <span style={{ fontWeight: 500, opacity: 0.85 }}> · after {money(s.upcomingBills)} of upcoming bills</span>}
          </>
        )}
      </div>
    </button>
  );
}

function BudgetRow({ s, icon, color }: { s: BudgetStatus; icon: string; color?: string }) {
  return (
    <button className="list-row" onClick={() => go('budgets')}>
      <IconTile icon={icon} color={color || '#34D399'} />
      <div className="main-col">
        <div className="title">{s.budget.name}</div>
        <div className="meta num">
          {money(s.spent)} of {money(s.budget.amount)} · {s.remaining >= 0 ? `${money(s.safePerDay)}/day left` : `over by ${money(-s.remaining)}`}
        </div>
      </div>
      <Ring pct={s.pct} size={34} />
      <ChevronRight size={16} className="faint" />
    </button>
  );
}
