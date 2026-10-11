import { useEffect, useRef, useState } from 'react';
import { Decimal, dec, formatAmount, formatNumber, parseNumber, toStore } from '../../domain/numbers';

interface Props {
  value: string;
  /** Wywoływane przy każdej poprawnej zmianie – przeliczenie planu jest natychmiastowe */
  onChange: (value: string) => void;
  /** Wywoływane po opuszczeniu pola, z wartością sprzed edycji (do dziennika zmian) */
  onCommit?: (before: string, after: string) => void;
  min?: number;
  max?: number;
  digits?: number;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  allowEmpty?: boolean;
  placeholder?: string;
  suffix?: string;
}

function display(value: string, digits: number, allowEmpty: boolean): string {
  if (allowEmpty && value === '') return '';
  return digits === 2 ? formatAmount(dec(value)) : formatNumber(dec(value), digits, 0);
}

export function NumberInput({ value, onChange, onCommit, min = 0, max, digits = 2, disabled, ariaLabel, className = 'cell-input', allowEmpty = false, placeholder, suffix }: Props) {
  const [text, setText] = useState(() => display(value, digits, allowEmpty));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const startValue = useRef(value);
  const escaped = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(display(value, digits, allowEmpty));
  }, [value, digits, allowEmpty]);

  const validate = (raw: string): { ok: true; value: string } | { ok: false; msg: string } => {
    if (raw.trim() === '') return allowEmpty ? { ok: true, value: '' } : { ok: true, value: '0' };
    const d = parseNumber(raw.replace('%', ''));
    if (d === null) return { ok: false, msg: 'To nie jest liczba' };
    if (d.lessThan(min)) return { ok: false, msg: `Wartość nie może być mniejsza niż ${min}` };
    if (max !== undefined && d.greaterThan(max)) return { ok: false, msg: `Wartość nie może przekraczać ${max}` };
    return { ok: true, value: toStore(d.toDecimalPlaces(Math.max(digits, 2), Decimal.ROUND_HALF_UP)) };
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: '100%' }}>
      <input
        className={className}
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={error ? 'true' : 'false'}
        title={error ?? undefined}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          focused.current = true;
          startValue.current = value;
          // Surowa wartość do edycji; ustawiamy ją od razu w DOM i zaznaczamy całość,
          // żeby wpisany tekst zastępował poprzednią wartość (także przy wklejaniu).
          const raw = allowEmpty && value === '' ? '' : dec(value).toFixed().replace('.', ',');
          e.target.value = raw;
          setText(raw);
          e.target.select();
          const input = e.target;
          requestAnimationFrame(() => document.activeElement === input && input.selectionStart === input.selectionEnd && input.select());
        }}
        onChange={(e) => {
          setText(e.target.value);
          const r = validate(e.target.value);
          if (r.ok) {
            setError(null);
            if (r.value !== value) onChange(r.value);
          } else {
            setError(r.msg);
          }
        }}
        onBlur={() => {
          focused.current = false;
          setError(null);
          if (escaped.current) {
            escaped.current = false;
            setText(display(startValue.current, digits, allowEmpty));
            return;
          }
          setText(display(value, digits, allowEmpty));
          onCommit?.(startValue.current, value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            escaped.current = true;
            if (startValue.current !== value) onChange(startValue.current);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {suffix && <span className="muted small">{suffix}</span>}
    </span>
  );
}
