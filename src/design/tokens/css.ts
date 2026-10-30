import { base, themes, type ThemeName, type ThemeTokens, type CategoryColorKey } from './tokens';

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Flattens a token object into [cssVarName, value] pairs: {color:{textMuted}} → --sq-color-text-muted. */
export function flatten(obj: Record<string, unknown>, prefix = '--sq'): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(obj)) {
    const name = `${prefix}-${kebab(k)}`;
    if (v && typeof v === 'object') out.push(...flatten(v as Record<string, unknown>, name));
    else out.push([name, String(v)]);
  }
  return out;
}

const block = (selector: string, pairs: [string, string][]) =>
  `${selector}{${pairs.map(([k, v]) => `${k}:${v};`).join('')}}`;

/** Full stylesheet: base tokens + default theme on :root, other themes on [data-theme]. */
export function tokensToCss(): string {
  const parts = [block(':root', [...flatten(base as unknown as Record<string, unknown>), ...flatten(themes.default as unknown as Record<string, unknown>)])];
  for (const [name, t] of Object.entries(themes) as [ThemeName, ThemeTokens][]) {
    parts.push(block(`[data-theme="${name}"]`, flatten(t as unknown as Record<string, unknown>)));
  }
  parts.push(`[data-theme="dark"]{color-scheme:dark}`);
  return parts.join('\n');
}

/** Typed helper for TS code that needs a token reference: cssVar('color','primary') → var(--sq-color-primary). */
export const cssVar = (group: string, name: string) => `var(--sq-${kebab(group)}-${kebab(name)})`;

/** Category accent vars for a colorKey (unknown keys fall back to slate). */
export function categoryColorVars(key: string): { accent: string; soft: string } {
  const k = (['sky', 'grape', 'mint', 'coral', 'sun', 'rose', 'teal', 'slate'] as CategoryColorKey[]).includes(key as CategoryColorKey)
    ? key
    : 'slate';
  return { accent: `var(--sq-color-cat-${k})`, soft: `var(--sq-color-cat-${k}-soft)` };
}
