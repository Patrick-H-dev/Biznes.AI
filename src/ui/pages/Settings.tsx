import { Fragment, useState } from 'react';
import { CATEGORY_COLORS } from '../../domain/defaults';
import { demoData } from '../../domain/demo';
import { CURRENCIES, type AppData, type Category, type CategoryType, type Currency } from '../../domain/types';
import { addCategory, categoryUsage, deleteCategory, getState, replaceAllData, resetData, updateCategory, updateSettings, useStore } from '../../store/store';
import { NumberInput } from '../components/NumberInput';
import { downloadBlob } from '../download';
import { confirmDialog } from '../confirm';
import { attempt, toast, toastError } from '../toast';

export function SettingsPage() {
  const data = useStore();
  const s = data.settings;
  const top = data.categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => data.categories.filter((c) => c.parentId === id);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CategoryType>('performance');
  const [newParent, setNewParent] = useState('');

  const add = () => {
    const parent = top.find((c) => c.id === newParent);
    const ok = attempt(() =>
      addCategory({
        name: newName,
        type: parent?.type ?? newType,
        parentId: parent?.id ?? null,
        color: parent?.color ?? CATEGORY_COLORS[top.length % CATEGORY_COLORS.length],
        active: true,
      }),
    );
    if (ok) setNewName('');
  };

  const catRow = (c: Category, child: boolean) => {
    const used = categoryUsage(c.id);
    return (
      <tr key={c.id} className={child ? 'child' : ''} style={{ opacity: c.active ? 1 : 0.55 }}>
        <td>
          <input
            aria-label="Nazwa kategorii"
            defaultValue={c.name}
            onBlur={(e) => {
              if (e.target.value.trim() !== c.name && !attempt(() => (updateCategory(c.id, { name: e.target.value }), true))) e.target.value = c.name;
            }}
          />
        </td>
        <td>
          {child ? (
            <span className="muted small">jak kategoria nadrzędna ({c.type})</span>
          ) : (
            <select aria-label="Typ kategorii" value={c.type} onChange={(e) => attempt(() => updateCategory(c.id, { type: e.target.value as CategoryType }))}>
              <option value="performance">performance</option>
              <option value="brand">brand</option>
            </select>
          )}
        </td>
        <td>
          {!child && (
            <select aria-label="Kolor" value={c.color} onChange={(e) => updateCategory(c.id, { color: e.target.value })} style={{ borderLeft: `14px solid ${c.color}` }}>
              {[...new Set([...CATEGORY_COLORS, c.color])].map((col, i) => (
                <option key={col} value={col}>
                  Kolor {i + 1}
                </option>
              ))}
            </select>
          )}
        </td>
        <td>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={c.active} onChange={(e) => updateCategory(c.id, { active: e.target.checked })} /> aktywna
          </label>
        </td>
        <td className="num muted small">{used ? `w ${used} planach` : 'nieużywana'}</td>
        <td>
          <button
            className="btn-sm btn-ghost btn-danger"
            disabled={used > 0}
            title={used > 0 ? 'Kategoria jest używana w planach – możesz ją dezaktywować' : undefined}
            onClick={() =>
              confirmDialog(`Usunąć kategorię „${c.name}”${child ? '' : ' wraz z podkategoriami'}?`, { confirmLabel: 'Usuń', danger: true }).then(
                (ok) => ok && attempt(() => deleteCategory(c.id)),
              )
            }
          >
            Usuń
          </button>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ustawienia</h1>
          <div className="sub">Słownik kategorii, wartości domyślne, progi ostrzeżeń i kopia zapasowa danych.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Słownik kategorii</h2>
          <span className="muted small">współdzielony między planami · typ podkategorii wynika z kategorii nadrzędnej</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Typ</th>
                <th>Kolor</th>
                <th>Status</th>
                <th className="num">Użycie</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {top.map((c) => (
                <Fragment key={c.id}>
                  {catRow(c, false)}
                  {childrenOf(c.id).map((ch) => catRow(ch, true))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <input aria-label="Nazwa nowej kategorii" placeholder="Nazwa nowej kategorii" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select aria-label="Kategoria nadrzędna" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
            <option value="">Kategoria główna</option>
            {top.map((c) => (
              <option key={c.id} value={c.id}>
                Podkategoria: {c.name}
              </option>
            ))}
          </select>
          {!newParent && (
            <select aria-label="Typ nowej kategorii" value={newType} onChange={(e) => setNewType(e.target.value as CategoryType)}>
              <option value="performance">performance</option>
              <option value="brand">brand</option>
            </select>
          )}
          <button className="btn-primary" onClick={add}>
            Dodaj
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Wartości domyślne nowych planów</h2>
          <div className="form-grid">
            <label className="field">
              <span>Waluta</span>
              <select value={s.defaultCurrency} onChange={(e) => updateSettings({ ...s, defaultCurrency: e.target.value as Currency })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Marża brutto domyślna %</span>
              <NumberInput className="" ariaLabel="Marża domyślna" max={100} value={s.defaultMarginPct} onChange={(v) => updateSettings({ ...s, defaultMarginPct: v })} suffix="%" />
            </label>
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Progi ostrzeżeń</h2>
          <div className="form-grid">
            <label className="field">
              <span>ROMI poniżej (%)</span>
              <NumberInput className="" ariaLabel="Próg ROMI" min={-100} value={s.thresholds.romiMinPct} onChange={(v) => updateSettings({ ...s, thresholds: { ...s.thresholds, romiMinPct: v } })} suffix="%" />
              <span className="hint">kategoria performance nie zwraca kosztu</span>
            </label>
            <label className="field">
              <span>ROAS powyżej</span>
              <NumberInput className="" ariaLabel="Próg ROAS" value={s.thresholds.roasMax} onChange={(v) => updateSettings({ ...s, thresholds: { ...s.thresholds, roasMax: v } })} />
              <span className="hint">prawdopodobnie zawyżona prognoza</span>
            </label>
            <label className="field">
              <span>Udział kategorii powyżej (%)</span>
              <NumberInput className="" ariaLabel="Próg koncentracji" max={100} value={s.thresholds.concentrationMaxPct} onChange={(v) => updateSettings({ ...s, thresholds: { ...s.thresholds, concentrationMaxPct: v } })} suffix="%" />
              <span className="hint">ryzyko koncentracji</span>
            </label>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Dane</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Dane są zapisywane w tej przeglądarce. Pełny eksport (JSON) możesz pobrać w każdej chwili i odtworzyć na innym komputerze.
        </p>
        <div className="actions">
          <button onClick={() => downloadBlob(JSON.stringify(getState(), null, 2), `planer-budzetu-kopia-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}>
            Pobierz kopię zapasową (JSON)
          </button>
          <label className="btn">
            Przywróć z kopii…
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const parsed = JSON.parse(await f.text()) as AppData;
                  if (!(await confirmDialog('Przywrócenie zastąpi wszystkie obecne dane.', { confirmLabel: 'Przywróć', danger: true }))) return;
                  replaceAllData(parsed);
                  toast('Przywrócono dane z kopii zapasowej.');
                } catch (err) {
                  toastError(err instanceof SyntaxError ? new Error('Plik nie jest poprawnym JSON-em.') : err);
                }
              }}
            />
          </label>
          <button
            onClick={async () => {
              if (await confirmDialog('Wczytać dane przykładowe? Obecne dane zostaną zastąpione.', { confirmLabel: 'Wczytaj', danger: true })) {
                resetData(demoData());
                toast('Wczytano dane przykładowe.');
              }
            }}
          >
            Wczytaj dane przykładowe
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              if (await confirmDialog('Usunąć wszystkie plany i przywrócić słownik startowy? Tej operacji nie można cofnąć.', { confirmLabel: 'Wyczyść dane', danger: true })) {
                resetData();
                toast('Wyczyszczono dane.');
              }
            }}
          >
            Wyczyść wszystkie dane
          </button>
        </div>
      </div>
    </>
  );
}
