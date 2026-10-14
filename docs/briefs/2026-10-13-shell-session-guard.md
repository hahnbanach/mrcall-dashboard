# The shell asks for a session before it draws a page that needs one

## Intent and authority

Two defects in the dashboard shell, found while the restaurant page was being tried
on test and present on `v2.2` at `60c1522`. Angelo approved fixing both, in one
piece of work, on 2026-10-13. Commit, tag and deployment are authorized separately.

1. A deep link such as `/businessconfiguration?id=…&section=…` opened without a
   session renders the shell with an empty menu, an empty centre and "Sign in" in
   the header, instead of sending the person to sign in and back.
2. When a request fails with no response at all (network error, CORS refusal,
   backend down), catch blocks that read `error.response.status` throw
   "Cannot read properties of undefined (reading 'status')" from inside the catch.
   The rest of the handler is skipped and the error surfaces as an uncaught runtime
   error (the development overlay shows it).

## Evidence

**Routing** (`src/router/index.js`). The routes array holds 61 routes. The guard asks
for a session only on routes that carry `meta.requiresAuth`, which 39 do, so a route
without it is public by omission. Of the 22 without it, five read
`store.state.user.accessToken` to call the API and cannot cope with a missing session:

| Route | Reads the user in |
|---|---|
| `/businessconfiguration` | `views/business/BusinessConfiguration.vue` |
| `/payment` | `views/Payment.vue` |
| `/businessphonenumberverification` | `components/BusinessPhoneNumberVerification.vue` |
| `/whatsappweb` | `components/Whatsappweb.vue` (waits for a user that never comes) |
| `/outboundcalls` | `components/SubmitOutboundCall.vue` |

`/businessconfiguration` has lacked the flag since the repository's first commit.
The other 17 are public by design, or handle a missing user themselves:
- `/`, which redirects to sign-in;
- the sign-in flows: `/signin`, `/login` (the same component), `/signup`,
  `/magiclink`, `/customtokenlogin`, `/callback`;
- `/oauth/authorize`, which embeds its own sign-in;
- the four payment-result pages, which check for a missing user and are covered by
  `tests/e2e/public/payment-pages.spec.js`;
- the information pages: `/privacypolicy`, `/termsandconditions`,
  `/callforwardingguide`, `/partnerprogram`;
- the catch-all.

The only other reader of route meta is `App.vue` (`meta.bare`), which is unaffected.
`scripts/static-routes.js` reads this file as a syntax tree at deploy time and needs
routes written as object literals with string-literal paths.

**Error handling.** The Axios interceptor in `src/firebase/axiosConfig.js` handles a 401
as follows:
- It refreshes the token and retries the request.
- If the refresh fails, it logs out and goes to `/login`, without `redirect` and
  without `session_expired`. `Signin.vue` can already show a "session expired" dialog
  for `session_expired`, but nothing sets it.
- A direct retry carries `_retry`, so if the server answers 401 again the error passes
  through to the component.
- Requests queued during a refresh are retried without `_retry`, so a second 401 on
  one of them starts a new refresh.

Outside the interceptor there are 31 checks for 401 in 19 files, and each handles the
401 again on its own: logout, then `/login`, `/signin` or `/`. 20 of these checks, plus
two 404 checks in `components/Products.vue` (149, 224), read `error.response.status`
without a guard. The sites:

- `components/Businesses.vue` 773, 804
- `components/Subscription.vue` 150, 206, 272, 297
- `components/Plans.vue` 76
- `components/DeleteAccount.vue` 89
- `components/DeleteContacts.vue` 108
- `components/AnalyticsAdmin.vue` 594
- `components/Analytics.vue` 431
- `components/SubmitOutboundCall.vue` 82
- `components/Conversations.vue` 802, 876
- `components/BusinessPhoneNumberVerification.vue` 229, 272
- `components/Products.vue` 151, 194, 226, 288, 333, 379
- `components/templates/sign/GoogleCallback.vue` 256
- `components/widgets/FetchWebDataPerplexity.vue` 112
- `components/widgets/FetchWebData.vue` 112
- `views/PlanAndProducts.vue` 58
- `views/Plan.vue` 53
- `views/business/BusinessConfiguration.vue` 839, 1075
- `views/business/AladdinConfigurator.vue` 165
- `views/onboarding/OnboardingSearchBusiness.vue` 447

Several of these blocks do something visible in their 401 branch. `Analytics` and
`AnalyticsAdmin` return without a toast. The if/else blocks in `Subscription`,
`SubmitOutboundCall`, `Products` and `FetchWebData*` show their failure toast only
when the answer is not a 401. `GoogleCallback` goes to `/onboardinglang` only when it
is not a 401. Removing those branches alone would put a failure toast, or a
navigation that races the interceptor's, on top of the logout.

## Scope

- **Routing denies by default.** A route needs a session unless it declares
  `meta.public`; `requiresAuth` disappears. The public set is exactly the 17 routes
  above. Routes stay object literals with string-literal paths. Role checks, email
  verification (`isAdmitted` in `src/firebase/admission.js`) and the
  redirect-with-query behaviour are unchanged.
- **The interceptor is the only owner of a 401.** A 401 that survives a refresh ends
  the session, whether the retry was direct or queued; so does a failed refresh. When
  the session ends, the interceptor logs out and sends the person to `/signin` with
  `redirect` set to the current route (as the guard does) and `session_expired` set,
  so the existing dialog appears. It rejects the request with an error that a named
  predicate exported from `axiosConfig.js` recognises as "the session ended".
- **Components stop handling 401.** Each of the 31 sites drops its 401 branch. Where
  a block shows a failure message, a toast or navigates, it skips those for an error
  the predicate recognises, because the interceptor has already acted. The block's
  handling of every other failure stays as it is.
- **No catch block assumes a response.** None of the remaining reads of
  `error.response` in a catch block assumes that a response exists, the two 404
  checks included.
- **Tests, each seen failing on `60c1522` first:**
  - Browser: a deep link to `/businessconfiguration` without a session lands on
    `/signin` carrying the redirect, and signing in returns to that link with its query.
  - Browser: on the business configuration page, a backend that does not answer is
    reported in the page and raises no page error.
  - Browser: a 401 that survives the refresh ends on `/signin` with the
    session-expired dialog, and shows no failure toast from the page.
  - Unit: the public route set, read from the router source the way
    `scripts/static-routes.js` reads it, so that making a route public is a deliberate
    edit in two places.

## Constraints

- Authenticated requests keep using the configured Axios instance and its interceptor.
- The AI chat SSE client (`src/utils/Zylch.js`, native fetch) stays out of scope, as
  already recorded in `docs/harness-backlog.md`. The documentation of the
  interceptor's ownership states this exception.
- No new user-facing string unless a block loses the only message it had. If one is
  needed, it goes into all 12 locales.
- Do not touch `RestaurantBook.vue` or the restaurant menu check in
  `BusinessConfiguration.vue`: `restaurant-tables-page` changes them and will be
  delivered separately.

## Acceptance

- Full vitest and full Playwright (desktop, tablet, mobile) pass, and the new tests
  were seen failing on `60c1522`.
- A grep over `src` finds no `401` check outside `src/firebase/axiosConfig.js`, and no
  read of `error.response.` or `err.response.` that assumes a response.
- A production build in test mode succeeds, and `node scripts/static-routes.js` still
  lists the same 57 static routes.
- `docs/ARCHITECTURE.md` and `docs/system-rules.md` state the deny-by-default rule,
  the interceptor's ownership of 401 and its SSE exception.

## Assumptions

- A 401 on a request retried with a freshly refreshed token means the server refuses
  this identity, and ending the session is the right answer. The component branches
  do this today.
- Being public does not change how the payment-result pages, `/oauth/authorize` or
  the information pages behave for a signed-in person.
