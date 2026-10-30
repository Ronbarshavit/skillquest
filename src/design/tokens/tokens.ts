/**
 * Design tokens. Single source of truth for the look of SkillQuest.
 *
 * Two tiers:
 *  1. `base` tokens: theme-independent scales (spacing, radii, type scale, motion).
 *  2. `themes`: semantic colour + shadow tokens, one object per theme. Every theme must
 *     implement the same keys (enforced by the `ThemeTokens` type).
 *
 * Every token is emitted as a CSS custom property: --sq-<group>-<name>
 * (camelCase keys become kebab-case). Components only use var(--sq-…).
 */

export const base = {
  font: {
    family: "'Rubik', 'Assistant', 'Segoe UI', 'Arial Hebrew', 'Noto Sans Hebrew', system-ui, sans-serif",
    familyNumeric: "'Rubik', system-ui, sans-serif",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    xxl: '1.75rem',
    display: '2.5rem',
  },
  fontWeight: { regular: '400', medium: '500', bold: '700' },
  lineHeight: { tight: '1.2', normal: '1.5' },
  space: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
  },
  radius: { sm: '0.5rem', md: '0.875rem', lg: '1.25rem', pill: '999px' },
  size: {
    tapTarget: '2.75rem',
    pinKey: '4rem',
    iconSm: '1rem',
    iconMd: '1.5rem',
    iconLg: '2rem',
    progressHeight: '0.625rem',
    borderWidth: '1px',
    focusRing: '3px',
    contentMax: '40rem',
    categoryTile: '8.5rem',
  },
  motion: {
    durationFast: '120ms',
    durationNormal: '220ms',
    durationSlow: '600ms',
    durationCelebrate: '1400ms',
    easeStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easeBounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  z: { header: '10', overlay: '100' },
} as const;

/** Category accent palette. Core stores only the key (SkillCategory.colorKey). */
export const categoryColorKeys = ['sky', 'grape', 'mint', 'coral', 'sun', 'rose', 'teal', 'slate'] as const;
export type CategoryColorKey = (typeof categoryColorKeys)[number];

export interface ThemeTokens {
  color: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryHover: string;
    onPrimary: string;
    secondary: string;
    onSecondary: string;
    success: string;
    onSuccess: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    danger: string;
    onDanger: string;
    dangerSoft: string;
    info: string;
    infoSoft: string;
    /** Locked (deposited, unearned) money. */
    locked: string;
    lockedSoft: string;
    /** Earned / available money. */
    earned: string;
    earnedSoft: string;
    coin: string;
    track: string;
    focus: string;
    overlay: string;
  } & Record<`cat${Capitalize<CategoryColorKey>}`, string> &
    Record<`cat${Capitalize<CategoryColorKey>}Soft`, string>;
  shadow: { sm: string; md: string; lg: string };
}

const defaultTheme: ThemeTokens = {
  color: {
    bg: '#FFF8EE',
    surface: '#FFFFFF',
    surfaceAlt: '#F6F1FF',
    border: '#E8E1F2',
    text: '#1F1B3A',
    textMuted: '#5F5A7A',
    primary: '#5B4BDB',
    primaryHover: '#4A3BC4',
    onPrimary: '#FFFFFF',
    secondary: '#EDE9FF',
    onSecondary: '#3B2FA8',
    success: '#1E9E61',
    onSuccess: '#FFFFFF',
    successSoft: '#DDF6E8',
    warning: '#B86E00',
    warningSoft: '#FFF0D1',
    danger: '#D33A4A',
    onDanger: '#FFFFFF',
    dangerSoft: '#FDE3E6',
    info: '#2C6FD1',
    infoSoft: '#E1ECFD',
    locked: '#6B6489',
    lockedSoft: '#ECEAF4',
    earned: '#1E9E61',
    earnedSoft: '#DDF6E8',
    coin: '#F5B400',
    track: '#ECE7F5',
    focus: '#FFB020',
    overlay: 'rgba(31, 27, 58, 0.45)',
    catSky: '#2E8BEA',
    catSkySoft: '#E0EFFD',
    catGrape: '#8A4FD8',
    catGrapeSoft: '#F0E6FC',
    catMint: '#15A88A',
    catMintSoft: '#DBF5EE',
    catCoral: '#F0644A',
    catCoralSoft: '#FDE6E1',
    catSun: '#E59A00',
    catSunSoft: '#FFF1D4',
    catRose: '#E0457B',
    catRoseSoft: '#FCE3EC',
    catTeal: '#0E8EA3',
    catTealSoft: '#DDF2F5',
    catSlate: '#4E5A70',
    catSlateSoft: '#E5E8EE',
  },
  shadow: {
    sm: '0 1px 2px rgba(31, 27, 58, 0.08)',
    md: '0 4px 14px rgba(31, 27, 58, 0.10)',
    lg: '0 12px 32px rgba(31, 27, 58, 0.18)',
  },
};

/** Calm: lower saturation, softer contrast, for kids who find bright UIs over-stimulating. */
const calmTheme: ThemeTokens = {
  color: {
    ...defaultTheme.color,
    bg: '#F3F5F2',
    surface: '#FCFDFB',
    surfaceAlt: '#EAF0EA',
    border: '#D9E1D8',
    text: '#26332B',
    textMuted: '#5C6B61',
    primary: '#3F7D6B',
    primaryHover: '#336858',
    secondary: '#E1EEE8',
    onSecondary: '#2A5A4C',
    success: '#3D8B5A',
    successSoft: '#E1F0E5',
    earned: '#3D8B5A',
    earnedSoft: '#E1F0E5',
    coin: '#C9A227',
    track: '#E0E7DF',
    catSky: '#5B8DB8',
    catSkySoft: '#E3ECF4',
    catGrape: '#8873A8',
    catGrapeSoft: '#ECE7F3',
    catMint: '#4E9C88',
    catMintSoft: '#E0F0EB',
    catCoral: '#C27766',
    catCoralSoft: '#F5E7E3',
    catSun: '#B58B32',
    catSunSoft: '#F5EDDA',
    catRose: '#B86D86',
    catRoseSoft: '#F3E5EA',
    catTeal: '#4A8F99',
    catTealSoft: '#E0EEF0',
    catSlate: '#5F6B73',
    catSlateSoft: '#E6EAEC',
  },
  shadow: {
    sm: '0 1px 2px rgba(38, 51, 43, 0.06)',
    md: '0 3px 10px rgba(38, 51, 43, 0.08)',
    lg: '0 10px 24px rgba(38, 51, 43, 0.12)',
  },
};

const darkTheme: ThemeTokens = {
  color: {
    bg: '#14122A',
    surface: '#1F1C3B',
    surfaceAlt: '#2A2650',
    border: '#38335F',
    text: '#F3F1FF',
    textMuted: '#B5B0D6',
    primary: '#8E80FF',
    primaryHover: '#A398FF',
    onPrimary: '#14122A',
    secondary: '#2E2960',
    onSecondary: '#D9D4FF',
    success: '#4CD493',
    onSuccess: '#0B2A1B',
    successSoft: '#163A2A',
    warning: '#FFB84D',
    warningSoft: '#3D2E12',
    danger: '#FF6B7A',
    onDanger: '#2A0C10',
    dangerSoft: '#40191F',
    info: '#7AB0FF',
    infoSoft: '#1A2B4A',
    locked: '#B5B0D6',
    lockedSoft: '#2A2650',
    earned: '#4CD493',
    earnedSoft: '#163A2A',
    coin: '#FFC93C',
    track: '#2E2A55',
    focus: '#FFC93C',
    overlay: 'rgba(0, 0, 0, 0.6)',
    catSky: '#6BB4FF',
    catSkySoft: '#1B2D4A',
    catGrape: '#B98CFF',
    catGrapeSoft: '#2D2150',
    catMint: '#4FD8B7',
    catMintSoft: '#14372F',
    catCoral: '#FF8A73',
    catCoralSoft: '#40221C',
    catSun: '#FFC94D',
    catSunSoft: '#3D3015',
    catRose: '#FF7FAA',
    catRoseSoft: '#401D2B',
    catTeal: '#4FC6D9',
    catTealSoft: '#143439',
    catSlate: '#A8B3C7',
    catSlateSoft: '#272C3A',
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 4px 14px rgba(0, 0, 0, 0.45)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.55)',
  },
};

export const themes = { default: defaultTheme, calm: calmTheme, dark: darkTheme } satisfies Record<string, ThemeTokens>;
export type ThemeName = keyof typeof themes;
export const themeNames = Object.keys(themes) as ThemeName[];
export const themeLabels: Record<ThemeName, string> = { default: 'צבעוני', calm: 'רגוע', dark: 'כהה' };
