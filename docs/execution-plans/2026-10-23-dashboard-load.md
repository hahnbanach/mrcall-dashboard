---
status: planned
brief: ../briefs/2026-10-23-dashboard-load.md
owner: the dashboard-perf session, worktree dashboard-perf (branch dashboard-perf from origin/v2.2 at 80946cf)
target: the next dashboard release after v2.2.31 (not v2.2.31)
created: 2026-10-23
---

# Dashboard load: smaller bundle, mount at once, shorter sign-in

<!-- doc-scope:start -->
Scope: Milestones, verification, measurement protocol, release sequence, ownership, dependencies and
rollback for the dashboard load work of 2026-10-23; intent, evidence and acceptance live in the brief.
<!-- doc-scope:end -->

## Classification, target and dependencies

Substantial development: it changes the router guard, the authentication initialisation, the i18n
loading and the deploy pipeline's headers and deletion policy. Source edits start only after this
plan's fresh APPROVED review. Commit, merge into `v2.2`, tags and deployment are authorised
separately by Angelo; the merge goes through the session that holds the `v2.2` line.

Target: the first dashboard release after `v2.2.31`. Decided on 2026-10-23: this work does not ship
in the `v2.2.31` release, because the deploy change (gzip objects cached as immutable by the edge)
could not be rehearsed before it. There are no bucket credentials on this machine, passthrough of
`Content-Encoding` by Edge Services is unproven, and a wrong header would stay cached for a year.

No backend dependency: StarChat and mrcall-agent contracts are unchanged. Any other session editing
`src/router/index.js`, `src/main.js`, `src/i18n/`, `tests/e2e/fixtures/auth.js` or
`.github/workflows/deploy.yml` on `v2.2` is a merge dependency; M9 rebases on the line's head
(`v2.2.31` or later).

Gates run in this worktree: Node 26.5 locally (the workflow builds on Node 18), Playwright with
`E2E_PORT` on a free port (8080 belongs to another session), the dev server started separately when
the 120 s webServer timeout is not enough under load.

## Dependencies between milestones

- **M2, M3 and M4 each add async chunks** (pages, locales, the webcall client, the JSON editor). A tab
  opened before a deploy needs them after it. None of the three reaches any environment unless M5's
  retention (steps 2 and 5 below) is in the same deploy or an earlier one.
- M7 depends on M6 (the readiness promise).
- M5's immutable header depends on the passthrough probe of the release sequence (step 2).
- Otherwise each milestone can be left out if it fails review or Playwright.

## Measurement protocol (fixed before any measurement)

Every figure the brief's acceptance 3 and 4 gate on is produced this way and no other:

- **Instrument**: `scripts/measure-load.mjs` (M0) at the commit named in the report, Playwright
  Chromium (version recorded), on this laptop. The 1-minute load average is recorded before each
  series.
- **Pages and figures**: `/signin`, with the first child of `#app` and the rendered app (an email or
  password input visible). Businesses and Analytics with a real session, with the first business
  row and the first analytics figure, using the selectors fixed in M0. For each run: the locale
  chunk's request-to-response time (once M3 lands), bytes, requests, and the `securetoken` and
  `accounts:lookup` calls.
- **Profiles**: unthrottled, and CDP emulation at 10 Mbps down and up with 40 ms latency.
- **Runs**: cold runs (new context, cache disabled), 7 per page and profile; warm runs (same context,
  cache enabled, after one priming load), 5 per page and profile.
- **Order and window**:
  1. The baseline series runs on dashboard-test against the release it serves, immediately before
     the test deploy of this work.
  2. The candidate series runs immediately after that deploy's verification, within 60 minutes of
     the baseline.
  3. A second, local A/B corroborates the bundle effect on a quiet edge. Both `dist/` builds (the
     base commit and the candidate) are served from one local static server that sets the same
     headers the deploy sets. Runs alternate A, B, A, B.
- **Statistic**: the median per figure, page and profile, with minimum and maximum. Every run is
  reported. A run is discarded only for a recorded network error, and is then repeated and listed.
- **Gates**: the brief's thresholds are relative to the baseline series of step 1. The brief's
  `v2.2.30-test` figures are the first such baseline and are kept for reference.

## Milestones

Each milestone is one or a few commits, verified on its own.

### M0: baseline instrument and suite baseline

- Commit `scripts/measure-load.mjs` (Node, Playwright) implementing the protocol above.
  Credentials come from the environment at run time and are never written.
- Vitest and the whole Playwright suite on the base commit in this worktree, with the failure set and
  its reruns recorded. That is the regression baseline. For reference, the suite on `caaff42`
  (recorded in the call-insights plan, D12) was 1 183 passed, 7 failed and 5 skipped, and the 7
  passed when rerun serially.
- Verification: the instrument reproduces the brief's `/signin` figures within their spread on the
  release then on test; the suite baseline recorded below.

### M1: vendors in few files (`vue.config.js`)

- Remove the `configureWebpack.optimization.splitChunks` override (`maxSize: 64000`), leaving Vue
  CLI's default `chunk-vendors` and `chunk-common` groups.
- The built `index.html` at `80946cf` carries no `prefetch` or `preload` link (counted). This
  milestone and every later one re-count it, because a prefetch of 12 locales and every page would
  undo the saving.
- Verification: a production build, with the initial file count and bytes recorded; vitest;
  Playwright desktop.

### M2: every route on demand, and recovery from a missing chunk

- Every `component:` in `src/router/index.js` becomes `() => import(...)`, with one webpack chunk
  name per route group (sign, onboarding, business, admin, reseller, analytics).
- `router.onError`: a chunk load failure (`ChunkLoadError`, or a failed dynamic import) performs one
  full navigation to the target URL. A sessionStorage marker keeps it from looping. Any other error
  is rethrown unchanged.
- Verification:
  - `node scripts/static-routes.js` output identical to `80946cf`; `tests/unit/publicRoutes.spec.js`;
  - a new Playwright test, written first and seen failing on `80946cf`, that aborts one route chunk
    once and lands on the target;
  - a production build with no route component in the initial files.
- Retention dependency above.

### M3: locales on demand

- `src/i18n/index.js` starts with no messages and exports one loader, `loadLocaleMessages(locale)`.
  It imports `./locales/<locale>.json` dynamically (one async chunk per locale), registers it under
  the full tag and its short alias, and caches the promise. `loadLanguageAsync` becomes that loader
  plus setting `i18n.global.locale.value`. The dead `changeLanguage` in `App.vue` is removed.
- `translation.js`:
  - `switchLanguage` awaits the loader before setting the locale;
  - `getLocale` resolves the locale without setting it (it is called inside computed properties);
  - the setter goes through the loader.
- `main.js` resolves the active locale (localStorage, then navigator, then the default, the order used
  today). It awaits that locale and the fallback, in parallel, before `app.mount`, and the splash
  (M6) covers the wait. The wait has a cost:
  - the request can start only once the main bundle has run, so it is serial with it;
  - the locale JSON files gzip to 37 142 B (en-US), 39 601 B (it-IT) and 48 739 B (el-GR, the
    largest), measured at `80946cf`;
  - at 10 Mbps and 40 ms latency that is one round trip plus 30 to 40 ms of transfer, about 100 ms
    (estimated, not measured);
  - the import therefore starts when the i18n module is evaluated, ahead of the rest of `main.js`'s
    set-up, so the two overlap;
  - the instrument reports the request's time on every run, and the gated rendered-app figure
    includes it.
- `tests/unit/setup.js` loads synchronously the messages that unit tests assert on, so no spec
  depends on the async path by accident. One new spec covers the loader: unknown locale, alias,
  cached promise, failure.
- Verification:
  - a production build with 12 locale chunks and no locale in the initial files;
  - vitest;
  - the Playwright language-switch specs and the Signin `?lang=` path;
  - a new Playwright check that the first render of `/signin` in `it-IT` contains no English string
    from `en-US.json` (no flash).
- Retention dependency above.

### M4: the webcall client and the JSON editor on demand

- `WebcallButton.vue`: `MrCallWebCall` is imported with `import()` inside `buildClientIfNeeded`,
  which becomes async. `handleClick` and `startCall` await it; the button's `processing` state covers
  the load, and a load failure is shown as the existing start error.
- `main.js`: `app.use(JsonEditorVue)` is replaced by a global async component of the same name
  (`defineAsyncComponent(() => import('json-editor-vue'))`). `TupleVariable.vue` and
  `BusinessConfiguration.vue` keep using `<JsonEditorVue>` unchanged; `JsonField.vue` uses the same
  async component instead of its static import.
- Verification:
  - a production build with neither library in the initial files;
  - `tests/e2e/webcall/`;
  - the Playwright specs that open a JSON variable and a JSON skill field;
  - vitest for the skill fields.
- Retention dependency above.

### M5: deploy with compression, cache headers and asset retention

The upload logic moves from inline workflow steps to `scripts/deploy-assets.sh` (bash). The
workflow calls it, and the rehearsal runs the same file. It takes the endpoint, the bucket and the
asset `Cache-Control` value as required arguments with no defaults, and prints the destination
before each step.

The cache value comes from a GitHub environment variable (`ASSET_CACHE_CONTROL`, a variable, not a
secret). It is the only switch between the probe and the immutable header. The design choice (gzip,
not brotli, because the edge neither negotiates nor varies) is written in the script's comments with
the brief's `curl -I` evidence.

**What the steps cover** (from the baseline `dist/`):

| Path | Content | Upload |
|---|---|---|
| `js/` | 122 `.js`, each with `.gz` and `.br`; 122 `.js.map` with no `.gz` | step 1 |
| `css/` | 8 files, each with `.gz` | step 1 |
| `fonts/` | 4 files, all without `.gz` | step 1 |
| `img/` | 23 SVG with `.gz`, 2 PNG without | step 1 |
| site root | `index.html` (+`.gz`, `.br`); `MrCallWebCall.bundle.js` (+`.gz`, `.br`); `_redirects`, `favicon.ico`, `robots.txt`, `sitemap.xml` | steps 2 and 4 |

All names under `js/`, `css/`, `fonts/` and `img/` carry a content hash.

**Steps, in this order.** A page must never name an asset that is not yet uploaded, and a deep link
must never lose its key during a deploy.

1. **Manifest of what is being superseded.** List every key under `js/`, `css/`, `fonts/` and `img/`
   currently in the bucket. Write the list as `deploy-manifests/<UTC timestamp>.txt`: the assets
   this deploy supersedes, stamped with the moment they stopped being current.
   - On the first deploy under this scheme, this captures the previous release's assets, so they
     are retained too.
   - The keys are not secret: the same names are served publicly.
2. **Hashed assets.** Every file under `js/`, `css/`, `fonts/` and `img/` except the `.gz` and `.br`
   siblings, each with its content type and `ASSET_CACHE_CONTROL`:
   - with a `.gz` sibling: the sibling's bytes under the original key, with `Content-Encoding: gzip`;
   - without one (the compression plugin skips a file that does not shrink to 80% or less: today the
     maps, fonts and PNGs): the raw file, with no `Content-Encoding`;
   - no deletion in this step.
3. **The rest of the site.** `aws s3 sync dist/ --delete` with these excludes:
   - `js/*`, `css/*`, `fonts/*`, `img/*`: uploaded in step 2 and pruned only in step 5;
   - `*.gz`, `*.br`: siblings, never keys of their own;
   - `index.html`: uploaded last, in step 4;
   - every route key printed by `scripts/static-routes.js`. These copies of `index.html` are not in
     `dist/`, so without the exclude `--delete` would remove them. Today that leaves deep links on
     404 for the seconds between the sync and the copy;
   - `deploy-manifests/*`.

   Excluded keys are neither uploaded nor deleted by `sync`.
4. **`index.html` and its route copies, last.** Raw, with `no-cache`, as today.
5. **Prune.** Delete a key under the hashed prefixes only if both hold:
   - it is not in this build's `dist/`;
   - it is in no manifest younger than the retention period (proposed 14 days).

   Then delete manifests older than the retention period. Retention therefore counts from the deploy
   that superseded an asset, not from its upload: a release that stayed live for a month keeps its
   assets for 14 days after it is replaced. The rule is never "not referenced by `index.html`",
   because lazy chunks are named only by the runtime.

**Rehearsal**, before any deploy, against a local S3-compatible endpoint: MinIO in Docker (Docker
is on this machine). A throwaway bucket, with local credentials invented for the container and
never written to a file.

- Three successive builds deployed with the script: the base commit, the candidate, and the
  candidate with one change.
- After each, read with `aws s3api head-object` and `list-objects-v2`:
  - every hashed key has the right `Content-Encoding` (gzip where a sibling existed, none otherwise),
    `Content-Type` and `Cache-Control`;
  - no `.gz` or `.br` key exists;
  - `index.html` and the route keys are present, with `no-cache`;
  - step 1's manifest holds the previous build's keys.
- Upload order checked from the script's own log: every hashed key before `index.html`.
- Prune checked by setting the retention period to 0 and to 14 days on the third deploy:
  - with 14 days, the first build's assets remain;
  - with 0, they go and the current build's remain.
- A route key's presence polled throughout step 3: never absent.

The rehearsal proves the script, not the edge; the edge is the probe's job.

### M6: mount at once

- `public/index.html`: a splash inside `#app` (logo or spinner, inline CSS with the body background
  of `colors.less`, no text), replaced by Vue on mount.
- `main.js`: `app.mount('#app')` once the locale is loaded (M3), not after `router.isReady()`.
  `App.vue` shows a loading state (no Navbar, no `router-view`) until the first navigation resolves.
- `src/router/index.js`: `getUser()` is replaced by one shared readiness promise built on
  `auth.authStateReady()`, then `auth.currentUser`. No listener per navigation.
- `src/firebase/config.js`: the `setPersistence` call is removed; `initializeAuth`'s persistence
  list stays.
- Verification:
  - the session-guard specs (a deep link without a session goes to `/signin` with its redirect;
    public pages stay open);
  - a new spec seeding a localStorage-persisted user, as `v2.2.30` leaves one, that lands signed in
    on a protected route;
  - a new check that ten navigations register no further auth listener;
  - the splash visible in the first paint of a throttled load (instrument).

### M7: the sign-in path

**How sign-in navigates today** (read at `80946cf`). The `login` action (`store/index.js:222`) calls
`signInWithEmailAndPassword`, commits the user and does not navigate. `Signin.vue`'s `handleSubmit`
does not navigate either for a verified user. The move to `redirect`, or to `redirectAfterAuth()`,
comes from the `onAuthStateChanged` listener registered in `mounted()` (`Signin.vue`, lines 194 to
215 and 237 to 260). It fires after the password sign-in because it stays subscribed. A one-shot
readiness promise alone would therefore break password sign-in: the state changes after readiness.

**Tests first.** These run on `80946cf` before any change in this milestone.

- Fixtures (`tests/e2e/fixtures/auth.js`, today four `mock-id-token` strings):
  - mint unsigned JWT-shaped ID tokens: header `{"alg":"none"}`, claims `iss`, `aud`, `sub` and
    `user_id` (the uid), `email`, `email_verified`, `iat`, `auth_time` and `exp` (now plus one hour),
    `firebase.sign_in_provider`, and an empty signature;
  - Firebase Auth 1.10.8 rejects a token whose claims lack `exp`, `auth_time` or `iat` (`_parseToken`,
    `index-35c79a8a.js:1263`, `internal-error`);
  - the securetoken, `accounts:lookup` and password sign-in mocks take `email_verified` and
    `emailVerified` from the test;
  - the StarChat mock answers 403 to a token whose `email_verified` is false, as StarChat does.
- Specs. Today the only password sign-in that is submitted is `tests/e2e/public/session-guard.spec.js:47`
  (a redirect back to `/businessconfiguration`); `signin.spec.js` never submits. Existing and kept:
  `session-guard.spec.js:47`. New:
  1. a password sign-in with no `redirect` lands on `/businesses` (a business exists);
  2. a password sign-in for an account with no business lands on `/onboardinglang`;
  3. the confirm-email return. `/login?confirm_email=true` with a persisted user whose cached token
     says `email_verified: false`, and whose `accounts:lookup` says `emailVerified: true`, lands on
     the first page. Expected to pass on `80946cf` (correct today, only slow). Also run once against
     the change with the refresh removed, and seen failing, so it is known to guard the refresh;
  4. the converse: `/` with a persisted user whose token carries the claim reaches the first page
     with no `securetoken` call;
  5. `/` with a session reaches the first page without the sign-in form ever becoming visible (a
     MutationObserver record, as in the session-guard specs).

**Changes.**

- `/` becomes `{ path: '/', redirect: '/signin', meta: { public: true } }`. `Home.vue` and its import
  are removed (`scripts/static-routes.js` already excludes `/`; checked against its output).
- `src/firebase/authUtils.js`: one function, run once when authentication is ready (M6's readiness).
  - It reads `getIdTokenResult()` locally and forces `getIdToken(true)` only when the token's
    `email_verified` differs from `user.emailVerified`. If the token cannot be parsed it forces the
    refresh, which is today's behaviour.
  - The guard and `Signin.vue` await it, so a deep link after verification is covered as well as
    `/signin`.
- `Signin.vue`: one post-authentication step, `afterAuth(user)`. It decides, as today, between
  `redirect`, `redirectAfterAuth()` and staying on the form for an unverified user. Two callers, and
  no other path navigates:
  1. `mounted()`, after the readiness above, when a session exists. A loading state replaces the
     form while this runs, and there is no `user.reload()` (Firebase reloaded the user at
     initialisation);
  2. `handleSubmit`, after the `login` action resolves. The magic-link and confirm-email branches
     already call it explicitly.

  The `onAuthStateChanged` listeners in `mounted()` are removed. Tokens use `getIdToken()` without
  forcing.
- `Business.checkUserHasBusinesses`: `getIdToken()` without forcing. Firebase refreshes a token that
  is expired or within five minutes of expiry by itself. This also changes Analytics and
  AnalyticsAdmin, which call it on mount.
- Verification:
  - specs 1 to 5 and `session-guard.spec.js:47`;
  - `tests/e2e/public/magiclink.spec.js` (no sign-in spec drives `GoogleCallback.vue`, which this
    milestone does not change);
  - the Analytics and AnalyticsAdmin specs;
  - the instrument shows, from `/` with a verified session whose token carries the claim, no
    `accounts:lookup` beyond initialisation's and no `securetoken` call.

The forced refreshes outside the sign-in path are not in this plan: the lead put them out of this
release (brief, Follow-ups).

### M8: documentation

- `docs/development.md`: the deploy (steps, headers, compression, retention and manifests, the
  `ASSET_CACHE_CONTROL` variable, rehearsal, probe, purge, rollback). Also the workflow's
  concurrency comment, which says "per environment" while the group is `deploy-${ref_name}`, per tag:
  the comment is corrected, or the group made per environment if review prefers. That is M5's
  decision.
- `docs/ARCHITECTURE.md`: router lazy loading and chunk recovery, i18n loading, auth readiness and
  the claim check.
- `docs/active-context.md`, then `doc-end`.

### M9: integration and release sequence

Every step past the rehearsal needs Angelo's authorisation, and production needs him present.

1. **Integration.** Rebase on the head of `v2.2` (`v2.2.31` or later). The brief's acceptance 1 and
   5 on the integrated head; the M5 rehearsal repeated on that head; an integration review.
2. **Passthrough probe on test.** The test environment's `ASSET_CACHE_CONTROL` is set to
   `public, max-age=60`, then the test tag is pushed and deployed.
   - Verify with `curl -I`, with and without `Accept-Encoding: gzip`, and with
     `curl --compressed -o` plus a byte comparison against `dist/`, on one gzip JS, one gzip CSS, one
     raw font and one SVG:
     - `content-encoding: gzip` exactly where expected and absent elsewhere;
     - the content type;
     - `cache-control: public, max-age=60`;
     - decoded bytes equal to the build's.
   - Then a cold load in Chromium with no decoding error, and the session-guard deep link.
   - **If the edge alters or drops `Content-Encoding`:**
     - the affected objects are purged from the test pipeline's cache (Edge Services console,
       "Purge by object", or "Purge all"; the 60 s max-age bounds the exposure if the purge is late);
     - the script is switched to upload raw bytes, keeping retention and the cache header;
     - the probe is repeated.
3. **Immutable on test.** `ASSET_CACHE_CONTROL` is set to `public, max-age=31536000, immutable` and
   the workflow is rerun on the same test tag (`workflow_dispatch` on its ref).
   - Acceptance 2 is checked again with that header.
   - An asset of the previous release still answers 200.
   - The measurement protocol runs: baseline before step 2, candidate now.
   - Acceptance 3 and 4 are checked.
4. **Beta, then production**, as separate tags on the same commit, each with the environment's
   `ASSET_CACHE_CONTROL` set first, and acceptance 2 checked on each domain. Beta and production get
   the immutable value directly, because the edge behaviour is a property of the service, already
   proven on test. If review prefers, the 60 s probe is repeated on beta.
5. **Production fallback tag, identified and verified before the production deploy**: the tag
   production is serving at that moment, and the rollback target. It is verified in two ways:
   - by `gh run list --workflow deploy.yml`, the last successful `-production` run;
   - by the `app.<hash>.js` name that the served `https://dashboard.mrcall.ai/index.html` names,
     found among the upload lines of that run's log.

   Checked on 2026-10-23 for reference: the last production run is `v2.2.25-production`
   (2026-10-17 16:59 UTC, tag at `0515932`), and the served `index.html` was last modified at
   17:01 UTC that day. `docs/active-context.md` still says production runs `v2.2.21`, which is stale.
   If `v2.2.31` reaches production, the fallback becomes its tag, verified the same way.

## Rollback

- **Per milestone**: revert its commits. M2, M3 and M4 revert freely; M5's retention reverts only
  together with every one of them that has been deployed.
- **Deployed**: redeploy the fallback tag of the environment (`workflow_dispatch` on its ref), with
  authorisation.
  - Its `sync` re-uploads its own assets raw and its `--delete` removes the retained ones and the
    manifests.
  - Objects the edge cached with `Content-Encoding: gzip` and the immutable header stay
    self-consistent: the cached response holds both the gzip body and its header.
  - A wrong header cached on the edge is removed by a purge (step 2 of M9), not by a redeploy.

## Status

| Milestone | Status | Evidence |
|---|---|---|
| M0 | build and `/signin` baseline measured (brief); instrument, session figures and suite baseline pending | brief, Evidence |
| M1 to M9 | not started | |

## Baseline figures (`80946cf` built locally; `/signin` on dashboard-test serving `v2.2.30-test`, 2026-10-23)

| Measure | Value |
|---|---|
| Initial JS (files, raw, gzip) | 102, 6 891 694 B, 1 806 913 B |
| All JS in `dist/js` (files, raw, gzip, brotli) | 122, 7 184 958 B, 1 908 028 B, 1 490 715 B |
| Initial CSS (files, raw, gzip) | 2, 625 169 B, 76 150 B |
| `/signin` cold, unthrottled, sign-in form visible | 698 to 1 109 ms, median 808 (5 runs); an earlier series to `#app` first child, 924 to 1 412 ms; about 8.2 MB, 119 to 120 requests |
| `/signin` cold, 10 Mbps, sign-in form visible | 6 544, 6 555, 6 587 ms (median 6 555); an earlier series to `#app` first child, 6 696, 6 780, 6 952 ms |
| Businesses, Analytics first data | M0, under the protocol |
| vitest, Playwright | M0 |

These series predate the protocol (5 and 3 runs, a scratch instrument). They are kept as reference;
the gates use the protocol's baseline series.
