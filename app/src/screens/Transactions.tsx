import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { DayGroups, TxnList } from '../components/TxnList';
import { AnimatedMoney, Empty, Segmented, spring } from '../components/ui';
import { byDay, sortTxns, sum } from '../lib/analytics';
import { addMonths, eachDay, endOfMonth, fmtFull, fmtMonthYear, fmtWeekday, parseKey, startOfMonth, startOfWeek, todayKey, addDays } from '../lib/dates';
import { money, moneyShort } from '../lib/format';
import { go, openAdd, openExport, useData, useRoute } from '../lib/hooks';

type View = 'day' | 'calendar' | 'custom';

export function Transactions() {
  const { params } = useRoute();
  const view = (params.get('view') as View) || 'day';
  const setView = (v: View) => go('transactions', { view: v });
  return (
    <div className="page wide">
      <header className="header">
        <h1 className="large-title grow">Transactions</h1>
        <button className="icon-btn" onClick={() => openAdd()} aria-label="New expense"><Plus size={18} /></button>
      </header>
      <div style={{ maxWidth: 420, marginBottom: 14 }}>
        <Segmented value={view} options={[{ value: 'day', label: 'Day' }, { value: 'calendar', label: 'Calendar' }, { value: 'custom', label: 'Custom' }]} onChange={setView} />
      </div>
      {view === 'day' && <DayView />}
      {view === 'calendar' && <CalendarView />}
      {view === 'custom' && <CustomView />}
    </div>
  );
}

function MonthNav({ month, setMonth, total, count }: { month: string; setMonth: (m: string) => void; total: number; count: number }) {
  const isCurrent = month >= startOfMonth(todayKey());
  return (
    <div className="card row between" style={{ padding: 8 }}>
      <button className="icon-btn plain" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={20} /></button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 650 }}>{fmtMonthYear(month)}</div>
        <div className="tiny faint num">{money(total)} · {count} expenses</div>
      </div>
      <button className="icon-btn plain" onClick={() => setMonth(addMonths(month, 1))} disabled={isCurrent} style={{ opacity: isCurrent ? 0.3 : 1 }} aria-label="Next month"><ChevronRight size={20} /></button>
    </div>
  );
}

function DayView() {
  const { txns } = useData();
  const [month, setMonth] = useState(startOfMonth(todayKey()));
  const list = useMemo(() => txns.filter((t) => t.date >= month && t.date <= endOfMonth(month)), [txns, month]);
  return (
    <div style={{ maxWidth: 720 }}>
      <MonthNav month={month} setMonth={setMonth} total={sum(list)} count={list.length} />
      {list.length ? <DayGroups txns={list} /> : <div className="card" style={{ marginTop: 14 }}><Empty title="No expenses this month" /></div>}
    </div>
  );
}

function CalendarView() {
  const { txns, weekStart } = useData();
  const [month, setMonth] = useState(startOfMonth(todayKey()));
  const [sel, setSel] = useState<string>(todayKey());
  const mEnd = endOfMonth(month);
  const list = useMemo(() => txns.filter((t) => t.date >= month && t.date <= mEnd), [txns, month, mEnd]);
  const daily = useMemo(() => byDay(list), [list]);
  const gridStart = startOfWeek(month, weekStart);
  const cells = eachDay(gridStart, addDays(gridStart, 41)).slice(0, Math.ceil(((parseKey(month).getDay() - weekStart + 7) % 7 + eachDay(month, mEnd).length) / 7) * 7);
  const vals = [...daily.values()].sort((a, b) => a - b);
  // sequential single-hue scale by quantile, so one huge day doesn't wash out the rest
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 0;
  const level = (v: number) => (!v ? 0 : v <= q(0.25) ? 1 : v <= q(0.5) ? 2 : v <= q(0.8) ? 3 : 4);
  const today = todayKey();
  const dows = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat('en-IN', { weekday: 'narrow' }).format(parseKey(addDays(gridStart, i))));
  const dayList = list.filter((t) => t.date === sel);

  return (
    <div className="grid-2">
      <div className="col">
        <MonthNav month={month} setMonth={(m) => { setMonth(m); setSel(m <= today && endOfMonth(m) >= today ? today : m); }} total={sum(list)} count={list.length} />
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <div className="cal">
            {dows.map((d, i) => <div key={i} className="dow">{d}</div>)}
            {cells.map((k) => {
              const v = daily.get(k) || 0;
              const lv = level(v);
              const out = k < month || k > mEnd;
              return (
                <button
                  key={k}
                  className={`cal-day ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''} ${out ? 'out' : ''}`}
                  style={{ background: out ? 'transparent' : `var(--heat-${lv})`, color: lv >= 3 ? `var(--heat-ink-${lv})` : undefined }}
                  onClick={() => !out && setSel(k)}
                  disabled={out}
                  aria-label={`${fmtFull(k)}: ${money(v)}`}
                >
                  {parseKey(k).getDate()}
                  {!out && v > 0 && <span className="v num">{moneyShort(v)}</span>}
                </button>
              );
            })}
          </div>
          <div className="row tiny faint" style={{ justifyContent: 'flex-end', gap: 4, marginTop: 10 }}>
            Less {[0, 1, 2, 3, 4].map((l) => <i key={l} style={{ width: 12, height: 12, borderRadius: 3, background: `var(--heat-${l})` }} />)} More
          </div>
        </div>
      </div>
      <div className="col">
        <div className="day-head" style={{ paddingTop: 4 }}>
          <span style={{ fontSize: 15, color: 'var(--text)' }}>{fmtWeekday(sel)}, {fmtFull(sel)}</span>
          <span className="num">{money(sum(dayList))}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={sel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
            {dayList.length ? (
              <TxnList txns={sortTxns(dayList)} showDate={false} />
            ) : (
              <div className="card">
                <Empty title="No spending this day">
                  <button className="btn sm" style={{ marginTop: 10 }} onClick={() => openAdd({ date: sel })}><Plus size={14} /> Add for this day</button>
                </Empty>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

type Sort = 'new' | 'old' | 'high' | 'low';

function CustomView() {
  const { params } = useRoute();
  const { txns, activeCategories, accounts } = useData();
  const t = todayKey();
  const [from, setFrom] = useState(params.get('from') || addMonths(startOfMonth(t), -2));
  const [to, setTo] = useState(params.get('to') || t);
  const [q, setQ] = useState(params.get('q') || '');
  const [cats, setCats] = useState<string[]>(params.get('cat') ? [params.get('cat')!] : []);
  const [accs, setAccs] = useState<string[]>(params.get('acc') ? [params.get('acc')!] : []);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const [showFilters, setShowFilters] = useState(true);
  const [limit, setLimit] = useState(60);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const lo = parseFloat(min);
    const hi = parseFloat(max);
    const r = txns.filter(
      (x) =>
        x.date >= from && x.date <= to &&
        (!cats.length || cats.includes(x.category)) &&
        (!accs.length || accs.includes(x.account)) &&
        (isNaN(lo) || x.amount >= lo) && (isNaN(hi) || x.amount <= hi) &&
        (!ql || x.note.toLowerCase().includes(ql) || x.category.toLowerCase().includes(ql) || x.account.toLowerCase().includes(ql) || String(x.amount).includes(ql)),
    );
    if (sort === 'new') return sortTxns(r);
    if (sort === 'old') return sortTxns(r).reverse();
    return r.slice().sort((a, b) => (sort === 'high' ? b.amount - a.amount : a.amount - b.amount));
  }, [txns, from, to, cats, accs, min, max, q, sort]);

  const total = sum(results);
  const activeCount = cats.length + accs.length + (min ? 1 : 0) + (max ? 1 : 0);
  const reset = () => { setCats([]); setAccs([]); setMin(''); setMax(''); setQ(''); };
  const presets: [string, () => void][] = [
    ['This month', () => { setFrom(startOfMonth(t)); setTo(t); }],
    ['Last month', () => { const s = addMonths(startOfMonth(t), -1); setFrom(s); setTo(endOfMonth(s)); }],
    ['Last 90 days', () => { setFrom(addDays(t, -89)); setTo(t); }],
    ['This year', () => { setFrom(t.slice(0, 4) + '-01-01'); setTo(t); }],
    ['All time', () => { setFrom(txns.reduce((m, x) => (x.date < m ? x.date : m), t)); setTo(t); }],
  ];

  return (
    <div className="grid-2">
      <div className="col">
        <div className="quick" style={{ marginBottom: 12 }}>
          <Search size={18} className="faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, categories, amounts" aria-label="Search" />
          {q && <button className="icon-btn plain" onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>}
          <button className={`icon-btn ${showFilters ? '' : 'plain'}`} onClick={() => setShowFilters((s) => !s)} aria-label="Toggle filters" style={{ position: 'relative' }}>
            <SlidersHorizontal size={17} />
            {activeCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: 'var(--accent)', color: '#062b1d', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{activeCount}</span>}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
              <div className="card stack" style={{ gap: 16 }}>
                <div className="field">
                  <span>Date range</span>
                  <div className="row" style={{ gap: 8 }}>
                    <input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="From" />
                    <span className="faint">→</span>
                    <input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="To" />
                  </div>
                  <div className="chips" style={{ marginTop: 4 }}>
                    {presets.map(([l, f]) => <button key={l} className="chip" style={{ height: 30, fontSize: 12.5 }} onClick={f}>{l}</button>)}
                  </div>
                </div>
                <div className="field">
                  <span>Categories {cats.length > 0 && `· ${cats.length}`}</span>
                  <div className="chips wrap">
                    {activeCategories.map((c) => (
                      <button key={c.id || c.name} className={`chip ${cats.includes(c.name) ? 'on' : ''}`} onClick={() => toggle(cats, setCats, c.name)}>
                        <span style={{ color: cats.includes(c.name) ? undefined : c.color, display: 'flex' }}><Icon name={c.icon} size={14} /></span> {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span>Accounts {accs.length > 0 && `· ${accs.length}`}</span>
                  <div className="chips wrap">
                    {accounts.map((a) => (
                      <button key={a.id || a.name} className={`chip ${accs.includes(a.name) ? 'on' : ''}`} onClick={() => toggle(accs, setAccs, a.name)}>
                        <Icon name={a.icon || 'wallet'} size={14} /> {a.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-grid">
                  <label className="field"><span>Min amount</span><input className="input" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" /></label>
                  <label className="field"><span>Max amount</span><input className="input" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Any" /></label>
                </div>
                <div className="field">
                  <span>Sort by</span>
                  <Segmented value={sort} options={[{ value: 'new', label: 'Newest' }, { value: 'old', label: 'Oldest' }, { value: 'high', label: 'Highest' }, { value: 'low', label: 'Lowest' }]} onChange={setSort} />
                </div>
                {(activeCount > 0 || q) && <button className="btn sm" onClick={reset}>Clear filters</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="col">
        <div className="card row between">
          <div>
            <span className="card-label">{results.length} result{results.length === 1 ? '' : 's'}</span>
            <div><AnimatedMoney value={total} className="mid-amount" /></div>
            {results.length > 0 && <div className="tiny faint num">avg {money(total / results.length)} · {fmtFull(from)} – {fmtFull(to)}</div>}
          </div>
          <button className="btn sm" disabled={!results.length} onClick={() => openExport({ start: from, end: to, categories: cats, accounts: accs, q, label: 'Filtered expenses' })}>
            <Download size={15} /> Export
          </button>
        </div>
        {results.length === 0 ? (
          <div className="card" style={{ marginTop: 12 }}><Empty icon={<Search size={26} />} title="No matching expenses">Try a wider date range or fewer filters.</Empty></div>
        ) : sort === 'new' || sort === 'old' ? (
          <DayGroups txns={results.slice(0, limit)} presorted />
        ) : (
          <div style={{ marginTop: 12 }}><TxnList txns={results.slice(0, limit)} /></div>
        )}
        {results.length > limit && <button className="btn block" style={{ marginTop: 12 }} onClick={() => setLimit((l) => l + 100)}>Show more ({results.length - limit} left)</button>}
      </div>
    </div>
  );
}
