import { describe, expect, it } from 'vitest';
import { calculatePlan, roundShares } from './calc';
import { emptyData } from './defaults';
import { Decimal, sum } from './numbers';
import { createLine, createPlan } from './planOps';
import type { BudgetLine, BudgetPlan, Category } from './types';

const data = emptyData();
const cats = data.categories;
const t = data.settings.thresholds;
const cat = (name: string) => cats.find((c) => c.name === name)!.id;

function plan(lines: Partial<BudgetLine>[], extra: Partial<BudgetPlan> = {}): BudgetPlan {
  return {
    ...createPlan({ year: new Date().getFullYear(), name: 'Test', currency: 'PLN', limit: '1000000', defaultMarginPct: '35', salesTarget: null }),
    lines: lines.map((l) => ({ ...createLine(l.categoryId!), ...l })),
    ...extra,
  };
}

describe('metodologia ROI/ROMI (PRD, sekcja 6)', () => {
  it('przykład kontrolny: Social media 120 000 / 480 000 / 35%', () => {
    const p = plan([{ categoryId: cat('Social media'), annualAmount: '120000', revenue: '480000', marginPct: '35', assumption: 'x' }]);
    const r = calculatePlan(p, cats, t).leaves[0];
    expect(r.roi!.toFixed(2)).toBe('300.00');
    expect(r.romi!.toFixed(2)).toBe('40.00');
    expect(r.roas!.toFixed(1)).toBe('4.0');
    expect(r.breakeven!.toFixed(2)).toBe('342857.14');
  });

  it('kategoria brand nie ma ROI, ale jej koszt obniża ROMI całego budżetu', () => {
    const p = plan([
      { categoryId: cat('Social media'), annualAmount: '120000', revenue: '480000', assumption: 'x' },
      { categoryId: cat('Radio'), annualAmount: '80000', revenue: '999999' },
    ]);
    const c = calculatePlan(p, cats, t);
    const radio = c.leaves.find((r) => r.type === 'brand')!;
    expect(radio.roi).toBeNull();
    expect(radio.romi).toBeNull();
    expect(radio.roas).toBeNull();
    expect(c.performance.romi!.toFixed(2)).toBe('40.00');
    // (168 000 − 200 000) / 200 000 = −16%
    expect(c.romiTotal!.toFixed(2)).toBe('-16.00');
  });

  it('ROMI łączne liczone z sum, nie jako średnia ROMI kategorii', () => {
    const p = plan([
      { categoryId: cat('Social media'), annualAmount: '100000', revenue: '1000000', assumption: 'x' },
      { categoryId: cat('Content'), annualAmount: '900000', revenue: '900000', assumption: 'x' },
    ]);
    const c = calculatePlan(p, cats, t);
    // sumy: (1 900 000 × 0,35 − 1 000 000) / 1 000 000 = −33,5%; średnia z (250%, −65%) dałaby 92,5%
    expect(c.performance.romi!.toFixed(1)).toBe('-33.5');
  });

  it('marża domyślna planu, nadpisywalna per kategoria', () => {
    const p = plan([
      { categoryId: cat('Social media'), annualAmount: '100', revenue: '1000', assumption: 'x' },
      { categoryId: cat('Content'), annualAmount: '100', revenue: '1000', marginPct: '50', assumption: 'x' },
    ]);
    const [a, b] = calculatePlan(p, cats, t).leaves;
    expect(a.romi!.toFixed()).toBe('250');
    expect(b.romi!.toFixed()).toBe('400');
  });

  it('podkategorie: kategoria = suma podkategorii, ROMI grupy z sum', () => {
    const social = cats.find((c) => c.name === 'Social media')!;
    const subs: Category[] = [
      { id: 's1', name: 'Meta', type: 'performance', parentId: social.id, color: '#000', active: true },
      { id: 's2', name: 'TikTok', type: 'performance', parentId: social.id, color: '#000', active: true },
    ];
    const p = plan([
      { categoryId: 's1', annualAmount: '100000', revenue: '400000', assumption: 'x' },
      { categoryId: 's2', annualAmount: '50000', revenue: '100000', assumption: 'x' },
    ]);
    const c = calculatePlan(p, [...cats, ...subs], t);
    expect(c.rows).toHaveLength(1);
    const g = c.rows[0];
    expect(g.cost.toFixed()).toBe('150000');
    expect(g.children).toHaveLength(2);
    // (500 000 × 0,35 − 150 000) / 150 000
    expect(g.romi!.toFixed(4)).toBe('16.6667');
  });
});

describe('udziały, limit i ostrzeżenia', () => {
  it('suma udziałów = 100,0% na 50 losowych planach', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 50; i++) {
      const n = 1 + Math.floor(rnd() * cats.length);
      const p = plan(
        cats.slice(0, n).map((c) => ({ categoryId: c.id, annualAmount: (Math.floor(rnd() * 1e7) / 100).toFixed(2) })),
      );
      const c = calculatePlan(p, cats, t);
      if (c.allocated.isZero()) continue;
      expect(sum(c.rows.map((r) => r.shareDisplay)).toFixed(1)).toBe('100.0');
      expect(sum(c.leaves.map((r) => r.share)).toDecimalPlaces(10).toFixed()).toBe('100');
    }
  });

  it('roundShares: trzy równe kategorie → 33,4 + 33,3 + 33,3', () => {
    const s = roundShares([new Decimal(1), new Decimal(1), new Decimal(1)]);
    expect(s.map((x) => x.toFixed(1))).toEqual(['33.4', '33.3', '33.3']);
  });

  it('przekroczenie limitu: ostrzeżenie z kwotą i blokada zatwierdzenia', () => {
    const p = plan([{ categoryId: cat('Radio'), annualAmount: '1000500' }]);
    const c = calculatePlan(p, cats, t);
    expect(c.overLimit.toFixed()).toBe('500');
    const w = c.approvalBlockers.find((b) => b.code === 'OVER_LIMIT')!;
    expect(w.message).toContain('500');
  });

  it('brak założenia przy przychodzie > 0 blokuje zatwierdzenie', () => {
    const p = plan([{ categoryId: cat('Social media'), annualAmount: '100', revenue: '500', assumption: '  ' }]);
    expect(calculatePlan(p, cats, t).approvalBlockers.map((b) => b.code)).toEqual(['MISSING_ASSUMPTION']);
  });

  it('ostrzeżenia: ROMI < 0, ROAS > 20, koncentracja > 40%, podwójne liczenie', () => {
    const p = plan(
      [
        { categoryId: cat('Social media'), annualAmount: '100', revenue: '200', assumption: 'x' },
        { categoryId: cat('Content'), annualAmount: '100', revenue: '2500', assumption: 'x' },
        { categoryId: cat('Radio'), annualAmount: '500' },
      ],
      { salesTarget: '1000' },
    );
    const codes = calculatePlan(p, cats, t).warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['ROMI_NEGATIVE', 'ROAS_HIGH', 'CONCENTRATION', 'DOUBLE_COUNT']));
    expect(calculatePlan(p, cats, t).approvalBlockers).toHaveLength(0);
  });

  it('wydajność: 100 kategorii × 12 miesięcy < 200 ms', () => {
    const many: Category[] = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`, name: `K${i}`, type: i % 3 ? 'performance' : 'brand', parentId: null, color: '#000', active: true,
    }));
    const p = plan(
      many.map((c, i) => ({
        categoryId: c.id,
        mode: 'monthly' as const,
        monthly: Array.from({ length: 12 }, (_, m) => String(1000 + i * 13 + m)),
        annualAmount: '0',
        revenue: String(50000 + i),
        assumption: 'x',
      })),
    );
    calculatePlan(p, many, t);
    const start = performance.now();
    calculatePlan(p, many, t);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
