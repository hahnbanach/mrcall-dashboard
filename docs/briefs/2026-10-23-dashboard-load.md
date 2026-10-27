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

**First paint** (Playwright Chromium, a fresh context per run with the cache disabled; `/signin`
because it needs no session). Two figures: the first child of `#app` (the splash, once one exists),
and the rendered app, meaning Vue has mounted and the sign-in form's email or password input is
visible. On `v2.2.30-test` there is no splash, so the first child is the mounted app and the two
differ by 16 to 38 ms. Two series, a few minutes apart:

| Link | Series | First child of `#app` | Sign-in form visible | Transferred |
|---|---|---|---|---|
| unthrottled (office line) | 1, 5 runs | 924, 992, 994, 1 121, 1 412 ms | not recorded | 8.03 to 8.23 MB, 119 to 120 requests |
| unthrottled | 2, 5 runs | 681, 698, 788, 871, 1 071 ms | 698, 715, 808, 887, 1 109 ms (median 808) | same |
| 10 Mbps, 40 ms latency (CDP emulation) | 1, 3 runs | 6 696, 6 780, 6 952 ms | not recorded | 8.23 MB |
| 10 Mbps, 40 ms latency | 2, 3 runs | 6 524, 6 534, 6 561 ms | 6 544, 6 555, 6 587 ms (median 6 555) | same |

The time to first data on Businesses and Analytics needs a real session and is measured in the plan's
measurement protocol, on the release dashboard-test serves immediately before this work's test deploy.

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
  50-minute proactive refresh.
- `checkUserHasBusinesses` is also called by Analytics and AnalyticsAdmin on mount (it sets the role
  from `x-mrcall-role`). Changing it changes those two pages as well as sign-in.

**Why one forced refresh must stay** (reviewer's evidence, 2026-10-23, StarChat at its `9.34` line):
StarChat authorises a Firebase token only when its `email_verified` claim is true
(`JwtFirebaseTokenService.tokenAuthorize`, used by `FirebaseBusinessResource.scala` and about 50
other resources), and refuses otherwise with Akka's default 403, which the dashboard's 401
interceptor never retries. Sign-up sends `sendEmailVerification` with `handleCodeInApp: false` and
a continue URL of `/login?confirm_email=true` (`Signup.vue`, `store/index.js`): the person verifies on
Firebase's page and comes back holding the ID token minted before verification, whose claim is still
false. Firebase's start-up reload updates `user.emailVerified` but mints no new token. Today the
unconditional `getIdToken(true)` in `Signin.vue` is what puts the true claim into the token. There is
no Playwright test of this return in `tests/`.

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
   fix 4 but outside the sign-in path the request named. The lead decided on 2026-10-23 that they
   are out of this release: a follow-up (see Follow-ups).
5. **Fix 4 cannot drop every forced refresh.** The diagnosis proposed `getIdToken()` without forcing
   on the sign-in path. That would leave a person returning from email verification with a token
   StarChat refuses (evidence above). The refresh stays, but only when it is needed: when the cached
   token's `email_verified` claim (read locally with `getIdTokenResult()`, no network) differs from
   `user.emailVerified`, which Firebase's start-up reload has just updated.

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
3. **The sign-in path.** No `user.reload()` on the path from `/` or `/signin` with a session to the
   first page (Firebase reloaded the user at initialisation). A forced token refresh only when the
   cached token's `email_verified` claim differs from `user.emailVerified`, decided in one place once
   authentication is ready, so that a deep link after verification is covered as well as `/signin`;
   otherwise `getIdToken()` without forcing, in `Signin.vue` and in `checkUserHasBusinesses` (and so
   on Analytics and AnalyticsAdmin too). `/` redirects without mounting a component; a loading state
   instead of the sign-in form while a session is being resolved.

Out of scope: the StarChat overview read (fix 3); the forced refreshes outside the sign-in path
(Follow-ups); the per-mount `onAuthStateChanged` listeners in
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
3. **First paint**, measured under the plan's measurement protocol on dashboard-test, against the
   baseline series the protocol takes immediately before the test deploy; both figures reported per
   run:
   - the splash (first child of `#app`): reported, not gated;
   - the rendered app (sign-in form visible) at 10 Mbps: median at most half the baseline median.
     On `v2.2.30-test` that was 6 555 ms (half 3 278 ms; the other series' 6 780 ms gives 3 390 ms),
     kept for reference;
   - the rendered app unthrottled: median not above the baseline median (808 ms on `v2.2.30-test`);
   - loading the active locale before mount adds one request that starts only after the main
     bundle has run. Its time, from the locale chunk's request to its response, is reported
     separately and is inside the two gated figures, not added to them;
   - a warm reload transfers at most `index.html` plus requests the cache cannot serve, which are
     listed.
4. **First data** on Businesses and Analytics, with a real session on dashboard-test, cold and warm,
   against the protocol's baseline series: reported per run, the median not worse. From `/` with
   a verified session whose token already carries `email_verified: true`, the network log shows no
   `accounts:lookup` beyond Firebase's initialisation and no `securetoken` call. The one allowed
   refresh is the one a claim mismatch triggers.
   - A Playwright test of the confirm-email return, written first and seen passing on `80946cf`
     (the current behaviour is correct, only slow): a session whose `user.emailVerified` is true
     after the start-up `accounts:lookup` and whose cached token says `email_verified: false` lands
     on the first page. The StarChat mock refuses with 403 a token without the claim, so the test
     fails if the refresh is skipped.
   - Its converse: a token that already carries the claim makes no `securetoken` call.
5. **No regression**: `npm run lint` exit 0; vitest all passing; the whole Playwright suite (desktop,
   tablet, mobile) with no failure that does not also fail on `80946cf` under the same conditions
   (failures rerun as in earlier plans); a test seeding a v2.2.30-style localStorage session lands
   signed in; a test that fails a chunk load recovers to the target page; `static-routes` unchanged.

## Assumptions

- Scaleway Object Storage keeps the `Content-Encoding` and `Cache-Control` set on upload and Edge
  Services passes them through. This has not been observed yet. The plan checks it on test with a
  60-second `max-age` before any immutable upload. If the edge alters the headers, the objects are
  purged, the pre-compression is left out, and the cache headers are kept.
- `vue-cli-plugin-compression` writes a `.gz` only when it shrinks the file to 80% or less
  (`minRatio: 0.8`). At `80946cf` every JS file has one; the source maps, the four fonts and two PNG
  images do not.
  A hashed asset with no `.gz` is uploaded raw, with the same cache header and no `Content-Encoding`.
- Every browser that uses the dashboard sends `Accept-Encoding: gzip`. A client that does not
  (a bare `curl`) receives gzip bytes for hashed assets.
- The Edge Services note that requests carrying cookies bypass its cache was not reproduced on test
  (a request with a cookie answered `hit-fresh`); it is not relied on either way.

## Follow-ups

- The forced refreshes outside the sign-in path (finding 4): `Business.js` (`selectVariables`,
  `getBusiness`, `chooseBusinessTemplate`, `updateBusiness`, `createBusiness`), `AiConfigure.js`,
  `Whatsappweb.vue`, `DirectVoiceButton.vue`, `TextChatWidget.vue`. Once this work's single
  claim check runs at authentication readiness, an unforced `getIdToken()` there is safe. Its own
  brief, after this release.
- The StarChat overview read (fix 3 of the diagnosis): its own brief in both repositories.

## Rollback

The work targets the first dashboard release after `v2.2.31`, not `v2.2.31` itself (decided
2026-10-23: the deploy change could not be rehearsed before it). Rollback redeploys, per environment,
the tag that environment served before this work, identified and verified before the deploy as the
plan's release sequence states (on 2026-10-23: `v2.2.30-test`, at `caaff42`, on test;
`v2.2.25-production`, at `0515932`, on production). A redeploy needs authorisation like any
deployment. Its `sync` re-uploads raw assets without the new headers, and hashed names make a
browser's immutable copy of a newer file harmless. A wrong header cached on the edge is removed by a
purge, not by a redeploy.
