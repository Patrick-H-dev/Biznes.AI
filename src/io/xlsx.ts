// XLSX: odczyt szablonu importu oraz eksport planu z działającymi formułami (FR-19).

import ExcelJS from 'exceljs';
import type { PlanCalc } from '../domain/calc';
import { dec } from '../domain/numbers';
import { MONTH_LABELS } from '../domain/seasonality';
import type { BudgetPlan, Category } from '../domain/types';
import type { Table } from './csv';
import { TEMPLATE_EXAMPLE_ROWS, TEMPLATE_HEADERS } from './importer';

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text);
  }
  return String(value);
}

/** Odczytuje pierwszy arkusz pliku XLSX jako tabelę tekstową. */
export async function readXlsx(buffer: ArrayBuffer): Promise<Table> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const width = ws.columnCount;
  const rows: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    rows.push(Array.from({ length: width }, (_, c) => cellText(row.getCell(c + 1).value).trim()));
  }
  const [headers = [], ...data] = rows;
  return { headers, rows: data };
}

export async function templateXlsx(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Import');
  ws.addRow([...TEMPLATE_HEADERS]);
  for (const r of TEMPLATE_EXAMPLE_ROWS) {
    ws.addRow(r.map((v, i) => (v !== '' && i >= 3 && i <= 17 ? Number(v) : v)));
  }
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((col, i) => (col.width = i === 0 || i === 18 ? 28 : 14));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const MONEY_FMT = '#,##0.00';
const PCT_FMT = '0.0%';
const n = (d: { toNumber(): number } | null) => (d ? d.toNumber() : null);

/**
 * Eksport planu. Arkusz „Miesiące” przechowuje kwoty, a „Plan” liczy z nich formułami:
 * kwotę roczną, udział, ROI, ROMI, ROAS, próg rentowności oraz ROMI łączne.
 * Każda formuła ma zapisany wynik, więc plik czyta się poprawnie także bez przeliczenia.
 */
export async function exportPlanXlsx(plan: BudgetPlan, categories: Category[], calc: PlanCalc): Promise<ArrayBuffer> {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Planer budżetu marketingu';
  const ws = wb.addWorksheet('Plan');
  const wm = wb.addWorksheet('Miesiące');
  const wa = wb.addWorksheet('Metodologia');

  // --- Nagłówek planu (wiersze 1–7)
  ws.getCell('A1').value = `${plan.name} – ${plan.year} (wersja ${plan.version}, ${plan.status === 'approved' ? 'zatwierdzony' : 'szkic'})`;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = `Kwoty netto w ${plan.currency}. ROMI liczone na marży brutto; kategorie brand bez ROI.`;
  const leaves = calc.leaves;
  const first = 10;
  const last = first + Math.max(leaves.length, 1) - 1;
  const rng = (col: string) => `${col}${first}:${col}${last}`;

  const head: [string, ExcelJS.CellValue, string?][] = [
    ['Limit budżetu', dec(plan.limit).toNumber(), MONEY_FMT],
    ['Przydzielono', { formula: `SUM(${rng('D')})`, result: calc.allocated.toNumber() }, MONEY_FMT],
    ['Nieprzydzielono', { formula: 'B3-B4', result: calc.unallocated.toNumber() }, MONEY_FMT],
    ['Wykorzystanie limitu', { formula: 'IF(B3=0,"n/d",B4/B3)', result: calc.limitUsage ? calc.limitUsage.dividedBy(100).toNumber() : 'n/d' }, PCT_FMT],
  ];
  head.forEach(([label, value, fmt], i) => {
    const row = 3 + i;
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: true };
    ws.getCell(`B${row}`).value = value;
    if (fmt) ws.getCell(`B${row}`).numFmt = fmt;
  });
  const perfGross = `SUMPRODUCT((${rng('C')}="performance")*${rng('F')}*${rng('G')})`;
  const perfCost = `SUMIF(${rng('C')},"performance",${rng('D')})`;
  const kpis: [string, string, number | string][] = [
    ['ROMI performance', `IF(${perfCost}=0,"n/d",(${perfGross}-${perfCost})/${perfCost})`, calc.performance.romi ? calc.performance.romi.dividedBy(100).toNumber() : 'n/d'],
    ['ROMI całego budżetu', `IF(B4=0,"n/d",(${perfGross}-B4)/B4)`, calc.romiTotal ? calc.romiTotal.dividedBy(100).toNumber() : 'n/d'],
  ];
  kpis.forEach(([label, formula, result], i) => {
    const row = 3 + i;
    ws.getCell(`D${row}`).value = label;
    ws.getCell(`D${row}`).font = { bold: true };
    ws.getCell(`E${row}`).value = { formula, result };
    ws.getCell(`E${row}`).numFmt = PCT_FMT;
  });

  // --- Tabela pozycji
  const headers = ['Kategoria', 'Podkategoria', 'Typ', 'Kwota', 'Udział %', 'Przychód planowany', 'Marża %', 'ROI', 'ROMI', 'ROAS', 'Próg rentowności', 'Założenie'];
  const headerRow = ws.getRow(first - 1);
  headerRow.values = headers;
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE1E0D9' } }));

  wm.getRow(1).values = ['Kategoria', 'Podkategoria', ...MONTH_LABELS, 'Razem'];
  wm.getRow(1).font = { bold: true };

  leaves.forEach((r, i) => {
    const row = first + i;
    const mrow = i + 2;
    const cat = catById.get(r.categoryId);
    const parent = cat?.parentId ? catById.get(cat.parentId) : undefined;
    const topName = parent?.name ?? r.name;
    const subName = parent ? r.name : '';

    // Miesiące (dane wejściowe) + suma
    const mr = wm.getRow(mrow);
    mr.getCell(1).value = topName;
    mr.getCell(2).value = subName;
    r.monthly.forEach((m, k) => {
      mr.getCell(3 + k).value = m.toNumber();
      mr.getCell(3 + k).numFmt = MONEY_FMT;
    });
    mr.getCell(15).value = { formula: `SUM(C${mrow}:N${mrow})`, result: r.cost.toNumber() };
    mr.getCell(15).numFmt = MONEY_FMT;

    const brand = `C${row}="brand"`;
    const nd = (formula: string) => `IF(OR(${brand},D${row}=0),"n/d",${formula})`;
    const ndRes = (v: number | null) => (v === null ? 'n/d' : v);
    const values: ExcelJS.CellValue[] = [
      topName,
      subName,
      r.type,
      { formula: `'Miesiące'!O${mrow}`, result: r.cost.toNumber() },
      { formula: `IF(SUM(${rng('D')})=0,0,D${row}/SUM(${rng('D')}))`, result: r.share.dividedBy(100).toNumber() },
      r.type === 'performance' ? r.revenue.toNumber() : null,
      r.margin ? r.margin.toNumber() : null,
      { formula: nd(`(F${row}-D${row})/D${row}`), result: ndRes(r.roi ? n(r.roi.dividedBy(100)) : null) },
      { formula: nd(`(F${row}*G${row}-D${row})/D${row}`), result: ndRes(r.romi ? n(r.romi.dividedBy(100)) : null) },
      { formula: nd(`F${row}/D${row}`), result: ndRes(n(r.roas)) },
      { formula: `IF(OR(${brand},N(G${row})=0),"n/d",D${row}/G${row})`, result: ndRes(n(r.breakeven)) },
      r.line?.assumption ?? '',
    ];
    const xr = ws.getRow(row);
    xr.values = values;
    xr.getCell(4).numFmt = MONEY_FMT;
    xr.getCell(5).numFmt = PCT_FMT;
    xr.getCell(6).numFmt = MONEY_FMT;
    xr.getCell(7).numFmt = PCT_FMT;
    xr.getCell(8).numFmt = PCT_FMT;
    xr.getCell(9).numFmt = PCT_FMT;
    xr.getCell(10).numFmt = '0.00';
    xr.getCell(11).numFmt = MONEY_FMT;
  });

  const totalRow = last + 1;
  const tr = ws.getRow(totalRow);
  tr.getCell(1).value = 'RAZEM';
  tr.getCell(4).value = { formula: `SUM(${rng('D')})`, result: calc.allocated.toNumber() };
  tr.getCell(5).value = { formula: `SUM(${rng('E')})`, result: calc.allocated.isZero() ? 0 : 1 };
  tr.getCell(6).value = { formula: `SUM(${rng('F')})`, result: calc.performance.revenue.toNumber() };
  tr.getCell(9).value = { formula: 'E4', result: calc.romiTotal ? calc.romiTotal.dividedBy(100).toNumber() : 'n/d' };
  tr.font = { bold: true };
  tr.getCell(4).numFmt = MONEY_FMT;
  tr.getCell(5).numFmt = PCT_FMT;
  tr.getCell(6).numFmt = MONEY_FMT;
  tr.getCell(9).numFmt = PCT_FMT;

  const mTotal = wm.getRow(leaves.length + 2);
  mTotal.getCell(1).value = 'RAZEM';
  mTotal.font = { bold: true };
  for (let c = 3; c <= 15; c++) {
    const col = String.fromCharCode(64 + c);
    const result = c === 15 ? calc.allocated.toNumber() : calc.monthlyTotals[c - 3].toNumber();
    mTotal.getCell(c).value = { formula: `SUM(${col}2:${col}${leaves.length + 1})`, result };
    mTotal.getCell(c).numFmt = MONEY_FMT;
  }

  ws.columns.forEach((col, i) => (col.width = [22, 18, 13, 16, 10, 18, 10, 10, 10, 9, 18, 44][i] ?? 12));
  wm.columns.forEach((col, i) => (col.width = i < 2 ? 20 : 13));
  ws.views = [{ state: 'frozen', ySplit: first - 1 }];

  // --- Metodologia
  const method = [
    ['Miara', 'Wzór'],
    ['Udział kategorii', 'K_i / Σ K_j'],
    ['ROI przychodowe (pomocnicze)', '(P_i − K_i) / K_i'],
    ['ROMI na marży (główne)', '(P_i × m_i − K_i) / K_i'],
    ['ROAS', 'P_i / K_i'],
    ['ROMI performance', 'Σ_perf (P_i × m_i − K_i) / Σ_perf K_i'],
    ['ROMI całego budżetu', '(Σ_perf P_i × m_i − Σ_all K_i) / Σ_all K_i'],
    ['Próg rentowności', 'K_i / m_i'],
    [],
    ['Kategorie brand wchodzą do mianownika ROMI całego budżetu, ale nie mają własnego ROI (n/d).'],
    ['ROI łączne liczone wyłącznie z sum, nigdy jako średnia ROI kategorii.'],
    ['Przychód przypisany = przychód inkrementalny oczekiwany dzięki kategorii.'],
  ];
  method.forEach((r) => wa.addRow(r));
  wa.getRow(1).font = { bold: true };
  wa.getColumn(1).width = 34;
  wa.getColumn(2).width = 48;

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
