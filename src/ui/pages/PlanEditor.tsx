import { Fragment, useMemo, useState } from 'react';
import { calculatePlan, type RowCalc } from '../../domain/calc';
import { CATEGORY_COLORS } from '../../domain/defaults';
import { Decimal, HUNDRED, dec, formatAmount, formatDateTime, formatMoney, formatNumber, formatPct, toStore } from '../../domain/numbers';
import { MONTH_LABELS, SEASONALITY_PROFILES, monthlyAmounts } from '../../domain/seasonality';
import type { BudgetLine, BudgetPlan, CategoryType, SeasonalityProfileId } from '../../domain/types';
import {
  addCategory,
  addLine,
  addSubcategoryLine,
  approvePlan,
  createNewVersion,
  getState,
  logLineChange,
  removeCategoryFromPlan,
  removeLine,
  updateLine,
  updatePlanSettings,
  useStore,
} from '../../store/store';
import { Modal } from '../components/Modal';
import { NumberInput } from '../components/NumberInput';
import { PlanFormModal, StatusPill, SummaryBar, TypePill, WarningsList } from '../components/PlanParts';
import { XLSX_MIME, downloadBlob, slug } from '../download';
import { href, navigate } from '../router';
import { confirmDialog } from '../confirm';
import { attempt, toast, toastError } from '../toast';

type SortKey = 'order' | 'name' | 'cost' | 'revenue' | 'romi' | 'roas';
type View = 'annual' | 'monthly';

const SORTS: Record<SortKey, (a: RowCalc, b: RowCalc) => number> = {
  order: () => 0,
  name: (a, b) => a.name.localeCompare(b.name, 'pl'),
  cost: (a, b) => a.cost.comparedTo(b.cost),
  revenue: (a, b) => a.revenue.comparedTo(b.revenue),
  romi: (a, b) => (a.romi ?? new Decimal(-1e12)).comparedTo(b.romi ?? new Decimal(-1e12)),
  roas: (a, b) => (a.roas ?? new Decimal(-1)).comparedTo(b.roas ?? new Decimal(-1)),
};

export async function exportXlsx(plan: BudgetPlan) {
  const { exportPlanXlsx } = await import('../../io/xlsx');
  const s = getState();
  const calc = calculatePlan(plan, s.categories, s.settings.thresholds);
  const buf = await exportPlanXlsx(plan, s.categories, calc);
  downloadBlob(buf, `budzet-marketingu-${plan.year}-v${plan.version}-${slug(plan.name)}.xlsx`, XLSX_MIME);
}

export async function exportPdf(plan: BudgetPlan) {
  const { exportPlanPdf } = await import('../../io/pdf');
  const s = getState();
  const calc = calculatePlan(plan, s.categories, s.settings.thresholds);
  downloadBlob(await exportPlanPdf(plan, calc), `budzet-marketingu-${plan.year}-v${plan.version}-${slug(plan.name)}.pdf`);
}

export function ExportButtons({ plan }: { plan: BudgetPlan }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <button disabled={busy !== null} onClick={() => run('xlsx', () => exportXlsx(plan))}>
        {busy === 'xlsx' ? 'Eksport…' : 'Eksport XLSX'}
      </button>
      <button disabled={busy !== null} onClick={() => run('pdf', () => exportPdf(plan))}>
        {busy === 'pdf' ? 'Eksport…' : 'Eksport PDF'}
      </button>
    </>
  );
}

export function PlanEditor({ plan }: { plan: BudgetPlan }) {
  const data = useStore();
  const calc = useMemo(() => calculatePlan(plan, data.categories, data.settings.thresholds), [plan, data.categories, data.settings.thresholds]);
  const readOnly = plan.status === 'approved';
  const [view, setView] = useState<View>('annual');
  const [inputMode, setInputMode] = useState<'amount' | 'percent'>('amount');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'order', dir: 1 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'settings' | 'approve' | 'newCategory' | { sub: string }>(null);

  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const inPlan = new Set(plan.lines.map((l) => l.categoryId));
  const parentsInPlan = new Set(plan.lines.map((l) => catById.get(l.categoryId)?.parentId).filter(Boolean) as string[]);
  const available = data.categories.filter((c) => c.active && !c.parentId && !inPlan.has(c.id) && !parentsInPlan.has(c.id));

  const sorted = useMemo(() => {
    const cmp = (a: RowCalc, b: RowCalc) => SORTS[sort.key](a, b) * sort.dir;
    if (sort.key === 'order') return calc.rows;
    return [...calc.rows].sort(cmp).map((r) => (r.children.length ? { ...r, children: [...r.children].sort(cmp) } : r));
  }, [calc.rows, sort]);

  const selectRow = (categoryId: string) => {
    const cat = catById.get(categoryId);
    if (cat?.parentId) setCollapsed((s) => new Set([...s].filter((id) => id !== cat.parentId)));
    setFlash(categoryId);
    setTimeout(() => {
      document.getElementById(`row-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
    setTimeout(() => setFlash(null), 1700);
  };

  const sortHeader = (key: SortKey, label: string, numeric = true) => (
    <th className={numeric ? 'num' : undefined} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button
        className="sort"
        onClick={() =>
          setSort((s) => (s.key !== key ? { key, dir: numeric ? -1 : 1 } : s.dir === (numeric ? -1 : 1) ? { key, dir: numeric ? 1 : -1 } : { key: 'order', dir: 1 }))
        }
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  const update = (line: BudgetLine, patch: Partial<BudgetLine>) => attempt(() => updateLine(plan.id, line.id, patch));
  const log = (row: RowCalc, field: string, label: string) => (before: string, after: string) =>
    logLineChange(plan.id, { field, label: `${row.name}: ${label}`, before, after });

  const blockers = calc.approvalBlockers;
  const hasMonthly = plan.lines.some((l) => l.mode === 'monthly');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {plan.name} <StatusPill plan={plan} />
          </h1>
          <div className="sub">
            Rok {plan.year} · wersja {plan.version} · {plan.currency}, kwoty netto · marża domyślna {formatNumber(dec(plan.defaultMarginPct), 2, 0)}%
            {plan.salesTarget && <> · cel sprzedaży {formatMoney(dec(plan.salesTarget), plan.currency)}</>}
          </div>
        </div>
        <div className="actions">
          <a className="btn" href={href({ name: 'dashboard', planId: plan.id })}>
            Dashboard
          </a>
          <ExportButtons plan={plan} />
          {readOnly ? (
            <button
              className="btn-primary"
              onClick={() => {
                const v = attempt(() => createNewVersion(plan.id));
                if (v) {
                  toast(`Utworzono wersję ${v.version} (szkic).`);
                  navigate({ name: 'plan', planId: v.id });
                }
              }}
            >
              Nowa wersja
            </button>
          ) : (
            <>
              <a className="btn" href={href({ name: 'import', planId: plan.id })}>
                Importuj
              </a>
              <button onClick={() => setModal('settings')}>Ustawienia planu</button>
              <button className="btn-primary" onClick={() => setModal('approve')}>
                Zatwierdź plan
              </button>
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="banner">
          Plan zatwierdzony {plan.approvedAt && formatDateTime(plan.approvedAt)} – tylko do odczytu. Aby wprowadzić zmiany, utwórz nową wersję.
        </div>
      )}

      <SummaryBar calc={calc} currency={plan.currency} />

      <div className="card">
        <div className="card-head">
          <div className="actions">
            <div className="segmented" role="group" aria-label="Widok">
              <button aria-pressed={view === 'annual'} onClick={() => setView('annual')}>
                Roczny
              </button>
              <button aria-pressed={view === 'monthly'} onClick={() => setView('monthly')}>
                Miesięczny
              </button>
            </div>
            {view === 'annual' && !readOnly && (
              <div className="segmented" role="group" aria-label="Tryb wprowadzania kwot">
                <button aria-pressed={inputMode === 'amount'} onClick={() => setInputMode('amount')}>
                  Kwota
                </button>
                <button aria-pressed={inputMode === 'percent'} onClick={() => setInputMode('percent')} disabled={calc.limit.isZero()} title={calc.limit.isZero() ? 'Ustaw limit budżetu' : undefined}>
                  % limitu
                </button>
              </div>
            )}
          </div>
          {!readOnly && (
            <div className="actions">
              <select
                aria-label="Dodaj kategorię do planu"
                value=""
                onChange={(e) => {
                  if (e.target.value === '__new') setModal('newCategory');
                  else if (e.target.value) attempt(() => addLine(plan.id, e.target.value));
                }}
              >
                <option value="">+ Dodaj kategorię…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
                <option value="__new">Nowa kategoria…</option>
              </select>
            </div>
          )}
        </div>

        {plan.lines.length === 0 ? (
          <div className="empty">
            <h3>Plan jest pusty</h3>
            <p>Dodaj kategorie z listy powyżej albo zaimportuj szablon XLSX/CSV.</p>
          </div>
        ) : view === 'annual' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {sortHeader('name', 'Kategoria', false)}
                  {sortHeader('cost', inputMode === 'percent' && !readOnly ? '% limitu → kwota' : `Kwota (${plan.currency})`)}
                  <th className="num">Udział</th>
                  {sortHeader('revenue', 'Przychód planowany')}
                  <th className="num">Marża %</th>
                  <th className="num">ROI</th>
                  {sortHeader('romi', 'ROMI')}
                  {sortHeader('roas', 'ROAS')}
                  <th className="num">Próg rentowności</th>
                  <th>Założenie</th>
                  <th>
                    <span className="sr-only">Akcje</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const isGroup = row.children.length > 0;
                  const open = !collapsed.has(row.categoryId);
                  return (
                    <Fragment key={row.categoryId}>
                      {isGroup ? (
                        <GroupRow
                          row={row}
                          plan={plan}
                          open={open}
                          readOnly={readOnly}
                          flash={flash === row.categoryId}
                          onToggle={() =>
                            setCollapsed((s) => {
                              const n = new Set(s);
                              if (n.has(row.categoryId)) n.delete(row.categoryId);
                              else n.add(row.categoryId);
                              return n;
                            })
                          }
                          onAddSub={() => setModal({ sub: row.categoryId })}
                          onRemove={() => {
                            confirmDialog(`Usunąć „${row.name}” razem z podkategoriami z planu?`, { confirmLabel: 'Usuń', danger: true }).then((ok) => ok && attempt(() => removeCategoryFromPlan(plan.id, row.categoryId)));
                          }}
                        />
                      ) : null}
                      {(isGroup ? (open ? row.children : []) : [row]).map((leaf) => (
                        <Fragment key={leaf.categoryId}>
                          <LineRow
                            row={leaf}
                            plan={plan}
                            child={isGroup}
                            readOnly={readOnly}
                            inputMode={inputMode}
                            limit={calc.limit}
                            flash={flash === leaf.categoryId}
                            detailsOpen={details === leaf.categoryId}
                            onDetails={() => setDetails((d) => (d === leaf.categoryId ? null : leaf.categoryId))}
                            update={(patch) => update(leaf.line!, patch)}
                            log={(field, label) => log(leaf, field, label)}
                          />
                          {details === leaf.categoryId && (
                            <DetailsRow
                              row={leaf}
                              plan={plan}
                              readOnly={readOnly}
                              canAddSub={!isGroup && !catById.get(leaf.categoryId)?.parentId}
                              update={(patch) => update(leaf.line!, patch)}
                              log={(field, label) => log(leaf, field, label)}
                              onAddSub={() => setModal({ sub: leaf.categoryId })}
                            />
                          )}
                        </Fragment>
                      ))}
                    </Fragment>
                  );
                })}
                <tr className="total">
                  <td>Razem</td>
                  <td className="num">{formatMoney(calc.allocated)}</td>
                  <td className="num">{calc.allocated.isZero() ? '–' : '100,0%'}</td>
                  <td className="num">{formatMoney(calc.performance.revenue)}</td>
                  <td />
                  <td className="num">{calc.roiTotal ? formatPct(calc.roiTotal) : 'n/d'}</td>
                  <td className={`num ${calc.romiTotal?.isNegative() ? 'neg' : ''}`} title="ROMI całego budżetu (z kosztem kategorii brand)">
                    {calc.romiTotal ? formatPct(calc.romiTotal) : 'n/d'}
                  </td>
                  <td className="num" title="ROAS kategorii performance">
                    {calc.performance.roas ? formatNumber(calc.performance.roas, 1, 1) : 'n/d'}
                  </td>
                  <td colSpan={3} className="muted small">
                    ROMI performance: {calc.performance.romi ? formatPct(calc.performance.romi) : 'n/d'} · koszt brand: {formatMoney(calc.brandCost, plan.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <MonthlyGrid plan={plan} rows={sorted} readOnly={readOnly} totals={calc.monthlyTotals} allocated={calc.allocated} />
        )}
        {view === 'annual' && hasMonthly && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Pozycje oznaczone „mies.” mają kwotę wpisaną miesięcznie – kwota roczna jest sumą miesięcy (edytuj w widoku miesięcznym).
          </p>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head">
            <h2>Ostrzeżenia</h2>
            <span className="muted small">{calc.warnings.length}</span>
          </div>
          <WarningsList warnings={calc.warnings} onSelect={selectRow} />
        </div>
        <AuditCard planId={plan.id} />
      </div>

      {modal === 'settings' && (
        <PlanFormModal
          title="Ustawienia planu"
          submitLabel="Zapisz"
          initial={{ year: plan.year, name: plan.name, currency: plan.currency, limit: plan.limit, defaultMarginPct: plan.defaultMarginPct, salesTarget: plan.salesTarget }}
          onClose={() => setModal(null)}
          onSubmit={(input) => {
            if (attempt(() => (updatePlanSettings(plan.id, input), true))) setModal(null);
          }}
        />
      )}
      {modal === 'approve' && (
        <Modal
          title="Zatwierdzenie planu"
          onClose={() => setModal(null)}
          footer={
            <>
              <button onClick={() => setModal(null)}>Anuluj</button>
              <button
                className="btn-primary"
                disabled={blockers.length > 0}
                onClick={() => {
                  if (attempt(() => (approvePlan(plan.id), true))) {
                    setModal(null);
                    toast('Plan zatwierdzony – jest teraz tylko do odczytu.');
                  }
                }}
              >
                Zatwierdź
              </button>
            </>
          }
        >
          {blockers.length > 0 ? (
            <>
              <div className="banner banner-critical" role="alert">
                Planu nie można zatwierdzić – usuń blokady:
              </div>
              <WarningsList
                warnings={blockers}
                onSelect={(id) => {
                  setModal(null);
                  selectRow(id);
                }}
              />
            </>
          ) : (
            <>
              <p>
                Zatwierdzony plan zostanie zamrożony i będzie tylko do odczytu – stanie się niezmiennym punktem odniesienia. Zmiany wprowadzisz w
                nowej wersji.
              </p>
              <p>
                Przydzielono <strong>{formatMoney(calc.allocated, plan.currency)}</strong> z {formatMoney(calc.limit, plan.currency)} · ROMI całego
                budżetu <strong>{calc.romiTotal ? formatPct(calc.romiTotal) : 'n/d'}</strong>.
              </p>
              {calc.warnings.length > 0 && <p className="muted">Plan ma {calc.warnings.length} ostrzeżeń, które nie blokują zatwierdzenia.</p>}
            </>
          )}
        </Modal>
      )}
      {modal === 'newCategory' && <NewCategoryModal planId={plan.id} onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && <SubcategoryModal plan={plan} parentId={modal.sub} onClose={() => setModal(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------

function Na({ brand }: { brand: boolean }) {
  return brand ? (
    <span className="na" title="Kategoria wizerunkowa – ROI nie jest liczone">
      n/d
    </span>
  ) : (
    <span className="na">n/d</span>
  );
}

function ReturnsCells({ row }: { row: RowCalc }) {
  const brand = row.type === 'brand';
  if (brand) {
    return (
      <>
        <td className="num">
          <Na brand />
        </td>
        <td className="num">
          <Na brand />
        </td>
        <td className="num">
          <Na brand />
        </td>
        <td className="num">
          <Na brand />
        </td>
      </>
    );
  }
  return (
    <>
      <td className="num">{row.roi ? formatPct(row.roi) : <Na brand={false} />}</td>
      <td className={`num ${row.romi?.isNegative() ? 'neg' : ''}`}>{row.romi ? formatPct(row.romi) : <Na brand={false} />}</td>
      <td className="num">{row.roas ? formatNumber(row.roas, 1, 1) : <Na brand={false} />}</td>
      <td className="num">{row.breakeven ? formatMoney(row.breakeven) : '–'}</td>
    </>
  );
}

function GroupRow({
  row,
  plan,
  open,
  readOnly,
  flash,
  onToggle,
  onAddSub,
  onRemove,
}: {
  row: RowCalc;
  plan: BudgetPlan;
  open: boolean;
  readOnly: boolean;
  flash: boolean;
  onToggle: () => void;
  onAddSub: () => void;
  onRemove: () => void;
}) {
  return (
    <tr className={`group ${flash ? 'flash' : ''}`} id={`row-${row.categoryId}`}>
      <td>
        <span className="cat-name">
          <button className="expander" aria-expanded={open} aria-label={open ? 'Zwiń podkategorie' : 'Rozwiń podkategorie'} onClick={onToggle}>
            {open ? '▾' : '▸'}
          </button>
          <i className="swatch" style={{ background: row.color }} />
          {row.name}
          <TypePill type={row.type} />
          <span className="muted small">{row.children.length} podkat.</span>
        </span>
      </td>
      <td className="num">{formatMoney(row.cost)}</td>
      <td className="num">{formatPct(row.shareDisplay)}</td>
      <td className="num">{row.type === 'brand' ? <Na brand /> : formatMoney(row.revenue)}</td>
      <td className="num">{row.margin ? formatPct(row.margin.times(HUNDRED)) : '–'}</td>
      <ReturnsCells row={row} />
      <td className="muted small">Suma podkategorii</td>
      <td>
        {!readOnly && (
          <div className="actions" style={{ flexWrap: 'nowrap' }}>
            <button className="btn-sm" onClick={onAddSub} title={`Dodaj podkategorię do „${plan.name}”`}>
              + podkat.
            </button>
            <button className="btn-sm btn-ghost btn-danger" onClick={onRemove} aria-label={`Usuń ${row.name}`}>
              ✕
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function LineRow({
  row,
  plan,
  child,
  readOnly,
  inputMode,
  limit,
  flash,
  detailsOpen,
  onDetails,
  update,
  log,
}: {
  row: RowCalc;
  plan: BudgetPlan;
  child: boolean;
  readOnly: boolean;
  inputMode: 'amount' | 'percent';
  limit: Decimal;
  flash: boolean;
  detailsOpen: boolean;
  onDetails: () => void;
  update: (patch: Partial<BudgetLine>) => void;
  log: (field: string, label: string) => (before: string, after: string) => void;
}) {
  const line = row.line!;
  const brand = row.type === 'brand';
  const monthly = line.mode === 'monthly';
  const missingAssumption = !brand && dec(line.revenue).greaterThan(0) && !line.assumption.trim();
  const pctValue = limit.isZero() ? '0' : toStore(row.cost.dividedBy(limit).times(HUNDRED).toDecimalPlaces(4));

  return (
    <tr className={`${child ? 'child' : ''} ${flash ? 'flash' : ''}`} id={`row-${row.categoryId}`}>
      <td>
        <span className="cat-name">
          <button className="expander" aria-expanded={detailsOpen} aria-label={`Szczegóły: ${row.name}`} onClick={onDetails}>
            {detailsOpen ? '▾' : '▸'}
          </button>
          <i className="swatch" style={{ background: row.color }} />
          {row.name}
          {!child && <TypePill type={row.type} />}
          {monthly && (
            <span className="pill" title="Kwota wpisana miesięcznie">
              mies.
            </span>
          )}
        </span>
      </td>
      <td className="num">
        {readOnly || monthly ? (
          formatMoney(row.cost)
        ) : inputMode === 'percent' ? (
          <span title={formatMoney(row.cost, plan.currency)}>
            <NumberInput
              ariaLabel={`${row.name}: udział w limicie %`}
              value={pctValue}
              max={1000}
              digits={2}
              suffix="%"
              onChange={(v) => update({ annualAmount: toStore(limit.times(dec(v)).dividedBy(HUNDRED).toDecimalPlaces(2)) })}
              onCommit={log('annualAmount', 'kwota (z % limitu)')}
            />
          </span>
        ) : (
          <NumberInput ariaLabel={`${row.name}: kwota roczna`} value={line.annualAmount} onChange={(v) => update({ annualAmount: v })} onCommit={log('annualAmount', 'kwota')} />
        )}
      </td>
      <td className="num">{formatPct(row.shareDisplay)}</td>
      <td className="num">
        {brand ? (
          <span className="na" title="Kategoria wizerunkowa – bez przychodu przypisanego">
            n/d – wizerunkowa
          </span>
        ) : readOnly ? (
          formatMoney(row.revenue)
        ) : (
          <NumberInput ariaLabel={`${row.name}: przychód planowany`} value={line.revenue} onChange={(v) => update({ revenue: v })} onCommit={log('revenue', 'przychód')} />
        )}
      </td>
      <td className="num">
        {brand ? (
          <span className="na">–</span>
        ) : readOnly ? (
          formatPct(row.margin!.times(HUNDRED))
        ) : (
          <NumberInput
            ariaLabel={`${row.name}: marża %`}
            value={line.marginPct ?? ''}
            allowEmpty
            max={100}
            placeholder={`${formatNumber(dec(plan.defaultMarginPct), 2, 0)} (dom.)`}
            onChange={(v) => update({ marginPct: v === '' ? null : v })}
            onCommit={log('marginPct', 'marża %')}
          />
        )}
      </td>
      <ReturnsCells row={row} />
      <td>
        {readOnly ? (
          <span className="small">{line.assumption || <span className="muted">–</span>}</span>
        ) : (
          <TextCell
            value={line.assumption}
            ariaLabel={`${row.name}: założenie`}
            placeholder={brand ? 'Cel kampanii (opcjonalnie)' : 'Źródło prognozy przychodu'}
            invalid={missingAssumption}
            onChange={(v) => update({ assumption: v })}
            onCommit={log('assumption', 'założenie')}
          />
        )}
      </td>
      <td>
        {!readOnly && (
          <button
            className="btn-sm btn-ghost btn-danger"
            aria-label={`Usuń ${row.name} z planu`}
            onClick={() => {
              if (row.cost.isZero()) attempt(() => removeLine(plan.id, line.id));
              else confirmDialog(`Usunąć „${row.name}” z planu?`, { confirmLabel: 'Usuń', danger: true }).then((ok) => ok && attempt(() => removeLine(plan.id, line.id)));
            }}
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

function TextCell({
  value,
  ariaLabel,
  placeholder,
  invalid,
  onChange,
  onCommit,
}: {
  value: string;
  ariaLabel: string;
  placeholder?: string;
  invalid?: boolean;
  onChange: (v: string) => void;
  onCommit: (before: string, after: string) => void;
}) {
  const [start, setStart] = useState(value);
  return (
    <input
      className="cell-input cell-text"
      aria-label={ariaLabel}
      aria-invalid={invalid ? 'true' : 'false'}
      title={invalid ? 'Założenie jest wymagane, gdy przychód > 0' : value}
      placeholder={placeholder}
      value={value}
      onFocus={() => setStart(value)}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(start, value)}
    />
  );
}

function DetailsRow({
  row,
  plan,
  readOnly,
  canAddSub,
  update,
  log,
  onAddSub,
}: {
  row: RowCalc;
  plan: BudgetPlan;
  readOnly: boolean;
  canAddSub: boolean;
  update: (patch: Partial<BudgetLine>) => void;
  log: (field: string, label: string) => (before: string, after: string) => void;
  onAddSub: () => void;
}) {
  const line = row.line!;
  const brand = row.type === 'brand';
  const kpi = line.brandKpi;
  const setKpi = (k: keyof typeof kpi, v: string) => update({ brandKpi: { ...kpi, [k]: v === '' ? undefined : v } });
  return (
    <tr className="details">
      <td colSpan={11}>
        <div className="details-grid">
          <div className="field">
            <span>Rozkład w roku</span>
            {line.mode === 'monthly' ? (
              <>
                <span className="small">Kwoty wpisane miesięcznie</span>
                {!readOnly && (
                  <button className="btn-sm" onClick={() => update({ mode: 'annual', monthly: null })}>
                    Wróć do kwoty rocznej z profilem
                  </button>
                )}
              </>
            ) : (
              <select
                disabled={readOnly}
                value={line.seasonality}
                aria-label={`${row.name}: profil sezonowości`}
                onChange={(e) => update({ seasonality: e.target.value as SeasonalityProfileId })}
              >
                {SEASONALITY_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            <span className="hint">
              {monthlyAmounts(line)
                .map((m, i) => `${MONTH_LABELS[i]} ${formatNumber(m, 0)}`)
                .join(' · ')}
            </span>
          </div>
          {brand ? (
            <>
              <label className="field">
                <span>Zasięg (osoby)</span>
                <NumberInput className="" ariaLabel="Zasięg" allowEmpty disabled={readOnly} digits={0} value={kpi.reach ?? ''} onChange={(v) => setKpi('reach', v)} onCommit={log('reach', 'zasięg')} />
              </label>
              <label className="field">
                <span>CPM ({plan.currency})</span>
                <NumberInput className="" ariaLabel="CPM" allowEmpty disabled={readOnly} value={kpi.cpm ?? ''} onChange={(v) => setKpi('cpm', v)} onCommit={log('cpm', 'CPM')} />
              </label>
              <label className="field">
                <span>Liczba odsłon</span>
                <NumberInput className="" ariaLabel="Liczba odsłon" allowEmpty disabled={readOnly} digits={0} value={kpi.views ?? ''} onChange={(v) => setKpi('views', v)} onCommit={log('views', 'odsłony')} />
              </label>
              <label className="field">
                <span>Wzrost świadomości (p.p.)</span>
                <NumberInput className="" ariaLabel="Wzrost świadomości" allowEmpty max={100} disabled={readOnly} value={kpi.awarenessLiftPct ?? ''} onChange={(v) => setKpi('awarenessLiftPct', v)} onCommit={log('awarenessLiftPct', 'wzrost świadomości')} />
              </label>
            </>
          ) : (
            <div className="field">
              <span>Zysk brutto z przychodu</span>
              <strong>{formatMoney(row.grossProfit, plan.currency)}</strong>
              <span className="hint">
                Marża {row.margin ? formatPct(row.margin.times(HUNDRED)) : '–'} {row.marginOverridden ? '(nadpisana)' : '(domyślna planu)'}
                {row.breakeven && <> · próg rentowności {formatMoney(row.breakeven, plan.currency)}</>}
              </span>
            </div>
          )}
          {canAddSub && !readOnly && (
            <div className="field">
              <span>Podkategorie</span>
              <button className="btn-sm" onClick={onAddSub}>
                + Rozbij na podkategorie
              </button>
              <span className="hint">Kwota kategorii przejdzie na pierwszą podkategorię.</span>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------

function MonthlyGrid({ plan, rows, readOnly, totals, allocated }: { plan: BudgetPlan; rows: RowCalc[]; readOnly: boolean; totals: Decimal[]; allocated: Decimal }) {
  const setMonth = (line: BudgetLine, idx: number, value: string) => {
    const current = monthlyAmounts(line).map((m) => toStore(m));
    current[idx] = value;
    attempt(() => updateLine(plan.id, line.id, { mode: 'monthly', monthly: current }));
  };
  const leafRow = (r: RowCalc, child: boolean) => (
    <tr key={r.categoryId} className={child ? 'child' : ''}>
      <td>
        <span className="cat-name">
          <i className="swatch" style={{ background: r.color }} />
          {r.name}
        </span>
      </td>
      {r.monthly.map((m, i) => (
        <td key={i} className="num">
          {readOnly ? (
            formatAmount(m)
          ) : (
            <NumberInput
              ariaLabel={`${r.name}: ${MONTH_LABELS[i]}`}
              value={toStore(m)}
              onChange={(v) => setMonth(r.line!, i, v)}
              onCommit={(b, a) => logLineChange(plan.id, { field: `month${i + 1}`, label: `${r.name}: ${MONTH_LABELS[i]}`, before: b, after: a })}
            />
          )}
        </td>
      ))}
      <td className="num">
        <strong>{formatMoney(r.cost)}</strong>
      </td>
    </tr>
  );
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>
        Edycja miesiąca przełącza pozycję na kwoty miesięczne – kwota roczna = suma miesięcy.
      </p>
      <div className="table-wrap monthly">
        <table>
          <thead>
            <tr>
              <th>Kategoria</th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className="num">
                  {m}
                </th>
              ))}
              <th className="num">Rok</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              r.children.length ? (
                <Fragment key={r.categoryId}>
                  <tr className="group">
                    <td>{r.name}</td>
                    {r.monthly.map((m, i) => (
                      <td key={i} className="num">
                        {formatAmount(m)}
                      </td>
                    ))}
                    <td className="num">{formatMoney(r.cost)}</td>
                  </tr>
                  {r.children.map((c) => leafRow(c, true))}
                </Fragment>
              ) : (
                leafRow(r, false)
              ),
            )}
            <tr className="total">
              <td>Razem</td>
              {totals.map((t, i) => (
                <td key={i} className="num">
                  {formatAmount(t)}
                </td>
              ))}
              <td className="num">{formatMoney(allocated)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function NewCategoryModal({ planId, onClose }: { planId: string; onClose: () => void }) {
  const data = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('performance');
  const submit = () => {
    const cat = attempt(() =>
      addCategory({ name, type, parentId: null, color: CATEGORY_COLORS[data.categories.filter((c) => !c.parentId).length % CATEGORY_COLORS.length], active: true }),
    );
    if (cat && attempt(() => addLine(planId, cat.id))) onClose();
  };
  return (
    <Modal
      title="Nowa kategoria"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={submit}>
            Dodaj do słownika i planu
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Nazwa</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>
        <label className="field">
          <span>Typ</span>
          <select value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
            <option value="performance">Performance – ROI liczone</option>
            <option value="brand">Brand – wizerunkowa, bez ROI</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}

function SubcategoryModal({ plan, parentId, onClose }: { plan: BudgetPlan; parentId: string; onClose: () => void }) {
  const data = useStore();
  const parent = data.categories.find((c) => c.id === parentId)!;
  const inPlan = new Set(plan.lines.map((l) => l.categoryId));
  const existing = data.categories.filter((c) => c.parentId === parentId && !inPlan.has(c.id));
  const [name, setName] = useState(existing[0]?.name ?? '');
  const parentHasLine = plan.lines.some((l) => l.categoryId === parentId);
  const submit = () => {
    if (attempt(() => addSubcategoryLine(plan.id, parentId, name))) onClose();
  };
  return (
    <Modal
      title={`Podkategoria: ${parent.name}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={submit}>
            Dodaj
          </button>
        </>
      }
    >
      <label className="field">
        <span>Nazwa podkategorii (np. Meta, LinkedIn, TikTok)</span>
        <input list="sub-suggestions" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <datalist id="sub-suggestions">
          {existing.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <span className="hint">
          Typ podkategorii: {parent.type}. Kwota kategorii = suma podkategorii.
          {parentHasLine && ' Obecna kwota, przychód i założenie kategorii przejdą na tę podkategorię.'}
        </span>
      </label>
    </Modal>
  );
}

function AuditCard({ planId }: { planId: string }) {
  const data = useStore();
  const [all, setAll] = useState(false);
  const entries = data.audit.filter((a) => a.planId === planId).reverse();
  const shown = all ? entries : entries.slice(0, 8);
  const fmt = (v: string) => {
    if (v === '') return '–';
    const d = /^-?\d+(\.\d+)?$/.test(v) ? formatAmount(new Decimal(v)) : v;
    return d.length > 40 ? `${d.slice(0, 39)}…` : d;
  };
  return (
    <div className="card">
      <div className="card-head">
        <h2>Dziennik zmian</h2>
        <span className="muted small">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="muted">Brak zmian.</p>
      ) : (
        <>
          <table>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(e.timestamp)}
                  </td>
                  <td className="small">{e.label}</td>
                  <td className="small">
                    {e.before !== '' && (
                      <>
                        <span className="muted">{fmt(e.before)}</span> →{' '}
                      </>
                    )}
                    {fmt(e.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length > 8 && (
            <button className="btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => setAll((a) => !a)}>
              {all ? 'Pokaż mniej' : `Pokaż wszystkie (${entries.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
