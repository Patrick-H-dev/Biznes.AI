import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { calculatePlan } from '../domain/calc';
import { demoData } from '../domain/demo';
import { autoMap, buildPreview } from './importer';
import { exportPlanXlsx, readXlsx, templateXlsx } from './xlsx';

describe('XLSX', () => {
  it('eksport zawiera działające formuły udziału i ROMI z zapisanymi wynikami', async () => {
    const data = demoData();
    const plan = data.plans[1];
    const calc = calculatePlan(plan, data.categories, data.settings.thresholds);
    const buf = await exportPlanXlsx(plan, data.categories, calc);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Plan')!;
    const share = ws.getCell('E10').value as ExcelJS.CellFormulaValue;
    expect(share.formula).toMatch(/^IF\(SUM\(D10:D\d+\)=0,0,D10\/SUM/);
    const romi = ws.getCell('I10').value as ExcelJS.CellFormulaValue;
    expect(romi.formula).toContain('(F10*G10-D10)/D10');
    const total = ws.getCell('E4').value as ExcelJS.CellFormulaValue;
    expect(total.formula).toContain('SUMPRODUCT');
    expect(Number(total.result)).toBeCloseTo(calc.romiTotal!.dividedBy(100).toNumber(), 10);
    const amount = ws.getCell('D10').value as ExcelJS.CellFormulaValue;
    expect(amount.formula).toBe("'Miesiące'!O2");
  });

  it('szablon XLSX daje się wczytać z powrotem', async () => {
    const table = await readXlsx(await templateXlsx());
    expect(table.headers[0]).toBe('kategoria');
    const p = buildPreview(table, autoMap(table.headers), demoData().categories, null);
    expect(p.errorRowCount).toBe(0);
    expect(p.rows).toHaveLength(2);
  });
});
