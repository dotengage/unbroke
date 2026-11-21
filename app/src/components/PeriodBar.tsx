import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { periodFor, todayKey, type Period, type Preset } from '../lib/dates';
import { Segmented } from './ui';

export interface PeriodState {
  preset: Preset;
  offset: number;
  custom: { start: string; end: string };
}

export function usePeriod(initial: Preset = 'month', weekStart = 1) {
  const [s, setS] = useState<PeriodState>({ preset: initial, offset: 0, custom: { start: todayKey().slice(0, 8) + '01', end: todayKey() } });
  const period: Period = periodFor(s.preset, s.offset, weekStart, s.custom);
  return { state: s, setState: setS, period };
}

export function PeriodBar({ state, setState, period, presets = ['week', 'month', 'year', 'custom'], count }: {
  state: PeriodState;
  setState: (s: PeriodState) => void;
  period: Period;
  presets?: Preset[];
  count?: number;
}) {
  const labels: Record<Preset, string> = { today: 'Today', week: 'Week', month: 'Month', year: 'Year', custom: 'Custom' };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Segmented value={state.preset} options={presets.map((p) => ({ value: p, label: labels[p] }))} onChange={(p) => setState({ ...state, preset: p, offset: 0 })} />
      {state.preset === 'custom' ? (
        <div className="card row" style={{ padding: 10, gap: 8 }}>
          <input type="date" className="input" style={{ height: 40 }} value={state.custom.start} max={state.custom.end} onChange={(e) => e.target.value && setState({ ...state, custom: { ...state.custom, start: e.target.value } })} aria-label="From" />
          <span className="faint">→</span>
          <input type="date" className="input" style={{ height: 40 }} value={state.custom.end} min={state.custom.start} onChange={(e) => e.target.value && setState({ ...state, custom: { ...state.custom, end: e.target.value } })} aria-label="To" />
        </div>
      ) : (
        <div className="card row between" style={{ padding: '8px 8px' }}>
          <button className="icon-btn plain" onClick={() => setState({ ...state, offset: state.offset - 1 })} aria-label="Previous">
            <ChevronLeft size={20} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 650 }}>{period.label}</div>
            {count !== undefined && <div className="tiny faint" style={{ letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>{count} expense{count === 1 ? '' : 's'}</div>}
          </div>
          <button className="icon-btn plain" onClick={() => setState({ ...state, offset: Math.min(0, state.offset + 1) })} disabled={state.offset >= 0} style={{ opacity: state.offset >= 0 ? 0.3 : 1 }} aria-label="Next">
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
