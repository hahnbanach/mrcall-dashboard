# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MrCall Dashboard — Vue 3 SPA for managing AI voice call assistants, business configuration, and subscriptions.

## Commands

```bash
npm run serve                # Dev server (Vite, port 8080)
npm run build                # Production build (Webpack 5)
npm run lint                 # Lint and fix
npm run test:e2e             # Playwright E2E tests (all 3 viewports)
npm run test:e2e:ui          # Playwright with interactive UI
npx playwright test tests/e2e/auth/businesses.spec.js  # Run single test file
npx playwright test --grep "test name"                  # Run test by name
npx playwright test --project=desktop                   # Run single viewport (desktop|tablet|mobile)
npm run test:e2e:update-snapshots  # Update visual regression snapshots
npm run i18n:report          # i18n translation coverage report
```

## Architecture

### System Overview
Vue 3 SPA → two backend APIs (StarChat for business logic, Zylch for AI features) + Firebase Auth.

### Key Entry Points
- `src/main.js` — App bootstrap, PrimeVue global component registration, plugin setup
- `src/router/index.js` — 76+ routes with auth guards and role-based access (`requiresAuth`, `requiresRole`)
- `src/store/index.js` — Vuex root store (auth, business, onboarding) + modules (`calendar`, `tracking`)
- `src/firebase/axiosConfig.js` — Global Axios 401 interceptor with token refresh queue
- `src/firebase/authUtils.js` — Auth state listener, proactive token refresh (50-min interval)

### Two API Backends
- **StarChat** (`VUE_APP_STARCHAT_URL`): Business CRUD, contacts, conversations, Stripe proxy. Endpoint pattern: `/mrcall/v1/talkmeapp0/crm/*`
- **Zylch** (`VUE_APP_ZYLCH_URL`): AI chat, training, sessions. Endpoint pattern: `/api/chat/*`, `/api/mrcall/*`

### State Management
- Vuex with encrypted persistence (secure-ls) — only `auth` and `onboardingData` survive page reloads
- Feature modules: `store/modules/calendar.js`, `store/modules/tracking.js`

### Business Configuration System
Central to the app. `BusinessVariables.js` defines variable schemas (visibility rules, dependencies, types). `Business.js` handles CRUD and defaults. `BusinessConfiguration.vue` renders the dynamic form based on variable types (string, text, number, boolean, json, enum, multiselect, tuples, verbatim, templated).

### Auth Flow
Firebase Auth (email/password, Google OAuth, magic links, custom tokens) → JWT in `Authorization: Bearer` header → Axios interceptor auto-refreshes on 401 and queues concurrent requests.

### Roles
Three roles: `owner`, `reseller`, `admin`. Routes use `meta.requiresRole` for access control.

## Tech Stack Specifics

- **Vue 3** with mixed Options API (predominant) and Composition API
- **PrimeVue 4** (Aura theme) — components registered globally in `main.js`
- **PrimeFlex** for utility CSS layout
- **Less** for component styles
- **Vuelidate** for form validation
- **vue-i18n** — 12 locales in `src/i18n/locales/`, use `$t('key')` in templates

## Development Rules

- New PrimeVue components must be imported and registered globally in `main.js`
- All user-facing strings must exist in all 12 locale files under `src/i18n/locales/`
- All authenticated API calls must use the Axios instance (not raw fetch) to get the 401 interceptor
- Business variable defaults must preserve existing values unless mandatory and empty
- Environment-specific values in `.env.*` files only

## Dependency Rules

- `utils/` → may import `firebase/`, `store/` — must NOT import `components/` or `views/`
- `store/` → may import `firebase/` — must NOT import `components/`, `views/`, or `utils/`
- `firebase/` → standalone, no app imports

## E2E Tests

Playwright tests in `tests/e2e/` organized by domain: `auth/`, `public/`, `admin/`, `responsive/`, `visual/`. Page objects in `tests/e2e/pages/`, fixtures in `tests/e2e/fixtures/`. Tests run against `http://localhost:8080` across 3 viewports (desktop 1440px, tablet 768px, mobile 375px).

## Environment & Deployment

| Environment | Deploy tag | Domain |
|-------------|-----------|--------|
| Test | `v<version>-test` | `dashboard-test.mrcall.ai` |
| Beta | `v<version>-beta` | `dashboard-beta.mrcall.ai` |
| Production | `v<version>-production` | `dashboard.mrcall.ai` |

GitHub Actions → Scaleway Object Storage (S3-compatible, `fr-par`), driven by
`.github/workflows/deploy.yml` **in this repository**. A tag names both the release
and its destination, so the same commit can go to one environment and later to the
next without merging anything. A bare `v<version>` matches no trigger and deploys
nothing, by design. Each environment holds its own Scaleway keys and its own
`ENV_FILE`, so a test tag can never reach production's credentials.

### Naming

Branches are numbered and nothing else: `v2.0` is the branch, and the same scheme
holds in the sibling repos (StarChat develops on `v9.23`). No descriptive or
prefixed branch names.

Tags come in two kinds, both starting from the same `v<major>.<minor>.<patch>`:

| Tag | Meaning |
|---|---|
| `v2.0.20` | marks the release. Matches no workflow trigger, so it deploys nothing |
| `v2.0.20-test` / `-beta` / `-production` | sends that exact commit to that environment |

The same commit carries the release tag and one tag per environment it reaches, so
promoting from test to beta to production is three tags on one commit and never a
merge.

There are no `test-env` / `beta-env` / `production-env` branches; an earlier
version of this table listed them and they do not exist.

All three environments build with `NODE_ENV=production`, set on the Build step of
`deploy.yml`. `--mode` selects only which `.env` file is loaded, so test and beta
produce the same minified, hashed, split, compressed output as production. Before
that they did not: Vue CLI derives `NODE_ENV` from the mode name and recognises
only `production` and `test`, so `--mode beta` resolved to `development`, and test
and beta each served one unminified multi-megabyte bundle.

**This repository is public.** Nothing committed here may contain a credential,
or enough detail about an unrotated one to help locate it.

## Documentation Index

| Document | Summary |
|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system map, modules, data flow, infrastructure |
| [docs/system-rules.md](docs/system-rules.md) | Tech stack versions, coding standards, naming conventions |
| [docs/active-context.md](docs/active-context.md) | Current state, recent work, known issues |
| [docs/quality-grades.md](docs/quality-grades.md) | Per-module test coverage and quality grades |
| [docs/integration/zylch-integration.md](docs/integration/zylch-integration.md) | Zylch AI integration details |
| [docs/integration/google-oauth.md](docs/integration/google-oauth.md) | Google OAuth client, scope inventory, token storage, verification status |

## MrCall AI credits tile (since 2026-05)

Per-business info-grid in `src/components/Businesses.vue` shows the new line:

```
⚡ Crediti residui ⓘ NNN
```

- Replaces the previous "Crediti chiamate: NN minuti" view of the same
  underlying balance. Both before and after, the source is the StarChat
  `CALLCREDIT` resource counter — no schema change. Only the presentation
  changed: raw credit count instead of derived minutes.
- `NNN` is the raw `counterResources[businessId]['CALLCREDIT']` (formatted
  with `toLocaleString()`), populated by the same fetch that drives the
  existing `CALLCREDIT` minutes / `SMS` pills (`fetchBusinessResources`).
  No new endpoint, no proxy middleman: the dashboard reads StarChat
  directly via `VUE_APP_STARCHAT_URL`. It does **not** call
  `/api/desktop/llm/balance` on mrcall-agent (that endpoint exists for
  the desktop sidecar only — see `docs/integration/zylch-integration.md`).
- Hover tooltip on ⓘ uses `v-tooltip.bottom` with i18n keys
  `mrcallCredits.title` and `mrcallCredits.tooltip`. The `{factor}`
  interpolation comes from the new `creditTooltipFactor(business)` helper,
  which parses `business.variables.CALLCREDIT_FACTOR` (a JSON string keyed
  by template, default 25 if absent).
- All 12 locales carry `mrcallCredits.{title,tooltip}`. IT and EN are
  translated; the other 10 carry EN as placeholder.
- "MrCall credits" is **one bag**: the same `CALLCREDIT` pool funds phone
  calls, the configurator chat, and MrCall Desktop. Topup uses the
  existing Stripe products `call50_euros` / `call300_euros` /
  `call600_euros` (resourceCategory `CALLCREDIT`); the topup destination
  is the existing `Plan.vue` route at `/plan` — no new route.

## Sibling repos

This dashboard is one of four projects under `~/hb/`:

- **`~/hb/`** — meta-repo, cross-project docs (`~/hb/docs/`).
- **`mrcall-agent/`** (submodule) — FastAPI configurator (Python, Anthropic).
  AI chat / training / apply-changes backend that this dashboard calls via
  `Zylch.js` to `VUE_APP_ZYLCH_URL`.
- **`starchat/`** — Scala/Akka HTTP core: telephony, CRM, payments, native
  agent framework. Source of truth for business config; this dashboard
  reads/writes via `Business.js` to `VUE_APP_STARCHAT_URL`.
- **`mrcall-website/`** — Next.js public site (mrcall.ai). Shares Firebase
  project `talkmeapp-e696c` with the dashboard.

Cross-repo changes (e.g. an API contract change in mrcall-agent or a
StarChat variable schema change): check the matching repo before merging.

## Memory discipline

Claude Code's per-user memory at `~/.claude/projects/<encoded-path>/memory/`
is not in git, not shared, not portable. The team-visible source of truth
is this `CLAUDE.md` and the docs it links to (and `~/hb/docs/` for cross-
repo facts).

- Project knowledge (architecture, conventions, rules, infra) → docs in
  this repo, or `~/hb/docs/` if cross-cutting. Propose; don't silently
  auto-save to CC memory as `project`/`reference`.
- Personal/working-style notes → CC memory is the right place.
- Before quoting CC memory, verify against current docs/code — memory
  goes stale, repos don't.
