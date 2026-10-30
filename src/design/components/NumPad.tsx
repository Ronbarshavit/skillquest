import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface NumPadProps {
  /** Current text (controlled), e.g. "-12.5". */
  value: string;
  onChange: (next: string) => void;
  /** Called on the ✓ key or Enter. */
  onSubmit?: () => void;
  label: string;
  deleteLabel: string;
  submitLabel: string;
  /** Show "." and "−" keys. */
  allowDecimal?: boolean;
  allowNegative?: boolean;
  maxLength?: number;
  disabled?: boolean;
  /** Unit shown next to the value (e.g. "ס״מ"). */
  unit?: string;
  /** Visual state after answering. */
  status?: 'idle' | 'correct' | 'wrong';
}

/**
 * Big on-screen number pad for answers (no OS keyboard popping up on phones).
 * Digits keep phone order even in RTL (dir="ltr"); hardware keys work too.
 */
export function NumPad({ value, onChange, onSubmit, label, deleteLabel, submitLabel, allowDecimal, allowNegative, maxLength = 7, disabled, unit, status = 'idle' }: NumPadProps) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'del') return onChange(value.slice(0, -1));
    if (k === 'ok') return value ? onSubmit?.() : undefined;
    if (k === '−') return onChange(value.startsWith('-') ? value.slice(1) : `-${value}`);
    if (k === '.' && value.includes('.')) return;
    if (value.replace('-', '').length >= maxLength) return;
    onChange(k === '.' && (value === '' || value === '-') ? `${value}0.` : value + k);
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === 'Backspace') pressRef.current('del');
      else if (e.key === 'Enter') pressRef.current('ok');
      else if ((e.key === '.' || e.key === ',') && allowDecimal) pressRef.current('.');
      else if (e.key === '-' && allowNegative) pressRef.current('−');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowDecimal, allowNegative]);

  const extra = allowDecimal ? '.' : allowNegative ? '−' : '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', extra, '0', 'del'];
  return (
    <div className={`sq-numpad sq-numpad--${status}`} role="group" aria-label={label}>
      <output className="sq-numpad__display" dir="ltr" aria-live="polite" aria-label={label}>
        <span className="sq-numpad__value">{value.replace('-', '−') || '\u00a0'}</span>
        {unit && <span className="sq-numpad__unit" dir="rtl">{unit}</span>}
      </output>
      <div className="sq-numpad__keys" dir="ltr">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              className={`sq-numpad__key ${k === 'del' ? 'sq-numpad__key--fn' : ''}`}
              onClick={() => press(k)}
              disabled={disabled || (k === 'del' && value.length === 0)}
              aria-label={k === 'del' ? deleteLabel : k}
            >
              {k === 'del' ? <Icon name="back" size="md" /> : k}
            </button>
          ),
        )}
      </div>
      {onSubmit && (
        <button type="button" className="sq-btn sq-btn--primary sq-btn--lg sq-btn--block sq-numpad__ok" onClick={() => press('ok')} disabled={disabled || !value || value === '-'}>
          <Icon name="check" size="md" />
          <span>{submitLabel}</span>
        </button>
      )}
    </div>
  );
}
