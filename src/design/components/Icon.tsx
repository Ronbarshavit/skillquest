import type { SVGProps } from 'react';

const paths = {
  back: 'M15 18l-6-6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z',
  unlock: 'M7 11V8a5 5 0 019.6-2M6 11h12v9H6z',
  plus: 'M12 5v14M5 12h14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4M12 7.5v1.5M12 15.5V17',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-1-3-2.2.2-1.6-1.6L16.4 4.4 13.5 3.5 12 5.2 10.5 3.5 7.6 4.4l.2 2.2-1.6 1.6L4 8l-1 3 2 1-2 1 1 3 2.2-.2 1.6 1.6-.2 2.2 2.9.9 1.5-1.7 1.5 1.7 2.9-.9-.2-2.2 1.6-1.6L20 16l1-3z',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  parent: 'M8 8a3 3 0 100-6 3 3 0 000 6zM16 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 21v-3a5 5 0 0110 0v3M12 21v-2a4 4 0 018 0v2',
  wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H3zM3 7l13-3v3M16 13.5h2',
  trophy: 'M8 4h8v5a4 4 0 01-8 0zM8 6H4a3 3 0 003 4M16 6h4a3 3 0 01-3 4M12 13v4M8 20h8',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  palette: 'M12 3a9 9 0 000 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 2-1.5H17a4 4 0 004-4c0-4.7-4-8.5-9-8.5zM7.5 12a1 1 0 100-2 1 1 0 000 2zM10 8a1 1 0 100-2 1 1 0 000 2zM15 8a1 1 0 100-2 1 1 0 000 2z',
} as const;

export type IconName = keyof typeof paths;

/** Icons that point in the reading direction and must flip in RTL. */
const MIRRORED: ReadonlySet<IconName> = new Set(['back']);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string;
}

export function Icon({ name, size = 'md', label, className = '', ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`sq-icon sq-icon--${size} ${MIRRORED.has(name) ? 'sq-icon--mirror' : ''} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
