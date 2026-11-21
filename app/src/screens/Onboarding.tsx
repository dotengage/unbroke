import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft, Copy, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import code from '../../../apps-script/Code.gs?raw';
import { connect, startDemo } from '../lib/store';
import { spring } from '../components/ui';

// Set VITE_TEMPLATE_URL to your template sheet's ".../copy" link to enable one-click setup for friends.
const TEMPLATE = (import.meta.env.VITE_TEMPLATE_URL as string | undefined) || '';

export function Onboarding() {
  const [step, setStep] = useState<'welcome' | 'connect'>('welcome');
  return (
    <div className="onb">
      <AnimatePresence mode="wait">
        {step === 'welcome' ? (
          <motion.div key="w" className="onb-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={spring} style={{ textAlign: 'center' }}>
            <motion.img src="./icon.svg" alt="" width={96} height={96} style={{ borderRadius: 24, boxShadow: '0 20px 50px rgba(0,0,0,.25)' }} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.3, duration: 0.7 }} />
            <h1 className="large-title" style={{ fontSize: 40, marginTop: 24 }}>Unbroke</h1>
            <p className="muted" style={{ fontSize: 17, maxWidth: 380, margin: '10px auto 32px' }}>Track every rupee, set budgets, and see where your money goes. Everything lives in your own Google Sheet.</p>
            <div className="stack" style={{ maxWidth: 340, margin: '0 auto' }}>
              <button className="btn primary block" style={{ height: 52 }} onClick={() => setStep('connect')}>
                Connect my Google Sheet <ArrowRight size={18} />
              </button>
              <button className="btn block" style={{ height: 52 }} onClick={startDemo}>
                <Sparkles size={17} /> Try it with sample data
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="c" className="onb-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={spring}>
            <Connect onBack={() => setStep('welcome')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Connect({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState('');
  const [sheet, setSheet] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(!TEMPLATE);

  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      await connect(url, sheet);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Could not copy. Select the code manually from apps-script/Code.gs.');
    }
  };

  return (
    <div>
      <div className="header">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><ChevronLeft size={20} /></button>
        <h1 className="large-title grow" style={{ fontSize: 26 }}>Connect your sheet</h1>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>One-time setup, about two minutes. Your sheet runs a small script that the app talks to, and that records scheduled expenses on time even when the app is closed.</p>

      <div className="card" style={{ marginTop: 16 }}>
        {TEMPLATE && (
          <div style={{ marginBottom: 14 }}>
            <div className="seg" style={{ gridAutoColumns: '1fr' }}>
              <button className={!manual ? 'on' : ''} onClick={() => setManual(false)}>{!manual && <motion.span layoutId="onbseg" className="thumb" transition={spring} />}From template</button>
              <button className={manual ? 'on' : ''} onClick={() => setManual(true)}>{manual && <motion.span layoutId="onbseg" className="thumb" transition={spring} />}From scratch</button>
            </div>
          </div>
        )}
        <ol className="steps">
          {manual ? (
            <>
              <li>
                <div>
                  Create a new Google Sheet: <a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>sheets.new <ExternalLink size={12} /></a>
                </div>
              </li>
              <li>
                <div>
                  In the sheet open <b>Extensions › Apps Script</b>, delete what&rsquo;s there and paste this code, then press save.
                  <div><button className="btn sm" style={{ marginTop: 8 }} onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy script'}</button></div>
                </div>
              </li>
            </>
          ) : (
            <li>
              <div>
                Open the template and choose <b>Make a copy</b>.
                <div><a className="btn sm" style={{ marginTop: 8 }} href={TEMPLATE} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open template</a></div>
              </div>
            </li>
          )}
          <li>
            <div>
              {manual ? 'Click' : <>In your copy open <b>Extensions › Apps Script</b>, then click</>} <b>Deploy › New deployment</b>, pick type <b>Web app</b>, set <span className="code">Execute as: Me</span> and <span className="code">Who has access: Anyone</span>, then Deploy.
            </div>
          </li>
          <li>
            <div>
              Google asks you to authorise. It&rsquo;s your own script, so choose your account, then <b>Advanced › Go to project (unsafe)</b> › <b>Allow</b>.
            </div>
          </li>
          <li><div>Copy the <b>Web app URL</b> and paste it below.</div></li>
        </ol>
      </div>

      <div className="card stack" style={{ marginTop: 12 }}>
        <label className="field">
          <span>Web app URL</span>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" spellCheck={false} />
        </label>
        <label className="field">
          <span>Sheet link (optional, adds an “Open sheet” shortcut)</span>
          <input className="input" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" autoComplete="off" spellCheck={false} />
        </label>
        <AnimatePresence>{err && <motion.div className="small" style={{ color: 'var(--danger)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{err}</motion.div>}</AnimatePresence>
        <button className="btn primary block" style={{ height: 50 }} disabled={!url.trim() || busy} onClick={go}>
          {busy ? <Loader2 size={17} className="spin" /> : null} {busy ? 'Setting up your sheet…' : 'Connect'}
        </button>
        <div className="tiny faint">The app creates the Transactions, Categories, Accounts, Budgets, Scheduled and Settings tabs with all columns, and starts the hourly job for scheduled expenses.</div>
      </div>
    </div>
  );
}
