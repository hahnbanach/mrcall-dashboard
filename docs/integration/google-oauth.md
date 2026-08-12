# Google OAuth

Everything the dashboard does with Google goes through one OAuth client in one
Google Cloud project. This file is the inventory: what that client is, what it
may ask for, where the tokens end up, and what state its verification is in.
It exists because none of that was written down anywhere, and the consent screen
configuration is not visible from any repository.

## The client

| | |
|---|---|
| Google Cloud project number | `375340415237` |
| Firebase project | `talkmeapp-e696c` (same project: `VUE_APP_FIREBASE_MESSAGING_SENDER_ID` is the project number) |
| OAuth client ID | `375340415237-8hiphso6n86hd35lnhu4vc7m4fsb1mvh.apps.googleusercontent.com` |
| Client type | Web application |
| Used by | test, beta and production, identically |

The same client ID is in `.env.test`, `.env.beta` and `.env.production`. One
consequence worth knowing before submitting anything for verification: the
client carries all three redirect URIs, so a verification submission is a
submission of a client that also serves `dashboard-test`.

An isolated test project exists but is dormant: `mrcall-test-3a669`, client
`763888490777-...`, commented out in `.env.test`. Reactivating it is not a
one-line change, because `signInWithCredential` requires the Firebase project to
recognise the client that minted the token, so the Google client and the Firebase
project have to move together. That is why the commented block covers both.

| Environment | Redirect URI |
|---|---|
| production | `https://dashboard.mrcall.ai/callback` |
| beta | `https://dashboard-beta.mrcall.ai/callback` |
| test | `https://dashboard-test.mrcall.ai/callback` |
| local | `http://localhost:8080/callback` |

All four are also listed in StarChat's `starchat.google.oauth.allowedRedirectUris`,
which is a second local check on top of Google's own matching.

## Scopes

`ALLOWED_SCOPES` in `src/utils/OAuth.js` is the authoritative list on our side
and must mirror the Google Auth Platform "Data access" page for the client. It
is enforced: `assertScopesAllowed()` runs at every authorization site and throws
rather than sending an unregistered scope. Google shows the unverified-app
interstitial for a scope that is not registered even if it was verified before,
so a mismatch is not a soft failure.

| Scope | Sensitivity | Requested by |
|---|---|---|
| `openid`, `email`, `profile` | non-sensitive | `GoogleSignIn.vue` (sign-in) |
| `https://www.googleapis.com/auth/calendar` | **sensitive** | `ConnectCalendar.vue` (`/account`, `/businessconfiguration`) |

Adding a scope is two changes in this order: register it in the Google console
first, add it to `ALLOWED_SCOPES` second. Doing only the second breaks every
Google flow for every user at once.

`AgentSkillsConfigurator.vue` is the exception worth watching: its scope list
comes from the StarChat skill catalog, not from this repo, so a backend catalog
edit alone can try to request something unregistered. That is exactly what
`assertScopesAllowed` catches, and the user gets
`widgets.agentSkills.oauthScopeUnavailable` instead of a Google warning screen.

### Why the sign-in stays inside the non-sensitive set

Google exempts an authorization request whose scopes are a subset of
name/email/profile from the unverified-app screen, from the test-user list, and
from the 7-day refresh-token expiry. The exemption is evaluated **per request**,
not per project, so it holds only as long as nothing widens the sign-in request.

`include_granted_scopes=true` used to do exactly that widening, on all three
flows. It unions in whatever the user had already granted to the client, so for
anyone who had connected a calendar it turned a plain login into a
sensitive-scope authorization. It has been removed everywhere.

The sign-in also no longer sends `access_type=offline`: Firebase owns the
session and nothing reads a refresh token from the login. The calendar and skill
flows keep both `access_type=offline` and `prompt=consent`, because StarChat
renews those grants server-side and Google returns a refresh token only on a
first grant unless consent is re-requested.

## Where tokens live

Not in the customer document. Since the authorization-system migration they are
in PostgreSQL, table `user_oauth_providers`, primary key `(id, provider)`, with
the token JSON AES-encrypted in `tokens_enc` and the chosen calendar in
`provider_account_id`. `CrmCustomerRecord.oauth` is only a wire format,
synthesized on read and stripped on write.

The single row that matters here is `provider = 'google_calendar'`.

**No credential leaves the server.** `GET /mrcall/v1/{realm}/crm/customer/registry`
returns `oauth.GOOGLE_CALENDAR` as `{connected: true, calendarId}` and nothing
else. It used to include the Google refresh token, and that route authorizes
through `ResellerOwnerResolver`, which resolves a reseller to every customer they
manage and an admin to all of them, so it would return other people's Google
credentials to client-side JavaScript on request. Treat the refresh tokens that
existed before this change as potentially exposed; whether to force-revoke them,
which costs every affected customer a reconnect, is a product decision that
belongs next to the client-secret rotation below.

Connectedness is now a boolean the server asserts, not something the client infers
from a token being present. StarChat's own `readOnly` still returns the token and
is still correct for the calendar atoms, which run in the same JVM: it is the HTTP
path that changed (`readForWire`).

**`oauth.GOOGLE` is not a second row.** It never was. StarChat's
`extractGoogleCalendarTokens` used to accept either key and write both into that
one row, which meant a sign-in payload carrying a refresh token would overwrite a
real calendar connection: tokens replaced, scopes replaced by a hardcoded guess,
and `provider_account_id` reset to NULL, silently discarding the calendar the
user had picked. Two changes closed that:

- the dashboard sign-in no longer writes `oauth.GOOGLE` at all
  (`GoogleCallback.vue`), and
- StarChat honours only `oauth.GOOGLE_CALENDAR`, logging a warning if a caller
  still sends `oauth.GOOGLE` (`FirebaseCustomerRegistryService.scala`).

The warning is the migration signal: once it stops appearing in the logs, no
client is sending the old shape any more.

## Secrets

The client secret is held by StarChat and nowhere else. The dashboard exchanges
its authorization code through `POST /mrcall/v1/mrcall0/oauth/google/token`
(`GoogleAuthFlow.exchangeCode`) precisely so the secret never reaches a bundle.

Do not put `VUE_APP_GOOGLE_CLIENT_SECRET` in any `.env` file, commented out or
otherwise: vue-cli inlines every `VUE_APP_*` value into the bundle.

Rotating it is a Google console operation followed by an update to each
environment's secret. Google keeps both the old and the new secret valid until
the old one is explicitly disabled, so the order matters: add the new value,
roll every environment onto it, confirm, and only then disable the old one.
Disabling is reversible; deleting is not.

Because one OAuth client serves all three environments, a rotation cannot be
atomic: the previous value has to stay valid until the last environment has the
new one. Isolating the environments on separate clients would shorten that
window.

Credential state and any outstanding rotation are tracked outside this
repository, which is public.

`GOOGLE_CLIENT_ID_DEFAULT` / `GOOGLE_CLIENT_ID_TEST` are declared in
`application.conf` but injected by no deployment, so pointing an environment at a
different OAuth client currently needs a config edit, not just a secret change.

## Publishing and verification status

**Publishing status is In production.** Not read from the console, which no
repository records, but established from production behaviour on 2026-08-11, and
worth writing down because the alternative would have been serious.

An app in Testing issues refresh tokens that expire after seven days. In
production, the large majority of active `google_calendar` rows in
`user_oauth_providers` carry a token last written far more than seven days
earlier, most of them more than ninety days, the oldest around seven months. Over
a full day of logs across every replica, calendar operations succeed and there is
not a single `invalid_grant`, `invalid_client` or "token expired or revoked".
Seven-day expiry is incompatible with both observations at once.

The practical consequence, and the reason this matters beyond curiosity: **nobody
has to re-authorize their calendar on a schedule.** The stored refresh token is
durable, and the sign-in no longer needs to renew it as a side effect, which it
used to do accidentally and destructively (see the note on `oauth.GOOGLE` above).

The query that establishes it, aggregate only, no token values and no personal
data, against `user_oauth_providers` where `provider = 'google_calendar'`: count
the rows with `revoked_at IS NULL`, and of those the ones whose `updated_at` is
older than seven and ninety days. Re-run it if the sign-in flow changes again.

Still unknown and still only readable from the console for project
`375340415237`: whether verification for the sensitive calendar scope has been
granted, and whether brand verification has passed. In production and unverified
is a valid state, and the one that produces the interstitial on the calendar
connect.

| Page | URL |
|---|---|
| Overview | `console.cloud.google.com/auth/overview` |
| Branding | `console.cloud.google.com/auth/branding` |
| Audience | `console.cloud.google.com/auth/audience` |
| Data access | `console.cloud.google.com/auth/scopes` |
| Verification Center | `console.cloud.google.com/auth/verification` |

### Reading the warning screen

Two different interstitials share the headline "Google hasn't verified this app".
The body distinguishes them, and they have different causes:

- *"...currently being tested. You should only continue if you know the
  developer"* means publishing status is Testing. Comes with a 100 test-user cap
  and 7-day refresh tokens.
- *"...requesting access to sensitive info in your Google Account"* means a
  sensitive scope was requested by a client that is not verified for it.

The email shown in that text is the User Support Email from the Branding page.

Because `auth/calendar` is a sensitive scope, the second screen is expected on
the calendar connect until verification completes. It should **not** appear on
sign-in: if it does, capture the outgoing request to
`accounts.google.com/o/oauth2/v2/auth` and read its raw `scope` parameter before
assuming anything else.

### If verification is pursued

`auth/calendar` is sensitive, not restricted, so it needs standard verification:
no CASA security assessment, no annual re-verification, Google's own estimate
around 10 business days for one review round. Prerequisites, in the order the
console enforces them: branding published first (homepage, privacy policy and
terms URLs on a domain verified as a **Domain property** in Search Console by a
project Owner), then publishing status In production, then the scope registered
on Data access, then the submission itself with per-scope justification and a
demo video showing the consent screen and the actual feature that consumes the
scope.

Worth settling before submitting rather than after: whether the product needs
full `auth/calendar` at all. It was narrowed to `calendar.events.owned` once and
widened back when the calendar picker arrived, since `CalendarSelector.vue` lists
`calendar/v3/users/me/calendarList`. A narrower scope, or MrCall owning a
calendar it creates itself, would remove the cause instead of licensing it.

## Changing any of this

Test environment first, both repos. The dashboard and StarChat sides of the
`oauth.GOOGLE` change are coupled, and the failure mode of getting it wrong is a
silently emptied `provider_account_id`, which nobody notices until a booking does
not land in a calendar.
