import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export const ZERO = new Decimal(0);
export const HUNDRED = new Decimal(100);

export function dec(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return ZERO;
  return new Decimal(value);
}

export function sum(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

/** Zapis kanoniczny do przechowywania: bez wykładnika, bez zbędnych zer. */
export function toStore(value: Decimal): string {
  return value.toFixed();
}

/**
 * Parsuje liczbę w formatach akceptowanych przez PRD (sekcja 8):
 * `120000`, `120 000`, `120000,50`, `120 000,50`, a także `120000.50` i `120.000,50`.
 * Zwraca null, gdy tekst nie jest liczbą. Pusty tekst → null.
 */
export function parseNumber(input: string | number | null | undefined): Decimal | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? new Decimal(input) : null;
  let s = input.trim().replace(/[\s  ]/g, '');
  if (s === '') return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // 120.000,50 → kropka tysięcy, przecinek dziesiętny
    if (s.lastIndexOf(',') < s.lastIndexOf('.')) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(',', '.');
  } else if (hasDot && /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    // 1.200.000 → separator tysięcy
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return new Decimal(s);
}

/** Procent jako `35` lub `35%` (także `35,5 %`). Zwraca wartość w punktach procentowych. */
export function parsePercent(input: string | number | null | undefined): Decimal | null {
  if (typeof input === 'string') return parseNumber(input.replace('%', ''));
  return parseNumber(input);
}

/**
 * Formatowanie pl-PL (spacja tysięcy, przecinek dziesiętny). Zaokrąglamy na Decimal,
 * a dopiero gotowy wynik formatujemy – zaokrąglenie tylko w prezentacji.
 * Grupujemy także liczby 4-cyfrowe (Intl dla pl-PL tego domyślnie nie robi).
 */
export function formatNumber(value: Decimal | null, digits = 2, minDigits = digits): string {
  if (value === null) return '–';
  const rounded = value.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP);
  const [intPart, fracPart = ''] = rounded.abs().toFixed(digits).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  let frac = fracPart.replace(/0+$/, '');
  if (frac.length < minDigits) frac = fracPart.slice(0, Math.max(minDigits, frac.length));
  const sign = rounded.isNegative() && !rounded.isZero() ? '−' : '';
  return frac ? `${sign}${grouped},${frac}` : `${sign}${grouped}`;
}

/** Kwota: bez groszy, gdy całkowita; w przeciwnym razie zawsze 2 miejsca (10 237,50). */
export function formatAmount(value: Decimal | null): string {
  if (value === null) return '–';
  const rounded = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return formatNumber(rounded, 2, rounded.isInteger() ? 0 : 2);
}

export function formatMoney(value: Decimal | null, currency?: string): string {
  if (value === null) return '–';
  const s = formatAmount(value);
  return currency ? `${s} ${currency}` : s;
}

/** Procent z jednym miejscem po przecinku, np. „40,0%”. */
export function formatPct(value: Decimal | null, digits = 1): string {
  if (value === null) return '–';
  return `${formatNumber(value, digits, digits)}%`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}
