import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface ScreenHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** When set, a back button is rendered at the inline-start edge. */
  onBack?: () => void;
  backLabel?: string;
  /** Rendered at the inline-end edge. */
  actions?: ReactNode;
  leading?: ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, backLabel = 'חזרה', actions, leading }: ScreenHeaderProps) {
  return (
    <header className="sq-header">
      {onBack && (
        <button type="button" className="sq-header__back" onClick={onBack} aria-label={backLabel}>
          <Icon name="back" />
        </button>
      )}
      {leading}
      <div className="sq-header__titles">
        <h1 className="sq-header__title">{title}</h1>
        {subtitle && <p className="sq-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="sq-header__actions">{actions}</div>}
    </header>
  );
}
