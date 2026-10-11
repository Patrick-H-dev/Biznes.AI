import { useMemo } from 'react';
import { calculatePlan, type RowCalc } from '../../domain/calc';
import { Decimal, ZERO, formatMoney, formatNumber, formatPct } from '../../domain/numbers';
import { previousYearPlan } from '../../domain/planOps';
import type { BudgetPlan } from '../../domain/types';
import { useStore } from '../../store/store';
import { CostRomiMatrix, MonthlyChart, RomiChart, StructureChart } from '../components/Charts';
import { StatusPill, WarningsList } from '../components/PlanParts';
import { href, navigate } from '../router';
import { ExportButtons } from './PlanEditor';

function signed(d: Decimal, fmt: (x: Decimal) => string): string {
  if (d.isZero()) return fmt(d);
  return d.isPositive() ? `+${fmt(d)}` : fmt(d);
}

export function Dashboard({ plan }: { plan: BudgetPlan }) {
  const data = useStore();
  const t = data.settings.thresholds;
  const calc = useMemo(() => calculatePlan(plan, data.categories, t), [plan, data.categories, t]);
  const prev = useMemo(() => previousYearPlan(plan, data.plans), [plan, data.plans]);
  const prevCalc = useMemo(() => (prev ? calculatePlan(prev, data.categories, t) : null), [prev, data.categories, t]);
  const cur = plan.currency;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            Dashboard · {plan.name} <StatusPill plan={plan} />
          </h1>
          <div className="sub">
            Rok {plan.year}, wersja {plan.version}. Planowane (ex ante) ROI na podstawie prognoz przychodu przypisanego.
          </div>
        </div>
        <div className="actions">
          <a className="btn" href={href({ name: 'plan', planId: plan.id })}>
            Edytor planu
          </a>
          <ExportButtons plan={plan} />
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="label">Przydzielono</div>
          <div className="value">{formatMoney(calc.allocated, cur)}</div>
          <div className="note">
            z limitu {formatMoney(calc.limit, cur)} · {formatPct(calc.limitUsage)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">{calc.overLimit.greaterThan(0) ? 'Przekroczenie limitu' : 'Nieprzydzielono'}</div>
          <div className={`value ${calc.overLimit.greaterThan(0) ? 'neg' : ''}`}>{formatMoney(calc.unallocated.abs(), cur)}</div>
          <div className="note">{calc.overLimit.greaterThan(0) ? 'blokuje zatwierdzenie planu' : 'do rozdysponowania'}</div>
        </div>
        <div className="kpi">
          <div className="label">ROMI performance</div>
          <div className={`value ${calc.performance.romi?.isNegative() ? 'neg' : ''}`}>{calc.performance.romi ? formatPct(calc.performance.romi) : 'n/d'}</div>
          <div className="note">
            ROI {calc.performance.roi ? formatPct(calc.performance.roi) : 'n/d'} · ROAS {calc.performance.roas ? formatNumber(calc.performance.roas, 1, 1) : 'n/d'}
          </div>
        </div>
        <div className="kpi">
          <div className="label">ROMI całego budżetu</div>
          <div className={`value ${calc.romiTotal?.isNegative() ? 'neg' : ''}`}>{calc.romiTotal ? formatPct(calc.romiTotal) : 'n/d'}</div>
          <div className="note">z kosztem brand {formatMoney(calc.brandCost, cur)}</div>
        </div>
        <div className="kpi">
          <div className="label">Przychód przypisany</div>
          <div className="value">{formatMoney(calc.performance.revenue, cur)}</div>
          <div className="note">zysk brutto {formatMoney(calc.performance.grossProfit, cur)}</div>
        </div>
      </div>

      {calc.warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h2>Ostrzeżenia</h2>
            <span className="muted small">{calc.warnings.length}</span>
          </div>
          <WarningsList warnings={calc.warnings} onSelect={() => navigate({ name: 'plan', planId: plan.id })} />
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Struktura budżetu</h2>
            <span className="muted small">udział w kwocie przydzielonej</span>
          </div>
          <StructureChart rows={calc.rows} currency={cur} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>ROMI per kategoria</h2>
            <span className="muted small">na marży brutto, tylko performance</span>
          </div>
          <RomiChart rows={calc.rows} currency={cur} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Macierz koszt × ROMI</h2>
            <span className="muted small">zaznaczony obszar: koszt powyżej średniej, ROMI &lt; 0%</span>
          </div>
          <CostRomiMatrix rows={calc.rows} currency={cur} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Miesięczny rozkład wydatków</h2>
            <span className="muted small">wg kwot miesięcznych i profili sezonowości</span>
          </div>
          {calc.hasMonthlyBreakdown ? (
            <MonthlyChart totals={calc.monthlyTotals} currency={cur} />
          ) : (
            <p className="muted">Wszystkie pozycje są rozłożone równomiernie. Ustaw profil sezonowości lub kwoty miesięczne w edytorze, aby zobaczyć rozkład.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>Porównanie z planem poprzedniego roku</h2>
          {prev && (
            <a className="small" href={href({ name: 'plan', planId: prev.id })}>
              {prev.name} v{prev.version} ({prev.status === 'approved' ? 'zatwierdzony' : 'szkic'})
            </a>
          )}
        </div>
        {prev && prevCalc ? (
          <Comparison calc={calc.rows} prev={prevCalc.rows} currency={cur} prevCurrency={prev.currency} totals={{ cur: calc, prev: prevCalc }} />
        ) : (
          <p className="muted">Brak planu na rok {plan.year - 1}. Skopiuj lub zaimportuj plan z poprzedniego roku, żeby zobaczyć zmiany.</p>
        )}
      </div>
    </>
  );
}

function Comparison({
  calc,
  prev,
  currency,
  prevCurrency,
  totals,
}: {
  calc: RowCalc[];
  prev: RowCalc[];
  currency: string;
  prevCurrency: string;
  totals: { cur: ReturnType<typeof calculatePlan>; prev: ReturnType<typeof calculatePlan> };
}) {
  const prevById = new Map(prev.map((r) => [r.categoryId, r]));
  const ids = [...calc.map((r) => r.categoryId), ...prev.filter((r) => !calc.some((c) => c.categoryId === r.categoryId)).map((r) => r.categoryId)];
  const curById = new Map(calc.map((r) => [r.categoryId, r]));
  const fmtMoney = (d: Decimal) => formatMoney(d);
  const fmtPp = (d: Decimal) => `${formatNumber(d, 1, 1)} p.p.`;
  return (
    <>
      {currency !== prevCurrency && (
        <div className="banner banner-warning">
          Plany mają różne waluty ({prevCurrency} → {currency}) – kwoty nie są porównywalne.
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kategoria</th>
              <th className="num">Kwota poprz.</th>
              <th className="num">Kwota</th>
              <th className="num">Zmiana kwoty</th>
              <th className="num">Udział poprz.</th>
              <th className="num">Udział</th>
              <th className="num">Zmiana udziału</th>
              <th className="num">ROMI poprz.</th>
              <th className="num">ROMI</th>
              <th className="num">Zmiana ROMI</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const c = curById.get(id);
              const p = prevById.get(id);
              const row = c ?? p!;
              const costC = c?.cost ?? ZERO;
              const costP = p?.cost ?? ZERO;
              const shareC = c?.share ?? ZERO;
              const shareP = p?.share ?? ZERO;
              const brand = row.type === 'brand';
              const romiDelta = c?.romi && p?.romi ? c.romi.minus(p.romi) : null;
              return (
                <tr key={id}>
                  <td>
                    {row.name}
                    {!c && <span className="muted small"> (usunięta)</span>}
                    {!p && <span className="muted small"> (nowa)</span>}
                  </td>
                  <td className="num">{p ? fmtMoney(costP) : '–'}</td>
                  <td className="num">{c ? fmtMoney(costC) : '–'}</td>
                  <td className="num">
                    {signed(costC.minus(costP), fmtMoney)}
                    {!costP.isZero() && <span className="muted small"> ({signed(costC.minus(costP).dividedBy(costP).times(100), (d) => formatPct(d))})</span>}
                  </td>
                  <td className="num">{p ? formatPct(shareP) : '–'}</td>
                  <td className="num">{c ? formatPct(shareC) : '–'}</td>
                  <td className="num">{signed(shareC.minus(shareP), fmtPp)}</td>
                  <td className="num">{brand ? <span className="na">n/d</span> : p?.romi ? formatPct(p.romi) : '–'}</td>
                  <td className={`num ${c?.romi?.isNegative() ? 'neg' : ''}`}>{brand ? <span className="na">n/d</span> : c?.romi ? formatPct(c.romi) : '–'}</td>
                  <td className="num">{romiDelta ? signed(romiDelta, fmtPp) : '–'}</td>
                </tr>
              );
            })}
            <tr className="total">
              <td>Razem</td>
              <td className="num">{fmtMoney(totals.prev.allocated)}</td>
              <td className="num">{fmtMoney(totals.cur.allocated)}</td>
              <td className="num">{signed(totals.cur.allocated.minus(totals.prev.allocated), fmtMoney)}</td>
              <td />
              <td />
              <td />
              <td className="num">{totals.prev.romiTotal ? formatPct(totals.prev.romiTotal) : 'n/d'}</td>
              <td className="num">{totals.cur.romiTotal ? formatPct(totals.cur.romiTotal) : 'n/d'}</td>
              <td className="num">{totals.cur.romiTotal && totals.prev.romiTotal ? signed(totals.cur.romiTotal.minus(totals.prev.romiTotal), fmtPp) : '–'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        ROMI w wierszu „Razem” to ROMI całego budżetu (z kosztem kategorii brand). Kwoty w {currency}, netto.
      </p>
    </>
  );
}
