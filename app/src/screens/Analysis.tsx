import { motion } from 'framer-motion';
import { BarChart3, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bars, Donut, type Slice } from '../components/Charts';
import { Icon, IconTile, PALETTE } from '../components/Icon';
import { PeriodBar, usePeriod } from '../components/PeriodBar';
import { AnimatedMoney, Delta, Empty, Reveal, Segmented, spring } from '../components/ui';
import { byAccount, byCategory, inRange, insights, series, stats } from '../lib/analytics';
import { fmtDayMonth, fmtWeekday, previousPeriod } from '../lib/dates';
import { money, moneyShort } from '../lib/format';
import { go, openExport, useData } from '../lib/hooks';

const MAX_SLICES = 7;

export function Analysis() {
  const { txns, weekStart, cat, acc, accIcon, scheduled } = useData();
  const { state, setState, period } = usePeriod('month', weekStart);
  const [breakdown, setBreakdown] = useState<'category' | 'account'>('category');
  const prev = previousPeriod(period, weekStart);

  const cur = useMemo(() => inRange(txns, period.start, period.end), [txns, period.start, period.end]);
  const before = useMemo(() => inRange(txns, prev.start, prev.end), [txns, prev.start, prev.end]);
  const st = useMemo(() => stats(cur, period), [cur, period]);
  const prevSt = useMemo(() => stats(before, prev), [before, prev]);
  const trend = useMemo(() => series(cur, period, weekStart), [cur, period, weekStart]);
  const cats = useMemo(() => byCategory(cur), [cur]);
  const accs = useMemo(() => byAccount(cur), [cur]);
  const ins = useMemo(() => insights(cur, before, period, scheduled), [cur, before, period, scheduled]);
  const prevCats = useMemo(() => new Map(byCategory(before).map((g) => [g.name, g.total])), [before]);

  const groups = breakdown === 'category' ? cats : accs;
  // color follows the entity: categories carry their own color; accounts get palette slots in a fixed order
  const colorFor = (name: string, i: number) => (breakdown === 'category' ? cat(name).color : acc(name).color || PALETTE[i % 8]);
  const slices: Slice[] = useMemo(() => {
    const top = groups.slice(0, MAX_SLICES).map((g, i) => ({ name: g.name, value: g.total, color: colorFor(g.name, i) }));
    const rest = groups.slice(MAX_SLICES).reduce((a, g) => a + g.total, 0);
    if (rest > 0) top.push({ name: 'Other', value: rest, color: '#8e8e93' });
    return top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, breakdown]);

  const avgBucket = trend.buckets.filter((b) => !b.future).length ? trend.buckets.filter((b) => !b.future).reduce((a, b) => a + b.total, 0) / trend.buckets.filter((b) => !b.future).length : 0;
  const unitLabel = trend.unit === 'day' ? 'Daily' : trend.unit === 'week' ? 'Weekly' : 'Monthly';

  return (
    <div className="page wide">
      <header className="header">
        <h1 className="large-title grow">Analysis</h1>
        <button className="icon-btn" onClick={() => openExport({ start: period.start, end: period.end, label: period.label })} aria-label="Export this period">
          <Download size={18} />
        </button>
      </header>

      <PeriodBar state={state} setState={setState} period={period} count={cur.length} />

      {cur.length === 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <Empty icon={<BarChart3 size={28} />} title="Nothing spent in this period">Pick another period, or add an expense.</Empty>
        </div>
      ) : (
        <div className="grid-2" style={{ marginTop: 14 }}>
          <div className="col">
            <Reveal>
              <div className="card">
                <div className="row between">
                  <span className="card-label">Total spent</span>
                  {before.length > 0 && (
                    <span className="small faint">
                      vs {money(prevSt.total)} before
                    </span>
                  )}
                </div>
                <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                  <AnimatedMoney value={st.total} className="hero-amount" />
                  <Delta now={st.total} before={prevSt.total} />
                </div>
                <div className="section-title" style={{ margin: '18px 0 6px' }}>
                  <span className="small muted" style={{ fontWeight: 600 }}>{unitLabel} spending</span>
                  <span className="row tiny faint" style={{ gap: 6 }}>
                    <i style={{ width: 14, borderTop: '1.5px dashed var(--warn)' }} /> avg {moneyShort(avgBucket)}
                  </span>
                </div>
                <Bars buckets={trend.buckets} avg={avgBucket} />
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="section-title">
                <h2>Breakdown</h2>
              </div>
              <div className="card">
                <Segmented value={breakdown} options={[{ value: 'category', label: 'Categories' }, { value: 'account', label: 'Accounts' }]} onChange={setBreakdown} />
                <div style={{ margin: '20px 0 8px' }}>
                  <Donut
                    data={slices}
                    size={210}
                    center={
                      <div>
                        <div className="small muted" style={{ fontWeight: 600 }}>{groups.length} {breakdown === 'category' ? 'categories' : 'accounts'}</div>
                        <div className="mid-amount num">{money(st.total)}</div>
                      </div>
                    }
                  />
                </div>
                <div className="list" style={{ margin: '0 -18px -18px' }}>
                  {groups.map((g, i) => {
                    const icon = breakdown === 'category' ? cat(g.name).icon : accIcon(acc(g.name));
                    const color = colorFor(g.name, i);
                    const was = breakdown === 'category' ? prevCats.get(g.name) || 0 : 0;
                    return (
                      <button
                        key={g.name}
                        className="list-row"
                        onClick={() => go('transactions', { view: 'custom', from: period.start, to: period.end, [breakdown === 'category' ? 'cat' : 'acc']: g.name })}
                      >
                        <IconTile icon={icon} color={color} size="sm" />
                        <div className="main-col">
                          <div className="row between">
                            <span className="title">{g.name}</span>
                            <span className="amt num">{money(g.total)}</span>
                          </div>
                          <div className="row" style={{ gap: 8, marginTop: 5 }}>
                            <div className="bar" style={{ flex: 1 }}>
                              <motion.i style={{ background: color }} initial={{ scaleX: 0 }} animate={{ scaleX: g.share }} transition={{ ...spring, duration: 0.7, delay: i * 0.03 }} />
                            </div>
                            <span className="tiny faint num" style={{ width: 92, textAlign: 'right' }}>
                              {Math.round(g.share * 100)}% · {g.count}×{was ? (g.total > was ? ' ↑' : ' ↓') : ''}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>

          <div className="col">
            <div className="section-title" style={{ marginTop: 0 }}>
              <h2>Stats</h2>
            </div>
            <Reveal delay={0.08}>
              <div className="stat-grid">
                <Stat k="Average per day" v={money(st.avgPerDay)} s={prevSt.total ? `${money(prevSt.avgPerDay)} before` : `over ${st.elapsedDays} days`} />
                <Stat k="Average per expense" v={money(st.avgPerTxn)} s={`${st.count} expenses`} />
                <Stat k="Biggest day" v={st.peakDay ? money(st.peakDay.total) : '—'} s={st.peakDay ? `${fmtWeekday(st.peakDay.date).slice(0, 3)}, ${fmtDayMonth(st.peakDay.date)}` : ''} />
                <Stat k="Largest expense" v={st.largest ? money(st.largest.amount) : '—'} s={st.largest ? st.largest.note || st.largest.category : ''} />
                <Stat k="No-spend days" v={String(st.noSpendDays)} s={`of ${st.elapsedDays} days`} />
                <Stat k={st.projected ? 'Projected total' : 'Top category'} v={st.projected ? money(st.projected) : cats[0] ? cats[0].name : '—'} s={st.projected ? 'at the current pace' : cats[0] ? `${Math.round(cats[0].share * 100)}% of spending` : ''} />
              </div>
            </Reveal>

            <div className="section-title">
              <h2>Trends</h2>
            </div>
            <Reveal delay={0.1}>
              {ins.length ? (
                <div className="card flush list">
                  {ins.map((x, i) => (
                    <div key={i} className="list-row" style={{ alignItems: 'flex-start', cursor: 'default' }}>
                      <span
                        className="icon-tile sm"
                        style={{
                          background: x.tone === 'up' ? 'var(--danger-soft)' : x.tone === 'down' ? 'var(--accent-soft)' : 'var(--fill-2)',
                          color: x.tone === 'up' ? 'var(--danger)' : x.tone === 'down' ? 'var(--accent-ink)' : 'var(--text-2)',
                        }}
                      >
                        <Icon name={x.icon} size={16} />
                      </span>
                      <div className="main-col">
                        <div style={{ fontWeight: 600 }}>{x.title}</div>
                        <div className="small muted">{x.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <Empty title="No clear patterns yet">Trends show up as more expenses are recorded.</Empty>
                </div>
              )}
            </Reveal>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v num">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}
