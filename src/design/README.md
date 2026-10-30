# SkillQuest design system (`src/design`)

Presentational layer only: tokens, theming, and primitives. It never imports `src/core` or `src/app`
(enforced by `scripts/check-layers.mjs`, which runs before every build).

## Token naming

Tokens live in `tokens/tokens.ts` (the only file allowed to contain literal colours) and are emitted as
CSS custom properties by `tokens/css.ts`:

```
--sq-<group>-<name>        camelCase keys → kebab-case
```

| Group | Example | Source |
|---|---|---|
| `font` | `--sq-font-family` | base |
| `font-size` | `--sq-font-size-xs … xxl, display` | base |
| `font-weight` / `line-height` | `--sq-font-weight-bold`, `--sq-line-height-tight` | base |
| `space` | `--sq-space-0 … 12` (4px grid, rem) | base |
| `radius` | `--sq-radius-sm/md/lg/pill` | base |
| `size` | `--sq-size-tap-target`, `--sq-size-progress-height` | base |
| `motion` | `--sq-motion-duration-fast`, `--sq-motion-ease-bounce` | base |
| `z` | `--sq-z-header`, `--sq-z-overlay` | base |
| `color` | `--sq-color-primary`, `--sq-color-on-primary`, `--sq-color-surface`, `--sq-color-text-muted`, `--sq-color-success/-soft`, `--sq-color-earned/-soft`, `--sq-color-locked/-soft`, `--sq-color-track` … | theme |
| `color-cat` | `--sq-color-cat-<key>` + `--sq-color-cat-<key>-soft` for `sky grape mint coral sun rose teal slate` | theme |
| `shadow` | `--sq-shadow-sm/md/lg` | theme |

Contextual (component-scoped) variables: a `Card` with `accent="<key>"` sets `--sq-accent` and
`--sq-accent-soft` so children (level badges, progress bars, tiles) pick up the category colour without
knowing which category they are in. Core stores only the colour *key* on `SkillCategory.colorKey`.

Semantic names are role-based (`primary`, `on-primary`, `earned`, `locked`), never hue-based, so themes
can remap them freely.

## Themes

`themes` in `tokens.ts` has three themes (`default` "צבעוני", `calm` "רגוע", `dark` "כהה"), all typed by
`ThemeTokens` so a missing key is a compile error. `injectTokens()` writes one `<style id="sq-tokens">`
with `:root` (base + default theme) and one `[data-theme="<name>"]` block per theme. `ThemeProvider`
sets `data-theme` on `<html>`, persists the choice in `localStorage['skillquest.theme']`, and updates
`<meta name="theme-color">`. Adding a theme = add an object to `themes` + a label in `themeLabels`.

## RTL rules

* Logical properties only (`margin-inline-start`, `padding-block`, `inset-inline-end`, `inline-size`,
  `text-align: start`). Physical `left/right` are rejected by the layer check.
* Direction-bearing icons (`back`, chevrons) are mirrored with `[dir="rtl"]` / `scaleX(-1)` in `Icon`.
* Progress fills grow from inline-start (the right edge in Hebrew).

## Primitives

`Button`, `Card`, `ProgressBar`, `Badge`, `Amount` (+ `formatShekels`, agorot → `₪` via `Intl` he-IL),
`ScreenHeader`, `Icon`, `Switch`, `TextField`/`TextArea`, `Stepper`. All styling is in
`styles/components.css` and uses `var(--sq-*)` only. `styles/base.css` holds resets, focus ring, and the
global `prefers-reduced-motion` rule.
