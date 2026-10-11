// Czyste operacje na planach: tworzenie, kopiowanie z poprzedniego roku, nowe wersje.

import { Decimal, HUNDRED, dec, sum, toStore } from './numbers';
import type { BudgetLine, BudgetPlan, Currency } from './types';

export function uid(prefix: string): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rnd}`;
}

/** Dozwolony zakres lat planu: bieżący −2 … +2 (PRD, sekcja 7). */
export function allowedYears(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y - 2, y - 1, y, y + 1, y + 2];
}

export interface PlanInput {
  year: number;
  name: string;
  currency: Currency;
  limit: string;
  defaultMarginPct: string;
  salesTarget: string | null;
}

export function validatePlanInput(input: PlanInput, now = new Date()): string[] {
  const errors: string[] = [];
  if (!allowedYears(now).includes(input.year)) {
    const ys = allowedYears(now);
    errors.push(`Rok musi mieścić się w zakresie ${ys[0]}–${ys[ys.length - 1]}.`);
  }
  if (!input.name.trim()) errors.push('Podaj nazwę planu.');
  if (dec(input.limit).isNegative()) errors.push('Limit budżetu nie może być ujemny.');
  const m = dec(input.defaultMarginPct);
  if (m.isNegative() || m.greaterThan(100)) errors.push('Marża domyślna musi mieścić się w zakresie 0–100%.');
  if (input.salesTarget !== null && dec(input.salesTarget).isNegative()) errors.push('Cel sprzedaży nie może być ujemny.');
  return errors;
}

export function createPlan(input: PlanInput): BudgetPlan {
  return {
    id: uid('plan'),
    year: input.year,
    name: input.name.trim(),
    currency: input.currency,
    limit: input.limit,
    defaultMarginPct: input.defaultMarginPct,
    salesTarget: input.salesTarget,
    status: 'draft',
    version: 1,
    sourcePlanId: null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    lines: [],
  };
}

export function createLine(categoryId: string): BudgetLine {
  return {
    id: uid('line'),
    categoryId,
    mode: 'annual',
    annualAmount: '0',
    monthly: null,
    seasonality: 'equal',
    revenue: '0',
    marginPct: null,
    assumption: '',
    brandKpi: {},
  };
}

function cloneLines(lines: BudgetLine[]): BudgetLine[] {
  return lines.map((l) => ({
    ...l,
    id: uid('line'),
    monthly: l.monthly ? [...l.monthly] : null,
    brandKpi: { ...l.brandKpi },
  }));
}

const money = (d: Decimal) => toStore(d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));

/** Skaluje pozycję o współczynnik (koszty i przychód; ROMI pozostaje bez zmian). */
function scaleLine(line: BudgetLine, factor: Decimal): BudgetLine {
  if (line.mode === 'monthly' && line.monthly) {
    const monthly = line.monthly.map((m) => money(dec(m).times(factor)));
    return { ...line, monthly, annualAmount: toStore(sum(monthly.map(dec))), revenue: money(dec(line.revenue).times(factor)) };
  }
  return {
    ...line,
    annualAmount: money(dec(line.annualAmount).times(factor)),
    revenue: money(dec(line.revenue).times(factor)),
  };
}

/**
 * Kopia planu na inny rok z korektą procentową (np. 5 = +5%).
 * Skalujemy limit, koszty i przychody przypisane – założenia i marże zostają.
 */
export function copyPlanToYear(source: BudgetPlan, year: number, adjustmentPct: string, name?: string): BudgetPlan {
  const factor = HUNDRED.plus(dec(adjustmentPct)).dividedBy(HUNDRED);
  return {
    ...createPlan({
      year,
      name: name ?? `Plan marketingu ${year}`,
      currency: source.currency,
      limit: money(dec(source.limit).times(factor)),
      defaultMarginPct: source.defaultMarginPct,
      salesTarget: source.salesTarget ? money(dec(source.salesTarget).times(factor)) : null,
    }),
    sourcePlanId: source.id,
    lines: cloneLines(source.lines).map((l) => scaleLine(l, factor)),
  };
}

/** Nowa, edytowalna wersja zatwierdzonego planu. */
export function newVersion(source: BudgetPlan, allPlans: BudgetPlan[]): BudgetPlan {
  const maxVersion = Math.max(...allPlans.filter((p) => p.year === source.year).map((p) => p.version));
  return {
    ...source,
    id: uid('plan'),
    status: 'draft',
    version: maxVersion + 1,
    sourcePlanId: source.id,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    lines: cloneLines(source.lines),
  };
}

/** Plan referencyjny z poprzedniego roku: najnowsza wersja zatwierdzona, a w jej braku najnowszy szkic. */
export function previousYearPlan(plan: BudgetPlan, allPlans: BudgetPlan[]): BudgetPlan | null {
  const candidates = allPlans.filter((p) => p.year === plan.year - 1);
  if (candidates.length === 0) return null;
  const approved = candidates.filter((p) => p.status === 'approved');
  const pool = approved.length > 0 ? approved : candidates;
  return pool.reduce((a, b) => (b.version > a.version ? b : a));
}
