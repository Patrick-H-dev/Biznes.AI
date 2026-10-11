// Import planu z szablonu XLSX/CSV (PRD, sekcja 8): mapowanie kolumn, walidacja, podgląd, zastosowanie.

import { Decimal, ZERO, parseNumber, parsePercent, sum, toStore } from '../domain/numbers';
import { CATEGORY_COLORS } from '../domain/defaults';
import { createLine, uid } from '../domain/planOps';
import { MONTHS } from '../domain/seasonality';
import type { BudgetLine, BudgetPlan, Category, CategoryType } from '../domain/types';
import type { Table } from './csv';

export const TEMPLATE_HEADERS = [
  'kategoria',
  'podkategoria',
  'typ',
  'kwota_roczna',
  ...MONTHS,
  'przychod_planowany',
  'marza_proc',
  'zalozenie',
] as const;

export type FieldKey = (typeof TEMPLATE_HEADERS)[number];

export const FIELD_LABELS: Record<FieldKey, string> = {
  kategoria: 'Kategoria',
  podkategoria: 'Podkategoria',
  typ: 'Typ (performance/brand)',
  kwota_roczna: 'Kwota roczna',
  sty: 'Styczeń',
  lut: 'Luty',
  mar: 'Marzec',
  kwi: 'Kwiecień',
  maj: 'Maj',
  cze: 'Czerwiec',
  lip: 'Lipiec',
  sie: 'Sierpień',
  wrz: 'Wrzesień',
  paz: 'Październik',
  lis: 'Listopad',
  gru: 'Grudzień',
  przychod_planowany: 'Przychód planowany',
  marza_proc: 'Marża %',
  zalozenie: 'Założenie',
};

export const REQUIRED_FIELDS: FieldKey[] = ['kategoria', 'typ'];

export const TEMPLATE_EXAMPLE_ROWS: string[][] = [
  ['Social media', 'Meta', 'performance', '120000', '', '', '', '', '', '', '', '', '', '', '', '', '480000', '35', 'Prognoza na bazie ROAS 2026'],
  ['Radio', '', 'brand', '90000', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Kampania wizerunkowa Q2 i Q4'],
];

export type ColumnMapping = Record<FieldKey, number | null>;

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[%]/g, 'proc')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const ALIASES: Partial<Record<FieldKey, string[]>> = {
  kategoria: ['category', 'kanal'],
  podkategoria: ['subcategory', 'podkanal'],
  typ: ['type', 'rodzaj'],
  kwota_roczna: ['kwota', 'budzet', 'koszt', 'amount'],
  przychod_planowany: ['przychod', 'przychod_przypisany', 'revenue'],
  marza_proc: ['marza', 'marza_brutto', 'marza_proc', 'margin'],
  zalozenie: ['zalozenia', 'komentarz', 'assumption'],
  sty: ['styczen'],
  lut: ['luty'],
  mar: ['marzec'],
  kwi: ['kwiecien'],
  maj: [],
  cze: ['czerwiec'],
  lip: ['lipiec'],
  sie: ['sierpien'],
  wrz: ['wrzesien'],
  paz: ['pazdziernik'],
  lis: ['listopad'],
  gru: ['grudzien'],
};

export function autoMap(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping = {} as ColumnMapping;
  for (const field of TEMPLATE_HEADERS) {
    const names = [field, ...(ALIASES[field] ?? [])];
    const idx = normalized.findIndex((h) => names.includes(h));
    mapping[field] = idx >= 0 ? idx : null;
  }
  return mapping;
}

export interface ParsedRow {
  rowNumber: number;
  category: string;
  subcategory: string;
  type: CategoryType | null;
  annual: Decimal;
  monthly: Decimal[] | null;
  revenue: Decimal;
  marginPct: Decimal | null;
  assumption: string;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  rows: ParsedRow[];
  mappingErrors: string[];
  globalWarnings: string[];
  errorRowCount: number;
}

const keyOf = (category: string, sub: string) => `${category.trim().toLowerCase()}\u0000${sub.trim().toLowerCase()}`;

function findCategory(categories: Category[], name: string, parentId: string | null): Category | undefined {
  const n = name.trim().toLowerCase();
  return categories.find((c) => c.parentId === parentId && c.name.trim().toLowerCase() === n);
}

export function buildPreview(table: Table, mapping: ColumnMapping, categories: Category[], limit: Decimal | null): ImportPreview {
  const mappingErrors = REQUIRED_FIELDS.filter((f) => mapping[f] === null).map(
    (f) => `Brak kolumny „${FIELD_LABELS[f]}” – wskaż ją w mapowaniu.`,
  );
  if (mapping.kwota_roczna === null && MONTHS.every((m) => mapping[m] === null)) {
    mappingErrors.push('Brak kolumny z kwotą – wskaż „Kwota roczna” lub kolumny miesięczne.');
  }
  if (mappingErrors.length > 0) return { rows: [], mappingErrors, globalWarnings: [], errorRowCount: 0 };

  const cell = (row: string[], f: FieldKey) => {
    const idx = mapping[f];
    return idx === null ? '' : (row[idx] ?? '').trim();
  };

  const rows: ParsedRow[] = [];
  const seen = new Map<string, number>();
  table.rows.forEach((raw, i) => {
    if (raw.every((v) => v.trim() === '')) return;
    const r: ParsedRow = {
      rowNumber: i + 2,
      category: cell(raw, 'kategoria'),
      subcategory: cell(raw, 'podkategoria'),
      type: null,
      annual: ZERO,
      monthly: null,
      revenue: ZERO,
      marginPct: null,
      assumption: cell(raw, 'zalozenie'),
      errors: [],
      warnings: [],
    };

    if (!r.category) r.errors.push('Brak nazwy kategorii.');

    const typeRaw = cell(raw, 'typ').toLowerCase();
    if (typeRaw === 'performance' || typeRaw === 'brand') r.type = typeRaw;
    else if (!typeRaw) r.errors.push('Brak typu kategorii (performance/brand).');
    else r.errors.push(`Nieznany typ „${cell(raw, 'typ')}” – dozwolone: performance, brand.`);

    // Kwoty
    const monthRaw = MONTHS.map((m) => cell(raw, m));
    const anyMonth = monthRaw.some((v) => v !== '');
    const annualRaw = cell(raw, 'kwota_roczna');
    const annual = annualRaw ? parseNumber(annualRaw) : null;
    if (annualRaw && annual === null) r.errors.push(`Kwota roczna „${annualRaw}” nie jest liczbą.`);
    else if (annual?.isNegative()) r.errors.push('Kwota roczna jest ujemna.');
    if (anyMonth) {
      const months = monthRaw.map((v, m) => {
        if (v === '') return ZERO;
        const d = parseNumber(v);
        if (d === null) {
          r.errors.push(`Kwota za ${MONTHS[m]} „${v}” nie jest liczbą.`);
          return ZERO;
        }
        if (d.isNegative()) r.errors.push(`Kwota za ${MONTHS[m]} jest ujemna.`);
        return d;
      });
      const monthSum = sum(months);
      r.monthly = months;
      if (annual !== null && !annual.toDecimalPlaces(2).equals(monthSum.toDecimalPlaces(2))) {
        r.errors.push(`Suma miesięcy (${monthSum.toFixed()}) ≠ kwota roczna (${annual.toFixed()}).`);
      }
      r.annual = monthSum;
    } else if (annual !== null) {
      r.annual = annual;
    } else {
      r.errors.push('Brak kwoty rocznej.');
    }

    const revRaw = cell(raw, 'przychod_planowany');
    if (revRaw) {
      const rev = parseNumber(revRaw);
      if (rev === null) r.errors.push(`Przychód „${revRaw}” nie jest liczbą.`);
      else if (rev.isNegative()) r.errors.push('Przychód planowany jest ujemny.');
      else r.revenue = rev;
    }

    const marginRaw = cell(raw, 'marza_proc');
    if (marginRaw) {
      const m = parsePercent(marginRaw);
      if (m === null) r.errors.push(`Marża „${marginRaw}” nie jest liczbą.`);
      else if (m.isNegative() || m.greaterThan(100)) r.errors.push('Marża musi mieścić się w zakresie 0–100%.');
      else r.marginPct = m;
    }

    if (r.type === 'brand' && (r.revenue.greaterThan(0) || r.marginPct !== null)) {
      r.warnings.push('Kategoria wizerunkowa – przychód i marża zostaną pominięte (ROI n/d).');
    }
    if (r.type === 'performance' && r.revenue.greaterThan(0) && !r.assumption) {
      r.warnings.push('Brak założenia przy przychodzie > 0 – uzupełnij przed zatwierdzeniem planu.');
    }

    if (r.category) {
      const parent = findCategory(categories, r.category, null);
      if (!parent) r.warnings.push(`Nowa kategoria „${r.category}” spoza słownika – zostanie dodana.`);
      else if (r.type && parent.type !== r.type) {
        r.warnings.push(`W słowniku „${parent.name}” ma typ ${parent.type} – zostanie użyty typ ze słownika.`);
      }
      if (r.subcategory && (!parent || !findCategory(categories, r.subcategory, parent.id))) {
        r.warnings.push(`Nowa podkategoria „${r.subcategory}” – zostanie dodana.`);
      }
      const key = keyOf(r.category, r.subcategory);
      const dup = seen.get(key);
      if (dup !== undefined) r.errors.push(`Duplikat pozycji z wiersza ${dup}.`);
      else seen.set(key, r.rowNumber);
    }
    rows.push(r);
  });

  // Kategoria nie może mieć jednocześnie własnej kwoty i podkategorii
  const parentsWithSubs = new Set(rows.filter((r) => r.subcategory).map((r) => r.category.trim().toLowerCase()));
  for (const r of rows) {
    if (!r.subcategory && parentsWithSubs.has(r.category.trim().toLowerCase())) {
      r.errors.push('Kategoria ma w pliku podkategorie – kwotę podaj na podkategoriach (kategoria = suma podkategorii).');
    }
  }

  const globalWarnings: string[] = [];
  const validTotal = sum(rows.filter((r) => r.errors.length === 0).map((r) => r.annual));
  if (limit && limit.greaterThan(0) && validTotal.greaterThan(limit)) {
    globalWarnings.push(
      `Suma kwot w pliku (${validTotal.toFixed(2)}) przekracza limit planu (${limit.toFixed(2)}). Import jest możliwy – plan pokaże ostrzeżenie.`,
    );
  }
  if (rows.length === 0) globalWarnings.push('Plik nie zawiera wierszy z danymi.');
  return { rows, mappingErrors, globalWarnings, errorRowCount: rows.filter((r) => r.errors.length > 0).length };
}

export interface ImportOptions {
  mode: 'replace' | 'merge';
  skipErrorRows: boolean;
}

export interface ImportReport {
  imported: number;
  skipped: { rowNumber: number; reason: string }[];
  createdCategories: string[];
  notes: string[];
}

export interface ImportResult {
  lines: BudgetLine[];
  categories: Category[];
  report: ImportReport;
}

/** Zastosowanie podglądu do planu. Rzuca wyjątek, gdy są błędy, a pomijanie wierszy jest wyłączone. */
export function applyImport(preview: ImportPreview, plan: BudgetPlan, categories: Category[], opts: ImportOptions): ImportResult {
  if (preview.mappingErrors.length > 0) throw new Error('Popraw mapowanie kolumn.');
  if (preview.errorRowCount > 0 && !opts.skipErrorRows) {
    throw new Error('Plik zawiera błędne wiersze – popraw je lub zaznacz pominięcie błędnych wierszy.');
  }
  const cats = categories.map((c) => ({ ...c }));
  const report: ImportReport = { imported: 0, skipped: [], createdCategories: [], notes: [] };
  const lines: BudgetLine[] = opts.mode === 'replace' ? [] : plan.lines.map((l) => ({ ...l }));
  const catById = () => new Map(cats.map((c) => [c.id, c]));

  const ensureCategory = (name: string, type: CategoryType, parentId: string | null): Category => {
    const existing = findCategory(cats, name, parentId);
    if (existing) {
      if (!existing.active) existing.active = true;
      return existing;
    }
    const parent = parentId ? cats.find((c) => c.id === parentId) : undefined;
    const created: Category = {
      id: uid('cat'),
      name: name.trim(),
      type: parent?.type ?? type,
      parentId,
      color: parent?.color ?? CATEGORY_COLORS[cats.filter((c) => !c.parentId).length % CATEGORY_COLORS.length],
      active: true,
    };
    cats.push(created);
    report.createdCategories.push(parent ? `${parent.name} → ${created.name}` : created.name);
    return created;
  };

  for (const r of preview.rows) {
    if (r.errors.length > 0) {
      report.skipped.push({ rowNumber: r.rowNumber, reason: r.errors.join(' ') });
      continue;
    }
    const parent = ensureCategory(r.category, r.type!, null);
    const target = r.subcategory ? ensureCategory(r.subcategory, parent.type, parent.id) : parent;
    const isPerf = parent.type === 'performance';

    // Struktura z pliku wygrywa: podkategorie zastępują kwotę na kategorii nadrzędnej i odwrotnie.
    const map = catById();
    for (let i = lines.length - 1; i >= 0; i--) {
      const lc = map.get(lines[i].categoryId);
      const conflict = r.subcategory ? lines[i].categoryId === parent.id : lc?.parentId === parent.id;
      if (conflict) {
        report.notes.push(
          r.subcategory
            ? `Pozycja „${parent.name}” zastąpiona podkategoriami z pliku.`
            : `Podkategoria „${lc?.name}” usunięta – plik podaje kwotę na kategorii „${parent.name}”.`,
        );
        lines.splice(i, 1);
      }
    }

    const existing = lines.find((l) => l.categoryId === target.id);
    const line: BudgetLine = existing ?? createLine(target.id);
    line.mode = r.monthly ? 'monthly' : 'annual';
    line.monthly = r.monthly ? r.monthly.map((m) => toStore(m)) : null;
    line.annualAmount = toStore(r.annual);
    line.revenue = isPerf ? toStore(r.revenue) : '0';
    line.marginPct = isPerf && r.marginPct !== null ? toStore(r.marginPct) : null;
    line.assumption = r.assumption;
    if (!existing) lines.push(line);
    report.imported++;
  }
  report.notes = [...new Set(report.notes)];
  return { lines, categories: cats, report };
}
