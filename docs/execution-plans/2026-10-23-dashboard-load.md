---
status: planned
brief: ../briefs/2026-10-23-dashboard-load.md
owner: the dashboard session of 2026-11-02 (it also holds the v2.2 line), worktree mrcall-dashboard-wt/dashboard-load, branch dashboard-load from v2.2 at the plan's approval, local only (merged into v2.2 by fast-forward, never pushed under that name)
target: the next dashboard release after v2.2.47
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
separately by Angelo; this session holds the `v2.2` line and merges by fast-forward.

Target: the first dashboard release after `v2.2.47`. Compression, the part of M5 that needed no cache
header and no retention, shipped alone in `v2.2.47` on 2026-11-02 (commit `8f194be`): `scripts/precompress.sh`
and the workflow's three syncs. Edge Services passes `Content-Encoding` through, observed on test, beta and
production. Still unobserved: passthrough of `Cache-Control`, which the probe of M9 step 2 checks with a 60 s
value before any immutable upload. There are no bucket credentials on this machine, and a wrong immutable header
would stay cached for a year.

No backend dependency: StarChat and mrcall-agent contracts are unchanged. Any other session editing
`src/router/index.js`, `src/main.js`, `src/i18n/`, `tests/e2e/fixtures/auth.js` or
`.github/workflows/deploy.yml` on `v2.2` is a merge dependency; M9 rebases on the line's head
(`v2.2.47` or later).

Gates run in this worktree: Node 26.5 locally (the workflow builds on Node 18), Playwright with
`E2E_PORT` on a free port (8080 belongs to another session), the dev server started separately when
the 120 s webServer timeout is not enough under load.

## Dependencies between milestones

- **M2, M3 and M4 each add async chunks** (pages, locales, the webcall client, the JSON editor). A tab
  opened before a deploy needs them after it. None of the three reaches any environment unless M5's
  retention (M5 steps 1, 3, 5 and 6) is in the same deploy or an earlier one.
- M7 depends on M6 (the readiness promise).
- M5's immutable header depends on the passthrough probe of the release sequence (step 2).
- Otherwise each milestone can be left out if it fails review or Playwright.

## Measurement protocol (fixed before any measurement)

Every figure the brief's acceptance 3 and 4 gate on is produced this way and no other:

- **Instrument**: `scripts/measure-load.mjs` (M0) at the commit named in the report, Playwright
  Chromium (version recorded), on this laptop. The 1-minute load average is recorded before each
  series.
- **Pages and figures**: `/signin`, with the first child of `#app` and the rendered app (an email or
  password input visible), in a context whose locale is `en-US` for the gated runs (the brief's
  acceptance 3), and one `it-IT` series reported beside them. For each `/signin` run the network log
  lists the async chunks fetched before the form is visible, their gzip bytes and which waited on
  which: that is what the brief's T and R are computed from. Businesses and Analytics with a real session, with the first business
  row and the first analytics figure, using the selectors fixed in M0. For each run: the locale
  chunk's request-to-response time (once M3 lands), bytes, requests, and the `securetoken` and
  `accounts:lookup` calls.
- **Profiles**: unthrottled, and CDP emulation at 10 Mbps down and up with 40 ms latency.
- **Runs**: cold runs (new context, cache disabled), 7 per page and profile; warm runs (same context,
  cache enabled, after one priming load), 5 per page and profile.
- **Session state**: every real-session run signs in fresh in its own context. Its ID token is
  therefore less than an hour old, and Firebase's start-up makes no expiry refresh. The figures do
  not cover a returning user with a persisted token older than an hour, who pays one `securetoken`
  call (0.23 to 0.27 s measured in the diagnosis) at start-up, on both baseline and candidate.
- **Order and window**:
  1. The baseline series runs on dashboard-test against the release it serves, immediately before
     the test deploy of this work.
  2. The candidate series runs immediately after that deploy's verification, within 60 minutes of
     the baseline. If the window is missed, both series are retaken on beta, which serves the previous
     release until M9 step 4: baseline there, candidate on test, alternating within one window. Those
     figures then compare two environments behind two edge pipelines, and are reported as such.
     Cold runs disable the cache, so the gated figures do not depend on whether the immutable step
     ran; if the probe fails and step 3 is dropped, acceptance 3 and 4 are measured after step 2, and
     only the warm-reload item is reported as not applicable.
  3. A second, local A/B corroborates the bundle effect on a quiet edge. Both `dist/` builds (the
     base commit and the candidate) are served from one local static server that sets the same
     headers the deploy sets. Runs alternate A, B, A, B.
- **Statistic**: the median per figure, page and profile, with minimum and maximum. Every run is
  reported. A run is discarded only for a recorded network error, and is then repeated and listed.
- **If the unthrottled gate fails**: the extra serialized requests on the path to the form are the
  suspect (the route chunk and the locale). Two levers, tried in this order and each measured again under
  the protocol, with the outcome recorded:
  1. the sign-in route group back in the initial bundle: one request fewer, its bytes counted in
     acceptance 1;
  2. the locale import started at the very top of `main.js`, before the rest of its set-up, so that it
     overlaps the bundle's evaluation. A `<link rel="preload">` cannot do it: which locale chunk is needed
     is known only at run time.
- **Gates**: the brief's thresholds are relative to the baseline series of step 1. The brief's
  `v2.2.30-test` figures (uncompressed) and its `v2.2.47` production reference (gzipped, 2026-11-02:
  10 Mbps form median 2 170 ms, splash not yet existing, unthrottled 599 ms) are kept for reference.

## Milestones

Each milestone is one or a few commits, verified on its own.

### M0: baseline instrument and suite baseline

- Commit `scripts/measure-load.mjs` (Node, Playwright) implementing the protocol above.
  Credentials come from the environment at run time and are never written.
- Vitest and the whole Playwright suite on the base commit in this worktree, with the failure set and
  its reruns recorded. That is the regression baseline. For reference, the suite on `caaff42`
  (recorded in the call-insights plan, D12) was 1 183 passed, 7 failed and 5 skipped, and the 7
  passed when rerun serially.
- Verification: the instrument reproduces the brief's `v2.2.47` reference figures within their spread
  on the release then on test; the suite baseline recorded below.

### M1: vendors in few files (`vue.config.js`)

- Remove the `configureWebpack.optimization.splitChunks` override (`maxSize: 64000`), leaving Vue
  CLI's default `chunk-vendors` and `chunk-common` groups.
- The built `index.html` carries no `prefetch` or `preload` link (counted at `80946cf` and on production `v2.2.47`). This
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
  - `node scripts/static-routes.js` output identical to the base commit's; `tests/unit/publicRoutes.spec.js`;
  - a new Playwright test, written first and seen failing on the base commit, that aborts one route chunk
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
- `main.js` resolves the active locale before mount, in this order: on `/signin`, `/login` and `/signup` only,
  the URL's `lang` query (read by `Signin.vue:177` and `Signup.vue:162` today; elsewhere `lang` is not an
  interface language, e.g. `Conversations.vue:1668` reads it as a date format), or on `/customtokenlogin`
  (`src/router/index.js:90`) its `language` query mapped as
  `CustomTokenSignin.vue:36-42` maps it (`it*` to `it-IT`, anything else to `en-US`); then localStorage, then
  navigator, then the default (the order used today). Those components keep their switch, which then finds
  the locale already loaded and does not wait, so a link carrying a language shows no other language first. It awaits that locale and the fallback, in parallel, before `app.mount`, and the splash
  (M6) covers the wait. The wait has a cost:
  - the request can start only once the main bundle has run, so it is serial with it;
  - the locale JSON files gzip to 37 142 B (en-US), 39 601 B (it-IT) and 48 739 B (el-GR, the
    largest), measured at `80946cf` (en-US 46 673 B and it-IT 49 763 B with `gzip -9 -n` on 2026-11-02);
  - at 10 Mbps and 40 ms latency that is one round trip plus 30 to 40 ms of transfer, about 100 ms
    (estimated, not measured);
  - the import therefore starts when the i18n module is evaluated, ahead of the rest of `main.js`'s
    set-up, so the two overlap;
  - the instrument reports the request's time on every run, and the gated rendered-app figure
    includes it.
- The fallback is `en-US`. For a browser in `en-US` the active locale is the fallback, and one locale chunk
  is fetched before mount; in any other locale, two (about 96 kB gzip with `it-IT`). The gated runs are
  `en-US` (brief, acceptance 3).
- `tests/unit/setup.js` loads synchronously the messages that unit tests assert on, so no spec
  depends on the async path by accident. One new spec covers the loader: unknown locale, alias,
  cached promise, failure.
- Verification:
  - a production build with 12 locale chunks and no locale in the initial files;
  - vitest;
  - the Playwright language-switch specs and the Signin `?lang=` path;
  - a new Playwright check that the first render of `/signin` in `it-IT` contains no English string
    from `en-US.json` (no flash), and the same for `/signin?lang=it-IT` and `/signup?lang=it-IT` in an
    `en-US` browser, and for `/customtokenlogin?language=it` (the query paths); plus a check that
    `/conversations?lang=it-IT` in an `en-US` browser leaves the interface in English;
  - a failed locale import before mount reloads the page once (the sessionStorage marker of M2); a second
    failure mounts with the messages that did load and logs the error, rather than leaving the splash up.
    A failed JSON editor import shows the async component's error state; a failed webcall import shows
    the existing start error (M4). Each has a Playwright check that aborts the chunk.
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

The upload logic moves from the workflow's inline steps (the three syncs of `v2.2.47`) to
`scripts/deploy-assets.sh` (bash). The workflow calls it after the Precompress step, and the rehearsal runs
the same file, on a `dist/` that went through `scripts/precompress.sh` first. Before uploading anything the
script checks that every `.js` and `.css` under `dist/` starts with the gzip magic bytes (`1f 8b`) and stops
otherwise, so a build that skipped the Precompress step can never go up declared as gzip. It takes the endpoint, the bucket and the
asset `Cache-Control` value as required arguments with no defaults, and prints the destination
before each step.

The cache value comes from a GitHub environment variable (`ASSET_CACHE_CONTROL`, a variable, not a
secret). It is the only switch between the probe and the immutable header. It is required: unset or empty,
the script exits before uploading anything. The literal value `none` means "set no `Cache-Control` on the
hashed assets", which is today's behaviour and the fallback after a failed probe. The design choice (gzip,
not brotli, because the edge neither negotiates nor varies) is written in the script's comments with
the brief's `curl -I` evidence.

**What the steps cover** (the baseline `dist/` after the Precompress step, shipped on 2026-11-02: `scripts/precompress.sh`
replaces every `.js` and `.css` with its gzip bytes in place and deletes the plugin's `.gz` and `.br` siblings, so
none reaches these steps):

| Path | Content | Upload |
|---|---|---|
| `js/` | 122 `.js`, gzip bytes; 122 `.js.map`, raw | step 2 |
| `css/` | 8 files, gzip bytes | step 2 |
| `fonts/` | 4 files, raw | step 2 |
| `img/` | 23 SVG and 2 PNG, raw (the SVGs could be added to `precompress.sh`) | step 2 |
| site root | `MrCallWebCall.bundle.js`, gzip bytes, unhashed: `no-cache`, never `ASSET_CACHE_CONTROL` | step 2 |
| site root | `index.html`; `_redirects`, `favicon.ico`, `robots.txt`, `sitemap.xml` | steps 3 and 4 |

All names under `js/`, `css/`, `fonts/` and `img/` carry a content hash.

**Steps, in this order.** A page must never name an asset that is not yet uploaded, and a deep link
must never lose its key during a deploy.

Two kinds of list live under `deploy-manifests/`, holding hashed keys only (the hashed keys are not
secret: the same names are served publicly):

- `current.txt`: the hashed keys of the build that is live, rewritten by every deploy (step 5);
- `superseded-<UTC timestamp>.txt`: the keys one deploy took out of service, stamped with the moment
  they stopped being current. A key appears in a list only when it stops being current, so a key
  current again after a rollback and then superseded again appears in a newer list.

1. **Record what this deploy supersedes.** The list is written as `superseded-<now>.txt`, and no
   file is written when it is empty. It is the union of:
   - the keys of the previous `current.txt` that are not in this build's `dist/`;
   - orphans: keys under `js/`, `css/`, `fonts/` and `img/` that are in the bucket, not in this
     `dist/`, not in the previous `current.txt` and in no retained `superseded-*` list.

   Orphans are the assets of the release live before this scheme exists (the first deploy has no
   `current.txt`), and the leftovers of a deploy interrupted before step 5. They are retained like
   any superseded key rather than deleted unseen.
2. **Hashed assets, and every `.js` and `.css`.** Every file under `js/`, `css/`, `fonts/` and `img/`, and every
   `.js` and `.css` elsewhere (today `MrCallWebCall.bundle.js` at the root), each with its content type and
   `ASSET_CACHE_CONTROL`:
   - a `.js` or `.css` outside the hashed prefixes carries no hash: it goes up with `Cache-Control: no-cache`, never
     with `ASSET_CACHE_CONTROL`, or a change to it would never reach a browser (brief, scope 1: the header is for
     hashed assets only);
   - a `.js` or `.css` holds gzip bytes since the Precompress step: uploaded with `Content-Encoding: gzip`. Never
     decide by the presence of a `.gz` sibling: there is none any more, and a bundle so judged would go up as gzip
     bytes with no header, which breaks the site;
   - every other file: raw, with no `Content-Encoding`;
   - no deletion in this step.
3. **The rest of the site.** `aws s3 sync dist/ --delete` with these excludes:
   - `js/*`, `css/*`, `fonts/*`, `img/*`, and `*.js`, `*.css` anywhere: uploaded in step 2 and pruned only in step 6
     (a `.js` or `.css` outside the hashed prefixes carries no hash, so step 6 deletes it as soon as the build no
     longer has it);
   - `index.html`: uploaded last, in step 4;
   - every route key printed by `scripts/static-routes.js`. These copies of `index.html` are not in
     `dist/`, so without the exclude `--delete` would remove them. Today that leaves deep links on
     404 for the seconds between the sync and the copy;
   - `deploy-manifests/*`.

   Excluded keys are neither uploaded nor deleted by `sync`.
4. **`index.html` and its route copies, last.** Raw, with `no-cache`, as today.
5. **`current.txt`** rewritten with this build's hashed keys, once `index.html` names them.
6. **Prune.** A `.js` or `.css` outside the hashed prefixes that is not in this build's `dist/` is deleted at once:
   it carries no hash, and step 3's exclude keeps `sync --delete` from it. Then, for each key under the hashed
   prefixes that is not in this build's `dist/`:
   - the newest `superseded-*` list naming the key decides;
   - if that list is older than the retention period (proposed 14 days), the key is deleted;
   - a key that no list names is left in place and reported. After step 1 this can happen only
     through a concurrent writer.

   Then every `superseded-*` list older than the retention period is deleted. Each of its keys has
   by then been deleted, is current again, or is named by a newer list.

   **Why the bucket stays bounded.** A key is listed only when it leaves service, and it goes once
   its newest listing is older than the retention period. The bucket therefore holds the live
   release, plus the assets superseded within the last 14 days, plus the reported strays, whatever
   the interval between deploys.

   **Why it never deletes too early.** Retention counts from the deploy that superseded an asset,
   not from its upload: a release live for a month keeps its assets for 14 days after it is
   replaced. The rule is never "not referenced by `index.html`", because lazy chunks are named only
   by the runtime.

**Rehearsal**, before any deploy, against a local S3-compatible endpoint: MinIO in Docker (Docker
is on this machine). A throwaway bucket, with local credentials invented for the container and
never written to a file.

- Three successive builds deployed with the script: the base commit, the candidate, and the
  candidate with one change.
- After each, read with `aws s3api head-object` and `list-objects-v2`:
  - every key has the right `Content-Encoding` (gzip on every `.js` and `.css`, none otherwise),
    `Content-Type` and `Cache-Control`;
  - no `.gz` or `.br` key exists;
  - `index.html` and the route keys are present, with `no-cache`;
  - step 1's list holds exactly the keys that left service, and `current.txt` equals the build's
    hashed keys.
- Upload order checked from the script's own log: every hashed key before `index.html`.
- A route key's presence polled throughout step 3: never absent.
- **Retention over time, with backdated lists.** The script reads a list's date from its name, so
  the rehearsal renames lists to move them in time.
  - Setup: the bucket is first filled the way today's workflow fills it, with the base build. Then
    five builds are deployed with the script:
    - B1 = the base build;
    - B2, B3 and B5, each with at least one chunk of its own;
    - B4, which brings back one chunk of B2, as a rollback would.
  - After each deploy, the new list is renamed to put supersessions at day 0 (D2 supersedes B1),
    day 10 (D3, B2), day 20 (D4, B3) and day 30 (D5, B4). D5's prune runs at day 31 with a
    14-day retention.
  - Expected after D5:
    - B1's own chunks are gone (superseded 31 days earlier), and so are B2's (21 days);
    - B3's remain (11 days) and B4's remain (1 day);
    - the B2 chunk that B4 brought back remains, because D5 listed it again;
    - B5's are all present;
    - the lists dated day 0 and day 10 are deleted;
    - the orphans of the pre-scheme fill are recorded by D1 and gone once their list ages out.
  - The object count after each deploy is recorded. It must fall once lists age out instead of
    growing with every deploy.

- **Header-only redeploy**, as M9 step 3 does: the same build deployed again with a different
  `ASSET_CACHE_CONTROL` (`public, max-age=60`, then the immutable value, then `none`). After each, every hashed
  key carries the new header, no key is deleted, and the manifests are unchanged. `sync` skips an object
  whose size and date match, so the script must rewrite the metadata of every hashed key whose header
  differs (a copy onto itself with the new metadata); the rehearsal checks that it does.

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

**How sign-in navigates today** (read at `80946cf`, re-read at `adbb851`). The `login` action (`store/index.js:223`) calls
`signInWithEmailAndPassword`, commits the user and does not navigate. `Signin.vue`'s `handleSubmit`
does not navigate either for a verified user. The move to `redirect`, or to `redirectAfterAuth()`,
comes from the `onAuthStateChanged` listener registered in `mounted()` (`Signin.vue`, lines 194 to
215 and 237 to 260). It fires after the password sign-in because it stays subscribed. A one-shot
readiness promise alone would therefore break password sign-in: the state changes after readiness.

**Tests first.** These run on the base commit before any change in this milestone.

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
     the first page. Expected to pass on the base commit (correct today, only slow). Also run once against
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

  `afterAuth` works on its `user` argument, never on `store.state.user`, which the readiness promise may
  precede. It also fires the Google Analytics events the removed listeners fire today, where they fire them
  today, once per call: `login` (`Signin.vue:203`, with a session or after a password sign-in), `login` with
  `mode: 'magiclink'` (`:221`) and `verified_email` (`:227`, `:247`, the confirm-email return). Changing what
  they count is not this work. A Playwright check stubs `gtag` and asserts each event on its path.

  The `onAuthStateChanged` listeners in `mounted()` are removed. Tokens use `getIdToken()` without
  forcing.
- `Signin.vue` calls `Business.checkUserHasBusinesses` with `{ fresh: false }`, after the claim check above.
  Firebase refreshes a token that is expired or within five minutes of expiry by itself. The function's
  default stays forced: `GoogleCallback.vue`, Conversations and the report page keep it (brief, scope 3;
  their refresh is the follow-up). Analytics and AnalyticsAdmin already pass `{ fresh: false }` (`5f08d1f`).
- Verification:
  - specs 1 to 5 and `session-guard.spec.js:47`;
  - `tests/e2e/public/magiclink.spec.js` (no sign-in spec drives `GoogleCallback.vue`, which this
    milestone does not change);
  - the Analytics, AnalyticsAdmin and Conversations specs (unchanged callers, as a regression check);
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

1. **Integration.** Rebase on the head of `v2.2` (`v2.2.47` or later). The brief's acceptance 1 and
   5 on the integrated head; the M5 rehearsal repeated on that head; an integration review.
2. **Cache header probe on test.** `Content-Encoding` passthrough is already proven (`v2.2.47`, 2026-11-02);
   what is probed is `Cache-Control`. The test environment's `ASSET_CACHE_CONTROL` is set to
   `public, max-age=60`, then the test tag is pushed and deployed.
   - Verify with `curl -I`, with and without `Accept-Encoding: gzip`, and with
     `curl --compressed -o` plus a byte comparison against the build before precompression, on one JS,
     one CSS, one font and one SVG:
     - `cache-control: public, max-age=60` on all four, on a miss and on a hit;
     - `content-encoding: gzip` on the JS and CSS only, and the content type;
     - decoded bytes equal to the build's.
   - Then a cold load in Chromium with no decoding error, and the session-guard deep link.
   - **If the edge alters or drops `Cache-Control`:** the affected objects are purged from the test
     pipeline's cache (Edge Services console, "Purge by object", or "Purge all"; the 60 s max-age bounds
     the exposure if the purge is late), `ASSET_CACHE_CONTROL` is set to `none` so that the script sets no
     cache header, and the immutable step is dropped from this release; retention stays.
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
5. **Fallback tag per environment, identified and verified before that environment's deploy**: the tag the
   environment is serving at that moment, and its rollback target. It is verified in two ways:
   - by `gh run list --workflow deploy.yml`, the last successful run of that environment's suffix;
   - by the `app.<hash>.js` name that the environment's served `index.html` names, found among the upload
     lines of that run's log.

   Checked on 2026-11-02 for reference: test serves `v2.2.47-test` (commit `8f194be`, run 41422948921); beta
   `v2.2.47-beta` and production `v2.2.47-production` (commit `adbb851`, runs 41426787373 and 41426787252). The
   two commits differ by documentation only. If a later release reaches an environment first, its fallback
   becomes that tag, verified the same way.

## Rollback

- **Per milestone**: revert its commits. M2, M3 and M4 revert freely; M5's retention reverts only
  together with every one of them that has been deployed.
- **Deployed**: redeploy the fallback tag of the environment (`workflow_dispatch` on its ref), with
  authorisation.
  - Its workflow re-uploads its own assets gzipped with `Content-Encoding: gzip` (as since `v2.2.47`) and
    without the immutable header, and its `--delete` removes the retained ones and the manifests.
  - Objects the edge cached with `Content-Encoding: gzip` and the immutable header stay
    self-consistent: the cached response holds both the gzip body and its header.
  - A wrong header cached on the edge is removed by a purge (step 2 of M9), not by a redeploy.

## Status

| Milestone | Status | Evidence |
|---|---|---|
| M0 | build and `/signin` baseline measured (brief: `80946cf` uncompressed, and the `v2.2.47` production reference of 2026-11-02); instrument, session figures and suite baseline pending | brief, Evidence and acceptance 3 |
| M1 to M4, M6 to M9 | not started | |
| M5, compression only | shipped ahead of the plan on 2026-11-02, scoped: `scripts/precompress.sh` gzips every `.js` and `.css` in place and the workflow uploads them with `Content-Encoding: gzip` in three syncs (bundles, the rest with `--delete`, then the bundles' own prune). Caching unchanged (edge default), deletion unchanged (superseded bundles go at once, as before). Still pending under M5: the immutable header after the passthrough probe, the retention lists, `scripts/deploy-assets.sh` and its rehearsal | production served 7 891 KB of JS uncompressed on `v2.2.46` (curl, 105 files, `Accept-Encoding: gzip, br`); first paint of `/login` in Chromium throttled to 9 Mbps / 170 ms: 9.3 s on production; 1.6 Mbps / 300 ms: 46.7 s, and 46.6 s in a second run. Same build served locally raw and gzipped: 10.4 s and 46.7 s raw, 5.9 s and 17.7 s gzipped. Edge passthrough proved on `v2.2.47-test` (commit 8f194be, run 41422948921: "precompress: 132 files gzipped"): all 105 initial assets of https://dashboard-test.mrcall.ai answer `content-encoding: gzip`, on `x-cache: miss` and on `hit-fresh`, and decode to JS; 1.98 MB transferred against 7.9 MB; favicon unencoded. Same throttled runs live: 3.7 s at 9 Mbps and 15.8 s at 1.6 Mbps, against 9.3 s and 46.6 s on production `v2.2.46`. A client sending no `Accept-Encoding` also gets gzip: every browser accepts it, and there is no negotiation to fall back on. A rollback to a tag from before 8f194be runs that tag's own workflow, which re-uploads every bundle raw without the header (its files are newer than the objects) |

## Reviews

- Brief, restated on 2026-11-02: REVISE twice, then APPROVED at `672d101` by one fresh reviewer. First pass: the
  10 Mbps cap was already met by `v2.2.47` and the splash ungated, and `checkUserHasBusinesses`' callers were
  stale (Analytics pages pass `fresh: false` since `5f08d1f`). Second pass: the rendered-app gate credited the
  sign-in route and locale chunks as removed although the form waits for them. Both repaired in the brief.
- Plan: pending.

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
