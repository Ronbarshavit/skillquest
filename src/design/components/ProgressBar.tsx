export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label: string;
  tone?: 'primary' | 'accent' | 'success' | 'locked';
  size?: 'sm' | 'md';
  /** Show the visible label text under the bar. */
  showLabel?: boolean;
}

export function ProgressBar({ value, label, tone = 'primary', size = 'md', showLabel }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`sq-progress sq-progress--${tone} sq-progress--${size}`}>
      <div className="sq-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
        <div className="sq-progress__fill" style={{ inlineSize: `${pct}%` }} />
      </div>
      {showLabel && <div className="sq-progress__label">{label}</div>}
    </div>
  );
}
