import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { themeNames, themes, type ThemeName } from '../tokens/tokens';
import { tokensToCss } from '../tokens/css';

const STYLE_ID = 'sq-tokens';
const THEME_KEY = 'skillquest.theme';

/** Injects the token stylesheet once. Safe to call before React renders (avoids a flash). */
export function injectTokens(doc: Document = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = tokensToCss();
  doc.head.prepend(el);
}

export function readStoredTheme(): ThemeName {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t && (themeNames as string[]).includes(t)) return t as ThemeName;
  } catch {
    /* storage unavailable */
  }
  return 'default';
}

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

/**
 * Applies a theme by setting data-theme on <html>. `storageKey` lets a future per-user
 * profile keep its own theme (e.g. `skillquest.theme.child-star`).
 */
export function ThemeProvider({ children, initial, storageKey = THEME_KEY }: { children: ReactNode; initial?: ThemeName; storageKey?: string }) {
  const [theme, setTheme] = useState<ThemeName>(initial ?? readStoredTheme());

  useLayoutEffect(() => {
    injectTokens();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      /* ignore */
    }
    // Keep the browser chrome colour in sync with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', themes[theme].color.primary);
  }, [theme, storageKey]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
