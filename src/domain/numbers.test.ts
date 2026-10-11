import { describe, expect, it } from 'vitest';
import { Decimal, formatMoney, formatNumber, formatPct, parseNumber, parsePercent } from './numbers';
import { distribute } from './seasonality';
import { copyPlanToYear, createLine, createPlan } from './planOps';

describe('parsowanie liczb (PRD, sekcja 8)', () => {
  it.each([
    ['120000', '120000'],
    ['120 000', '120000'],
    ['120000,50', '120000.5'],
    ['120 000,50', '120000.5'],
    ['120 000', '120000'],
    ['120000.50', '120000.5'],
    ['1.200.000', '1200000'],
    ['1.200.000,25', '1200000.25'],
  ])('%s → %s', (input, expected) => {
    expect(parseNumber(input)!.toFixed()).toBe(expected);
  });

  it.each(['abc', '12,3,4', '1,000.50', '12a'])('odrzuca %s', (input) => {
    expect(parseNumber(input)).toBeNull();
  });

  it('procent jako 35 lub 35%', () => {
    expect(parsePercent('35')!.toFixed()).toBe('35');
    expect(parsePercent('35%')!.toFixed()).toBe('35');
    expect(parsePercent('35,5 %')!.toFixed()).toBe('35.5');
  });
});

describe('formatowanie pl-PL', () => {
  it('spacja tysięcy, przecinek dziesiętny', () => {
    expect(formatMoney(new Decimal('342857.142857'), 'PLN')).toBe('342 857,14 PLN');
    expect(formatMoney(new Decimal('1000'))).toBe('1 000');
    expect(formatPct(new Decimal('40'))).toBe('40,0%');
    expect(formatNumber(new Decimal('-16.04'), 1, 1)).toBe('−16,0');
  });
});

describe('rozkład miesięczny', () => {
  it('suma miesięcy = kwota co do grosza', () => {
    const parts = distribute(new Decimal('100000.01'), [0.7, 0.7, 0.8, 0.9, 0.9, 0.8, 0.7, 0.7, 1, 1.2, 1.8, 1.8]);
    expect(parts.reduce((a, b) => a.plus(b)).toFixed(2)).toBe('100000.01');
    expect(distribute(new Decimal(100), Array(12).fill(1)).map((p) => p.toFixed(2))[0]).toBe('8.34');
  });
});

describe('kopiowanie planu z korektą', () => {
  it('skaluje limit, koszty i przychody o +5%', () => {
    const src = createPlan({ year: 2026, name: 'A', currency: 'PLN', limit: '1000000', defaultMarginPct: '35', salesTarget: null });
    src.lines = [
      { ...createLine('x'), annualAmount: '120000', revenue: '480000' },
      { ...createLine('y'), mode: 'monthly', monthly: Array(12).fill('1000.10'), annualAmount: '12001.2' },
    ];
    const copy = copyPlanToYear(src, 2027, '5');
    expect(copy.limit).toBe('1050000');
    expect(copy.lines[0].annualAmount).toBe('126000');
    expect(copy.lines[0].revenue).toBe('504000');
    expect(copy.lines[1].monthly![0]).toBe('1050.11');
    expect(copy.lines[1].annualAmount).toBe('12601.32');
    expect(copy.status).toBe('draft');
    expect(copy.sourcePlanId).toBe(src.id);
  });
});
