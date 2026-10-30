import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface PinPadProps {
  /** Current digits (controlled). */
  value: string;
  length: number;
  onChange: (next: string) => void;
  /** Called once when `length` digits have been entered. */
  onComplete?: (pin: string) => void;
  label: string;
  disabled?: boolean;
  error?: boolean;
  /** Labels for the non-digit keys (localised by the caller). */
  deleteLabel: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/**
 * Numeric keypad with dots (presentational). Digits keep the familiar phone order even in RTL,
 * hence dir="ltr" on the grid. Hardware keyboards work too (digits / Backspace).
 */
export function PinPad({ value, length, onChange, onComplete, label, disabled, error, deleteLabel }: PinPadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'del') return onChange(value.slice(0, -1));
    if (value.length >= length) return;
    const next = value + k;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === 'Backspace') pressRef.current('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`sq-pin ${error ? 'sq-pin--error' : ''}`} ref={ref} role="group" aria-label={label}>
      <div className="sq-pin__dots" dir="ltr" aria-live="polite" aria-label={`${value.length}/${length}`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`sq-pin__dot ${i < value.length ? 'sq-pin__dot--on' : ''}`} />
        ))}
      </div>
      <div className="sq-pin__keys" dir="ltr">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              className={`sq-pin__key ${k === 'del' ? 'sq-pin__key--fn' : ''}`}
              onClick={() => press(k)}
              disabled={disabled || (k === 'del' && value.length === 0)}
              aria-label={k === 'del' ? deleteLabel : k}
            >
              {k === 'del' ? <Icon name="back" size="md" /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
