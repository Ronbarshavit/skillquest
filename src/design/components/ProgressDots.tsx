export type DotState = 'todo' | 'current' | 'correct' | 'wrong';

export interface ProgressDotsProps {
  states: DotState[];
  label: string;
}

/** One dot per question; fills from inline-start (right in RTL), coloured by result. */
export function ProgressDots({ states, label }: ProgressDotsProps) {
  return (
    <ol className="sq-dots" aria-label={label}>
      {states.map((s, i) => (
        <li key={i} className={`sq-dots__dot sq-dots__dot--${s}`} aria-current={s === 'current' ? 'step' : undefined} />
      ))}
    </ol>
  );
}
