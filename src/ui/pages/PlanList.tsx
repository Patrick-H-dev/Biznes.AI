import { useMemo, useState } from 'react';
import { calculatePlan } from '../../domain/calc';
import { demoData } from '../../domain/demo';
import { dec, formatMoney, formatPct } from '../../domain/numbers';
import { allowedYears } from '../../domain/planOps';
import type { BudgetPlan } from '../../domain/types';
import { addPlan, copyPlan, deletePlan, resetData, useStore } from '../../store/store';
import { Modal } from '../components/Modal';
import { NumberInput } from '../components/NumberInput';
import { PlanFormModal, StatusPill } from '../components/PlanParts';
import { href, navigate } from '../router';
import { confirmDialog } from '../confirm';
import { attempt, toast } from '../toast';

export function PlanList() {
  const data = useStore();
  const [creating, setCreating] = useState(false);
  const [copying, setCopying] = useState<BudgetPlan | null | 'pick'>(null);

  const plans = useMemo(
    () => [...data.plans].sort((a, b) => b.year - a.year || b.version - a.version),
    [data.plans],
  );
  const nextYear = new Date().getFullYear() + 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plany budżetu</h1>
          <div className="sub">Roczne plany alokacji budżetu marketingu z planowanym ROI.</div>
        </div>
        <div className="actions">
          <button onClick={() => setCopying('pick')} disabled={plans.length === 0}>
            Kopiuj z poprzedniego roku
          </button>
          <a className="btn" href={href({ name: 'import', planId: null })}>
            Importuj z Excela/CSV
          </a>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + Nowy plan
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="card empty">
          <h2>Nie masz jeszcze żadnego planu</h2>
          <p>
            Utwórz plan na rok budżetowy z limitem i walutą, zaimportuj plan z szablonu XLSX/CSV albo wczytaj dane przykładowe, żeby
            zobaczyć, jak działa aplikacja.
          </p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              + Nowy plan
            </button>
            <button
              onClick={() => {
                resetData(demoData());
                toast('Wczytano dane przykładowe.');
              }}
            >
              Wczytaj dane przykładowe
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rok</th>
                <th>Nazwa</th>
                <th>Wersja</th>
                <th>Status</th>
                <th className="num">Limit</th>
                <th className="num">Przydzielono</th>
                <th className="num">Wykorzystanie</th>
                <th className="num">ROMI łączne</th>
                <th className="num">Ostrzeżenia</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const c = calculatePlan(p, data.categories, data.settings.thresholds);
                const issues = c.warnings.filter((w) => w.severity !== 'info').length;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.year}</strong>
                    </td>
                    <td>
                      <a href={href({ name: 'plan', planId: p.id })}>{p.name}</a>
                    </td>
                    <td>v{p.version}</td>
                    <td>
                      <StatusPill plan={p} />
                    </td>
                    <td className="num">{formatMoney(dec(p.limit), p.currency)}</td>
                    <td className="num">{formatMoney(c.allocated, p.currency)}</td>
                    <td className={`num ${c.overLimit.greaterThan(0) ? 'neg' : ''}`}>{formatPct(c.limitUsage)}</td>
                    <td className={`num ${c.romiTotal?.isNegative() ? 'neg' : ''}`}>{c.romiTotal ? formatPct(c.romiTotal) : 'n/d'}</td>
                    <td className="num">{issues || '–'}</td>
                    <td>
                      <div className="actions" style={{ justifyContent: 'flex-end' }}>
                        <a className="btn btn-sm" href={href({ name: 'dashboard', planId: p.id })}>
                          Dashboard
                        </a>
                        <button className="btn-sm" onClick={() => setCopying(p)}>
                          Kopiuj
                        </button>
                        {p.status === 'draft' && (
                          <button
                            className="btn-sm btn-ghost btn-danger"
                            onClick={() => {
                              confirmDialog(`Usunąć szkic „${p.name}” (v${p.version})? Tej operacji nie można cofnąć.`, { confirmLabel: 'Usuń szkic', danger: true }).then(
                                (ok) => ok && attempt(() => deletePlan(p.id)),
                              );
                            }}
                          >
                            Usuń
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <PlanFormModal
          title="Nowy plan"
          submitLabel="Utwórz plan"
          initial={{
            year: nextYear,
            name: `Plan marketingu ${nextYear}`,
            currency: data.settings.defaultCurrency,
            limit: '0',
            defaultMarginPct: data.settings.defaultMarginPct,
            salesTarget: null,
          }}
          onClose={() => setCreating(false)}
          onSubmit={(input) => {
            const plan = attempt(() => addPlan(input));
            if (plan) navigate({ name: 'plan', planId: plan.id });
          }}
        />
      )}
      {copying && <CopyModal plans={plans} source={copying === 'pick' ? null : copying} onClose={() => setCopying(null)} />}
    </>
  );
}

function CopyModal({ plans, source, onClose }: { plans: BudgetPlan[]; source: BudgetPlan | null; onClose: () => void }) {
  const years = allowedYears();
  const defaultSource = source ?? plans.find((p) => p.status === 'approved') ?? plans[0];
  const [sourceId, setSourceId] = useState(defaultSource.id);
  const src = plans.find((p) => p.id === sourceId)!;
  const [year, setYear] = useState(Math.min(src.year + 1, years[years.length - 1]));
  const [adj, setAdj] = useState('0');
  const [name, setName] = useState(`Plan marketingu ${year}`);
  const submit = () => {
    const plan = attempt(() => copyPlan(sourceId, year, adj, name));
    if (plan) navigate({ name: 'plan', planId: plan.id });
  };
  return (
    <Modal
      title="Kopiuj plan jako punkt startowy"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={submit}>
            Utwórz kopię
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Plan źródłowy</span>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.year} · {p.name} · v{p.version} {p.status === 'approved' ? '(zatwierdzony)' : '(szkic)'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Rok nowego planu</span>
          <select
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              setYear(y);
              setName(`Plan marketingu ${y}`);
            }}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Nazwa</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Współczynnik korekty</span>
          <NumberInput className="" ariaLabel="Współczynnik korekty w procentach" value={adj} min={-100} onChange={setAdj} suffix="%" />
          <span className="hint">np. 5 = +5%. Skaluje limit, kwoty i przychody; marże i założenia zostają.</span>
        </label>
      </div>
    </Modal>
  );
}
