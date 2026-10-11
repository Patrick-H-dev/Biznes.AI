import { useState } from 'react';
import type { PlanCalc, PlanWarning } from '../../domain/calc';
import { formatMoney, formatPct } from '../../domain/numbers';
import { allowedYears, validatePlanInput, type PlanInput } from '../../domain/planOps';
import { CURRENCIES, type BudgetPlan, type CategoryType, type Currency } from '../../domain/types';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';

export function StatusPill({ plan }: { plan: BudgetPlan }) {
  return plan.status === 'approved' ? (
    <span className="pill pill-approved">✓ Zatwierdzony</span>
  ) : (
    <span className="pill pill-draft">Szkic</span>
  );
}

export function TypePill({ type }: { type: CategoryType }) {
  return type === 'brand' ? (
    <span className="pill pill-brand" title="Kategoria wizerunkowa – ROI nie jest liczone">
      brand
    </span>
  ) : (
    <span className="pill pill-perf">performance</span>
  );
}

export function SummaryBar({ calc, currency }: { calc: PlanCalc; currency: string }) {
  const over = calc.overLimit.greaterThan(0);
  const usage = calc.limitUsage?.toNumber() ?? 0;
  const romiCls = (v: PlanCalc['romiTotal']) => (v && v.isNegative() ? 'value neg' : 'value');
  return (
    <section className="summary" aria-label="Podsumowanie planu">
      <div>
        <div className="label">Limit budżetu</div>
        <div className="value">{formatMoney(calc.limit, currency)}</div>
      </div>
      <div>
        <div className="label">Przydzielono</div>
        <div className="value">{formatMoney(calc.allocated, currency)}</div>
      </div>
      <div>
        <div className="label">{over ? 'Przekroczenie limitu' : 'Nieprzydzielono'}</div>
        <div className={over ? 'value neg' : 'value'}>
          {over ? '+' : ''}
          {formatMoney(calc.unallocated.abs(), currency)}
        </div>
      </div>
      <div>
        <div className="label">Wykorzystanie limitu</div>
        <div className={over ? 'value neg' : 'value'}>{formatPct(calc.limitUsage)}</div>
        <div className={`meter ${over ? 'over' : ''}`} aria-hidden="true">
          <span style={{ width: `${Math.min(100, usage)}%` }} />
        </div>
      </div>
      <div>
        <div className="label" title="ROMI na marży kategorii performance">
          ROMI performance
        </div>
        <div className={romiCls(calc.performance.romi)}>{calc.performance.romi ? formatPct(calc.performance.romi) : 'n/d'}</div>
      </div>
      <div>
        <div className="label" title="ROMI całego budżetu – koszt kategorii brand w mianowniku">
          ROMI całego budżetu
        </div>
        <div className={romiCls(calc.romiTotal)}>{calc.romiTotal ? formatPct(calc.romiTotal) : 'n/d'}</div>
      </div>
    </section>
  );
}

const ICON: Record<PlanWarning['severity'], string> = { critical: '!', warning: '⚠', info: 'i' };

export function WarningsList({ warnings, onSelect }: { warnings: PlanWarning[]; onSelect?: (categoryId: string) => void }) {
  if (warnings.length === 0) return <p className="muted">Brak ostrzeżeń – plan jest spójny.</p>;
  return (
    <ul className="warnings">
      {warnings.map((w, i) => (
        <li key={i} className={w.severity}>
          <span className="icon" aria-hidden="true">
            {ICON[w.severity]}
          </span>
          <span>
            <span className="sr-only">{w.severity === 'critical' ? 'Błąd: ' : w.severity === 'warning' ? 'Ostrzeżenie: ' : 'Informacja: '}</span>
            {w.message}
            {w.blocksApproval && <strong> Blokuje zatwierdzenie.</strong>}
          </span>
          {w.categoryId && onSelect && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSelect(w.categoryId!);
              }}
            >
              Pokaż wiersz
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PlanFormModal({
  title,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: PlanInput;
  submitLabel: string;
  onSubmit: (input: PlanInput) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<PlanInput>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof PlanInput>(k: K, value: PlanInput[K]) => setV((prev) => ({ ...prev, [k]: value }));
  const submit = () => {
    const errs = validatePlanInput(v);
    setErrors(errs);
    if (errs.length === 0) onSubmit(v);
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={submit}>
            {submitLabel}
          </button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>Rok budżetowy</span>
          <select value={v.year} onChange={(e) => set('year', Number(e.target.value))}>
            {allowedYears().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Nazwa planu</span>
          <input value={v.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>Waluta (jedna na plan)</span>
          <select value={v.currency} onChange={(e) => set('currency', e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Limit budżetu (netto)</span>
          <NumberInput className="" ariaLabel="Limit budżetu" value={v.limit} onChange={(x) => set('limit', x)} suffix={v.currency} />
        </label>
        <label className="field">
          <span>Marża brutto domyślna %</span>
          <NumberInput className="" ariaLabel="Marża domyślna" value={v.defaultMarginPct} max={100} onChange={(x) => set('defaultMarginPct', x)} suffix="%" />
          <span className="hint">Nadpisywalna per kategoria</span>
        </label>
        <label className="field">
          <span>Cel sprzedaży firmy (opcjonalnie)</span>
          <NumberInput
            className=""
            ariaLabel="Cel sprzedaży"
            allowEmpty
            placeholder="np. 12 000 000"
            value={v.salesTarget ?? ''}
            onChange={(x) => set('salesTarget', x === '' ? null : x)}
            suffix={v.currency}
          />
          <span className="hint">Ostrzega przed podwójnym liczeniem przychodu</span>
        </label>
        <button type="submit" hidden />
      </form>
      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
