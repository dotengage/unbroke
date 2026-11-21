import { ChevronLeft, ExternalLink, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Reveal, Segmented } from '../components/ui';
import { back, go, useData } from '../lib/hooks';
import { disconnect, discardPending, pull, setConnMeta, setSetting, setTheme, toast, useStore, type ThemePref } from '../lib/store';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];

export function Settings() {
  const theme = useStore((s) => s.theme);
  const conn = useStore((s) => s.conn);
  const pending = useStore((s) => s.pending.length);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const { data, weekStart, txns, activeAccounts, defaultAccount } = useData();
  const [sheetUrl, setSheetUrl] = useState(conn?.mode === 'sheet' ? conn.sheetUrl || '' : '');

  return (
    <div className="page">
      <header className="header">
        <button className="icon-btn" onClick={back} aria-label="Back"><ChevronLeft size={20} /></button>
        <h1 className="large-title grow">Settings</h1>
      </header>

      <Reveal>
        <div className="section-title" style={{ marginTop: 6 }}><h2>Appearance</h2></div>
        <div className="card stack">
          <Segmented<ThemePref> value={theme} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={setTheme} />
          <div className="tiny faint">Saved on this device.</div>
        </div>

        <div className="section-title"><h2>Preferences</h2></div>
        <div className="card stack" style={{ gap: 16 }}>
          <label className="field">
            <span>Currency</span>
            <select className="input" value={data.settings.currency || 'INR'} onChange={(e) => setSetting('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {activeAccounts.length > 0 && (
            <label className="field">
              <span>Default account</span>
              <select className="input" value={defaultAccount} onChange={(e) => setSetting('defaultAccount', e.target.value)}>
                {activeAccounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </label>
          )}
          <div className="field">
            <span>Week starts on</span>
            <Segmented value={String(weekStart)} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} onChange={(v) => setSetting('weekStart', v)} />
          </div>
          <button className="btn" onClick={() => go('categories')}>Edit categories</button>
        </div>

        <div className="section-title"><h2>Google Sheet</h2></div>
        {conn?.mode === 'sheet' ? (
          <div className="card stack" style={{ gap: 14 }}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 600 }}>Connected</div>
                <div className="tiny faint">{txns.length} expenses · checks for changes every 12 seconds</div>
              </div>
              <button className="btn sm" onClick={() => pull(true)} disabled={status === 'syncing'}>
                <RefreshCw size={14} className={status === 'syncing' ? 'spin' : ''} /> Sync now
              </button>
            </div>
            {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}
            {pending > 0 && (
              <div className="row between small" style={{ background: 'var(--warn-soft)', borderRadius: 12, padding: '10px 12px' }}>
                <span>{pending} change{pending === 1 ? '' : 's'} waiting to sync</span>
                <button className="btn sm danger" onClick={() => { if (confirm('Discard unsynced changes? They have not reached your sheet yet.')) discardPending(); }}>
                  <Trash2 size={14} /> Discard
                </button>
              </div>
            )}
            <label className="field">
              <span>Sheet link (for the “Open sheet” shortcut)</span>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                <button className="btn sm" onClick={() => { setConnMeta({ sheetUrl: sheetUrl.trim() || undefined }); toast('Saved'); }}>Save</button>
              </div>
            </label>
            {conn.sheetUrl && <a className="btn" href={conn.sheetUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open sheet</a>}
            <div className="field">
              <span>Web app URL</span>
              <div className="code small" style={{ wordBreak: 'break-all', padding: '8px 10px' }}>{conn.url}</div>
            </div>
            <button className="btn danger" onClick={() => { if (confirm('Disconnect this device? Your sheet keeps all data.')) disconnect(); }}>
              <LogOut size={15} /> Disconnect
            </button>
          </div>
        ) : (
          <div className="card stack">
            <div className="small muted">You&rsquo;re using sample data on this device. Connect your own Google Sheet to keep real expenses.</div>
            <button className="btn primary" onClick={disconnect}>Connect a Google Sheet</button>
          </div>
        )}
        <p className="tiny faint" style={{ textAlign: 'center', marginTop: 24 }}>Unbroke · your data lives in your own Google Sheet</p>
      </Reveal>
    </div>
  );
}
