import { CalendarClock, CalendarDays, ChevronRight, Download, ExternalLink, LayoutList, List, PiggyBank, Settings as SettingsIcon, SlidersHorizontal, Tags } from 'lucide-react';
import { SyncBadge } from '../components/SyncBadge';
import { Reveal } from '../components/ui';
import { go, openExport, useData } from '../lib/hooks';
import { useStore } from '../lib/store';

export function More() {
  const conn = useStore((s) => s.conn);
  const { txns, scheduled, budgets, categories } = useData();
  const tiles = [
    { label: 'Transactions', sub: `${txns.length}`, icon: List, to: 'transactions', color: '#2a78d6' },
    { label: 'Scheduled', sub: `${scheduled.filter((s) => s.active).length} active`, icon: CalendarClock, to: 'scheduled', color: '#6250d6' },
    { label: 'Budgets', sub: `${budgets.length}`, icon: PiggyBank, to: 'budgets', color: '#1baf7a' },
    { label: 'Categories', sub: `${categories.length}`, icon: Tags, to: 'categories', color: '#eb6834' },
  ];
  return (
    <div className="page">
      <header className="header">
        <h1 className="large-title grow">More</h1>
        <SyncBadge />
      </header>
      <Reveal>
        <div className="tiles">
          {tiles.map((t) => (
            <button key={t.to} className="tile" onClick={() => go(t.to)}>
              <span className="icon-tile sm" style={{ background: t.color, color: '#fff' }}><t.icon size={17} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {t.label}
                <span className="tiny faint" style={{ display: 'block', fontWeight: 500 }}>{t.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </Reveal>

      <div className="section-title"><h2>Views</h2></div>
      <Reveal delay={0.04}>
        <div className="tiles three">
          <button className="tile v" onClick={() => go('transactions', { view: 'day' })}><LayoutList size={22} /> Day</button>
          <button className="tile v" onClick={() => go('transactions', { view: 'calendar' })}><CalendarDays size={22} /> Calendar</button>
          <button className="tile v" onClick={() => go('transactions', { view: 'custom' })}><SlidersHorizontal size={22} /> Custom</button>
        </div>
      </Reveal>

      <div className="section-title"><h2>Data</h2></div>
      <Reveal delay={0.08}>
        <div className="card flush list">
          <button className="list-row" onClick={() => openExport()}>
            <span className="icon-tile sm" style={{ background: 'var(--fill-2)' }}><Download size={16} /></span>
            <div className="main-col"><div className="title">Export PDF or Excel</div><div className="meta">Any date range, category or account</div></div>
            <ChevronRight size={16} className="faint" />
          </button>
          {conn?.mode === 'sheet' && conn.sheetUrl && (
            <a className="list-row" href={conn.sheetUrl} target="_blank" rel="noreferrer">
              <span className="icon-tile sm" style={{ background: 'var(--fill-2)' }}><ExternalLink size={16} /></span>
              <div className="main-col"><div className="title">Open Google Sheet</div><div className="meta">Edit rows directly; changes sync back in seconds</div></div>
              <ChevronRight size={16} className="faint" />
            </a>
          )}
          <button className="list-row" onClick={() => go('settings')}>
            <span className="icon-tile sm" style={{ background: 'var(--fill-2)' }}><SettingsIcon size={16} /></span>
            <div className="main-col"><div className="title">Settings</div><div className="meta">Theme, currency, week start, sheet connection</div></div>
            <ChevronRight size={16} className="faint" />
          </button>
        </div>
      </Reveal>
    </div>
  );
}
