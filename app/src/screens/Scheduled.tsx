import { CalendarClock, ChevronLeft, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Frequency, Scheduled } from '../types';
import { Icon, IconTile } from '../components/Icon';
import { AnimatedMoney, Empty, Reveal, Segmented, Sheet, Switch } from '../components/ui';
import { addDays, fmtFull, relativeDay, todayKey } from '../lib/dates';
import { currencySymbol, evalAmount, money, uid } from '../lib/format';
import { back, useData, useRoute } from '../lib/hooks';
import { describeFrequency, monthlyCost, nextOf, occurrence, upcoming } from '../lib/schedule';
import { mutate, toast } from '../lib/store';

export function ScheduledScreen() {
  const { scheduled, cat, txns } = useData();
  const { params } = useRoute();
  const [editing, setEditing] = useState<Scheduled | null | undefined>(undefined);
  useEffect(() => {
    if (params.get('new')) setEditing(null);
    const id = params.get('id');
    if (id) {
      const s = scheduled.find((x) => x.id === id);
      if (s) setEditing(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const active = useMemo(() => scheduled.filter((s) => s.active).map((s) => ({ s, next: nextOf(s) })).sort((a, b) => (a.next || '9').localeCompare(b.next || '9')), [scheduled]);
  const inactive = scheduled.filter((s) => !s.active);
  const monthly = active.reduce((a, { s }) => a + monthlyCost(s), 0);
  const t = todayKey();
  const next30 = upcoming(scheduled, t, addDays(t, 29)).reduce((a, u) => a + Number(u.s.amount), 0);
  const recorded = (id: string) => txns.filter((x) => x.source === 'scheduled:' + id).length;

  const Row = ({ s, next }: { s: Scheduled; next: string | null }) => {
    const c = cat(s.category);
    return (
      <button className="list-row" onClick={() => setEditing(s)} style={{ opacity: s.active ? 1 : 0.55 }}>
        <IconTile icon={c.icon} color={c.color} />
        <div className="main-col">
          <div className="title">{s.title}</div>
          <div className="meta">{describeFrequency(s)}{s.account ? ` · ${s.account}` : ''}</div>
        </div>
        <div className="amt num">
          {money(s.amount)}
          <span className="sub">{s.active ? (next ? relativeDay(next) : 'Done') : (s.runs || 0) > 0 ? `Ended · ${recorded(s.id)}×` : 'Paused'}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="page">
      <header className="header">
        <button className="icon-btn" onClick={back} aria-label="Back"><ChevronLeft size={20} /></button>
        <h1 className="large-title grow">Scheduled</h1>
        <button className="btn sm" onClick={() => setEditing(null)}><Plus size={16} /> New</button>
      </header>
      <p className="small muted" style={{ margin: '0 2px 14px' }}>Recorded into your sheet automatically on the due date by an hourly job, even when the app is closed.</p>

      <Reveal>
        <div className="card row between">
          <div>
            <span className="card-label">Recurring per month</span>
            <div><AnimatedMoney value={monthly} className="mid-amount" /></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="card-label">Next 30 days</span>
            <div className="mid-amount num">{money(next30)}</div>
          </div>
        </div>
      </Reveal>

      {scheduled.length === 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <Empty icon={<CalendarClock size={28} />} title="No scheduled expenses">
            Add rent, EMIs, bills and subscriptions, or a one-off future payment.
            <div><button className="btn primary sm" style={{ marginTop: 14 }} onClick={() => setEditing(null)}>Add scheduled expense</button></div>
          </Empty>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="section-title"><h2>Upcoming</h2></div>
              <Reveal delay={0.04}><div className="card flush list">{active.map(({ s, next }) => <Row key={s.id} s={s} next={next} />)}</div></Reveal>
            </>
          )}
          {inactive.length > 0 && (
            <>
              <div className="section-title"><h2>Paused & finished</h2></div>
              <div className="card flush list">{inactive.map((s) => <Row key={s.id} s={s} next={null} />)}</div>
            </>
          )}
        </>
      )}

      <Sheet open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Edit scheduled' : 'New scheduled'}>
        {editing !== undefined && <ScheduleForm key={editing?.id || 'new'} item={editing} onClose={() => setEditing(undefined)} recordedCount={editing ? recorded(editing.id) : 0} />}
      </Sheet>
    </div>
  );
}

type EndMode = 'never' | 'date' | 'count';

function ScheduleForm({ item, onClose, recordedCount }: { item: Scheduled | null; onClose: () => void; recordedCount: number }) {
  const { activeCategories, activeAccounts, defaultAccount } = useData();
  const t = todayKey();
  const curNext = item ? nextOf(item) : null;
  const [title, setTitle] = useState(item?.title || '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [category, setCategory] = useState(item?.category || activeCategories.find((c) => c.name === 'Subscriptions')?.name || activeCategories[0]?.name || 'Others');
  const [account, setAccount] = useState(item?.account || defaultAccount);
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency || 'monthly');
  const [interval, setInterval] = useState(String(item?.interval || 1));
  const [date, setDate] = useState(curNext || item?.startDate || t);
  const [endMode, setEndMode] = useState<EndMode>(item?.endDate ? 'date' : item?.maxRuns ? 'count' : 'never');
  const [endDate, setEndDate] = useState(item?.endDate || addDays(t, 365));
  const [count, setCount] = useState(String(item?.maxRuns ? Math.max(1, item.maxRuns - (item.runs || 0)) : 12));
  const [active, setActive] = useState(item?.active ?? true);
  const amt = evalAmount(amount);
  const iv = Math.max(1, parseInt(interval) || 1);
  const valid = amt > 0 && title.trim().length > 0 && (endMode !== 'date' || endDate >= date);

  const preview = useMemo(() => {
    const s = { frequency, interval: iv, startDate: date };
    const out: string[] = [];
    for (let k = 0; k < 4; k++) {
      const d = occurrence(s, k);
      if (!d || (endMode === 'date' && d > endDate) || (endMode === 'count' && k >= (parseInt(count) || 1))) break;
      out.push(d);
      if (frequency === 'once') break;
    }
    return out;
  }, [frequency, iv, date, endMode, endDate, count]);

  const save = () => {
    if (!valid) return;
    const now = new Date().toISOString();
    // Schedules are anchored on (startDate, runs). Editing the cadence re-anchors at the chosen next date.
    const reanchor = !item || date !== curNext || frequency !== item.frequency || iv !== (item.interval || 1) || (!item.active && active);
    const row: Scheduled = {
      id: item?.id || uid(),
      title: title.trim(),
      amount: amt,
      category,
      account,
      note: item?.note || '',
      frequency,
      interval: iv,
      startDate: reanchor ? date : item!.startDate,
      endDate: endMode === 'date' ? endDate : '',
      maxRuns: endMode === 'count' ? (reanchor ? parseInt(count) || 1 : (item!.runs || 0) + (parseInt(count) || 1)) : null,
      runs: reanchor ? 0 : item!.runs || 0,
      nextDate: date,
      active,
      lastRun: item?.lastRun || '',
      created: item?.created || now,
    };
    mutate([{ op: 'upsert', table: 'Scheduled', row: row as unknown as Record<string, unknown> }]);
    toast(item ? 'Schedule updated' : date <= t ? 'Scheduled · first one recorded now' : `Scheduled from ${fmtFull(date)}`);
    onClose();
  };
  const del = () => {
    if (!item) return;
    mutate([{ op: 'delete', table: 'Scheduled', id: item.id }]);
    toast('Schedule deleted. Past expenses are kept.');
    onClose();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <label className="field">
        <span>Name</span>
        <input className="input" value={title} autoFocus={!item} onChange={(e) => setTitle(e.target.value)} placeholder="Netflix, Rent, Electricity…" />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Amount</span>
          <div className="row input" style={{ gap: 6 }}>
            <span className="faint">{currencySymbol()}</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="649" style={{ border: 0, background: 'transparent', flex: 1, minWidth: 0, height: '100%', fontWeight: 650 }} />
          </div>
        </label>
        <label className="field">
          <span>{item && (item.runs || 0) > 0 ? 'Next date' : 'First date'}</span>
          <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>Repeats</span>
        <Segmented value={frequency} options={[{ value: 'once', label: 'Once' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} onChange={setFrequency} />
      </div>
      {frequency !== 'once' && (
        <div className="form-grid">
          <label className="field">
            <span>Every</span>
            <div className="row input" style={{ gap: 6 }}>
              <input inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value.replace(/\D/g, '').slice(0, 3))} style={{ border: 0, background: 'transparent', width: 40, height: '100%', fontWeight: 650 }} />
              <span className="faint">{{ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[frequency]}{iv > 1 ? 's' : ''}</span>
            </div>
          </label>
          <label className="field">
            <span>Ends</span>
            <select className="input" value={endMode} onChange={(e) => setEndMode(e.target.value as EndMode)}>
              <option value="never">Never</option>
              <option value="date">On a date</option>
              <option value="count">After a number of times</option>
            </select>
          </label>
          {endMode === 'date' && <label className="field full"><span>End date</span><input type="date" className="input" value={endDate} min={date} onChange={(e) => e.target.value && setEndDate(e.target.value)} /></label>}
          {endMode === 'count' && <label className="field full"><span>Number of payments{item && (item.runs || 0) > 0 ? ' remaining' : ''}</span><input className="input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>}
        </div>
      )}
      <div className="field">
        <span>Category</span>
        <div className="chips wrap">
          {activeCategories.map((c) => (
            <button key={c.id || c.name} className={`chip ${category === c.name ? 'on' : ''}`} onClick={() => setCategory(c.name)}>
              <span style={{ color: category === c.name ? undefined : c.color, display: 'flex' }}><Icon name={c.icon} size={14} /></span> {c.name}
            </button>
          ))}
        </div>
      </div>
      {activeAccounts.length > 0 && (
        <div className="field">
          <span>Paid from</span>
          <div className="chips wrap">
            {activeAccounts.map((a) => (
              <button key={a.id || a.name} className={`chip ${account === a.name ? 'on' : ''}`} onClick={() => setAccount(a.name)}>
                <Icon name={a.icon || 'wallet'} size={14} /> {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {preview.length > 0 && (
        <div className="small" style={{ background: 'var(--fill-2)', borderRadius: 12, padding: '10px 12px' }}>
          <div className="faint tiny" style={{ fontWeight: 650, marginBottom: 4 }}>{describeFrequency({ frequency, interval: iv, startDate: date })}</div>
          {preview.map((d) => <div key={d} className="row between"><span>{fmtFull(d)}</span><span className="num muted">{money(amt || 0)}</span></div>)}
          {date <= t && <div className="tiny" style={{ color: 'var(--accent-ink)', marginTop: 6, fontWeight: 600 }}>Dates up to today are recorded as soon as you save.</div>}
        </div>
      )}
      {item && (
        <div className="row between">
          <div>
            <div style={{ fontWeight: 600 }}>Active</div>
            <div className="tiny faint">{recordedCount} recorded so far</div>
          </div>
          <Switch
            on={active}
            onChange={(v) => {
              setActive(v);
              // resuming shouldn't back-fill everything missed while paused
              if (v && !item.active && date < t) {
                let k = 0;
                let d = occurrence({ frequency, interval: iv, startDate: date }, 0);
                while (d && d < t && k < 2000) d = occurrence({ frequency, interval: iv, startDate: date }, ++k);
                setDate(d && d >= t ? d : t);
              }
            }}
            label="Active"
          />
        </div>
      )}
      <button className="btn primary block" style={{ height: 50 }} disabled={!valid} onClick={save}>{item ? 'Save' : 'Schedule'}</button>
      {item && <button className="btn danger block" onClick={del}>Delete schedule</button>}
    </div>
  );
}
