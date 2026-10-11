// Eksport PDF: podsumowanie planu dla zarządu na 1–2 stronach A4 (FR-19).

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fontRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import fontBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import type { PlanCalc, RowCalc } from '../domain/calc';
import { formatMoney, formatNumber, formatPct } from '../domain/numbers';
import type { BudgetPlan } from '../domain/types';

async function fontBase64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

// jsPDF nie zna niełamliwych spacji w DejaVu po podziale wiersza – zamieniamy na zwykłe.
const t = (s: string) => s.replace(/[  ]/g, ' ').replace(/−/g, '-');

const INK = '#0b0b0b';
const INK2 = '#52514e';
const MUTED = '#898781';
const GRID = '#e1e0d9';
const BAR = '#2a78d6';
const CRITICAL = '#d03b3b';

export async function exportPlanPdf(plan: BudgetPlan, calc: PlanCalc): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('DejaVuSans.ttf', await fontBase64(fontRegularUrl));
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', await fontBase64(fontBoldUrl));
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  doc.setFont('DejaVu', 'normal');

  const M = 14;
  const W = 210 - 2 * M;
  const cur = plan.currency;
  let y = M;

  doc.setFont('DejaVu', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text(t(`${plan.name} – budżet marketingu ${plan.year}`), M, y + 4);
  y += 10;
  doc.setFont('DejaVu', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(INK2);
  const status = plan.status === 'approved' ? `zatwierdzony ${new Date(plan.approvedAt!).toLocaleDateString('pl-PL')}` : 'szkic (niezatwierdzony)';
  doc.text(t(`Wersja ${plan.version} · ${status} · kwoty netto w ${cur} · wygenerowano ${new Date().toLocaleDateString('pl-PL')}`), M, y);
  y += 7;

  // --- Kafle KPI
  const tiles: [string, string][] = [
    ['Limit budżetu', formatMoney(calc.limit, cur)],
    ['Przydzielono', formatMoney(calc.allocated, cur)],
    [calc.unallocated.isNegative() ? 'Przekroczenie limitu' : 'Nieprzydzielono', formatMoney(calc.unallocated.abs(), cur)],
    ['Wykorzystanie limitu', formatPct(calc.limitUsage)],
    ['ROMI performance', calc.performance.romi ? formatPct(calc.performance.romi) : 'n/d'],
    ['ROMI całego budżetu', calc.romiTotal ? formatPct(calc.romiTotal) : 'n/d'],
  ];
  const tw = (W - 5 * 3) / 6;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tw + 3);
    doc.setDrawColor(GRID);
    doc.roundedRect(x, y, tw, 16, 1.5, 1.5, 'S');
    doc.setFontSize(6.5);
    doc.setTextColor(INK2);
    doc.text(t(label), x + 2.5, y + 5);
    doc.setFont('DejaVu', 'bold');
    doc.setFontSize(9);
    const neg = (i === 2 && calc.unallocated.isNegative()) || (i >= 4 && value.startsWith('−'));
    doc.setTextColor(neg ? CRITICAL : INK);
    doc.text(t(value), x + 2.5, y + 11.5, { maxWidth: tw - 4 });
    doc.setFont('DejaVu', 'normal');
  });
  y += 23;

  // --- Struktura budżetu: słupki poziome z udziałem %
  doc.setFont('DejaVu', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  doc.text('Struktura budżetu', M, y);
  y += 5;
  doc.setFont('DejaVu', 'normal');
  const rows = [...calc.rows].sort((a, b) => b.cost.comparedTo(a.cost));
  const maxShare = Math.max(...rows.map((r) => r.share.toNumber()), 1);
  const labelW = 42;
  const barMax = W - labelW - 26;
  const bh = 4.2;
  for (const r of rows) {
    doc.setFontSize(7.5);
    doc.setTextColor(INK2);
    doc.text(t(r.name), M, y + 3.2, { maxWidth: labelW - 2 });
    const w = Math.max(0.6, (r.share.toNumber() / maxShare) * barMax);
    doc.setFillColor(BAR);
    doc.roundedRect(M + labelW, y, w, bh, 0.8, 0.8, 'F');
    doc.setTextColor(INK);
    doc.text(t(`${formatPct(r.shareDisplay)}${r.type === 'brand' ? ' · brand' : ''}`), M + labelW + w + 2, y + 3.2);
    y += bh + 1.8;
  }
  y += 4;

  // --- Tabela kategorii
  const body: string[][] = [];
  const pushRow = (r: RowCalc, indent: boolean) => {
    const brand = r.type === 'brand';
    body.push([
      t(`${indent ? '   ↳ ' : ''}${r.name}`),
      brand ? 'brand' : 'perf.',
      t(formatMoney(r.cost)),
      t(formatPct(r.shareDisplay)),
      brand ? '–' : t(formatMoney(r.revenue)),
      brand ? 'n/d' : r.romi ? t(formatPct(r.romi)) : 'n/d',
      brand ? 'n/d' : r.roas ? t(formatNumber(r.roas, 1, 1)) : 'n/d',
      brand ? '–' : r.breakeven ? t(formatMoney(r.breakeven)) : '–',
    ]);
  };
  for (const r of calc.rows) {
    pushRow(r, false);
    r.children.forEach((c) => pushRow(c, true));
  }
  body.push([
    'RAZEM',
    '',
    t(formatMoney(calc.allocated)),
    calc.allocated.isZero() ? '–' : '100,0%',
    t(formatMoney(calc.performance.revenue)),
    calc.romiTotal ? t(formatPct(calc.romiTotal)) : 'n/d',
    calc.performance.roas ? t(formatNumber(calc.performance.roas, 1, 1)) : 'n/d',
    '',
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Kategoria', 'Typ', `Kwota (${cur})`, 'Udział', 'Przychód', 'ROMI', 'ROAS', 'Próg rentown.']],
    body,
    styles: { font: 'DejaVu', fontSize: 7.5, cellPadding: 1.4, textColor: INK, lineColor: GRID, lineWidth: 0.1 },
    headStyles: { fillColor: '#f0efec', textColor: INK, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 46 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (data.row.index === body.length - 1) data.cell.styles.fontStyle = 'bold';
      if (data.column.index === 5 && String(data.cell.raw).startsWith('-')) data.cell.styles.textColor = CRITICAL;
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // --- Ostrzeżenia
  const ensure = (h: number) => {
    if (y + h > 297 - M) {
      doc.addPage();
      y = M;
    }
  };
  const relevant = calc.warnings.filter((w) => w.severity !== 'info');
  if (relevant.length > 0) {
    ensure(12);
    doc.setFont('DejaVu', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    doc.text('Ostrzeżenia', M, y);
    y += 5;
    doc.setFont('DejaVu', 'normal');
    doc.setFontSize(7.5);
    for (const w of relevant) {
      const lines = doc.splitTextToSize(t(`${w.severity === 'critical' ? '!' : '•'} ${w.message}`), W);
      ensure(lines.length * 3.6);
      doc.setTextColor(w.severity === 'critical' ? CRITICAL : INK2);
      doc.text(lines, M, y);
      y += lines.length * 3.6;
    }
    y += 3;
  }

  // --- Założenia prognoz
  const assumptions = calc.leaves.filter((r) => r.type === 'performance' && r.line?.assumption.trim());
  if (assumptions.length > 0) {
    ensure(12);
    doc.setFont('DejaVu', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    doc.text('Założenia prognoz przychodu', M, y);
    y += 5;
    doc.setFont('DejaVu', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(INK2);
    for (const r of assumptions) {
      const lines = doc.splitTextToSize(t(`${r.name}: ${r.line!.assumption}`), W);
      ensure(lines.length * 3.6);
      doc.text(lines, M, y);
      y += lines.length * 3.6;
    }
    y += 3;
  }

  ensure(14);
  doc.setFontSize(6.5);
  doc.setTextColor(MUTED);
  const note = doc.splitTextToSize(
    t(
      'Metodologia: ROMI = (przychód przypisany × marża brutto − koszt) / koszt. ROMI całego budżetu = (Σ marża brutto z kategorii performance − Σ kosztów wszystkich kategorii) / Σ kosztów. Kategorie wizerunkowe (brand) nie mają własnego ROI, ale ich koszt obniża ROMI całego budżetu. Przychód przypisany to przychód inkrementalny – prognoza, nie wynik.',
    ),
    W,
  );
  doc.text(note, M, y);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED);
    doc.text(`${p}/${pages}`, 210 - M, 297 - 7, { align: 'right' });
  }
  return doc.output('blob');
}
