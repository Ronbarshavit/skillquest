export interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}

/** − value + control. In RTL "+" sits at inline-start (right), matching Hebrew reading order. */
export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <div className="sq-stepper" role="group" aria-label={label}>
      <button type="button" className="sq-stepper__btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label}: הגדלה`}>+</button>
      <output className="sq-stepper__value" aria-live="polite">{value}</output>
      <button type="button" className="sq-stepper__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label}: הקטנה`}>−</button>
    </div>
  );
}
