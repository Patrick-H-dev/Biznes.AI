// Model danych wg PRD, sekcja 7. Kwoty i procenty przechowujemy jako napisy
// dziesiętne (np. "120000.50"), żeby nie tracić precyzji na typie float.
// Wartości pochodne (udziały, ROI, ROMI, ROAS) są wyliczane, nie przechowywane.

export type DecimalString = string;

export type CategoryType = 'performance' | 'brand';
export type PlanStatus = 'draft' | 'approved';
export type Currency = 'PLN' | 'EUR' | 'USD';
export const CURRENCIES: Currency[] = ['PLN', 'EUR', 'USD'];

export type SeasonalityProfileId = 'equal' | 'q4_peak' | 'summer' | 'spring_autumn' | 'h1_focus';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  /** null dla kategorii głównej; id kategorii nadrzędnej dla podkategorii */
  parentId: string | null;
  color: string;
  active: boolean;
}

export interface BrandKpi {
  reach?: DecimalString;
  cpm?: DecimalString;
  views?: DecimalString;
  awarenessLiftPct?: DecimalString;
}

export interface BudgetLine {
  id: string;
  categoryId: string;
  /** 'annual' – kwota roczna rozkładana profilem; 'monthly' – 12 kwot wpisanych ręcznie */
  mode: 'annual' | 'monthly';
  annualAmount: DecimalString;
  /** Wypełnione tylko w trybie 'monthly'; suma = annualAmount */
  monthly: DecimalString[] | null;
  seasonality: SeasonalityProfileId;
  revenue: DecimalString;
  /** null = marża domyślna planu */
  marginPct: DecimalString | null;
  assumption: string;
  brandKpi: BrandKpi;
}

export interface BudgetPlan {
  id: string;
  year: number;
  name: string;
  currency: Currency;
  limit: DecimalString;
  defaultMarginPct: DecimalString;
  salesTarget: DecimalString | null;
  status: PlanStatus;
  version: number;
  /** Plan, z którego utworzono tę wersję (nowa wersja lub kopia z poprzedniego roku) */
  sourcePlanId: string | null;
  createdAt: string;
  approvedAt: string | null;
  lines: BudgetLine[];
}

export interface Thresholds {
  /** ROMI poniżej tej wartości (w %) w kategorii performance → ostrzeżenie */
  romiMinPct: DecimalString;
  /** ROAS powyżej tej wartości → prawdopodobnie zawyżona prognoza */
  roasMax: DecimalString;
  /** Udział kategorii powyżej tej wartości (w %) → ryzyko koncentracji */
  concentrationMaxPct: DecimalString;
}

export interface Settings {
  defaultCurrency: Currency;
  defaultMarginPct: DecimalString;
  thresholds: Thresholds;
}

export interface AuditEntry {
  id: string;
  planId: string;
  entity: 'plan' | 'line';
  field: string;
  label: string;
  before: string;
  after: string;
  timestamp: string;
}

export interface AppData {
  schemaVersion: 1;
  settings: Settings;
  categories: Category[];
  plans: BudgetPlan[];
  audit: AuditEntry[];
}
