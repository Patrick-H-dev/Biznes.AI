import { describe, expect, it } from 'vitest';
import { emptyData } from '../domain/defaults';
import { Decimal } from '../domain/numbers';
import { createLine, createPlan } from '../domain/planOps';
import { parseCsv, toCsv } from './csv';
import { applyImport, autoMap, buildPreview, TEMPLATE_EXAMPLE_ROWS, TEMPLATE_HEADERS } from './importer';

const data = emptyData();
const plan = () => createPlan({ year: new Date().getFullYear(), name: 'P', currency: 'PLN', limit: '1000000', defaultMarginPct: '35', salesTarget: null });
const csv = (rows: string[][], sep: ',' | ';' = ',') => toCsv([...TEMPLATE_HEADERS], rows, sep);
const row = (o: Partial<Record<(typeof TEMPLATE_HEADERS)[number], string>>) => TEMPLATE_HEADERS.map((h) => o[h] ?? '');

function preview(text: string) {
  const table = parseCsv(text);
  return buildPreview(table, autoMap(table.headers), data.categories, new Decimal(1000000));
}

describe('CSV', () => {
  it('wykrywa separator ; i obsługuje cudzysłowy', () => {
    const t = parseCsv('kategoria;kwota_roczna;zalozenie\r\n"Radio";"90 000,50";"Q2; Q4 ""wizerunek"""\n');
    expect(t.headers).toEqual(['kategoria', 'kwota_roczna', 'zalozenie']);
    expect(t.rows[0]).toEqual(['Radio', '90 000,50', 'Q2; Q4 "wizerunek"']);
  });

  it('szablon z PRD importuje się bez błędów', () => {
    const p = preview(csv(TEMPLATE_EXAMPLE_ROWS));
    expect(p.mappingErrors).toEqual([]);
    expect(p.errorRowCount).toBe(0);
    const res = applyImport(p, plan(), data.categories, { mode: 'replace', skipErrorRows: false });
    expect(res.report.imported).toBe(2);
    expect(res.report.createdCategories).toEqual(['Social media → Meta']);
    const meta = res.categories.find((c) => c.name === 'Meta')!;
    expect(meta.type).toBe('performance');
    const line = res.lines.find((l) => l.categoryId === meta.id)!;
    expect(line.annualAmount).toBe('120000');
    expect(line.revenue).toBe('480000');
    expect(line.marginPct).toBe('35');
  });
});

describe('walidacja importu', () => {
  it('kwota ujemna: błąd z numerem wiersza, nic nie jest importowane bez pominięcia', () => {
    const p = preview(csv([row({ kategoria: 'Radio', typ: 'brand', kwota_roczna: '100' }), row({ kategoria: 'PR', typ: 'brand', kwota_roczna: '-5' })]));
    expect(p.errorRowCount).toBe(1);
    const bad = p.rows.find((r) => r.errors.length)!;
    expect(bad.rowNumber).toBe(3);
    expect(bad.errors[0]).toContain('ujemna');
    expect(() => applyImport(p, plan(), data.categories, { mode: 'replace', skipErrorRows: false })).toThrow();
    const res = applyImport(p, plan(), data.categories, { mode: 'replace', skipErrorRows: true });
    expect(res.report.imported).toBe(1);
    expect(res.report.skipped).toEqual([{ rowNumber: 3, reason: 'Kwota roczna jest ujemna.' }]);
  });

  it('błędy blokujące: brak kategorii, nieznany typ, suma miesięcy ≠ kwota', () => {
    const months = { sty: '100', lut: '100' };
    const p = preview(
      csv([
        row({ typ: 'brand', kwota_roczna: '1' }),
        row({ kategoria: 'X', typ: 'wizerunek', kwota_roczna: '1' }),
        row({ kategoria: 'Radio', typ: 'brand', kwota_roczna: '300', ...months }),
      ]),
    );
    expect(p.rows.map((r) => r.errors.length > 0)).toEqual([true, true, true]);
    expect(p.rows[2].errors[0]).toContain('Suma miesięcy');
  });

  it('kolumny miesięczne bez kwoty rocznej → kwota = suma, tryb miesięczny', () => {
    const p = preview(csv([row({ kategoria: 'Radio', typ: 'brand', sty: '1 000,50', gru: '999,50' })]));
    expect(p.errorRowCount).toBe(0);
    const res = applyImport(p, plan(), data.categories, { mode: 'replace', skipErrorRows: false });
    expect(res.lines[0].mode).toBe('monthly');
    expect(res.lines[0].annualAmount).toBe('2000');
  });

  it('ostrzeżenia: nowa kategoria spoza słownika i przekroczenie limitu', () => {
    const p = preview(csv([row({ kategoria: 'Podcasty', typ: 'brand', kwota_roczna: '2000000' })]));
    expect(p.rows[0].warnings[0]).toContain('Nowa kategoria');
    expect(p.globalWarnings[0]).toContain('przekracza limit');
  });

  it('tryb scalania aktualizuje istniejące i dodaje nowe kategorie', () => {
    const radio = data.categories.find((c) => c.name === 'Radio')!;
    const pr = data.categories.find((c) => c.name === 'PR')!;
    const p0 = plan();
    p0.lines = [{ ...createLine(radio.id), annualAmount: '5' }, { ...createLine(pr.id), annualAmount: '7' }];
    const p = preview(csv([row({ kategoria: 'radio', typ: 'brand', kwota_roczna: '50' }), row({ kategoria: 'TV', typ: 'brand', kwota_roczna: '9' })]));
    const merged = applyImport(p, p0, data.categories, { mode: 'merge', skipErrorRows: false });
    expect(merged.lines.map((l) => l.annualAmount)).toEqual(['50', '7', '9']);
    const replaced = applyImport(p, p0, data.categories, { mode: 'replace', skipErrorRows: false });
    expect(replaced.lines.map((l) => l.annualAmount)).toEqual(['50', '9']);
  });

  it('mapowanie po nagłówkach z polskimi znakami i aliasami', () => {
    const m = autoMap(['Kategoria', 'Typ', 'Kwota', 'Przychód', 'Marża %', 'Założenie', 'Październik']);
    expect(m.kategoria).toBe(0);
    expect(m.kwota_roczna).toBe(2);
    expect(m.przychod_planowany).toBe(3);
    expect(m.marza_proc).toBe(4);
    expect(m.zalozenie).toBe(5);
    expect(m.paz).toBe(6);
  });
});
