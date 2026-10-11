import { useSyncExternalStore } from 'react';

// Minimalny router oparty o hash – aplikacja wewnętrzna, bez potrzeby konfiguracji serwera.

export type Route =
  | { name: 'plans' }
  | { name: 'plan'; planId: string }
  | { name: 'dashboard'; planId: string }
  | { name: 'import'; planId: string | null }
  | { name: 'settings' }
  | { name: 'notFound' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'plans' };
  if (parts[0] === 'plan' && parts[1]) {
    if (parts[2] === 'dashboard') return { name: 'dashboard', planId: parts[1] };
    if (parts[2] === 'import') return { name: 'import', planId: parts[1] };
    return { name: 'plan', planId: parts[1] };
  }
  if (parts[0] === 'import') return { name: 'import', planId: null };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'notFound' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'plans':
      return '#/';
    case 'plan':
      return `#/plan/${route.planId}`;
    case 'dashboard':
      return `#/plan/${route.planId}/dashboard`;
    case 'import':
      return route.planId ? `#/plan/${route.planId}/import` : '#/import';
    case 'settings':
      return '#/settings';
    default:
      return '#/';
  }
}

export function navigate(route: Route) {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    () => window.location.hash,
  );
  return parseRoute(hash);
}
