---
status: planned
brief: ../briefs/2026-10-23-dashboard-load.md
owner: the dashboard-perf session, worktree dashboard-perf (branch dashboard-perf from origin/v2.2 at 80946cf)
created: 2026-10-23
---

# Dashboard load: smaller bundle, mount at once, shorter sign-in

<!-- doc-scope:start -->
Scope: Milestones, verification, ownership, dependencies and rollback for the dashboard load work
of 2026-10-23; intent, evidence and acceptance live in the brief.
<!-- doc-scope:end -->

## Classification and dependencies

Substantial development: it changes the router guard, the authentication initialisation, the i18n
loading and the deploy pipeline's headers and deletion policy. The brief needs a fresh APPROVED
review, then this plan, before any source edit. Commit, merge into `v2.2`, tags and deployment are
authorised separately by Angelo; the merge goes through the session that holds the `v2.2` line.

No backend dependency: StarChat and mrcall-agent contracts are unchanged. Every other session that
edits `src/router/index.js`, `src/main.js`, `src/i18n/` or `.github/workflows/deploy.yml` on `v2.2`
is a merge dependency; the integration milestone rebases on the line's head.

Gates run in this worktree: Node 26.5 locally (the workflow builds on Node 18), Playwright with
`E2E_PORT` on a free port (8080 belongs to another session), the dev server started separately when
the 120 s webServer timeout is not enough under load.

## Milestones

Each milestone is one or a few commits, verified on its own, and can be left out if it fails review or
Playwright. The stated dependencies are the only ones.

### M0: baseline and the measuring tool

- Commit the load measurement as `scripts/measure-load.mjs` (Node, Playwright): cold and warm runs,
  optional CDP throttling, and per run, as separate figures: the first child of `#app` (the splash
  once M6 lands), the rendered app (the sign-in form's input visible on `/signin`), the locale
  chunk's request-to-response time (once M3 lands), the first business row on Businesses and the first
  analytics figure on Analytics, transferred bytes and requests, and the list of
  `securetoken`/`accounts:lookup` calls. Credentials come from the environment at run time and are
  never written; the selectors for "first data" are chosen here and recorded in the script. The
  brief's `/signin` figures came from a scratch version of the same measurement; M0 reruns them with
  the committed script so before and after use one instrument.
- Run it on dashboard-test (`v2.2.30-test`): `/signin` already measured in the brief; Businesses and
  Analytics with a real session, 5 cold and 5 warm runs each, unthrottled and at 10 Mbps.
- Vitest and the whole Playwright suite on `80946cf` in this worktree, with the failure set and its
  reruns recorded: the regression baseline.
- Verification: the figures in the table at the end of this plan, with the commit and the date.

### M1: vendors in few files (`vue.config.js`)

- Remove the `configureWebpack.optimization.splitChunks` override (`maxSize: 64000`), leaving Vue CLI's
  default `chunk-vendors`/`chunk-common` groups.
- The built `index.html` at `80946cf` carries no `prefetch` or `preload` link for the 20 async
  chunks (counted), so making locales and routes async does not make an idle page download them.
  This milestone and every later one re-count it, because a prefetch of 12 locales and every page
  would undo the saving.
- Verification: production build; initial file count and bytes recorded; vitest; Playwright desktop.

### M2: every route on demand, and recovery from a missing chunk

- Every `component:` in `src/router/index.js` becomes `() => import(...)`, with a webpack chunk name
  per route group (sign, onboarding, business, admin, reseller, analytics).
- `router.onError`: a chunk load failure (`ChunkLoadError`, or a failed dynamic import) performs one
  full navigation to the target URL, guarded by a sessionStorage marker so it cannot loop; any other
  error is rethrown unchanged.
- Verification: `node scripts/static-routes.js` output identical to `80946cf`;
  `tests/unit/publicRoutes.spec.js`; a new Playwright test that aborts one route chunk once and lands
  on the target; a test written first and seen failing on `80946cf` for the chunk case; production
  build: the route components absent from the initial files.
- Depends on M5's asset retention being deployed with or before it (brief, finding 2): in any test or
  production deploy M2 never ships without M5's retention part.

### M3: locales on demand

- `src/i18n/index.js` starts with no messages and exports one loader, `loadLocaleMessages(locale)`,
  that imports `./locales/<locale>.json` dynamically (one async chunk per locale), registers it under
  the full tag and its short alias, and caches the promise. `loadLanguageAsync` becomes that loader
  plus setting `i18n.global.locale.value`; the dead `changeLanguage` in `App.vue` is removed.
- `translation.js`: `switchLanguage` awaits the loader before setting the locale; `getLocale` resolves
  the locale without setting it (it is called inside computed properties); the setter goes through the
  loader.
- `main.js` resolves the active locale (localStorage, then navigator, then the default, the same order
  as today) and awaits it and the fallback, in parallel, before `app.mount`. The splash (M6) covers
  that wait. The cost is real: this request can start only once the main bundle has run, so it is
  serial with it. The locale JSON files gzip to 37 142 B (en-US), 39 601 B (it-IT) and 48 739 B
  (el-GR, the largest), measured at `80946cf`. At 10 Mbps and 40 ms latency that is one round trip
  plus 30 to 40 ms of transfer, about 100 ms, estimated and not measured. The import therefore starts
  when the i18n module is evaluated, ahead of the rest of `main.js`'s set-up, so the two overlap. The M0 tool reports its request-to-response time on every run, and the gated
  rendered-app figure includes it.
- Unit tests that use i18n get the messages they assert on from `tests/unit/setup.js`, loaded
  synchronously there, so no spec depends on the async path by accident; one spec covers the loader
  (unknown locale, alias, cached promise, failure).
- Verification: production build shows 12 locale chunks and no locale in the initial files; vitest;
  Playwright language-switch specs and the Signin `?lang=` path; a Playwright check that the first
  render of `/signin` in `it-IT` contains no English string from `en-US.json` (no flash).

### M4: the webcall client and the JSON editor on demand

- `WebcallButton.vue`: `MrCallWebCall` imported with `import()` inside `buildClientIfNeeded`, which
  becomes async; `handleClick`/`startCall` await it, with the button's `processing` state covering the
  load and a load failure shown as the existing start error.
- `main.js`: `app.use(JsonEditorVue)` replaced by a global async component of the same name
  (`defineAsyncComponent(() => import('json-editor-vue'))`), so `TupleVariable.vue` and
  `BusinessConfiguration.vue` keep using `<JsonEditorVue>` unchanged; `JsonField.vue` uses the same
  async component instead of its static import.
- Verification: production build: neither library in the initial files; `tests/e2e/webcall/`;
  Playwright specs that open a JSON variable and a JSON skill field; vitest for the skill fields.

### M5: deploy with compression, immutable cache and asset retention

- `deploy.yml`, after the build, in this order (a page must never name an asset not yet uploaded):
  1. hashed assets (`js/`, `css/`, `fonts/`, `img/`, whose names carry a content hash), each with
     its content type and `--cache-control "public, max-age=31536000, immutable"`:
     - with a `.gz` sibling: the sibling's bytes under the original key, `--content-encoding gzip`;
     - without one (the compression plugin skips a file that does not shrink to 80% or less, and
       today that is the four fonts and two PNG images): the raw file, no `Content-Encoding`;
     - the `.gz` and `.br` siblings are no longer uploaded as keys of their own;
  2. everything else synced as today, with `--delete` excluding the hashed-asset prefixes;
  3. `index.html` and its route copies last, unchanged: raw, `no-cache`;
  4. a prune step deleting, under the hashed-asset prefixes, objects that are not in this build's
     `dist/` and were last modified more than a retention period ago (proposed 14 days). Never
     "not referenced by `index.html`": the lazy chunks are named only by the runtime, so that rule
     would delete the current release's pages.
- The design choice (gzip, not brotli, because the edge neither negotiates nor varies) is written in
  the workflow's comments with the `curl -I` evidence of the brief.
- Verification: the workflow cannot run locally against a bucket. Before the test tag: the upload
  commands dry-run (`--dryrun`) against a local `dist/` printed in review. After the test deploy
  (authorisation needed): brief acceptance 2 with `curl -I`; a load in Chromium with no decoding
  error; a previous-release asset still 200. If the edge drops or alters `Content-Encoding`, this
  milestone ships with the cache headers and retention only.

### M6: mount at once

- `public/index.html`: a splash inside `#app` (logo or spinner, inline CSS with the body background of
  `colors.less`, no text), replaced by Vue on mount.
- `main.js`: `app.mount('#app')` once the locale is loaded (M3), not after `router.isReady()`;
  `App.vue` shows a loading state (no Navbar, no `router-view`) until the first navigation resolves.
- `src/router/index.js`: `getUser()` replaced by `await auth.authStateReady()` and `auth.currentUser`;
  no listener per navigation.
- `src/firebase/config.js`: the `setPersistence` call removed; `initializeAuth`'s persistence list
  stays.
- Verification: the session-guard specs (deep link without session to `/signin` with redirect, public
  pages open); a new spec seeding a localStorage-persisted user, as `v2.2.30` leaves it, that lands
  signed in on a protected route; a unit or browser check that ten navigations register no further
  auth listener; the splash visible in the first paint of a throttled load (M0 tool).

### M7: the sign-in path

- `/` becomes `{ path: '/', redirect: '/signin', meta: { public: true } }`; `Home.vue` is removed with
  its import (the static-routes script excludes `/` already; checked against its output).
- Tests first, run on `80946cf` before any change of this milestone:
  - the e2e fixtures mint unsigned JWT-shaped ID tokens (header, claims with `email_verified`, `exp`,
    `sub`, empty signature) instead of `mock-id-token`, because `getIdTokenResult()` parses the
    token and would throw on the current string; the securetoken and `accounts:lookup` mocks take the
    claim and `emailVerified` from the test;
  - the StarChat mock answers 403 to a token whose claim is false, as StarChat does;
  - the confirm-email return: `/login?confirm_email=true` with a persisted user whose cached token
    says `email_verified: false` and whose `accounts:lookup` says `emailVerified: true` lands on the
    first page. Expected to pass on `80946cf` (correct today, only slow) and to keep passing; it is
    also run once against the change with the refresh removed, and seen failing, so it is known to
    guard the refresh;
  - the converse: a token that already carries the claim reaches the first page with no
    `securetoken` call.
- `src/firebase/authUtils.js`: one function, run once when authentication is ready (the same
  readiness M6 gives the guard), that reads `getIdTokenResult()` locally and forces
  `getIdToken(true)` only when the token's `email_verified` differs from `user.emailVerified`. If the
  token cannot be parsed it forces the refresh, which is today's behaviour. The guard and `Signin.vue`
  await it, so a deep link after verification is covered as well as `/signin`.
- `Signin.vue`: with a session, no `user.reload()` (Firebase reloaded it at initialisation); the
  listener replaced by the readiness above; `getIdToken()` without forcing; a loading state instead
  of the form while a session is being resolved; the redirect to `redirect` or to
  `redirectAfterAuth()` unchanged in its outcomes.
- `Business.checkUserHasBusinesses`: `getIdToken()` without forcing (Firebase refreshes a token that
  is expired or within five minutes of expiry by itself). This also changes Analytics and
  AnalyticsAdmin, which call it on mount: their specs are part of this milestone's verification.
- Depends on M6 (the readiness promise).
- Verification: the tests above; the sign-in specs (password, magic link, confirm email, redirect
  with query, no businesses to onboarding); the Analytics and AnalyticsAdmin specs; the M0 tool shows,
  from `/` with a verified session whose token carries the claim, no `accounts:lookup` beyond
  initialisation's, no `securetoken` call, and no visible sign-in form.

The forced refreshes outside the sign-in path are not in this plan: the lead put them out of this
release (brief, Follow-ups).

### M8: integration and test release

- Rebase on the head of `v2.2`; the brief's acceptance 1 and 5 on the integrated head; an
  integration review; then, with authorisation, a test tag and deploy, and acceptance 2 to 4 on
  dashboard-test with the M0 tool.
- Documentation: `docs/development.md` (deploy: headers, compression, retention, rollback),
  `docs/ARCHITECTURE.md` (router lazy loading and chunk recovery, i18n loading, auth readiness),
  `docs/active-context.md`; then `doc-end`.

## Rollback

Per milestone: revert its commits; M2 and M5's retention revert together. Deployed: redeploy
`v2.2.30-test` (tag at `caaff42`) with authorisation, as the brief states. Objects left in the bucket
with `Content-Encoding: gzip` are replaced by that deploy's sync whenever their size differs, and the
ones it does not name are removed by its `--delete`.

## Status

| Milestone | Status | Evidence |
|---|---|---|
| M0 | build and `/signin` baseline measured (brief), session measures and suite baseline pending | brief, Evidence |
| M1 to M8 | not started | |

## Baseline figures (`80946cf`, 2026-10-23)

| Measure | Value |
|---|---|
| Initial JS (files, raw, gzip) | 102, 6 891 694 B, 1 806 913 B |
| All JS in `dist/js` (files, raw, gzip, brotli) | 122, 7 184 958 B, 1 908 028 B, 1 490 715 B |
| Initial CSS (files, raw, gzip) | 2, 625 169 B, 76 150 B |
| `/signin` cold, unthrottled, sign-in form visible | 698 to 1 109 ms, median 808 (5 runs); an earlier series measured to `#app` first child, 924 to 1 412 ms; about 8.2 MB, 119 to 120 requests |
| `/signin` cold, 10 Mbps, sign-in form visible | 6 544, 6 555, 6 587 ms (median 6 555); an earlier series to `#app` first child, 6 696, 6 780, 6 952 ms |
| Businesses, Analytics first data | M0 |
| vitest, Playwright | M0 |
