import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { pull, useStore } from '../lib/store';

function ago(ts: number | null) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 30) return 'just now';
  if (s < 3600) return `${Math.round(s / 60) || 1}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function SyncBadge() {
  const status = useStore((s) => s.status);
  const conn = useStore((s) => s.conn);
  const lastSync = useStore((s) => s.lastSync);
  const pending = useStore((s) => s.pending.length);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 20000);
    return () => clearInterval(t);
  }, []);
  if (conn?.mode === 'demo') return <span className="sync offline"><i /> Demo mode</span>;
  const text =
    status === 'syncing' ? 'Syncing…' : status === 'offline' ? `Offline${pending ? ` · ${pending} pending` : ''}` : status === 'error' ? 'Sync error' : pending ? `${pending} pending` : `Synced ${ago(lastSync)}`;
  return (
    <button className={`sync ${status}`} onClick={() => pull(true)} title="Sync now">
      <i /> {text}
      {status !== 'syncing' && <RefreshCw size={11} />}
    </button>
  );
}
