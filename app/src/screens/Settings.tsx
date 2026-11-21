import { Check, ChevronDown, ChevronLeft, Copy, ExternalLink, LogOut, Pencil, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import scriptCode from '../../../apps-script/Code.gs?raw';
import { spring } from '../components/ui';
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
        {conn?.mode === 'sheet' && <BackTapCard url={conn.url} api={data.api || 1} />}
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

/**
 * Optional: lets iPhone users add expenses by double-tapping the back of the phone.
 * Collapsed by default so it stays out of the way for everyone who doesn't use it.
 */
function BackTapCard({ url, api }: { url: string; api: number }) {
  const [open, setOpen] = useState(false);
  const ready = api >= 2;
  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptCode);
      toast('Copied the latest script');
    } catch {
      toast('Couldn’t copy. Use apps-script/Code.gs from the repo instead.', { tone: 'error' });
    }
  };
  return (
    <>
      <div className="section-title"><h2>Shortcuts</h2></div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button className="list-row" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="icon-tile sm" style={{ background: 'var(--fill-2)' }}><Smartphone size={16} /></span>
          <div className="main-col">
            <div className="title">Add with iPhone Back Tap</div>
            <div className="meta">Optional · double-tap the back of your phone to log an expense</div>
          </div>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} style={{ display: 'flex' }}><ChevronDown size={18} className="faint" /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
              <div className="stack" style={{ padding: '4px 16px 18px', gap: 14 }}>
                <p className="small muted" style={{ margin: 0 }}>
                  Double-tap, type or say something like <b>“swiggy 340 upi note team dinner”</b>, and it&rsquo;s saved straight to your sheet without opening the app. It understands the same things as quick add.
                </p>
                {!ready && (
                  <div className="small" style={{ background: 'var(--warn-soft)', borderRadius: 12, padding: '10px 12px' }}>
                    <b>First, update your sheet&rsquo;s script.</b> Copy the latest script, paste it over the old one in <b>Extensions › Apps Script</b>, then <b>Deploy › Manage deployments › Edit (pencil) › Version: New version › Deploy</b>. Your URL stays the same.
                    <div><button className="btn sm" style={{ marginTop: 8 }} onClick={copyScript}><Copy size={14} /> Copy latest script</button></div>
                  </div>
                )}
                <ol className="steps">
                  <li><div>Open the <b>Shortcuts</b> app, tap <b>+</b>, and name it <b>Add expense</b>.</div></li>
                  <li><div>Add <b>Ask for Input</b>. Prompt: <span className="code">What did you spend?</span>, type: Text.</div></li>
                  <li>
                    <div className="stack" style={{ gap: 8, minWidth: 0, flex: 1 }}>
                      <div>Add <b>Get Contents of URL</b> and paste your web app URL:</div>
                      <SecretRow value={url} label="web app URL" />
                      <div>Tap the arrow on it: <b>Method</b> POST, <b>Request Body</b> JSON, then add three Text fields:</div>
                      <div className="code small" style={{ padding: '8px 10px', lineHeight: 1.7 }}>
                        action → quick<br />text → <i>Provided Input</i> (pick the variable)<br />format → text
                      </div>
                    </div>
                  </li>
                  <li><div>Add <b>Show Notification</b> and set its text to <b>Contents of URL</b>.</div></li>
                  <li><div>On the phone: <b>Settings › Accessibility › Touch › Back Tap › Double Tap</b> › choose <b>Add expense</b>.</div></li>
                </ol>
                <p className="tiny faint" style={{ margin: 0 }}>
                  {ready ? 'Your sheet is ready for this. ' : ''}You&rsquo;ll see a notification like “✓ Added ₹340 · Food & Dining · UPI”, and the expense shows up in the app within a few seconds. Expenses without an account go to your default account.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
