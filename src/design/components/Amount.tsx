import { Icon } from './Icon';

const fmtWhole = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const fmtFrac = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });

/** Formats integer agorot as ₪ (drops ".00" for whole shekels). */
export function formatShekels(agorot: number): string {
  return agorot % 100 === 0 ? fmtWhole.format(agorot / 100) : fmtFrac.format(agorot / 100);
}

export interface AmountProps {
  /** Integer agorot. */
  agorot: number;
  tone?: 'default' | 'earned' | 'locked' | 'muted' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show a coin (earned) or lock (locked) glyph. */
  withIcon?: boolean;
  label?: string;
}

export function Amount({ agorot, tone = 'default', size = 'md', withIcon, label }: AmountProps) {
  const text = formatShekels(agorot);
  return (
    <span className={`sq-amount sq-amount--${tone} sq-amount--${size}`} aria-label={label ? `${label}: ${text}` : undefined}>
      {withIcon && <Icon name={tone === 'locked' ? 'lock' : 'coin'} size={size === 'xl' || size === 'lg' ? 'md' : 'sm'} className="sq-amount__icon" />}
      <bdi>{text}</bdi>
    </span>
  );
}
