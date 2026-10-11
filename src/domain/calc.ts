// Silnik obliczeń planu – metodologia z PRD, sekcja 6.
// Funkcje są czyste: wejście (plan, słownik kategorii, progi) → wynik. Nic nie jest zapisywane.

import { Decimal, HUNDRED, ZERO, dec, formatMoney, formatNumber, sum } from './numbers';
import { monthlyAmounts } from './seasonality';
import type { BudgetLine, BudgetPlan, Category, CategoryType, Thresholds } from './types';

export interface Returns {
  /** ROI przychodowe w % (pomocnicze); null = n/d */
  roi: Decimal | null;
  /** ROMI na marży w % (główne); null = n/d */
  romi: Decimal | null;
  /** ROAS jako krotność; null = n/d */
  roas: Decimal | null;
  /** Próg rentowności: przychód, przy którym ROMI = 0%; null = n/d */
  breakeven: Decimal | null;
}

export interface RowCalc extends Returns {
  categoryId: string;
  name: string;
  type: CategoryType;
  color: string;
  /** Linia planu (tylko dla wierszy-liści) */
  line: BudgetLine | null;
  cost: Decimal;
  revenue: Decimal;
  /** Marża brutto jako ułamek (0–1); dla wiersza zbiorczego – średnia ważona przychodem */
  margin: Decimal | null;
  grossProfit: Decimal;
  /** Dokładny udział w kwocie przydzielonej, w % */
  share: Decimal;
  /** Udział zaokrąglony do 0,1 p.p.; udziały liści sumują się do dokładnie 100,0% */
  shareDisplay: Decimal;
  /** Udział w limicie budżetu, w % */
  limitShare: Decimal | null;
  monthly: Decimal[];
  children: RowCalc[];
  marginOverridden: boolean;
}

export type WarningCode =
  | 'OVER_LIMIT'
  | 'ROMI_NEGATIVE'
  | 'ROAS_HIGH'
  | 'CONCENTRATION'
  | 'DOUBLE_COUNT'
  | 'MISSING_ASSUMPTION'
  | 'NO_REVENUE';

export interface PlanWarning {
  code: WarningCode;
  /** 'critical' – czerwone (ROMI < 0, przekroczenia); 'warning' – do sprawdzenia; 'info' – wskazówka */
  severity: 'critical' | 'warning' | 'info';
  message: string;
  categoryId?: string;
  /** Czy blokuje zatwierdzenie planu */
  blocksApproval: boolean;
}

export interface Totals extends Returns {
  cost: Decimal;
  revenue: Decimal;
  grossProfit: Decimal;
}

export interface PlanCalc {
  limit: Decimal;
  allocated: Decimal;
  unallocated: Decimal;
  overLimit: Decimal;
  limitUsage: Decimal | null;
  rows: RowCalc[];
  leaves: RowCalc[];
  performance: Totals;
  brandCost: Decimal;
  /** ROMI całego budżetu w % (koszt brand w mianowniku) */
  romiTotal: Decimal | null;
  /** ROI przychodowe całego budżetu w % */
  roiTotal: Decimal | null;
  monthlyTotals: Decimal[];
  hasMonthlyBreakdown: boolean;
  warnings: PlanWarning[];
  approvalBlockers: PlanWarning[];
}

/** Zwroty dla kategorii performance. Liczone wyłącznie z sum – nigdy jako średnia ROI. */
export function computeReturns(cost: Decimal, revenue: Decimal, grossProfit: Decimal, margin: Decimal | null): Returns {
  if (cost.isZero()) return { roi: null, romi: null, roas: null, breakeven: null };
  return {
    roi: revenue.minus(cost).dividedBy(cost).times(HUNDRED),
    romi: grossProfit.minus(cost).dividedBy(cost).times(HUNDRED),
    roas: revenue.dividedBy(cost),
    breakeven: margin && !margin.isZero() ? cost.dividedBy(margin) : null,
  };
}

const NO_RETURNS: Returns = { roi: null, romi: null, roas: null, breakeven: null };

export function lineMargin(line: BudgetLine, plan: BudgetPlan): Decimal {
  return dec(line.marginPct ?? plan.defaultMarginPct).dividedBy(HUNDRED);
}

/**
 * Udziały zaokrąglone do 0,1 p.p. metodą największych reszt (Hamilton),
 * dzięki czemu wyświetlane udziały sumują się dokładnie do 100,0%.
 */
export function roundShares(costs: Decimal[]): Decimal[] {
  const total = sum(costs);
  if (total.isZero()) return costs.map(() => ZERO);
  const units = costs.map((c) => c.dividedBy(total).times(1000)); // w dziesiątych częściach procenta
  const floors = units.map((u) => u.floor());
  let remainder = new Decimal(1000).minus(sum(floors)).toNumber();
  const order = units
    .map((u, i) => ({ i, frac: u.minus(u.floor()) }))
    .sort((a, b) => b.frac.comparedTo(a.frac) || a.i - b.i);
  const result = [...floors];
  for (let k = 0; remainder > 0; k++, remainder--) {
    result[order[k % order.length].i] = result[order[k % order.length].i].plus(1);
  }
  return result.map((r) => r.dividedBy(10));
}

export function calculatePlan(plan: BudgetPlan, categories: Category[], thresholds: Thresholds): PlanCalc {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const limit = dec(plan.limit);

  // 1. Wiersze-liście (pozycje planu)
  const leafRows: RowCalc[] = plan.lines.map((line) => {
    const cat = catById.get(line.categoryId);
    const parent = cat?.parentId ? catById.get(cat.parentId) : undefined;
    const type: CategoryType = parent?.type ?? cat?.type ?? 'performance';
    const monthly = monthlyAmounts(line);
    const cost = line.mode === 'monthly' ? sum(monthly) : dec(line.annualAmount);
    const isPerf = type === 'performance';
    const revenue = isPerf ? dec(line.revenue) : ZERO;
    const margin = isPerf ? lineMargin(line, plan) : null;
    const grossProfit = margin ? revenue.times(margin) : ZERO;
    return {
      categoryId: line.categoryId,
      name: cat?.name ?? '(usunięta kategoria)',
      type,
      color: cat?.color ?? parent?.color ?? '#888',
      line,
      cost,
      revenue,
      margin,
      grossProfit,
      share: ZERO,
      shareDisplay: ZERO,
      limitShare: null,
      monthly,
      children: [],
      marginOverridden: line.marginPct !== null,
      ...(isPerf ? computeReturns(cost, revenue, grossProfit, margin) : NO_RETURNS),
    };
  });

  const allocated = sum(leafRows.map((r) => r.cost));
  const shares = roundShares(leafRows.map((r) => r.cost));
  leafRows.forEach((r, i) => {
    r.share = allocated.isZero() ? ZERO : r.cost.dividedBy(allocated).times(HUNDRED);
    r.shareDisplay = shares[i];
    r.limitShare = limit.isZero() ? null : r.cost.dividedBy(limit).times(HUNDRED);
  });

  // 2. Grupowanie podkategorii pod kategorią nadrzędną (kategoria = suma podkategorii)
  const rows: RowCalc[] = [];
  const groups = new Map<string, RowCalc>();
  for (const leaf of leafRows) {
    const cat = catById.get(leaf.categoryId);
    const parent = cat?.parentId ? catById.get(cat.parentId) : undefined;
    if (!parent) {
      rows.push(leaf);
      continue;
    }
    let group = groups.get(parent.id);
    if (!group) {
      group = {
        categoryId: parent.id,
        name: parent.name,
        type: parent.type,
        color: parent.color,
        line: null,
        cost: ZERO,
        revenue: ZERO,
        margin: null,
        grossProfit: ZERO,
        share: ZERO,
        shareDisplay: ZERO,
        limitShare: null,
        monthly: Array.from({ length: 12 }, () => ZERO),
        children: [],
        marginOverridden: false,
        ...NO_RETURNS,
      };
      groups.set(parent.id, group);
      rows.push(group);
    }
    group.children.push(leaf);
  }
  for (const group of groups.values()) {
    const ch = group.children;
    group.cost = sum(ch.map((c) => c.cost));
    group.revenue = sum(ch.map((c) => c.revenue));
    group.grossProfit = sum(ch.map((c) => c.grossProfit));
    group.share = sum(ch.map((c) => c.share));
    group.shareDisplay = sum(ch.map((c) => c.shareDisplay));
    group.limitShare = limit.isZero() ? null : group.cost.dividedBy(limit).times(HUNDRED);
    group.monthly = group.monthly.map((_, m) => sum(ch.map((c) => c.monthly[m])));
    if (group.type === 'performance') {
      group.margin = group.revenue.isZero() ? null : group.grossProfit.dividedBy(group.revenue);
      Object.assign(group, computeReturns(group.cost, group.revenue, group.grossProfit, group.margin));
    }
  }

  // 3. Sumy
  const perfLeaves = leafRows.filter((r) => r.type === 'performance');
  const perfCost = sum(perfLeaves.map((r) => r.cost));
  const perfRevenue = sum(perfLeaves.map((r) => r.revenue));
  const perfGross = sum(perfLeaves.map((r) => r.grossProfit));
  const perfMargin = perfRevenue.isZero() ? null : perfGross.dividedBy(perfRevenue);
  const performance: Totals = {
    cost: perfCost,
    revenue: perfRevenue,
    grossProfit: perfGross,
    ...computeReturns(perfCost, perfRevenue, perfGross, perfMargin),
  };
  const brandCost = allocated.minus(perfCost);
  const romiTotal = allocated.isZero() ? null : perfGross.minus(allocated).dividedBy(allocated).times(HUNDRED);
  const roiTotal = allocated.isZero() ? null : perfRevenue.minus(allocated).dividedBy(allocated).times(HUNDRED);
  const monthlyTotals = Array.from({ length: 12 }, (_, m) => sum(leafRows.map((r) => r.monthly[m])));

  const calc: PlanCalc = {
    limit,
    allocated,
    unallocated: limit.minus(allocated),
    overLimit: Decimal.max(ZERO, allocated.minus(limit)),
    limitUsage: limit.isZero() ? null : allocated.dividedBy(limit).times(HUNDRED),
    rows,
    leaves: leafRows,
    performance,
    brandCost,
    romiTotal,
    roiTotal,
    monthlyTotals,
    hasMonthlyBreakdown: plan.lines.some((l) => l.mode === 'monthly' || l.seasonality !== 'equal'),
    warnings: [],
    approvalBlockers: [],
  };
  calc.warnings = buildWarnings(plan, calc, thresholds);
  calc.approvalBlockers = calc.warnings.filter((w) => w.blocksApproval);
  return calc;
}

function buildWarnings(plan: BudgetPlan, calc: PlanCalc, t: Thresholds): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const fmt = (d: Decimal, digits = 2) => formatNumber(d, digits, digits === 1 ? 1 : 0);
  const money = (d: Decimal) => formatMoney(d);

  if (calc.overLimit.greaterThan(0)) {
    warnings.push({
      code: 'OVER_LIMIT',
      severity: 'critical',
      message: `Budżet przekracza limit o ${money(calc.overLimit)} ${plan.currency}. Plan nie może zostać zatwierdzony.`,
      blocksApproval: true,
    });
  }

  for (const r of calc.leaves) {
    if (r.line && dec(r.line.revenue).greaterThan(0) && r.type === 'performance' && !r.line.assumption.trim()) {
      warnings.push({
        code: 'MISSING_ASSUMPTION',
        severity: 'warning',
        message: `${r.name}: brak założenia dla prognozy przychodu – uzupełnij źródło prognozy.`,
        categoryId: r.categoryId,
        blocksApproval: true,
      });
    }
    if (r.type !== 'performance' || r.cost.isZero()) continue;
    if (r.revenue.isZero()) {
      warnings.push({
        code: 'NO_REVENUE',
        severity: 'info',
        message: `${r.name}: kategoria performance bez prognozy przychodu – ROMI = −100%.`,
        categoryId: r.categoryId,
        blocksApproval: false,
      });
    } else if (r.romi && r.romi.lessThan(dec(t.romiMinPct))) {
      warnings.push({
        code: 'ROMI_NEGATIVE',
        severity: 'critical',
        message: `${r.name}: ROMI ${fmt(r.romi, 1)}% – kategoria nie zwraca kosztu na marży.`,
        categoryId: r.categoryId,
        blocksApproval: false,
      });
    }
    if (r.roas && r.roas.greaterThan(dec(t.roasMax))) {
      warnings.push({
        code: 'ROAS_HIGH',
        severity: 'warning',
        message: `${r.name}: ROAS ${fmt(r.roas, 1)} > ${fmt(dec(t.roasMax))} – prognoza przychodu prawdopodobnie zawyżona.`,
        categoryId: r.categoryId,
        blocksApproval: false,
      });
    }
  }

  // Koncentracja liczona na poziomie kategorii głównej
  for (const r of calc.rows) {
    if (r.share.greaterThan(dec(t.concentrationMaxPct))) {
      warnings.push({
        code: 'CONCENTRATION',
        severity: 'warning',
        message: `${r.name}: ${fmt(r.share, 1)}% budżetu (> ${fmt(dec(t.concentrationMaxPct))}%) – ryzyko koncentracji.`,
        categoryId: r.categoryId,
        blocksApproval: false,
      });
    }
  }

  if (plan.salesTarget && dec(plan.salesTarget).greaterThan(0) && calc.performance.revenue.greaterThan(dec(plan.salesTarget))) {
    warnings.push({
      code: 'DOUBLE_COUNT',
      severity: 'warning',
      message: `Suma przychodów przypisanych (${money(calc.performance.revenue)} ${plan.currency}) przekracza cel sprzedaży firmy (${money(dec(plan.salesTarget))} ${plan.currency}) – możliwe podwójne liczenie.`,
      blocksApproval: false,
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
}
