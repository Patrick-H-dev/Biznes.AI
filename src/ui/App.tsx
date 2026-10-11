import { useStore } from '../store/store';
import { Dashboard } from './pages/Dashboard';
import { ImportWizard } from './pages/ImportWizard';
import { PlanEditor } from './pages/PlanEditor';
import { PlanList } from './pages/PlanList';
import { SettingsPage } from './pages/Settings';
import { href, useRoute } from './router';
import { ToastHost } from './toast';

export function App() {
  const route = useRoute();
  const data = useStore();
  const planId = 'planId' in route ? route.planId : null;
  const plan = planId ? data.plans.find((p) => p.id === planId) : undefined;
  const missing = planId && !plan && route.name !== 'import';

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href({ name: 'plans' })}>
          <span className="brand-mark" aria-hidden="true" />
          Planer budżetu marketingu
        </a>
        <nav className="topnav" aria-label="Nawigacja główna">
          <a href={href({ name: 'plans' })} aria-current={route.name === 'plans' ? 'page' : undefined}>
            Plany
          </a>
          {plan && (
            <>
              <a href={href({ name: 'plan', planId: plan.id })} aria-current={route.name === 'plan' ? 'page' : undefined}>
                Edytor {plan.year} v{plan.version}
              </a>
              <a href={href({ name: 'dashboard', planId: plan.id })} aria-current={route.name === 'dashboard' ? 'page' : undefined}>
                Dashboard
              </a>
            </>
          )}
          <a href={href({ name: 'import', planId: null })} aria-current={route.name === 'import' ? 'page' : undefined}>
            Import
          </a>
          <a href={href({ name: 'settings' })} aria-current={route.name === 'settings' ? 'page' : undefined}>
            Ustawienia
          </a>
        </nav>
      </header>
      <main>
        {missing || route.name === 'notFound' ? (
          <div className="card empty">
            <h2>Nie znaleziono strony</h2>
            <p>Plan mógł zostać usunięty.</p>
            <a className="btn" href={href({ name: 'plans' })}>
              Wróć do listy planów
            </a>
          </div>
        ) : route.name === 'plans' ? (
          <PlanList />
        ) : route.name === 'plan' ? (
          <PlanEditor plan={plan!} />
        ) : route.name === 'dashboard' ? (
          <Dashboard plan={plan!} />
        ) : route.name === 'import' ? (
          <ImportWizard key={route.planId ?? 'new'} initialPlanId={route.planId} />
        ) : (
          <SettingsPage />
        )}
      </main>
      <ToastHost />
    </div>
  );
}
