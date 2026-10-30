import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface Common {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
}

export function TextField({ label, hint, error, className = '', ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={`sq-field ${className}`}>
      <label className="sq-field__label" htmlFor={id}>{label}</label>
      <input id={id} className="sq-field__input" aria-invalid={!!error} aria-describedby={hint || error ? `${id}-d` : undefined} {...rest} />
      {(hint || error) && <div id={`${id}-d`} className={error ? 'sq-field__error' : 'sq-field__hint'}>{error ?? hint}</div>}
    </div>
  );
}

export function TextArea({ label, hint, error, className = '', ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={`sq-field ${className}`}>
      <label className="sq-field__label" htmlFor={id}>{label}</label>
      <textarea id={id} className="sq-field__input sq-field__input--area" aria-invalid={!!error} {...rest} />
      {(hint || error) && <div className={error ? 'sq-field__error' : 'sq-field__hint'}>{error ?? hint}</div>}
    </div>
  );
}
