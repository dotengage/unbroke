import type { Txn } from '../types';
import { byAccount, byCategory, sortTxns, stats, sum } from './analytics';
import { daysBetween, fmtFull, fmtMonthYear, type Period } from './dates';
import { getCurrency } from './format';

export interface ExportScope {
  start: string;
  end: string;
  categories?: string[];
  accounts?: string[];
  q?: string;
  label?: string;
}

export function filterForExport(txns: Txn[], s: ExportScope): Txn[] {
  const q = (s.q || '').trim().toLowerCase();
  return sortTxns(
    txns.filter(
      (t) =>
        t.date >= s.start && t.date <= s.end &&
        (!s.categories?.length || s.categories.includes(t.category)) &&
        (!s.accounts?.length || s.accounts.includes(t.account)) &&
        (!q || t.note.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.account.toLowerCase().includes(q)),
    ),
  );
}

const fileBase = (s: ExportScope) => `Unbroke ${s.start} to ${s.end}`;

// jsPDF's built-in fonts have no ₹ glyph, so PDFs use the ISO-style prefix.
function pdfMoney(n: number) {
  const c = getCurrency();
  const prefix = c === 'INR' ? 'Rs ' : c === 'USD' ? '$' : c === 'EUR' ? 'EUR ' : c === 'GBP' ? 'GBP ' : c + ' ';
  return prefix + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
}

function monthly(txns: Txn[]) {
  const m = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    const k = t.date.slice(0, 7);
    const v = m.get(k) || { total: 0, count: 0 };
    v.total += t.amount;
    v.count++;
    m.set(k, v);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export async function exportXlsx(txns: Txn[], s: ExportScope) {
  const XLSX = await import('xlsx');
  const p: Period = { preset: 'custom', start: s.start, end: s.end, label: '' };
  const st = stats(txns, p);
  const wb = XLSX.utils.book_new();

  const summary = [
    ['Unbroke expense report'],
    [s.label || 'Expenses', `${fmtFull(s.start)} – ${fmtFull(s.end)}`],
    [],
    ['Total spent', st.total],
    ['Expenses', st.count],
    ['Days', daysBetween(s.start, s.end)],
    ['Average per day', Math.round(st.avgPerDay * 100) / 100],
    ['Average per expense', Math.round(st.avgPerTxn * 100) / 100],
    ['Largest expense', st.largest ? st.largest.amount : 0, st.largest ? `${st.largest.note || st.largest.category} (${st.largest.date})` : ''],
    ['Currency', getCurrency()],
  ];
  if (s.categories?.length) summary.push(['Categories filter', s.categories.join(', ')]);
  if (s.accounts?.length) summary.push(['Accounts filter', s.accounts.join(', ')]);
  const ws0 = XLSX.utils.aoa_to_sheet(summary);
  ws0['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, ws0, 'Summary');

  const rows = txns.map((t) => ({ Date: t.date, Time: t.time, Amount: t.amount, Category: t.category, Account: t.account, Note: t.note, Receipt: t.receipt.startsWith('data:') ? '' : t.receipt, Type: t.source.startsWith('scheduled') ? 'Scheduled' : 'Manual' }));
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1['!cols'] = [{ wch: 11 }, { wch: 7 }, { wch: 11 }, { wch: 18 }, { wch: 16 }, { wch: 34 }, { wch: 30 }, { wch: 10 }];
  ws1['!autofilter'] = { ref: `A1:H${rows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, ws1, 'Transactions');

  const cat = byCategory(txns).map((g) => ({ Category: g.name, Total: Math.round(g.total * 100) / 100, Expenses: g.count, Share: Math.round(g.share * 1000) / 10 + '%' }));
  const ws2 = XLSX.utils.json_to_sheet(cat);
  ws2['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'By category');

  const acc = byAccount(txns).map((g) => ({ Account: g.name, Total: Math.round(g.total * 100) / 100, Expenses: g.count, Share: Math.round(g.share * 1000) / 10 + '%' }));
  const ws3 = XLSX.utils.json_to_sheet(acc);
  ws3['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'By account');

  const mon = monthly(txns).map(([k, v]) => ({ Month: fmtMonthYear(k + '-01'), Total: Math.round(v.total * 100) / 100, Expenses: v.count }));
  const ws4 = XLSX.utils.json_to_sheet(mon);
  ws4['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'By month');

  XLSX.writeFile(wb, `${fileBase(s)}.xlsx`);
}

export async function exportPdf(txns: Txn[], s: ExportScope, opts: { transactions: boolean } = { transactions: true }) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  // the package ships UMD as "main"; depending on interop the function sits at a different depth
  const m = autoTableMod as unknown as { default?: unknown; autoTable?: unknown };
  const d = m.default as { default?: unknown; autoTable?: unknown } | undefined;
  const autoTable = (typeof m.default === 'function' ? m.default : typeof d?.default === 'function' ? d.default : typeof d?.autoTable === 'function' ? d.autoTable : m.autoTable) as typeof autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const ink: [number, number, number] = [11, 11, 15];
  const grey: [number, number, number] = [120, 120, 128];
  const green: [number, number, number] = [52, 211, 153];
  const p: Period = { preset: 'custom', start: s.start, end: s.end, label: '' };
  const st = stats(txns, p);

  // Header with the mark
  doc.setFillColor(...ink);
  doc.roundedRect(M, 36, 34, 34, 8, 8, 'F');
  doc.setDrawColor(245, 245, 247);
  doc.setLineWidth(2.6);
  doc.setLineCap('round');
  doc.line(M + 11, 46, M + 11, 55);
  doc.line(M + 23, 46, M + 23, 55);
  // U bowl approximated with a bezier
  doc.lines([[0, 4.2, 2.7, 7.5, 6, 7.5], [3.3, 0, 6, -3.3, 6, -7.5]], M + 11, 55, [1, 1], 'S', false);
  doc.setFillColor(...green);
  doc.circle(M + 17, 54.5, 2.4, 'F');

  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Unbroke', M + 46, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...grey);
  doc.text(`${s.label || 'Expense report'} · ${fmtFull(s.start)} – ${fmtFull(s.end)}`, M + 46, 66);
  doc.text(`Generated ${fmtFull(new Date().toISOString().slice(0, 10))}`, W - M, 52, { align: 'right' });

  // KPI boxes
  const kpis: [string, string][] = [
    ['Total spent', pdfMoney(Math.round(st.total))],
    ['Expenses', String(st.count)],
    ['Avg per day', pdfMoney(Math.round(st.avgPerDay))],
    ['Avg per expense', pdfMoney(Math.round(st.avgPerTxn))],
  ];
  const bw = (W - 2 * M - 3 * 10) / 4;
  kpis.forEach(([k, v], i) => {
    const x = M + i * (bw + 10);
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(x, 92, bw, 54, 8, 8, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(...grey);
    doc.text(k.toUpperCase(), x + 12, 110);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ink);
    doc.text(v, x + 12, 132);
    doc.setFont('helvetica', 'normal');
  });

  const head = { fillColor: ink, textColor: 245, fontStyle: 'bold' as const, fontSize: 9 };
  const body = { fontSize: 9, textColor: 30, cellPadding: 5 };
  let y = 166;
  const cats = byCategory(txns);
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Expenses', 'Share', 'Total']],
    body: cats.map((g) => [g.name, String(g.count), `${Math.round(g.share * 100)}%`, pdfMoney(Math.round(g.total * 100) / 100)]),
    foot: [['Total', String(st.count), '100%', pdfMoney(Math.round(st.total * 100) / 100)]],
    headStyles: head,
    footStyles: { fillColor: [245, 245, 247], textColor: 20, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: body,
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: M, right: M },
    tableWidth: (W - 2 * M) * 0.58,
  });
  const afterCats = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(doc, {
    startY: y,
    head: [['Account', 'Total']],
    body: byAccount(txns).map((g) => [g.name, pdfMoney(Math.round(g.total * 100) / 100)]),
    headStyles: head,
    bodyStyles: body,
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: M + (W - 2 * M) * 0.62, right: M },
  });
  const afterAccs = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = Math.max(afterCats, afterAccs) + 24;

  if (opts.transactions && txns.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...ink);
    doc.text('Transactions', M, y);
    autoTable(doc, {
      startY: y + 8,
      head: [['Date', 'Note', 'Category', 'Account', 'Amount']],
      body: txns.map((t) => [fmtFull(t.date), (t.note || '').slice(0, 60), t.category, t.account, pdfMoney(t.amount)]),
      foot: [['', '', '', 'Total', pdfMoney(Math.round(sum(txns) * 100) / 100)]],
      headStyles: head,
      footStyles: { fillColor: [245, 245, 247], textColor: 20, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: body,
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: { 0: { cellWidth: 74 }, 4: { halign: 'right', cellWidth: 80 } },
      margin: { left: M, right: M },
      showFoot: 'lastPage',
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grey);
    doc.text(`Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  doc.save(`${fileBase(s)}.pdf`);
}
