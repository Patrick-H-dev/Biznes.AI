import { Decimal, ZERO, dec, sum } from './numbers';
import type { BudgetLine, SeasonalityProfileId } from './types';

export const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paz', 'lis', 'gru'] as const;
export const MONTH_LABELS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

export interface SeasonalityProfile {
  id: SeasonalityProfileId;
  label: string;
  weights: number[];
}

export const SEASONALITY_PROFILES: SeasonalityProfile[] = [
  { id: 'equal', label: 'Równomiernie', weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { id: 'q4_peak', label: 'Szczyt w IV kw. (Black Friday, święta)', weights: [0.7, 0.7, 0.8, 0.9, 0.9, 0.8, 0.7, 0.7, 1, 1.2, 1.8, 1.8] },
  { id: 'summer', label: 'Sezon letni', weights: [0.5, 0.5, 0.7, 1, 1.3, 1.6, 1.8, 1.6, 1, 0.8, 0.6, 0.6] },
  { id: 'spring_autumn', label: 'Wiosna i jesień', weights: [0.6, 0.8, 1.3, 1.4, 1.3, 0.8, 0.5, 0.5, 1.3, 1.4, 1.3, 0.8] },
  { id: 'h1_focus', label: 'Nacisk na I półrocze', weights: [1.2, 1.3, 1.4, 1.4, 1.3, 1.2, 0.8, 0.7, 0.7, 0.7, 0.7, 0.6] },
];

export function profileById(id: SeasonalityProfileId): SeasonalityProfile {
  return SEASONALITY_PROFILES.find((p) => p.id === id) ?? SEASONALITY_PROFILES[0];
}

/**
 * Rozkłada kwotę na 12 miesięcy wg wag, z dokładnością do 0,01. Reszty z zaokrągleń
 * rozdzielamy metodą największych reszt, więc suma miesięcy = kwota co do grosza.
 */
export function distribute(total: Decimal, weights: number[]): Decimal[] {
  const cents = total.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => cents.times(w).dividedBy(wSum));
  const floors = raw.map((r) => r.floor());
  let remainder = cents.minus(sum(floors)).toNumber();
  const order = raw
    .map((r, i) => ({ i, frac: r.minus(r.floor()) }))
    .sort((a, b) => b.frac.comparedTo(a.frac) || a.i - b.i);
  const result = [...floors];
  for (let k = 0; remainder > 0; k = (k + 1) % 12, remainder--) {
    result[order[k].i] = result[order[k].i].plus(1);
  }
  return result.map((c) => c.dividedBy(100));
}

/** Kwoty miesięczne pozycji – wpisane ręcznie albo wyliczone z profilu sezonowości. */
export function monthlyAmounts(line: BudgetLine): Decimal[] {
  if (line.mode === 'monthly' && line.monthly && line.monthly.length === 12) {
    return line.monthly.map((m) => dec(m));
  }
  const total = dec(line.annualAmount);
  if (total.isZero()) return Array.from({ length: 12 }, () => ZERO);
  return distribute(total, profileById(line.seasonality).weights);
}
