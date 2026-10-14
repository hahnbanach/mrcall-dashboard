---
status: active
brief: ../briefs/2026-10-13-shell-session-guard.md
owner: dashboard release lead (this line, v2.2)
created: 2026-10-13
---

# Session guard and single owner of 401

## Classification and dependencies

Substantial development: this changes the authentication boundary of the router and
the error contract between the Axios interceptor and every component. Fast path does
not apply. The brief received an independent APPROVED review after one REVISE round.
This plan needs a fresh APPROVED before source edits. Commit, tag and deployment are
authorized separately by Angelo.

Work happens in worktree `shell-auth-guard`, onto `60c1522` (origin/v2.2). There is no
backend dependency. `restaurant-tables-page` (another session) touches only the
restaurant menu check in `BusinessConfiguration.vue`; the two deliveries are rebased in
whichever order they land.

## Verified starting point

- At `60c1522`, the production build in test mode succeeds.
- Vitest: 109 of 110 pass in this worktree. `tests/unit/skillsOwnerSave.spec.js` takes
  3.5 to 5.3 s against a 5 s timeout and passes with a longer one. It also passes on
  the main checkout. This is a pre-existing timing margin: it is reported, not fixed
  here.
- Full Playwright on `60c1522` (main checkout): 709 passed, 3 skipped, 0 failed.
- `node scripts/static-routes.js` lists 57 routes.

## Milestones

### M1: failing tests first

Write the tests and run them on the unmodified tree. Record that each one fails, and
how it fails.

- `tests/e2e/public/session-guard.spec.js` uses a plain `page` with
  `interceptFirebaseEndpoints` and `setupApiMocks`, and seeds no user:
  - `goto('/businessconfiguration?id=X&section=__SKILLS__')` ends on `/signin`, and its
    `redirect` query decodes to `{path:'/businessconfiguration', query:{id, section}}`.
  - The same for `/payment`, `/businessphonenumberverification`, `/whatsappweb` and
    `/outboundcalls`, as one parametrised test.
  - Return after sign-in: from that redirect, fill and submit the sign-in form. The
    identitytoolkit mock already answers the password sign-in and `accounts:lookup`.
    The page then lands on `/businessconfiguration` with the original `id` and
    `section`.
- `tests/e2e/auth/session-errors.spec.js` uses `authenticatedPage`. An init script
  (`addInitScript`) installs a MutationObserver that records whether a
  `.p-message-error` or `.p-toast-message-error` ever appears. This matters because a
  toast unmounts with its page, so only a record of every appearance can show it was
  never shown.
  - A backend that does not answer: `route.abort('failed')` on the business and
    variables endpoints for `/businessconfiguration`. A `pageerror` listener collects
    errors, and so does a `console` listener in case WebKit does not report the
    rejection as a page error (which of the two caught it on each project is
    recorded). Expected: no error naming `reading 'status'`, and the page's error
    message visible.
  - A 401 that survives the refresh: the StarChat business endpoints answer 401 every
    time, while `securetoken` answers 200. Expected: `/signin` with `session_expired`
    and a `redirect` back to the page, the session-expired dialog, and the observer
    reporting that no error message or error toast ever appeared. On `60c1522` this
    fails because the inline message appears and the page does not navigate (the
    `router.push` in that catch is commented out).
  - A 401 on a request that carried no Firebase token does not end the session: the
    OAuth code exchange endpoint answers 401, and the person stays signed in. The
    test drives this through the page that calls `OAuth.exchangeCode` if it is
    reachable with the existing mocks; otherwise it lives in the interceptor unit
    test below. It cannot fail on `60c1522`, where that 401 is retried and handed to
    the component without a logout, so it is reported as a regression guard and not
    as a test seen failing.
- `tests/unit/sessionInterceptor.spec.js` (vitest) drives the configured axios
  instance through a mocked adapter, with `auth`, `store` and `router` mocked:
  - concurrent 401s that survive the refresh produce one logout, one push carrying the
    redirect, and every rejection marked as session ended;
  - requests queued during a failed refresh are rejected marked as well;
  - a request that arrives after the session ended is rejected marked as well, with
    no second logout or push;
  - after a non-null user signs in again, a new surviving 401 ends the session again,
    with a fresh redirect;
  - a 401 on a request that carried no `auth` or `Authorization` header is passed
    through unchanged: no refresh, no logout, no mark;
  - a 401 from a third-party origin carrying `Authorization: Bearer` (the Google
    calendar list) is passed through unchanged as well.
  - On `60c1522` this fails because the predicate is not exported.
- `tests/unit/publicRoutes.spec.js`: `publicPaths()` read from the router source
  equals the 17 routes listed in the brief. It is seen failing because `publicPaths`
  does not exist yet.

### M2: routing denies by default

- `src/router/index.js`:
  - remove every `requiresAuth: true`;
  - add `meta: { public: true }` to the 17 public routes, keeping them object literals
    with string-literal paths;
  - the guard computes `const isPublic = to.matched.some(r => r.meta.public)` and runs
    its existing session, admission and role block when the route is not public.
  - Admission, role and `toSignin` code is unchanged.
- `scripts/static-routes.js`: add `publicPaths(source)` next to `declaredPaths`, using
  the same parser, and export it. The static route list is unchanged.

### M3: the interceptor ends the session

`src/firebase/axiosConfig.js`:

- **Scope.** The 401 handling applies only to a request that was sent to one of the
  two backends that take the Firebase token (`VUE_APP_STARCHAT_URL`,
  `VUE_APP_ZYLCH_URL`) and carried a token header (`auth` or `Authorization:
  Bearer`). Both conditions are needed:
  - the header alone is not enough, because `CalendarSelector.vue` sends a Google
    OAuth token as `Bearer` to `googleapis.com`. A 401 from Google would otherwise be
    retried with the Firebase token and end the dashboard session;
  - the origin alone is not enough, because the consent fetch in `OAuthConsent.vue`
    and `OAuth.exchangeCode` call StarChat with no token, and their 401 says nothing
    about the session.

  Every other 401 is passed through unchanged. The origins come from the environment
  in one place in `axiosConfig.js`. `VUE_APP_SERVICE_BASE_URL` is the dashboard's own
  address, used only for payment return URLs, and is not one of them.
- **Queued retries.** A request queued during a refresh is retried with
  `_retry = true`, so a 401 on any retry ends the session.
- **`endSession(error)`.** One function, used on four paths:
  - a 401 on a retried request;
  - a failed refresh, including every request queued behind it (`processQueue`
    rejects them through `endSession`, not with the bare refresh error);
  - a 401 with no Firebase user (line 51 today);
  - any qualifying 401 that arrives after the session has already ended.
- **What `endSession` does.** It marks the error `error.sessionEnded = true` and
  rejects with it, on every call. Only the first call after a sign-in dispatches
  `logout` and pushes
  `{ path: '/signin', query: { redirect: JSON.stringify({ path, query }), session_expired: '1' } }`.
  Here `path` and `query` are those of `router.currentRoute.value`, and the redirect
  is omitted when that route is public.
- **The latch.** The latch that makes this happen once resets only when a non-null
  user signs in: an `onAuthStateChanged` listener that sees a user clears it. Signing
  out (null) never resets it, so a second failure during the logout cannot push from
  `/signin` and lose the redirect.
- **The predicate.** `isSessionEnded(error)` is exported and returns
  `error?.sessionEnded === true`.

### M4: components stop handling 401

For each of the 31 sites listed in the brief, in its file:

- Delete the 401 branch: its logout and its navigation.
- Where the block shows a message or toast, or navigates, for other failures, guard
  that with `if (isSessionEnded(error)) return` (or the block's equivalent early exit
  that keeps its return value), placed before the UI.
- Replace the remaining `error.response.status` reads with `error.response?.status`,
  the 404 checks in `Products.vue` included.
- `GoogleCallback.vue`: return before `router.replace('/onboardinglang')` when the
  session ended.
- Leave any `store`, `router` or `logout` import that is now unused only if lint
  disagrees. Otherwise remove it.

Measured after M4, and recorded here:
- `grep -rnE "(===|==) *401" src` prints only `axiosConfig.js`;
- `grep -rnE "\b(error|err|e|ex|reason)\.response\.(status|data|headers)" src` prints
  only lines already guarded by `?.` or `&&`.

### M5: documentation and full gates

- `docs/ARCHITECTURE.md`: the system map's guard line, the Router section, the
  authenticated request flow (end of session, `isSessionEnded`, `/signin` with
  redirect and `session_expired`), and the Authentication bullets.
- `docs/system-rules.md`: the API communication and error handling bullets, keeping
  the SSE exception.
- `docs/integration/zylch-integration.md`: the passages on 401 handling (around lines
  57-60 and 157).
- `docs/active-context.md`: updated through `doc-end` at closure.
- Gates:
  - full vitest;
  - full Playwright on all three projects;
  - production build in test mode;
  - `node scripts/static-routes.js | wc -l` = 57;
  - the two greps above;
  - `doc-check.py`.

## Progress

- M1 (2026-10-13), on the unmodified `60c1522`:
  - `publicRoutes`: fails, `publicPaths` is not a function.
  - `sessionInterceptor`: 7 of 7 fail, `isSessionEnded` is not a function and the
    refresh runs.
  - `session-guard`: all 6 tests fail on desktop, tablet and mobile; each route stays
    on its own path and is not sent to `/signin`.
  - `session-errors`, aborted backend: fails on all three projects. Chromium reports
    "reading 'status'"; WebKit reports "evaluating 'error.response.status'", through
    `pageerror`. The filter matches both.
  - `session-errors`, surviving 401: fails on all three projects; the page stays on
    `/businessconfiguration`.
- M2 to M4: implemented.
  - Mutation check of the interceptor spec: these faults each fail at least one test:
    re-arming the latch on sign-out, dropping the origin check, rejecting queued
    requests unmarked, and removing the latch.
  - The `ended` shortcut before the retry check changed no outcome, so it was
    removed.
  - `AladdinConfigurator`'s 401 branch was dead: its request is a WebSocket, whose
    errors never carry a response. It is listed beside the SSE stream as outside the
    interceptor.
  - Both acceptance greps are clean. The remaining `.response.data` reads in
    `OAuthConsent.vue` and `AgentSkills.js` sit behind a guard on the preceding line.
  - Build in test mode: passes. Static routes: 57. New tests: 24 of 24 pass on three
    projects.
- Integration review M2 to M4: APPROVED, with two non-blocking notes. Both are taken:
  - `endSession` now waits for `logout` before it pushes, so sign-in does not mount
    on the old user. The surviving-401 browser test checks that the page stays on
    `/signin`.
  - When the first navigation has not finished, the return target is resolved from
    the address bar.

  Each has a unit case, and a mutation that removes it fails that case.
- First full Playwright run after M4: 727 passed, 3 skipped, 6 failed. The failures
  were the retention and restaurant "opens from the menu" tests on all three
  projects.
  - The cause: `setupApiMocks` mocked StarChat but not mrcall-agent, so the
    configuration chat's history request reached the real `zylch-test` backend with
    the mock token and got a 401. The 401 used to be swallowed; it now correctly
    ends the session.
  - Fixed in the shared fixture, not in the two specs. A new `mockAiBackend` in
    `tests/e2e/fixtures/auth.js` registers a catch-all for the `VUE_APP_ZYLCH_URL`
    origin and an empty chat history. `setupAuthPage` calls it before every other
    route, so the routes a spec registers afterwards win.
  - A first placement inside `setupApiMocks` broke the 45 tests of
    `tests/e2e/skills/oauth.spec.js`. That fixture calls `setupApiMocks` a second
    time after registering its own chat routes, so the defaults overrode them.
  - With the defaults moved: `tests/e2e/skills`, retention, restaurant, wizard and
    session-errors pass 186 of 186 on three projects.
- Final gates in the worktree:
  - full vitest: 120 of 120, run with `NODE_OPTIONS=--no-experimental-webstorage`.
    Node 26's built-in localStorage otherwise shadows jsdom's, and
    `skillOAuthIntegration` fails on the unmodified tree too;
  - full Playwright: 733 passed, 3 skipped, 0 failed on desktop, tablet and mobile;
  - `npm run lint:check`: clean;
  - test-mode build: passes;
  - static routes: 57.

## Ownership

The lead implements all milestones in this worktree. There is no delegation:
the 31 edits are each small, context-dependent and in files the lead has already read.
Reviews are performed by fresh reviewers: this plan; an integration review after
M2–M4 before the documentation; a final review through the user path before closure.

## Verification

Every new test is seen failing on `60c1522` and passing after the change. The full
suites are compared with the starting point above. Any existing spec whose expectation
changes, for example one that expected `/login` after a 401, is named in the final
report together with the reason.

## Rollback

There is no persisted data, no backend, and no dependency change. Rollback is a
revert of the commits on `v2.2`, plus a re-deploy of the previous tag
(`v2.2.22-test`) if it was deployed.
