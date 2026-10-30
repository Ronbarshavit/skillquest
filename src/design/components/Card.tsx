import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { categoryColorVars } from '../tokens/css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li';
  /** Category colour key; sets --sq-accent / --sq-accent-soft for children. */
  accent?: string;
  tone?: 'default' | 'soft' | 'outline';
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  children?: ReactNode;
}

export function Card({ as: Tag = 'div', accent, tone = 'default', padding = 'md', interactive, className = '', style, children, ...rest }: CardProps) {
  const vars = accent ? categoryColorVars(accent) : null;
  const s = vars ? ({ ...style, '--sq-accent': vars.accent, '--sq-accent-soft': vars.soft } as CSSProperties) : style;
  return (
    <Tag
      className={`sq-card sq-card--${tone} sq-card--pad-${padding} ${accent ? 'sq-card--accent' : ''} ${interactive ? 'sq-card--interactive' : ''} ${className}`}
      style={s}
      {...rest}
    >
      {children}
    </Tag>
  );
}
