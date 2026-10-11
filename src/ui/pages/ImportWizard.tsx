import { useMemo, useState } from 'react';
import { dec, formatMoney, formatPct } from '../../domain/numbers';
import { allowedYears, type PlanInput } from '../../domain/planOps';
import type { Table } from '../../io/csv';
import { toCsv } from '../../io/csv';
import {
  FIELD_LABELS,
  REQUIRED_FIELDS,
  TEMPLATE_EXAMPLE_ROWS,
  TEMPLATE_HEADERS,
  applyImport,
  autoMap,
  buildPreview,
  type ColumnMapping,
  type FieldKey,
  type ImportReport,
} from '../../io/importer';
import { parseImportFile } from '../../io/parseFile';
import { addPlan, applyImportToPlan, deletePlan, getState, useStore } from '../../store/store';
import { NumberInput } from '../components/NumberInput';
import { XLSX_MIME, downloadBlob } from '../download';
import { href } from '../router';
import { toastError } from '../toast';

type Step = 1 | 2 | 3;

export function ImportWizard({ initialPlanId }: { initialPlanId: string | null }) {
  const data = useStore();
  const drafts = data.plans.filter((p) => p.status === 'draft').sort((a, b) => b.year - a.year || b.version - a.version);
  const [step, setStep] = useState<Step>(1);
  const [target, setTarget] = useState<string>(initialPlanId && drafts.some((p) => p.id === initialPlanId) ? initialPlanId : 'new');
  const nextYear = new Date().getFullYear() + 1;
  const [newPlan, setNewPlan] = useState<PlanInput>({
    year: nextYear,
    name: `Plan marketingu ${nextYear}`,
    currency: data.settings.defaultCurrency,
    limit: '0',
    defaultMarginPct: data.settings.defaultMarginPct,
    salesTarget: null,
  });
  const [file, setFile] = useState<{ name: string; table: Table } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const [drag, setDrag] = useState(false);
  const [report, setReport] = useState<{ planId: string; report: ImportReport } | null>(null);

  const targetPlan = target === 'new' ? null : data.plans.find((p) => p.id === target) ?? null;
  const limit = targetPlan ? dec(targetPlan.limit) : dec(newPlan.limit);
  const preview = useMemo(
    () => (file && mapping ? buildPreview(file.table, mapping, data.categories, limit) : null),
    [file, mapping, data.categories, limit],
  );

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const table = await parseImportFile(f);
      if (table.headers.length === 0) throw new Error('Plik jest pusty.');
      setFile({ name: f.name, table });
      setMapping(autoMap(table.headers));
      setSkipErrors(false);
      setStep(2);
    } catch (e) {
      toastError(e);
    }
  };

  const doImport = () => {
    if (!preview) return;
    let createdId: string | null = null;
    try {
      const plan = targetPlan ?? addPlan(newPlan);
      if (!targetPlan) createdId = plan.id;
      const s = getState();
      const res = applyImport(preview, plan, s.categories, { mode: targetPlan ? mode : 'replace', skipErrorRows: skipErrors });
      applyImportToPlan(plan.id, res.lines, res.categories, `${file?.name}: ${res.report.imported} wierszy (${targetPlan ? (mode === 'merge' ? 'scalenie' : 'zastąpienie') : 'nowy plan'})`);
      setReport({ planId: plan.id, report: res.report });
    } catch (e) {
      if (createdId) deletePlan(createdId);
      toastError(e);
    }
  };

  if (report) {
    const r = report.report;
    return (
      <>
        <div className="page-head">
          <h1>Import zakończony</h1>
        </div>
        <div className="card">
          <p>
            Zaimportowano <strong>{r.imported}</strong> wierszy, pominięto <strong>{r.skipped.length}</strong>.
          </p>
          {r.createdCategories.length > 0 && <p>Dodane do słownika kategorie: {r.createdCategories.join(', ')}.</p>}
          {r.notes.map((n) => (
            <p key={n} className="muted">
              {n}
            </p>
          ))}
          {r.skipped.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Wiersz</th>
                    <th>Powód pominięcia</th>
                  </tr>
                </thead>
                <tbody>
                  {r.skipped.map((s) => (
                    <tr key={s.rowNumber}>
                      <td>{s.rowNumber}</td>
                      <td>{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <a className="btn btn-primary" href={href({ name: 'plan', planId: report.planId })}>
            Przejdź do planu
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Import planu z Excela/CSV</h1>
          <div className="sub">Import działa na szablonie pobieranym z aplikacji: jeden wiersz = jedna kategoria, kolumny miesięczne opcjonalne.</div>
        </div>
        <div className="actions">
          <button
            onClick={() => downloadBlob(toCsv([...TEMPLATE_HEADERS], TEMPLATE_EXAMPLE_ROWS), 'szablon-budzetu.csv', 'text/csv;charset=utf-8')}
          >
            Szablon CSV
          </button>
          <button
            onClick={async () => {
              const { templateXlsx } = await import('../../io/xlsx');
              downloadBlob(await templateXlsx(), 'szablon-budzetu.xlsx', XLSX_MIME);
            }}
          >
            Szablon XLSX
          </button>
        </div>
      </div>

      <ol className="steps">
        {['1. Plik', '2. Mapowanie i walidacja', '3. Potwierdzenie'].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? 'step' : undefined}>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="card">
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Importuj do</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">Nowy plan</option>
                {drafts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.year} · {p.name} · v{p.version} (szkic)
                  </option>
                ))}
              </select>
              <span className="hint">Zatwierdzone plany są tylko do odczytu – importuj do szkicu lub nowej wersji.</span>
            </label>
            {target === 'new' && (
              <>
                <label className="field">
                  <span>Rok</span>
                  <select value={newPlan.year} onChange={(e) => setNewPlan({ ...newPlan, year: Number(e.target.value), name: `Plan marketingu ${e.target.value}` })}>
                    {allowedYears().map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Nazwa</span>
                  <input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Limit budżetu</span>
                  <NumberInput className="" ariaLabel="Limit budżetu" value={newPlan.limit} onChange={(v) => setNewPlan({ ...newPlan, limit: v })} suffix={newPlan.currency} />
                </label>
              </>
            )}
          </div>
          <label
            className={`dropzone ${drag ? 'drag' : ''}`}
            style={{ display: 'block', cursor: 'pointer' }}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onFile(e.dataTransfer.files[0]);
            }}
          >
            <strong>Przeciągnij plik tutaj lub kliknij, aby wybrać</strong>
            <div className="muted small" style={{ marginTop: 6 }}>
              XLSX lub CSV (UTF-8, separator „,” lub „;”), maks. 5 MB. Liczby: 120000, 120 000, 120000,50; procent: 35 lub 35%.
            </div>
            <input type="file" accept=".xlsx,.csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
      )}

      {step === 2 && file && mapping && preview && (
        <>
          <div className="card">
            <div className="card-head">
              <h2>Mapowanie kolumn</h2>
              <span className="muted small">
                {file.name} · {file.table.rows.length} wierszy · rozpoznano automatycznie po nagłówkach
              </span>
            </div>
            <div className="mapping">
              {TEMPLATE_HEADERS.map((f) => (
                <label key={f} className="field">
                  <span>
                    {FIELD_LABELS[f]}
                    {REQUIRED_FIELDS.includes(f) ? ' *' : ''}
                  </span>
                  <select value={mapping[f] ?? ''} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === '' ? null : Number(e.target.value) } as Record<FieldKey, number | null>)}>
                    <option value="">— brak —</option>
                    {file.table.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(kolumna ${i + 1})`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Walidacja i podgląd</h2>
              <span className="muted small">
                {preview.rows.length} wierszy · {preview.errorRowCount} z błędami · {preview.rows.filter((r) => r.warnings.length && !r.errors.length).length} z ostrzeżeniami
              </span>
            </div>
            {preview.mappingErrors.map((e) => (
              <div key={e} className="banner banner-critical" role="alert">
                {e}
              </div>
            ))}
            {preview.globalWarnings.map((w) => (
              <div key={w} className="banner banner-warning">
                {w}
              </div>
            ))}
            {preview.rows.length > 0 && (
              <div className="table-wrap" style={{ maxHeight: 460 }}>
                <table>
                  <thead>
                    <tr>
                      <th className="num">Wiersz</th>
                      <th>Kategoria</th>
                      <th>Podkategoria</th>
                      <th>Typ</th>
                      <th className="num">Kwota</th>
                      <th className="num">Przychód</th>
                      <th className="num">Marża</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.rowNumber} className={r.errors.length ? 'row-error' : r.warnings.length ? 'row-warning' : ''}>
                        <td className="num">{r.rowNumber}</td>
                        <td>{r.category || <span className="muted">–</span>}</td>
                        <td>{r.subcategory}</td>
                        <td>{r.type ?? '–'}</td>
                        <td className="num">
                          {formatMoney(r.annual)}
                          {r.monthly && <span className="muted small"> (mies.)</span>}
                        </td>
                        <td className="num">{r.revenue.isZero() ? '–' : formatMoney(r.revenue)}</td>
                        <td className="num">{r.marginPct ? formatPct(r.marginPct) : '–'}</td>
                        <td className="small">
                          {r.errors.map((e) => (
                            <div key={e}>
                              <strong className="neg">Błąd:</strong> {e}
                            </div>
                          ))}
                          {r.warnings.map((w) => (
                            <div key={w}>⚠ {w}</div>
                          ))}
                          {!r.errors.length && !r.warnings.length && <span className="muted">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.errorRowCount > 0 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                <input type="checkbox" checked={skipErrors} onChange={(e) => setSkipErrors(e.target.checked)} />
                Pomiń {preview.errorRowCount} błędnych wierszy (bez zaznaczenia nic nie zostanie zaimportowane – popraw plik i wczytaj ponownie)
              </label>
            )}
            <div className="modal-foot">
              <button onClick={() => setStep(1)}>Wstecz</button>
              <button
                className="btn-primary"
                disabled={preview.mappingErrors.length > 0 || preview.rows.length === 0 || (preview.errorRowCount > 0 && !skipErrors) || preview.errorRowCount === preview.rows.length}
                onClick={() => setStep(3)}
              >
                Dalej
              </button>
            </div>
          </div>
        </>
      )}

      {step === 3 && preview && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Potwierdzenie</h2>
          {targetPlan ? (
            <>
              <p>
                Import do planu <strong>{targetPlan.name}</strong> ({targetPlan.year}, v{targetPlan.version}), który ma obecnie {targetPlan.lines.length} pozycji.
              </p>
              <div className="field" style={{ marginBottom: 12 }}>
                <span>Tryb</span>
                <label>
                  <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Scal – aktualizuj istniejące kategorie, dodaj nowe, pozostałe zostaw
                </label>
                <label>
                  <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Zastąp – usuń wszystkie obecne pozycje planu
                </label>
              </div>
            </>
          ) : (
            <p>
              Zostanie utworzony nowy plan <strong>{newPlan.name}</strong> ({newPlan.year}) z limitem {formatMoney(dec(newPlan.limit), newPlan.currency)}.
            </p>
          )}
          <p>
            Do importu: <strong>{preview.rows.length - preview.errorRowCount}</strong> wierszy
            {preview.errorRowCount > 0 && <>, pominiętych zostanie {preview.errorRowCount}</>}.
          </p>
          <div className="modal-foot">
            <button onClick={() => setStep(2)}>Wstecz</button>
            <button className="btn-primary" onClick={doImport}>
              Importuj
            </button>
          </div>
        </div>
      )}
    </>
  );
}
