import { useSyncExternalStore } from 'react';
import { Modal } from './components/Modal';

// Okno potwierdzenia w aplikacji zamiast window.confirm(), które bywa blokowane
// (np. w osadzonych podglądach) i nie pasuje wyglądem do reszty interfejsu.

interface Pending {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { message, confirmLabel: opts.confirmLabel ?? 'Potwierdź', danger: opts.danger ?? false, resolve };
    emit();
  });
}

function close(ok: boolean) {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
}

export function ConfirmHost() {
  const p = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
  );
  if (!p) return null;
  return (
    <Modal
      title="Potwierdzenie"
      onClose={() => close(false)}
      footer={
        <>
          <button onClick={() => close(false)}>Anuluj</button>
          <button className={p.danger ? 'btn-primary btn-destructive' : 'btn-primary'} onClick={() => close(true)}>
            {p.confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{p.message}</p>
    </Modal>
  );
}
