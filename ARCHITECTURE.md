# SkillQuest – architecture

Hebrew, RTL, installable PWA. Parents set a weekly allowance, deposit it into a mock wallet, and the
child unlocks it by completing skill quests that the parent approves. No backend; all data is local.

```
src/
  core/      pure TypeScript domain – no React, no DOM, no browser APIs
    model/        types.ts (entities, AppState), errors.ts (DomainError codes)
    services/     week, money, levels, wallet, categories, budget, quests, weekReset, context
    drills/       real practice: seeded generators (math, english, wordbank), guided templates,
                  engine (generate/check/score), service (startDrill/finishDrill/submitGuided), migrate
    repository/   StateRepository interface + LocalStorageRepository / InMemoryRepository
    seed.ts       default categories, demo family, empty family
    store.ts      SkillQuestStore facade (getState/subscribe/commit → repository.save)
    __tests__/    Vitest unit tests (node environment)
  design/    tokens → CSS variables, ThemeProvider, primitives; knows nothing about the domain
  app/       screens, routing, hooks, Hebrew copy; the only layer that knows both
    adapters/storeInstance.ts   binds core store to window.localStorage + crypto.randomUUID
    hooks/                      useAppState (useSyncExternalStore), selectors, session (mode/child)
    i18n/he.ts                  all user-facing strings derived from domain values
    components/, screens/
  main.tsx   bootstraps tokens, providers, HashRouter, PWA update prompt
scripts/
  check-layers.mjs   import-boundary, no-hard-coded-colour, logical-CSS guard (runs in `npm run build`)
  screenshots.mjs    Playwright 390×844 captures + RTL/offline/a11y-ish checks
  drill-bot.mjs      test helper: re-generates the on-screen drill from data-seed/data-level and answers it
  make-icons.mjs     renders public/icons/icon.svg to the PWA PNG sizes
```

## Layers and rules

**Core** (`tsconfig.core.json` has `lib: ES2022` and no DOM types, so `window`/`document` do not even
type-check there). Every operation is a pure function `(state, input, ctx) → newState` or a selector
`(state, …) → value`. `ctx = { now(), newId() }` is injected so tests are deterministic. Invalid
operations throw `DomainError` with a code (e.g. `INSUFFICIENT_LOCKED_FUNDS`) that the app translates
to Hebrew. Persistence is behind `StateRepository { load, save, clear }`; the localStorage version
validates the schema and falls back to the seed on corrupt data. Swapping to IndexedDB, a file, or a
real backend means writing one class – screens do not change.

Key domain rules:

* **Money** is integer agorot; ₪ formatting happens in design/app.
* **Weeks**: `WeekId` = local date of the week's first day (Sunday default, configurable). Quest status
  is *derived per week* from completions, so quests reset weekly without mutating anything.
* **Wallet ledger**: append-only entries `deposit | unlock | return`.
  `locked = deposits − unlocks − returns`, `available (earned) = unlocks`. Approving a quest writes an
  `unlock` for its reward; core refuses if `reward > locked` (`canApprove` exposes the shortfall so
  the UI can disable the button and explain).
* **Budget**: weekly budget per child; `allocationFor` reports allocated rewards vs budget, earned,
  pending, locked, and a suggested deposit. Rewards are fixed per quest (proportional helper exists).
* **Levels**: per child × category, `{startLevel, xp}`. Curve `xpToNext(L) = round(baseXp·growth^(L−1))`
  (default 50 / 1.3 / max 20), stored in family settings. Approval adds the quest XP and stores
  `levelChange {from,to}` on the completion so Celebration can show it.
* **Categories**: 5 built-ins + custom; enable/disable is family-wide; children see enabled only; a
  disabled category's quests cannot be submitted.
* **Week rollover**: `startNewWeekIfNeeded` runs on load/visibility; policy `rollover` keeps locked money,
  `return` writes `return` entries for the leftover.

**Design** – see `src/design/README.md`. Tokens → CSS variables, three runtime themes via
`data-theme`, logical properties only, primitives that consume tokens only.

**App** – routing (HashRouter, so it works from any static host / `file`-like sub-path) and screens.
Screens read via selectors and call store actions; they contain no business rules.

## Why React + Vite (not Vue, not Next.js)

* **Next.js** is optimised for server rendering, server routes and a Node runtime. This product
  explicitly has no backend and must work offline as an installed PWA; a static SPA is the right shape
  and Next's SSR/RSC model would be dead weight (static export loses most of its value and complicates
  service-worker routing).
* **Vite** gives a fast dev server, a plain static `dist/` that any host can serve, and
  `vite-plugin-pwa` (Workbox) for manifest + offline precache with almost no config. Vitest shares the
  same config/toolchain for core tests.
* **React vs Vue** is closer. React was chosen for the larger ecosystem/hiring pool, first-class
  TypeScript JSX for typed primitives, `useSyncExternalStore` which binds cleanly to a framework-agnostic
  core store, and an easier path to React Native if a native app is wanted later (core and tokens port
  as-is). Because core is pure TS, moving to Vue later would only rewrite `design` primitives and `app`.

## Drills (real practice)

* A quest may carry `drill`: `{kind:'quiz', topic, length, passScore, autoApprove, table?}` or
  `{kind:'guided', templateId}`; quests without one keep the old "סיימתי" → parent-approval flow.
* Quiz topics: times tables, mental math, fractions, geometry (SVG figures), Hebrew word problems
  (varied names/genders), English vocab Heb↔Eng with emoji, sentences, fill-in-the-blank, match, mix.
  Question types: multiple choice, numeric (NumPad), blank, match. Difficulty = the child's level in
  the category, clamped 1–5 (ages 8–14).
* Determinism: `seed = child|quest|week|attempt` → `createRng` → `generateDrill`. `finishDrill`
  regenerates the questions from the stored seed and scores the raw responses, so the UI is never
  trusted for correctness. Every attempt is stored (`drillAttempts`), best score shown per week.
* Reward/XP only on a pass, once per quest per week; later passes are "practice". With
  `autoApprove` (default for quizzes) a pass moves money locked→available immediately, capped by the
  child's locked deposit (the shortfall is reported), then the Celebration screen opens. Otherwise a
  `submitted` completion with the score goes to the parent dashboard.
* Guided activities (sport, music, soft skills, any custom category): steps with optional timers,
  a short reflection, and a "what the parent checks" line; the parent approves.
* English text is rendered in `<bdi lang="en" dir="ltr">`; math expressions in LTR `<bdi>`; an
  optional speechSynthesis listen button appears when the browser supports it.

## Testing

* `npm test` – Vitest unit tests for core (levels, wallet/approval funds rule, budget, categories,
  week reset, store + repository round-trip, drill generators/answers, scoring, awarding, auto vs
  manual approval, locked-deposit cap, guided flow, migration).
* `npm run build` – layer check + `tsc -b` (core/app/node projects) + Vite/PWA build.
* `npm run screenshots` – requires `vite preview` on :4319; saves `screenshots/*.png` and asserts
  RTL direction, right-anchored layout, insufficient-funds UX, level-up, reduced-motion, theme switch,
  custom category visibility, service-worker offline load, drills played end-to-end (fail → retry →
  pass → celebration, English vocab, geometry figure, guided activity), and no console errors.

## Known gaps (MVP)

* Parent PIN (`core/services/pin.ts`, pure-TS SHA-256 in `core/services/sha256.ts`): 4 digits, random
  salt, 1000 iterations, constant-time compare; failed-attempt counter and `lockedUntil` persist in
  state (5 wrong → 30 s). It is a **simple lock**, **not security**: everything is in local browser
  storage that anyone with the device can read or clear. Session policy (`app/hooks/session.tsx`):
  start in child mode, auto-lock after 5 min idle (`PIN_POLICY.autoLockIdleMs`) or on background.
* Onboarding (`core/services/onboarding.ts`): `createFreshState` sets `family.onboarded = false`; the
  app routes everything to `/onboarding` until `completeOnboarding` atomically creates children,
  budgets, first deposits and the PIN. Children are managed later in `core/services/children.ts` (add / rename / avatar / remove with confirmation, which deletes their ledger, budget, progress and completions) and the `/parent/children` screen.
* Single device: data lives in that browser's localStorage. No sync between parent's and child's phones.
* No real money – the wallet is a ledger, not a payment integration. Parent mode shows a permanent
  note: "כסף דמיוני – ללא תשלומים אמיתיים". No card, bank, or payment data is collected or stored.
* Demo data is fictional (משפחת דמו, children כוכבית and דובון); no real people or personal data.
