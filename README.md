# SkillQuest – משימות ודמי כיס

Hebrew RTL PWA: parents fund a weekly allowance, children unlock it by completing skill quests.
See `ARCHITECTURE.md` for the design; `src/design/README.md` for tokens.

## Run locally

```bash
npm install
npm run dev                 # http://localhost:5173  (hot reload)
npm test                    # core unit tests
npm run build               # layer check + type-check + production build into dist/
npm run preview             # serve dist/ (the PWA/offline mode only works on the built version)
```

## Share with a tester on the same Wi-Fi

```bash
npm run build && npm run preview -- --host --port 4173
```
Then open `http://<your-computer-LAN-IP>:4173` on the phone. Note: browsers only install PWAs / run
service workers on `https://` or `localhost`, so over a LAN IP the app works but "Add to home screen"
as a full PWA may not. For installable testing, put `dist/` on any static HTTPS host (it is fully
static and uses hash routing; for a sub-path set `SQ_BASE`, see Publishing) or use an HTTPS tunnel.

## Tester: demo data / start fresh

* The app starts with a demo family (fictional demo kids כוכבית & דובון, pending approvals, one child with too little deposited).
* **Reset demo**: Parent mode → הגדרות → "איפוס לנתוני הדגמה", or open `#/reset`.
* **Start clean**: Parent mode → הגדרות → "התחלה נקייה", or open `#/reset-empty`. This opens the
  onboarding wizard: family name → children → weekly budget → first (pretend) deposit → parent PIN.
  "רק רוצים להציץ?" on the first step loads the demo family instead.
* **Manage children**: Parent mode → "ניהול ילדים": add (name, emoji, weekly budget), rename, change emoji,
  remove. Removing asks for confirmation and deletes that child's wallet, levels and quest history.
* **Parent PIN** (demo family has none): the first tap on "מצב הורה" asks you to choose a 4-digit PIN
  (entered twice). 5 wrong tries → 30 s lockout. "שכחתי את הקוד" resets **only the PIN** after typing
  "איפוס" to confirm. Parent mode auto-locks back to child mode after 5 min idle or when the app goes
  to the background, and the app always starts in child mode.
* Full wipe: clear site data in the browser (keys `skillquest.state.v1`, `skillquest.session`, `skillquest.theme`).

## Screenshots

```bash
npm run build && (npx vite preview --host 127.0.0.1 --port 4319 --strictPort &) && npm run screenshots
```
Outputs `screenshots/*.png` (390×844 @2x) and prints PASS/FAIL checks.

## Safety notes for testers

* **Pretend money only** – "כסף דמיוני – ללא תשלומים אמיתיים". No payments, cards or bank details anywhere.
* The parent PIN is a **simple lock** ("נעילה פשוטה – לא אמצעי אבטחה") that keeps kids out of parent
  screens on a shared device. It is **not security**: data is stored unencrypted in this browser's
  localStorage (the PIN itself only as a salted, iterated SHA-256 hash).
* All demo people are fictional (משפחת דמו: כוכבית, דובון).

## Publishing / building (GitHub Pages)

Target: a GitHub Pages project site at `https://<user>.github.io/skillquest/` (deployed by the workflow below).

* The public base path comes from the env var **`SQ_BASE`** (default `/` for local work). It sets the asset
  URLs, the PWA manifest `id` / `start_url` / `scope` and the service-worker scope.
  `npm run build:pages` = `SQ_BASE=/skillquest/ npm run build`.
* `.github/workflows/pages.yml` runs tests, builds with `SQ_BASE=/skillquest/` and uploads
  **only `dist/`** to GitHub Pages (repo Settings → Pages → Source: GitHub Actions). `public/.nojekyll` is included.
* Verify a sub-path build locally (the preview needs the same `SQ_BASE`):
  ```bash
  SQ_BASE=/skillquest/ npm run build
  SQ_BASE=/skillquest/ npx vite preview --host 127.0.0.1 --port 4319 --strictPort &
  SQ_URL=http://127.0.0.1:4319/skillquest/ SQ_SHOTS=/tmp/sq-pages-shots npm run screenshots
  ```
  Rebuild without `SQ_BASE` afterwards for local use.
* **Exclude `design/`**: that folder holds a separate design prototype owned by another contributor. It is
  not part of the app, not imported by `src/`, not in any `tsconfig`, not a Vite entry, and it is listed in
  `.gitignore`. Do not deploy or commit it as part of SkillQuest without its owner's approval.
* Never publish: `node_modules/`, any `.env*` file (none are used). `screenshots/` is optional.
* Before any publish: `npm run build && npm test`, the screenshot checks, and a secrets/PII scan.
