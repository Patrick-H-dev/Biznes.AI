// Magazyn danych aplikacji: localStorage + subskrypcja dla Reacta (useSyncExternalStore).
// Wszystkie zmiany przechodzą przez akcje poniżej, które pilnują reguł integralności
// (plan zatwierdzony tylko do odczytu, typ podkategorii = typ kategorii nadrzędnej).

import { useSyncExternalStore } from 'react';
import { calculatePlan } from '../domain/calc';
import { emptyData } from '../domain/defaults';
import { dec } from '../domain/numbers';
import { copyPlanToYear, createLine, createPlan, newVersion, uid, validatePlanInput, type PlanInput } from '../domain/planOps';
import type { AppData, AuditEntry, BudgetLine, BudgetPlan, Category, Settings } from '../domain/types';

const STORAGE_KEY = 'planer-budzetu:v1';

function load(): AppData {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.schemaVersion === 1) return parsed;
    }
  } catch {
    // uszkodzone dane lub brak dostępu do localStorage – startujemy od pustego stanu
  }
  return emptyData();
}

let state: AppData = load();
const listeners = new Set<() => void>();

function commit(next: AppData) {
  state = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // brak miejsca / tryb prywatny – stan pozostaje w pamięci
  }
  listeners.forEach((l) => l());
}

export function getState(): AppData {
  return state;
}

export function useStore(): AppData {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export class ReadOnlyError extends Error {
  constructor() {
    super('Plan jest zatwierdzony i tylko do odczytu. Utwórz nową wersję, aby wprowadzić zmiany.');
  }
}

function findPlan(planId: string): BudgetPlan {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) throw new Error('Nie znaleziono planu.');
  return plan;
}

function editablePlan(planId: string): BudgetPlan {
  const plan = findPlan(planId);
  if (plan.status === 'approved') throw new ReadOnlyError();
  return plan;
}

function replacePlan(plan: BudgetPlan, audit: AuditEntry[] = []) {
  commit({
    ...state,
    plans: state.plans.map((p) => (p.id === plan.id ? plan : p)),
    audit: audit.length ? [...state.audit, ...audit] : state.audit,
  });
}

function auditEntry(planId: string, entity: AuditEntry['entity'], field: string, label: string, before: string, after: string): AuditEntry {
  return { id: uid('log'), planId, entity, field, label, before, after, timestamp: new Date().toISOString() };
}

// ---------- Plany

export function addPlan(input: PlanInput): BudgetPlan {
  const errors = validatePlanInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  const plan = createPlan(input);
  commit({ ...state, plans: [...state.plans, plan], audit: [...state.audit, auditEntry(plan.id, 'plan', 'create', 'Plan', '', 'utworzono')] });
  return plan;
}

const PLAN_FIELD_LABELS: Partial<Record<keyof BudgetPlan, string>> = {
  name: 'Nazwa',
  year: 'Rok',
  currency: 'Waluta',
  limit: 'Limit budżetu',
  defaultMarginPct: 'Marża domyślna %',
  salesTarget: 'Cel sprzedaży',
};

export function updatePlanSettings(planId: string, input: PlanInput) {
  const plan = editablePlan(planId);
  const errors = validatePlanInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  const next: BudgetPlan = { ...plan, ...input, name: input.name.trim() };
  const audit = (Object.keys(PLAN_FIELD_LABELS) as (keyof BudgetPlan)[])
    .filter((k) => String(plan[k] ?? '') !== String(next[k] ?? ''))
    .map((k) => auditEntry(planId, 'plan', k, PLAN_FIELD_LABELS[k]!, String(plan[k] ?? ''), String(next[k] ?? '')));
  replacePlan(next, audit);
}

export function deletePlan(planId: string) {
  const plan = findPlan(planId);
  if (plan.status === 'approved') throw new Error('Zatwierdzonego planu nie można usunąć – to niezmienny punkt odniesienia.');
  commit({ ...state, plans: state.plans.filter((p) => p.id !== planId), audit: state.audit.filter((a) => a.planId !== planId) });
}

export function copyPlan(sourceId: string, year: number, adjustmentPct: string, name: string): BudgetPlan {
  const source = findPlan(sourceId);
  const plan = copyPlanToYear(source, year, adjustmentPct, name);
  const errors = validatePlanInput(plan);
  if (errors.length) throw new Error(errors.join(' '));
  commit({
    ...state,
    plans: [...state.plans, plan],
    audit: [...state.audit, auditEntry(plan.id, 'plan', 'create', 'Plan', '', `skopiowano z planu ${source.year} v${source.version} (korekta ${adjustmentPct}%)`)],
  });
  return plan;
}

export function createNewVersion(planId: string): BudgetPlan {
  const source = findPlan(planId);
  if (source.status !== 'approved') throw new Error('Nową wersję tworzy się z planu zatwierdzonego.');
  const plan = newVersion(source, state.plans);
  commit({
    ...state,
    plans: [...state.plans, plan],
    audit: [...state.audit, auditEntry(plan.id, 'plan', 'create', 'Plan', '', `nowa wersja z v${source.version}`)],
  });
  return plan;
}

export function approvePlan(planId: string) {
  const plan = editablePlan(planId);
  const calc = calculatePlan(plan, state.categories, state.settings.thresholds);
  if (calc.approvalBlockers.length > 0) {
    throw new Error(calc.approvalBlockers.map((b) => b.message).join(' '));
  }
  replacePlan({ ...plan, status: 'approved', approvedAt: new Date().toISOString() }, [
    auditEntry(planId, 'plan', 'status', 'Status', 'szkic', 'zatwierdzony'),
  ]);
}

// ---------- Pozycje planu

export function addLine(planId: string, categoryId: string): BudgetLine {
  const plan = editablePlan(planId);
  if (plan.lines.some((l) => l.categoryId === categoryId)) throw new Error('Kategoria jest już w planie.');
  const hasChildren = plan.lines.some((l) => state.categories.find((c) => c.id === l.categoryId)?.parentId === categoryId);
  if (hasChildren) throw new Error('Kategoria ma w planie podkategorie – jej kwota jest sumą podkategorii.');
  const line = createLine(categoryId);
  const name = state.categories.find((c) => c.id === categoryId)?.name ?? '';
  replacePlan({ ...plan, lines: [...plan.lines, line] }, [auditEntry(planId, 'line', 'add', name, '', 'dodano do planu')]);
  return line;
}

export function removeLine(planId: string, lineId: string) {
  const plan = editablePlan(planId);
  const line = plan.lines.find((l) => l.id === lineId);
  const name = state.categories.find((c) => c.id === line?.categoryId)?.name ?? '';
  replacePlan({ ...plan, lines: plan.lines.filter((l) => l.id !== lineId) }, [
    auditEntry(planId, 'line', 'remove', name, line ? line.annualAmount : '', 'usunięto z planu'),
  ]);
}

/** Usuwa z planu kategorię nadrzędną razem ze wszystkimi jej podkategoriami. */
export function removeCategoryFromPlan(planId: string, categoryId: string) {
  const plan = editablePlan(planId);
  const ids = new Set([categoryId, ...state.categories.filter((c) => c.parentId === categoryId).map((c) => c.id)]);
  const name = state.categories.find((c) => c.id === categoryId)?.name ?? '';
  replacePlan({ ...plan, lines: plan.lines.filter((l) => !ids.has(l.categoryId)) }, [
    auditEntry(planId, 'line', 'remove', name, '', 'usunięto z planu (z podkategoriami)'),
  ]);
}

export interface AuditInfo {
  field: string;
  label: string;
  before: string;
  after: string;
}

export function updateLine(planId: string, lineId: string, patch: Partial<BudgetLine>, audit?: AuditInfo) {
  const plan = editablePlan(planId);
  const lines = plan.lines.map((l) => {
    if (l.id !== lineId) return l;
    const next = { ...l, ...patch };
    if (next.mode === 'monthly' && next.monthly) {
      next.annualAmount = next.monthly.reduce((acc, m) => acc.plus(dec(m)), dec(0)).toFixed();
    }
    return next;
  });
  const entries = audit && audit.before !== audit.after ? [auditEntry(planId, 'line', audit.field, audit.label, audit.before, audit.after)] : [];
  replacePlan({ ...plan, lines }, entries);
}

export function logLineChange(planId: string, info: AuditInfo) {
  if (info.before === info.after) return;
  commit({ ...state, audit: [...state.audit, auditEntry(planId, 'line', info.field, info.label, info.before, info.after)] });
}

/**
 * Dodaje podkategorię do planu. Jeśli kategoria nadrzędna miała własną kwotę,
 * przenosimy ją na pierwszą podkategorię, żeby nie zmienić sumy planu.
 */
export function addSubcategoryLine(planId: string, parentId: string, name: string): BudgetLine {
  const plan = editablePlan(planId);
  const parent = state.categories.find((c) => c.id === parentId);
  if (!parent || parent.parentId) throw new Error('Podkategorię można dodać tylko do kategorii głównej.');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Podaj nazwę podkategorii.');
  let categories = state.categories;
  let child = categories.find((c) => c.parentId === parentId && c.name.toLowerCase() === trimmed.toLowerCase());
  if (!child) {
    child = { id: uid('cat'), name: trimmed, type: parent.type, parentId, color: parent.color, active: true };
    categories = [...categories, child];
  } else if (!child.active) {
    const reactivated: Category = { ...child, active: true };
    categories = categories.map((c) => (c.id === reactivated.id ? reactivated : c));
    child = reactivated;
  }
  if (plan.lines.some((l) => l.categoryId === child!.id)) throw new Error('Ta podkategoria jest już w planie.');
  const parentLine = plan.lines.find((l) => l.categoryId === parentId);
  const line: BudgetLine = parentLine ? { ...parentLine, id: uid('line'), categoryId: child.id } : createLine(child.id);
  const lines = [...plan.lines.filter((l) => l.categoryId !== parentId), line];
  commit({
    ...state,
    categories,
    plans: state.plans.map((p) => (p.id === planId ? { ...plan, lines } : p)),
    audit: [...state.audit, auditEntry(planId, 'line', 'add', `${parent.name} → ${child.name}`, '', parentLine ? 'dodano (przeniesiono kwotę kategorii)' : 'dodano do planu')],
  });
  return line;
}

export function applyImportToPlan(planId: string, lines: BudgetLine[], categories: Category[], summary: string) {
  const plan = editablePlan(planId);
  commit({
    ...state,
    categories,
    plans: state.plans.map((p) => (p.id === planId ? { ...plan, lines } : p)),
    audit: [...state.audit, auditEntry(planId, 'plan', 'import', 'Import', '', summary)],
  });
}

// ---------- Słownik kategorii i ustawienia

export function addCategory(input: Omit<Category, 'id'>): Category {
  if (!input.name.trim()) throw new Error('Podaj nazwę kategorii.');
  const parent = input.parentId ? state.categories.find((c) => c.id === input.parentId) : undefined;
  const dup = state.categories.some(
    (c) => c.parentId === input.parentId && c.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (dup) throw new Error('Kategoria o tej nazwie już istnieje.');
  const cat: Category = { ...input, name: input.name.trim(), id: uid('cat'), type: parent?.type ?? input.type };
  commit({ ...state, categories: [...state.categories, cat] });
  return cat;
}

export function updateCategory(id: string, patch: Partial<Omit<Category, 'id' | 'parentId'>>) {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Nazwa kategorii nie może być pusta.');
  const target = state.categories.find((c) => c.id === id);
  if (!target) return;
  if (target.parentId && patch.type && patch.type !== target.type) {
    throw new Error('Typ podkategorii wynika z kategorii nadrzędnej.');
  }
  commit({
    ...state,
    categories: state.categories.map((c) => {
      if (c.id === id) return { ...c, ...patch, name: patch.name?.trim() ?? c.name };
      // zmiana typu kategorii głównej przechodzi na podkategorie
      if (c.parentId === id && patch.type) return { ...c, type: patch.type };
      return c;
    }),
  });
}

export function categoryUsage(id: string): number {
  const ids = new Set([id, ...state.categories.filter((c) => c.parentId === id).map((c) => c.id)]);
  return state.plans.filter((p) => p.lines.some((l) => ids.has(l.categoryId))).length;
}

export function deleteCategory(id: string) {
  if (categoryUsage(id) > 0) throw new Error('Kategoria jest używana w planach – możesz ją dezaktywować.');
  commit({ ...state, categories: state.categories.filter((c) => c.id !== id && c.parentId !== id) });
}

export function updateSettings(settings: Settings) {
  commit({ ...state, settings });
}

export function replaceAllData(data: AppData) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.plans) || !Array.isArray(data.categories) || !data.settings) {
    throw new Error('Nieprawidłowy plik kopii zapasowej.');
  }
  commit({ ...data, audit: data.audit ?? [] });
}

export function resetData(data: AppData = emptyData()) {
  commit(data);
}
