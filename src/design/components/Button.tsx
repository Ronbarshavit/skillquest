import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', block, icon, className = '', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={`sq-btn sq-btn--${variant} sq-btn--${size} ${block ? 'sq-btn--block' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'lg' ? 'md' : 'sm'} />}
      {children && <span>{children}</span>}
    </button>
  );
}
