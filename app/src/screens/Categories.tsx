import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronLeft, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Category, Op } from '../types';
import { EntityEditor } from '../components/EntityEditor';
import { IconTile } from '../components/Icon';
import { spring } from '../components/ui';
import { back, useData } from '../lib/hooks';
import { mutate, toast } from '../lib/store';

export function Categories() {
  const { categories, txns, scheduled, budgets } = useData();
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txns) m.set(t.category.toLowerCase(), (m.get(t.category.toLowerCase()) || 0) + 1);
    return m;
  }, [txns]);
  const schedCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scheduled) m.set(s.category.toLowerCase(), (m.get(s.category.toLowerCase()) || 0) + 1);
    return m;
  }, [scheduled]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= categories.length) return;
    const list = categories.slice();
    [list[i], list[j]] = [list[j], list[i]];
    mutate(list.filter((c, k) => c.order !== k).map((c) => ({ op: 'upsert' as const, table: 'Categories' as const, row: { id: c.id, order: list.indexOf(c) } })));
  };

  const del = (c: Category) => {
    const used = counts.get(c.name.toLowerCase()) || 0;
    const sched = schedCounts.get(c.name.toLowerCase()) || 0;
    if (used > 0) {
      toast(`${c.name} has ${used} expense${used === 1 ? '' : 's'}, so it can’t be deleted. You can hide it instead.`, { tone: 'error' });
      return;
    }
    if (sched > 0) {
      toast(`${c.name} is used by ${sched} scheduled expense${sched === 1 ? '' : 's'}. Change or delete those first.`, { tone: 'error' });
      return;
    }
    const linked = budgets.filter((b) => b.category === c.name);
    const ops: Op[] = [...linked.map((b) => ({ op: 'delete' as const, table: 'Budgets' as const, id: b.id })), { op: 'delete', table: 'Categories', id: c.id }];
    mutate(ops);
    toast(`${c.name} deleted${linked.length ? ' with its budget' : ''}`, {
      action: {
        label: 'Undo',
        run: () =>
          mutate([
            { op: 'upsert', table: 'Categories', row: c as unknown as Record<string, unknown> },
            ...linked.map((b) => ({ op: 'upsert' as const, table: 'Budgets' as const, row: b as unknown as Record<string, unknown> })),
          ]),
      },
    });
  };

  return (
    <div className="page">
      <header className="header">
        <button className="icon-btn" onClick={back} aria-label="Back"><ChevronLeft size={20} /></button>
        <h1 className="large-title grow">Categories</h1>
        <button className="btn sm" onClick={() => setEditing(null)}><Plus size={16} /> New</button>
      </header>
      <p className="small muted" style={{ margin: '0 2px 14px' }}>Tap a category to edit it, or × to delete it. Categories that already have expenses can only be hidden.</p>
      <div className="card flush list">
        <AnimatePresence initial={false}>
          {categories.map((c, i) => {
            const used = counts.get(c.name.toLowerCase()) || 0;
            const locked = used > 0 || (schedCounts.get(c.name.toLowerCase()) || 0) > 0;
            return (
              <motion.div
                key={c.id || c.name}
                layout="position"
                className="row"
                style={{ gap: 0, opacity: c.archived ? 0.5 : 1, overflow: 'hidden', borderTop: i ? '1px solid var(--line)' : undefined }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: c.archived ? 0.5 : 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, x: 40 }}
                transition={spring}
              >
                <button className="list-row" onClick={() => setEditing(c)}>
                  <IconTile icon={c.icon} color={c.color} />
                  <div className="main-col">
                    <div className="title">{c.name}{c.archived ? ' (hidden)' : ''}</div>
                    <div className="meta">{used} expense{used === 1 ? '' : 's'}</div>
                  </div>
                </button>
                <div className="row" style={{ gap: 2, paddingRight: 8 }}>
                  <button className="icon-btn plain" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" style={{ opacity: i === 0 ? 0.25 : 1 }}><ArrowUp size={16} /></button>
                  <button className="icon-btn plain" onClick={() => move(i, 1)} disabled={i === categories.length - 1} aria-label="Move down" style={{ opacity: i === categories.length - 1 ? 0.25 : 1 }}><ArrowDown size={16} /></button>
                  <button
                    className="icon-btn"
                    onClick={() => del(c)}
                    aria-label={locked ? `${c.name} has expenses and can't be deleted` : `Delete ${c.name}`}
                    title={locked ? 'Has expenses, can’t be deleted' : 'Delete'}
                    style={{ width: 30, height: 30, marginLeft: 4, background: locked ? 'transparent' : 'var(--danger-soft)', color: locked ? 'var(--text-3)' : 'var(--danger)', opacity: locked ? 0.35 : 1 }}
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <EntityEditor kind="category" open={editing !== undefined} item={editing} onClose={() => setEditing(undefined)} existing={categories.map((c) => c.name)} usage={editing ? counts.get(editing.name.toLowerCase()) || 0 : 0} />
    </div>
  );
}
