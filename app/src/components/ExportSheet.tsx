import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { sum } from '../lib/analytics';
import { addMonths, endOfMonth, startOfMonth, todayKey } from '../lib/dates';
import { exportPdf, exportXlsx, filterForExport, type ExportScope } from '../lib/export';
import { money } from '../lib/format';
import { closeExport, useData, useUI } from '../lib/hooks';
import { toast } from '../lib/store';
import { Segmented, Sheet, Switch } from './ui';

export function ExportSheet() {
  const { exportOpen, exportScope } = useUI();
  return (
    <Sheet open={exportOpen} onClose={closeExport} title="Export">
      {exportOpen && <ExportForm key={JSON.stringify(exportScope || {})} initial={exportScope} />}
    </Sheet>
  );
}

function ExportForm({ initial }: { initial?: ExportScope }) {
  const { txns } = useData();
  const t = todayKey();
  const [scope, setScope] = useState<ExportScope>(initial || { start: startOfMonth(t), end: endOfMonth(t), label: 'This month' });
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [withTx, setWithTx] = useState(true);
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => filterForExport(txns, scope), [txns, scope]);

  const presets: [string, () => ExportScope][] = [
    ['This month', () => ({ ...scope, start: startOfMonth(t), end: endOfMonth(t), label: 'This month' })],
    ['Last month', () => { const s = addMonths(startOfMonth(t), -1); return { ...scope, start: s, end: endOfMonth(s), label: 'Last month' }; }],
    ['This year', () => ({ ...scope, start: t.slice(0, 4) + '-01-01', end: t.slice(0, 4) + '-12-31', label: t.slice(0, 4) })],
    ['All time', () => ({ ...scope, start: txns.reduce((m, x) => (x.date < m ? x.date : m), t), end: t, label: 'All time' })],
  ];

  const run = async () => {
    setBusy(true);
    try {
      if (format === 'pdf') await exportPdf(list, scope, { transactions: withTx });
      else await exportXlsx(list, scope);
      toast(`${format === 'pdf' ? 'PDF' : 'Excel file'} downloaded`);
      closeExport();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field">
        <span>Format</span>
        <Segmented value={format} options={[{ value: 'pdf', label: 'PDF report' }, { value: 'xlsx', label: 'Excel (.xlsx)' }]} onChange={setFormat} />
      </div>
      <div className="field">
        <span>Period</span>
        <div className="row" style={{ gap: 8 }}>
          <input type="date" className="input" value={scope.start} max={scope.end} onChange={(e) => e.target.value && setScope({ ...scope, start: e.target.value, label: 'Custom range' })} aria-label="From" />
          <span className="faint">→</span>
          <input type="date" className="input" value={scope.end} min={scope.start} onChange={(e) => e.target.value && setScope({ ...scope, end: e.target.value, label: 'Custom range' })} aria-label="To" />
        </div>
        <div className="chips" style={{ marginTop: 4 }}>
          {presets.map(([l, f]) => <button key={l} className={`chip ${scope.label === l ? 'on' : ''}`} style={{ height: 30, fontSize: 12.5 }} onClick={() => setScope(f())}>{l}</button>)}
        </div>
      </div>
      {(scope.categories?.length || scope.accounts?.length || scope.q) ? (
        <div className="small muted" style={{ background: 'var(--fill-2)', borderRadius: 12, padding: '10px 12px' }}>
          Filters applied: {[scope.categories?.join(', '), scope.accounts?.join(', '), scope.q && `“${scope.q}”`].filter(Boolean).join(' · ')}
          <button className="small" style={{ color: 'var(--accent-ink)', fontWeight: 600, marginLeft: 8 }} onClick={() => setScope({ ...scope, categories: [], accounts: [], q: '' })}>Remove</button>
        </div>
      ) : null}
      {format === 'pdf' && (
        <div className="row between">
          <div>
            <div style={{ fontWeight: 600 }}>Include every transaction</div>
            <div className="tiny faint">Off gives a one-page summary</div>
          </div>
          <Switch on={withTx} onChange={setWithTx} label="Include transactions" />
        </div>
      )}
      <div className="card row" style={{ background: 'var(--fill-2)', boxShadow: 'none' }}>
        {format === 'pdf' ? <FileText size={28} className="muted" /> : <FileSpreadsheet size={28} className="muted" />}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650 }}>{list.length} expenses · <span className="num">{money(sum(list))}</span></div>
          <div className="tiny faint">{format === 'pdf' ? 'Summary, category & account tables' + (withTx ? ', full list' : '') : 'Sheets: Summary, Transactions, By category, By account, By month'}</div>
        </div>
      </div>
      <button className="btn primary block" style={{ height: 50 }} onClick={run} disabled={busy || !list.length}>
        {busy && <Loader2 size={16} className="spin" />} {busy ? 'Preparing…' : `Download ${format === 'pdf' ? 'PDF' : 'Excel'}`}
      </button>
    </div>
  );
}
