import { Check, ChevronLeft, Copy, ExternalLink, LogOut, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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
  const [editingSheet, setEditingSheet] = useState(false);

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
            <div className="field">
              <span>Google Sheet</span>
              {conn.sheetUrl && !editingSheet ? (
                <SecretRow
                  value={conn.sheetUrl}
                  label="sheet link"
                  extra={
                    <>
                      <a className="icon-btn" href={conn.sheetUrl} target="_blank" rel="noreferrer" aria-label="Open sheet" title="Open sheet"><ExternalLink size={15} /></a>
                      <button className="icon-btn" onClick={() => { setSheetUrl(conn.sheetUrl || ''); setEditingSheet(true); }} aria-label="Change sheet link" title="Change"><Pencil size={15} /></button>
                    </>
                  }
                />
              ) : (
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" autoFocus={editingSheet} value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="Paste your sheet link (optional)" />
                  <button className="btn sm" onClick={() => { setConnMeta({ sheetUrl: sheetUrl.trim() || undefined }); setEditingSheet(false); toast('Saved'); }}>Save</button>
                </div>
              )}
            </div>
            <div className="field">
              <span>Web app URL</span>
              <SecretRow value={conn.url} label="web app URL" />
              <span style={{ fontWeight: 500 }}>To use the same data on another device, paste this URL there. Keep it private: anyone who has it can read and edit your sheet.</span>
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

/** Shows only the start and end of a private link, e.g. "script.google.com/…••••c2E2", with a copy button. */
function mask(url: string) {
  try {
    const u = new URL(url);
    const tail = url.replace(/\/(exec|edit.*|copy)$/, '').slice(-4);
    return `${u.host}/…••••••${tail}`;
  } catch {
    return '••••••••' + url.slice(-4);
  }
}

function SecretRow({ value, label, extra }: { value: string; label: string; extra?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // older browsers / insecure contexts
      const t = document.createElement('textarea');
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    toast(`Copied ${label}`);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="input row num" style={{ flex: 1, minWidth: 0, color: 'var(--text-2)', letterSpacing: '0.01em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', userSelect: 'none' }} aria-label={`${label} (hidden)`}>
        {mask(value)}
      </div>
      {extra}
      <button className="btn sm" onClick={copy} style={{ minWidth: 92 }} aria-label={`Copy ${label}`}>
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
