import { useEffect, useSyncExternalStore } from 'react';

type Toast = { id: number; text: string; kind: 'info' | 'error' } | null;
let current: Toast = null;
const listeners = new Set<() => void>();
let seq = 0;

export function toast(text: string, kind: 'info' | 'error' = 'info') {
  current = { id: ++seq, text, kind };
  listeners.forEach((l) => l());
}

export function toastError(e: unknown) {
  toast(e instanceof Error ? e.message : String(e), 'error');
}

/** Wykonuje akcję i zamienia wyjątek na komunikat; zwraca wynik albo undefined. */
export function attempt<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    toastError(e);
    return undefined;
  }
}

export function ToastHost() {
  const t = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => {
      if (current?.id === t.id) {
        current = null;
        listeners.forEach((l) => l());
      }
    }, t.kind === 'error' ? 7000 : 3500);
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return (
    <div className={`toast ${t.kind === 'error' ? 'error' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
      {t.text}
    </div>
  );
}
