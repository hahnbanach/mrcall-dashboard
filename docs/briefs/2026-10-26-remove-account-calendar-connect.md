# Remove the account-level Google Calendar connect

## Intent and authority

Angelo, 2026-10-26: the old ways of connecting Google Calendar leave the dashboard, and only the
new one stays. The calendar card goes from the Account page (`/account`, Integrations) and from
the `__SEND_DATA__` section of the business configuration. Calendar connections are made by the
skill itself. StarChat is not changed.

## Evidence

- One component, `src/components/ConnectCalendar.vue`, is mounted in both places
  (`src/views/Account.vue`, Integrations card; `src/views/business/BusinessConfiguration.vue`,
  inside the `__SEND_DATA__` section, above that section's own StarChat variables).
- It is the account-level flow: it sets `localStorage.oauthFlow = 'calendar'`, asks Google for
  `auth/calendar`, and `GoogleCallback.vue` then shows `CalendarSelector.vue` (which reads
  `calendar/v3/users/me/calendarList` with the browser's access token) and writes the token and
  the chosen calendar to the customer registry through `OAuthHelper.updateGoogleCalendarCredentials`
  (`PUT /mrcall/v1/mrcall0/crm/customer/registry`, `oauth.GOOGLE_CALENDAR`). Connection state lives
  in the Vuex module `src/store/modules/calendar.js`, read only by `ConnectCalendar.vue`.
- The skill flows are separate and stay: the chat handoff bound by `oauthSkillContext`, and the
  manual skill editor (`AgentSkillsConfigurator.vue`, `oauthProvider`), both posting to
  `POST /mrcall/v1/mrcall0/oauth/providers/google_calendar/connect` with a business and a grant
  name. Calendar choice for a skill is `CalendarField.vue`, served by StarChat's
  `/oauth/providers/google_calendar/calendars`, not by the browser.
- `GoogleSignIn.vue` clears `oauthFlow` only to undo an abandoned account-level connect.
- The manual editor stores `props.businessId || ''` as `oauthBusinessId`
  (`AgentSkillsConfigurator.vue`), and its callback branch posts it to `/connect` unchecked.

## StarChat facts

Answered by a StarChat session on 2026-10-26, from source at 9.34 HEAD `ba76bda1b` (the cited files
are identical in 9.34.86). Code reading, not a measurement on the production database or logs.

- Account-level and per-skill grants are distinct rows: the key of `user_oauth_providers` is
  `(id, provider, business_id, grant_name)`. The registry PUT writes `business_id = ''` and
  `grant_name = ''`; `/connect` writes the business and grant name from its body.
- No calendar skill reaches the account-level row: skill lookups require `business_id` to equal the
  conversation's business, and fall back on an empty grant name only, never on an empty business.
- Today the account-level row is read by the registry GET (what this dashboard showed), by
  `/oauth/providers/google_calendar/calendars` called without business and grant (the dashboard
  always sends both), and by code with no callers. The external analyzer artifact was not read.
- `/connect` with a missing or empty `businessId` writes the account-level row.
- An existing account-level connection remains revocable server-side by its owner through
  `DELETE /mrcall/v1/{realm}/oauth/providers/google_calendar` with neither business nor grant name;
  it does not touch per-skill grants.

## Scope

Delete the account-level flow end to end, with no remaining reader or writer of it in the
dashboard:

- Source: `ConnectCalendar.vue`, `CalendarSelector.vue`, `src/store/modules/calendar.js` and its
  registration in `src/store/index.js`, `OAuthHelper.getGoogleCalendarCredentials` /
  `updateGoogleCalendarCredentials`, the calendar branch of `GoogleCallback.vue` (`oauthFlow`,
  picker, registry write) and its sign-in comment claiming a StarChat fallback to account-level
  records (contradicted by the facts above), the `oauthFlow` cleanup in `GoogleSignIn.vue`, the card
  in `Account.vue` (the Integrations section keeps the MCP connectors card), the block in
  `BusinessConfiguration.vue` (the `__SEND_DATA__` section keeps its variables).
- The one skill-flow change: the manual skill branch of `GoogleCallback.vue` fails the callback
  (its existing failure handling) when `oauthBusinessId` is empty, instead of posting `/connect`.
  Without it the dashboard would keep one path that writes an account-level calendar row.
- Translations: the `components.connectCalendar.*` keys in all 12 locales.
- Tests: the e2e case `legacy calendar callback keeps calendar selection and registry path without
  skill binding` (`tests/e2e/skills/oauth.spec.js`), the `calendarList` route in
  `tests/e2e/fixtures/skill-oauth.js` that serves only it, and the `ConnectCalendar section` case in
  `tests/e2e/auth/account.spec.js`. The fixture's registry route and the `registryWrites` empty
  checks in `oauth.spec.js` stay: they prove the skill callbacks write no account-level row.
- Documentation: `docs/integration/google-oauth.md` (scopes table, calendar flow, calendar picker
  narrative, and the table key, which becomes the four-column key above), `docs/ARCHITECTURE.md`
  (store module, `GoogleAuthFlow` users), `docs/system-rules.md` (store module list),
  `docs/integration/zylch-integration.md` (legacy calendar flow mention), the `docs/README.md` index
  row for `google-oauth.md`.

Out of scope: StarChat; account-level rows already stored server-side; the sign-in flow's scopes;
the skill flows' behaviour, except the empty-business guard above.

## Constraints

- No StarChat change. Facts about StarChat come from a StarChat session, not from guesses.
- A callback arriving with a stale `oauthFlow = 'calendar'` (a connect started before the deploy)
  is handled as an ordinary sign-in; the key is inert once nothing reads it.
- Translation catalogues lose the keys in the same commit that loses their last reader.

## Acceptance

1. No source, test or indexed doc names `ConnectCalendar`, `CalendarSelector`, the calendar store
   module, the two registry helpers, `oauthFlow`, or `components.connectCalendar` (grep over
   `src`, `tests`, `docs` excluding the archive, briefs and plans).
2. `/account` shows the Integrations section with the MCP connectors card only; the `__SEND_DATA__`
   section renders its variables and no calendar card (browser tests on desktop, tablet, mobile).
3. Skill OAuth (bound chat handoff and manual editor) and Google sign-in behave as before. Their
   tests pass, the only deletions being the two test cases and the fixture route named in Scope; the `registryWrites` empty
   checks remain.
4. A test shows the manual skill callback with an empty business posts nothing to `/connect` and
   writes nothing to the registry, observed failing before the guard.
5. Lint, full vitest, full Playwright green.
6. `doc-critic` over the documentation files in Scope reports no STALE claim.

## Assumptions

- Removing the UI leaves any account-level connection already stored on the server untouched, and
  without a dashboard control to view or revoke it. Per the StarChat facts no skill reads that row,
  so nothing a customer configured stops working; the owner can still revoke it through the
  StarChat DELETE route.
- With the guard, a manual skill connect from a page without a business fails after Google consent
  and returns silently to the configuration. Business configuration always carries a business, so
  this path is not reachable from the current UI; it is a guard, not a feature.
