# The dashboard paints at once and loads a fraction of what it loads today

<!-- doc-scope:start -->
Scope: Intent, scope, constraints, acceptance and assumptions of the dashboard load work of 2026-10-23
(smaller and compressed bundle with long-lived caching, mount before authentication resolves, a shorter
sign-in path); the steps live in the matching execution plan.
<!-- doc-scope:end -->

## Intent and authority

In production the dashboard sometimes stays a grey page at load. The grey is the `body` background
with `#app` still empty: `src/main.js` mounts only after `router.isReady()`, and the first navigation
waits for the whole bundle and for Firebase's initialisation. Angelo asked on 2026-10-22 for the
proper fixes of a measured diagnosis, numbers 1, 2 and 4 of it. Number 3 (one StarChat read for a page
of businesses) is a contract change in two repositories and is not part of this work. Commit, tag and
deployment are authorised separately; nothing here authorises a release.

## Evidence

Measured on 2026-10-23 at `80946cf` (branch `dashboard-perf`, from `origin/v2.2`), unless stated.

**The bundle.** Production build, `NODE_ENV=production BABEL_ENV=production vue-cli-service build
--mode production`, Node 26.5 locally (the workflow uses Node 18):

| Measure | Value |
|---|---|
| JS files in `dist/js` | 122, 7 184 958 B (gzip siblings 1 908 028 B, brotli 1 490 715 B) |
| JS loaded by `index.html` before anything renders | 102 files, 6 891 694 B, 1 806 913 B gzipped |
| CSS loaded by `index.html` | 2 files, 625 169 B, 76 150 B gzipped |
| Largest file | `app.*.js`, 3 715 720 B |
| Next largest | vendors 462 882 B, 196 179 B, 173 359 B; an async chunk 170 920 B |

What `app.js` holds, from the production source maps (diagnosis of 2026-10-22, production at
`v2.2.21`): all 12 locales eagerly (about 1 313 KiB, `src/i18n/index.js` imports every JSON),
`public/MrCallWebCall.bundle.js` (about 1 204 KiB, a static import in `WebcallButton.vue`), and
every route component but three. Vendors carry the JSON editor stack (about 0.85 MB), installed
eagerly by `app.use(JsonEditorVue)` in `main.js`. `splitChunks.maxSize: 64000` in `vue.config.js`
is what splits the vendors into dozens of files.

**How it is served** (`curl -I`, 2026-10-23, dashboard-test serving `v2.2.30-test`):

- `index.html`: `cache-control: no-cache`, no `content-encoding`.
- `/js/app.0c0a16e8.js`: 3 716 738 B, `content-type: text/javascript`, no `cache-control`, no
  `content-encoding`, no `vary`. The response is identical (same length and `etag`) with no
  `Accept-Encoding`, with `gzip`, with `br`, and with `gzip, deflate, br, zstd`. Edge Services
  therefore neither compresses nor negotiates: it returns the stored object as stored.
- The `.gz` (958 674 B) and `.br` (667 796 B) siblings exist in the bucket as separate keys, served
  as `text/javascript` with no `content-encoding`; nothing requests them.
- Production (`dashboard.mrcall.ai`, `app.e4dffb90.js`) answers the same way.
- With no `cache-control` the edge keeps an asset for its fallback TTL (120 s) and the browser
  applies its heuristic: that is the "sometimes". The diagnosis saw 65 of 104 edge misses on a first
  fetch.

**First paint** (Playwright Chromium, a fresh context per run with the cache disabled, time from
navigation to `#app` having children; `/signin` because it needs no session):

| Link | Runs | `#app` rendered | Transferred |
|---|---|---|---|
| unthrottled (office line) | 5 | 924, 992, 994, 1 121, 1 412 ms | 8.03 to 8.23 MB, 119 to 120 requests |
| 10 Mbps, 40 ms latency (CDP emulation) | 3 | 6 696, 6 780, 6 952 ms | 8.23 MB |

The time to first data on Businesses and Analytics needs a real session and is measured in the plan's
first milestone, on `v2.2.30-test`, before anything is deployed.

**Authentication before mount** (read in the code at `80946cf`):

- `src/router/index.js` `getUser()` registers a new `onAuthStateChanged` listener on every
  navigation to a non-public route and never unsubscribes it.
- `src/firebase/config.js` calls `initializeAuth` with `[indexedDBLocalPersistence,
  browserLocalPersistence]` and then `setPersistence(auth, browserLocalPersistence)`, which moves
  the persisted user to localStorage after the SDK has chosen IndexedDB.
- Firebase Auth 1.10.8 already reloads a persisted user during initialisation
  (`reloadAndSetCurrentUserOrClear`, an `accounts:lookup` call), and finds a user in any persistence
  of the list, migrating it to the first available (`PersistenceUserManager.create`). Measured cost:
  `accounts:lookup` 0.21 to 0.31 s, a forced token refresh 0.23 to 0.27 s.
- `auth.authStateReady()` exists in this SDK: a promise that resolves once the initial state is known.

**The sign-in path** (`src/components/templates/sign/Signin.vue`, `src/utils/Business.js`):

- `/` mounts `Home.vue`, whose `mounted()` replaces the route with `/signin`.
- With a session, `Signin.vue` registers `onAuthStateChanged` (not unsubscribed), calls
  `user.reload()` (not awaited, and a duplicate of the reload Firebase did at initialisation), then
  `user.getIdToken(true)`, then `checkUserHasBusinesses`, which forces a second refresh before
  `search` with limit 1, then pushes. The sign-in form is visible throughout.
- `getIdToken(true)` appears 15 times in `src`. Besides the sign-in path it is in five other
  functions of `Business.js` (among them `getBusiness`, with 17 call sites), in `AiConfigure.js`, in
  the webcall and Whatsapp components, in the 401 interceptor (where forcing is the point) and in the
  50-minute proactive refresh. `checkUserHasBusinesses` is also called by Analytics and AnalyticsAdmin
  on mount, so its forced refresh delays their first data too.

## Findings that change the diagnosis's fixes

1. **`loadLanguageAsync` is not the switch in use.** It is called only by `changeLanguage` in
   `App.vue`, which nothing calls; it assigns `i18n.global.locale = locale`, which in composition
   mode would replace the ref rather than set it. The language is chosen by `src/i18n/translation.js`
   (`getLocale`, `switchLanguage`), called from Navbar, Signin, Signup, CustomTokenSignin and, as a
   side effect inside computed properties, from seven more components. Locales on demand therefore
   go through one loader that `translation.js` uses, and the dead path is removed.
2. **Lazy routes need the previous release's chunks to stay.** The deploy runs `aws s3 sync --delete`,
   which removes every asset of the previous release. A tab opened before a deploy that then navigates
   to a lazy route asks for a chunk that no longer exists; the bucket answers with `index.html` under
   404, and the import fails. This already applies to three routes and every async vendor chunk; making
   every route lazy makes it the common case. Fix 1 therefore includes keeping hashed assets across
   deploys (pruned after a retention period) and recovering from a failed chunk load by reloading the
   target URL once.
3. **Brotli cannot be served correctly by this edge.** It sends no `Vary` and does not choose between
   objects by `Accept-Encoding`, so a pre-compressed object goes to every client with the encoding it
   was stored with. Gzip is accepted by every browser in use; brotli is not guaranteed to be. The
   design stores gzip under the original key with `Content-Encoding: gzip`. Brotli would save about
   a further 22% (1 490 715 B against 1 908 028 B over all JS) and needs a CDN that negotiates; that is
   not in scope.
4. **The forced refreshes outside the sign-in path** (point above) cost one securetoken round trip per
   call on Business Configuration, the wizard, the onboarding pages, Plan and the Aladdin
   configurator (the callers of `getBusiness`). They are the same defect as
   fix 4 but outside the sign-in path the request named. The plan holds them in a separate milestone
   that runs only if the lead extends the scope.

## Scope

In scope:

1. **A smaller, compressed, cached bundle.** Every route component loaded on demand; locales loaded on
   demand, the active one (and the fallback) before mount; `MrCallWebCall` and the JSON editor
   imported dynamically; `splitChunks.maxSize` removed; the deploy uploads hashed assets gzip-encoded
   under their own keys with `Content-Encoding: gzip` and `Cache-Control: public, max-age=31536000,
   immutable`, keeps the previous assets for a retention period, and leaves `index.html` and its
   route copies with `no-cache`; a failed chunk load reloads its target once.
2. **Mount at once.** A splash in `public/index.html` visible from the first byte; the app mounts
   without waiting for the router, with a loading state in `App.vue` until the first navigation
   resolves; the guard awaits the SDK's single `authStateReady()` instead of a listener per
   navigation; the `setPersistence` call removed.
3. **The sign-in path.** No `user.reload()` and no forced refresh on the path from `/` or `/signin`
   with a session to the first page; `/` redirects without mounting a component; a loading state
   instead of the sign-in form while a session is being resolved.

Out of scope: the StarChat overview read (fix 3); the per-mount `onAuthStateChanged` listeners in
Businesses, Analytics, AnalyticsAdmin and Conversations, beyond what the guard change makes
unnecessary; brotli; source maps published to the bucket; the unhashed copy of
`MrCallWebCall.bundle.js` that `public/` puts at the site root (left in place: no caller was found in
the website or app repositories, but an external page cannot be ruled out); the build tool (Vue CLI
stays; `vite.config.js` is not the build that ships).

## Constraints

- No change to any API contract, environment variable or route path. `scripts/static-routes.js` reads
  the router as a syntax tree and must keep listing the same routes.
- Every user-facing string translated in all 12 locales; no untranslated flash at load (the active
  locale's messages are present before the first render of translated text).
- The splash uses no text that would need translating, or none at all.
- A session persisted by `v2.2.30` (in localStorage) must survive the upgrade.
- No Python in the repository; no credentials written anywhere; Playwright on a port other than 8080.
- Each milestone of the plan can be left out without breaking the others, except where the plan states
  a dependency.

## Acceptance

Measured on the revision delivered, each figure reported with its commit:

1. **Bundle**, same build command as above: JS loaded by `index.html` at most half of 1 806 913 B
   gzipped, in at most 10 files; total and per-file listing before and after recorded in the plan.
   Locales, the webcall client and the JSON editor appear only in async chunks.
2. **Headers** on dashboard-test after the test deploy (`curl -I`, with and without `Accept-Encoding:
   gzip`): a hashed JS and CSS asset answer `content-encoding: gzip`, `cache-control: public,
   max-age=31536000, immutable` and their content type; `index.html` and a route copy answer
   `cache-control: no-cache`; an asset of the previous release still answers 200 after the deploy.
3. **First paint**, the same Playwright measurement on dashboard-test against the `v2.2.30-test`
   figures above: `#app` (or the splash) visible at 10 Mbps in at most half of the baseline median
   (6 780 ms); unthrottled not slower than the baseline; a warm reload transfers at most
   `index.html` plus requests the cache cannot serve, which are listed.
4. **First data** on Businesses and Analytics, with a real session on dashboard-test, cold and warm,
   against the M0 figures for `v2.2.30-test`: reported per run; the median is not worse, and the
   sign-in hop from `/` to the first page makes no `accounts:lookup` and no forced `securetoken` call
   beyond Firebase's own initialisation (checked in the network log).
5. **No regression**: `npm run lint` exit 0; vitest all passing; the whole Playwright suite (desktop,
   tablet, mobile) with no failure that does not also fail on `80946cf` under the same conditions
   (failures rerun as in earlier plans); a test seeding a v2.2.30-style localStorage session lands
   signed in; a test that fails a chunk load recovers to the target page; `static-routes` unchanged.

## Assumptions

- Scaleway Object Storage keeps the `Content-Encoding` and `Cache-Control` set on upload and Edge
  Services passes them through. Not yet observed; the deploy milestone checks it on test first, and
  if the edge alters them, the pre-compression is left out and the cache headers kept.
- Every browser that uses the dashboard sends `Accept-Encoding: gzip`. A client that does not
  (a bare `curl`) receives gzip bytes for hashed assets.
- The Edge Services note that requests carrying cookies bypass its cache was not reproduced on test
  (a request with a cookie answered `hit-fresh`); it is not relied on either way.

## Rollback

`v2.2.30-test` is the tag at `caaff42`; `80946cf`, this work's base, differs from it only in one plan
file. Rollback redeploys that tag (`workflow_dispatch` on its ref, or a new environment tag on the
same commit), which needs authorisation like any deployment. Its `sync` re-uploads raw assets without
the new headers; hashed names make a browser's immutable copy of a newer file harmless.
