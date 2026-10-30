import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Public base path. Local default '/'. For the GitHub Pages project site
 * (https://<user>.github.io/skillquest/) build with SQ_BASE=/skillquest/ (see `npm run build:pages`).
 * Normalised to a leading and trailing slash. Used for asset URLs, the PWA manifest
 * scope/start_url and the service-worker scope.
 */
export function normaliseBase(raw: string | undefined): string {
  const t = (raw ?? '').trim();
  if (!t || t === '/' || t === '.' || t === './') return '/';
  return `/${t.replace(/^\/+|\/+$/g, '')}/`;
}
const BASE = normaliseBase(process.env.SQ_BASE);

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@design': r('./src/design'),
      '@app': r('./src/app'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'SkillQuest – משימות ודמי כיס',
        short_name: 'SkillQuest',
        description: 'דמי כיס שבועיים על השלמת משימות למידה',
        lang: 'he',
        dir: 'rtl',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF8EE',
        theme_color: '#5B4BDB',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
