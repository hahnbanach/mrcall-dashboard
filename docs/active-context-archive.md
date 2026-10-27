
## 2026-10-27 — Booking source candidate before TEST publication

The v2.2.36 booking-connect candidate implements the existing Google consent button,
calendar selection by name and scoped activation of five prepared skills. Local acceptance
passes 46 affected browser cases, 19 booking cases, two component identity checks, five
final browser reruns and three layout sizes. Production-mode TEST build and lint pass.
M1 integration is approved; source closure and final publication approval remain pending.
See the [plan](execution-plans/2026-10-27-booking-connect-activate.md) and
[evidence](evaluations/2026-10-27-booking-connect-activate.md).

The source baseline is fd4c94d, matching successful TEST workflow40482572038 for
v2.2.35-test. This candidate is not yet deployed. Production retains the separately
published v2.2.34 release; this work authorizes only TEST. The baseline includes readable
skill previews, confirmed Save refresh, business-wide consent, call-insights screens and
removal of the account-level connection. The dirty v2.1 checkout is untouched.

# Active context archive

Historical snapshots preserved verbatim, newest first. This cold storage is not
startup context; it records prior state without making current capability claims.

## 2026-10-27 — Baseline before booking continuation

- Push `v2.2`; deploying it to test needs its own authorization, and it is the release that
  removes the calendar connect from `/account` on the live domains.

Production and test run `v2.2.34-production` and `v2.2.34-test`, both on `a1897a3`. That commit
sits on branch `v2.2.34`, cut from `v2.2` at `c2b2a58`, not on the `v2.2` line. It carries
readable skill previews, the refresh of saved skills after a confirmed Save
([brief](briefs/2026-10-26-skill-save-refresh.md),
[plan](execution-plans/2026-10-26-skill-save-refresh.md)), and the business-wide calendar
consent beside a chat proposal. It still shows the account-level calendar connect on `/account`
and a calendar block in `__SEND_DATA__`.

Branch `v2.2` (not deployed) now merges `v2.2.34`, so the line contains what production runs,
together with:

- the call-insights reports and their review screens, and the skill catalogue's `addable` flag;
- a new skill instance taking its phase's default;
- the removal of every calendar connection outside the skills: none on `/account`, none in
  `__SEND_DATA__`, and the manual skill callback refuses a connect without a business
  ([brief](briefs/2026-10-26-remove-account-calendar-connect.md),
  [plan](execution-plans/2026-10-26-remove-account-calendar-connect.md)). The business-wide
  consent from the chat stays; see [Google OAuth](integration/google-oauth.md);
- the dashboard load brief and plan, not yet implemented
  ([plan](execution-plans/2026-10-23-dashboard-load.md)).

## 2026-10-27 — v2.2.34 line, before it merged into v2.2

# Active Context

<!-- archived-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- archived-scope:end -->

## State now

Production runs v2.2.34-production on the same tested a1897a3 commit
(successful workflow40336664459, served app.2fa78ebf.js). All104 index JS/CSS
assets returnHTTP200 with names matching production CI; refresh markers and
production backend references are present. The operator reports TEST passed and
explicitly authorizes this production promotion. TEST runs
v2.2.34-test on a1897a3 (successful workflow40335393257). The observed served
app.b0847d40.js contains the refresh markers; all104 index JS/CSS assets return
HTTP200 with filenames matching CI. The release starts from clean a775f4d.
It refreshes confirmed saved skill phases in the mounted parent while preserving
ordinary/dirty skill edits and owner/business identity. Coalesced reads protect
successive saves; the [plan](execution-plans/2026-10-26-skill-save-refresh.md)
records completed integration/final gates and actual verification.

Retained13:10 TEST readback confirms the reported calendar Save: skill and
business reads agree on the enabled instance, pending is cleared and Save has
confirmed readback. An
existing subsequent call invokes the loaded skill and reads calendar availability.
That is not proof of booking creation or an explanation of the earlier callback
response. The initial account-only grant observation is historical: subsequent
read-only metadata now includes an active exact-business/default grant.

The UI defect is reproduced locally on prior released8190c4b source: confirmed Save leaves
zero displayed instances until page reload, while mocked server state has one
enabled instance. The final47 affected browser cases pass on the exact frozen build; independent
integration review approves coalescing overlapping saves, failed-read recovery and
unsaved-edit/identity guards.
No live Save, consent, call or model trial is part of this UI repair verification.

Session ownership remains with the deployed guard: every nonpublic route needs a
session, the Axios interceptor alone ends it, and components suppress failure UI
for isSessionEnded. Local browser fixtures use mocked backend calls.

## Unresolved

- Outside this Save assignment, the first callback response remains unexplained. Retained runtime
  correlation exists, but available exact-ID and bounded-time call-history reads
  return no record under the available identity; archived trace access is unknown.
- The repaired UI has local mocked-browser acceptance, the operator's reported
  TEST acceptance and both environments' published-artifact checks. No new live
  production Save is performed by this deployment task.
- Actual booking creation is unverified; availability and Save are separate facts.
- AI chat SSE uses native fetch and bypasses the Axios interceptor; WebSockets do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Retained unit-test timing and mobile OAuth enable-wait instability remain open.

## Next

Keep Save and its consistent view within the reviewed boundary; use the retained
regressions for subsequent changes.
Preserve unsaved edits, pending operations and exact business grant boundaries.
Booking setup and first callback diagnosis remain assigned to another session.
This same-code dashboard promotion changes no backend deployment, provider grant
or saved customer configuration.

## 2026-10-27 — v2.2 line, before it absorbed v2.2.34

# Active Context

<!-- archived-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- archived-scope:end -->

## State now

Production and beta run `v2.2.21` (`6d3b5dd`, a commit on `v2.2.19`). It carries the
restaurant booking page, the hiding of platform-only skill fields from owners, and
the credit balance shown net of debt. A balance that StarChat does not give is shown
as a dash, not as zero. Each deployment was checked on its live domain: served
bundle, 57 static routes and the Businesses page.

Test runs `v2.2.24`, the tip of branch `v2.2`. It carries the restaurant bookings
page on named tables, which needs StarChat 9.34.68 or later (9.34.69 for the
tables) on the same environment; see
[the restaurant integration](integration/restaurant-booking.md). Production stays
off until StarChat reaches production. It also carries the Configure-via-chat
skill work, which needs the mrcall-agent deployed on test: the
agent on beta and production lacks the pending and reconcile endpoints, and the
skill fields of apply-changes. See the
[integration contract](integration/zylch-integration.md).

And it carries the session guard and the single owner of 401
([brief](briefs/2026-10-13-shell-session-guard.md),
[plan](execution-plans/2026-10-13-shell-session-guard.md)):

- Every route needs a session unless it declares `meta.public`.
- The Axios interceptor alone ends a session. Components skip their failure UI
  for `isSessionEnded(error)`.
- The browser-test fixture mocks mrcall-agent, as it already mocked StarChat.

Before release: vitest 120 of 120, and Playwright 733 passed with 3 skipped on
desktop, tablet and mobile. On the test domain, a fresh browser without a session is
sent from a deep link to sign-in with the full link to return to, and a public page
stays open. With a real session, the configuration page and its chat load, and the
session stays open. The session-expired dialog is covered only by the browser
tests, because it needs a real session that the server refuses.

Branch `remove-legacy-calendar` (off `v2.2`, not deployed) removes the
account-level Google Calendar connect from `/account` and from the `__SEND_DATA__` section; Google
Calendar is authorized per skill only
([brief](briefs/2026-10-26-remove-account-calendar-connect.md),
[plan](execution-plans/2026-10-26-remove-account-calendar-connect.md)). StarChat is unchanged.
Lint, vitest 405 of 405 and the full Playwright suite pass on it, apart from the intermittent
failures below.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor;
  see [harness-backlog](harness-backlog.md).
- WebSocket connections (Whatsappweb, the Aladdin configurator, TestChat, the
  webcall text chat and voice button) do not pass through the interceptor either.
- Real model quality, and actual Google consent and provider grants, remain
  unverified.
- `tests/unit/skillsOwnerSave.spec.js` takes 3.5 to 5.3 s against a 5 s timeout
  in a fresh worktree, and can time out there.
- `tests/e2e/skills/oauth.spec.js` fails intermittently on the tablet and mobile projects:
  on 2026-10-26, with `--repeat-each=3`, 4 of 12 runs of two of its cases failed on tablet on
  the unmodified `v2.2` tree. Under a full run, `admin.spec.js` (mobile) and
  `analytics-insights.spec.js:388` (desktop) also failed once and passed alone. The cause is not
  yet measured.
- The `__BOOKING__` section is not legacy: StarChat (source at 9.34 HEAD `ba76bda1b`) serves in it
  `BOOKING_TRIGGER` and `NO_BOOKING_INSTRUCTIONS` (the no-booking prompt) and the hidden
  `BOOKING_CALENDAR_ID` (a skill's fallback calendar, which businesses booking through the
  platform's service account rely on). Hiding it needs those variables moved first, on the
  StarChat side; the dashboard only names it in `menuGroups`. Awaiting Angelo's decision and a
  read-only production measurement by StarChat.

## Next

- Bring the session guard to production: either with the whole `v2.2` line once
  mrcall-agent and StarChat are promoted, or as a tag on `v2.2.21`. Either way
  needs authorization.
- Land `remove-legacy-calendar` on `v2.2` and deploy it to test; both need authorization.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first,
  plus authorization.

## 2026-10-26 — Before operator-authorized production promotion

# Active Context

<!-- archived-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- archived-scope:end -->

## State now

Production remains v2.2.25 in the last observed delivery evidence. TEST runs
v2.2.34-test on a1897a3 (successful workflow40335393257). The observed served
app.b0847d40.js contains the refresh markers; all104 index JS/CSS assets return
HTTP200 with filenames matching CI. The release starts from clean a775f4d.
It refreshes confirmed saved skill phases in the mounted parent while preserving
ordinary/dirty skill edits and owner/business identity. Coalesced reads protect
successive saves; the [plan](execution-plans/2026-10-26-skill-save-refresh.md)
records completed integration/final gates and actual verification.

Retained13:10 TEST readback confirms the reported calendar Save: skill and
business reads agree on the enabled instance, pending is cleared and Save has
confirmed readback. An
existing subsequent call invokes the loaded skill and reads calendar availability.
That is not proof of booking creation or an explanation of the earlier callback
response. The initial account-only grant observation is historical: subsequent
read-only metadata now includes an active exact-business/default grant.

The UI defect is reproduced locally on prior released8190c4b source: confirmed Save leaves
zero displayed instances until page reload, while mocked server state has one
enabled instance. The final47 affected browser cases pass on the exact frozen build; independent
integration review approves coalescing overlapping saves, failed-read recovery and
unsaved-edit/identity guards.
No live Save, consent, call or model trial is part of this UI repair verification.

Session ownership remains with the deployed guard: every nonpublic route needs a
session, the Axios interceptor alone ends it, and components suppress failure UI
for isSessionEnded. Local browser fixtures use mocked backend calls.

## Unresolved

- Outside this Save assignment, the first callback response remains unexplained. Retained runtime
  correlation exists, but available exact-ID and bounded-time call-history reads
  return no record under the available identity; archived trace access is unknown.
- The repaired UI has local mocked-browser acceptance and published-artifact
  checks; a new live user Save on this release was not performed.
- Actual booking creation is unverified; availability and Save are separate facts.
- AI chat SSE uses native fetch and bypasses the Axios interceptor; WebSockets do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Retained unit-test timing and mobile OAuth enable-wait instability remain open.

## Next

Keep Save and its consistent view within the reviewed boundary; use the retained
regressions for subsequent changes.
Preserve unsaved edits, pending operations and exact business grant boundaries.
The operator assigns booking setup and first callback diagnosis to another session; no new
provider/model action or production promotion is authorized by this UI work.


## 2026-10-26 — Before Save refresh TEST publication

# Active Context

<!-- archived-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- archived-scope:end -->

## State now

Production remains v2.2.25 in the last observed delivery evidence. TEST runs
v2.2.33-test on8190c4b (workflow40318787864, observed served app.c34fcf69.js).
The local v2.2.34 refresh candidate starts from clean a775f4d and is unpublished.
It refreshes confirmed saved skill phases in the mounted parent while preserving
ordinary/dirty skill edits and owner/business identity. Coalesced reads protect
successive saves; the [plan](execution-plans/2026-10-26-skill-save-refresh.md)
tracks the remaining integration/final gates and actual verification.

The reported calendar draft is saved and enabled on TEST: authoritative skill and
business reads agree, pending is cleared, and Save has confirmed readback. An
existing subsequent call invokes the loaded skill and reads calendar availability.
That is not proof of booking creation or an explanation of the earlier callback
response. The initial account-only grant observation is historical: subsequent
read-only metadata now includes an active exact-business/default grant.

The UI defect is reproduced locally on released source: confirmed Save leaves
zero displayed instances until page reload, while mocked server state has one
enabled instance. The final47 affected browser cases pass on the exact frozen build; independent
integration review approves coalescing overlapping saves, failed-read recovery and
unsaved-edit/identity guards.
No live Save, consent, call or model trial is part of this UI repair verification.

Session ownership remains with the deployed guard: every nonpublic route needs a
session, the Axios interceptor alone ends it, and components suppress failure UI
for isSessionEnded. Local browser fixtures use mocked backend calls.

## Unresolved

- Outside this Save assignment, the first callback response remains unexplained. Retained runtime
  correlation exists, but available exact-ID and bounded-time call-history reads
  return no record under the available identity; archived trace access is unknown.
- The refresh repair needs final approval and authorized TEST publication.
- Actual booking creation is unverified; availability and Save are separate facts.
- AI chat SSE uses native fetch and bypasses the Axios interceptor; WebSockets do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Retained unit-test timing and mobile OAuth enable-wait instability remain open.

## Next

Finish final review and authorized TEST rollout for Save and its consistent view.
Preserve unsaved edits, pending operations and exact business grant boundaries.
The operator assigns booking setup and first callback diagnosis to another session; no new
provider/model action or production promotion is authorized by this UI work.


## 2026-10-26 — Before confirmed Save view refresh

# Active Context

<!-- archived-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- archived-scope:end -->

## State now

The last successful deployment workflows observed by the lead report production
v2.2.25 and TEST v2.2.33-test. TEST workflow 40318787864 succeeded on commit
8190c4b; its 104 public index JS/CSS asset names match the CI build and return
HTTP 200, including app.c34fcf69.js. This does not verify every deployed feature.
The release starts from exact prior TEST commit c2b2a589, preserving the deployed
session guard, manifest-driven editor and legacy callback/provider identity.

The TEST release has readable pending skill summaries and collapsed exact details,
safe resource-refusal guidance, and explicit business-bound Google consent.
Account retains its global flow with clarified wording. Assistant configuration
separates account metadata from default business availability; negative or
malformed checks remain unknown. Pending proposals and explicit Save/probe remain
unchanged. See the [plan](execution-plans/2026-10-26-readable-skill-preview.md),
[chat contract](integration/zylch-integration.md) and
[Google contract](integration/google-oauth.md).

The released candidate's local scripted acceptance is recorded in its scoped
receipts, separately from the historical dirty-tree 110-case candidate. Read-only
TEST evidence identifies an account connection matching the requested calendar
and no business grant; it does not establish fresh provider access. Real Google
consent and live skill Save/activation remain open. Read-only authenticated
browser verification is qualified separately in the release plan.

Session ownership remains with the deployed guard: every route requires a session
unless public, the Axios interceptor alone ends it, and components suppress
failure UI for isSessionEnded. The browser fixture retains mocked backend calls.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor;
  see [harness-backlog](harness-backlog.md).
- WebSocket connections do not pass through that interceptor.
- Real model quality, Google consent/provider grants and actual enabled skill
  Save/activation are unverified. A positive availability check is not a booking.
- The retained unit-test timing and repeated mobile OAuth enable-wait instability
  remain unresolved; one passing candidate run does not establish their cause.

## Next

Complete the separately bounded provider-consent and live Save acceptance when
authorized. Preserve unknown pending operations and exact business grant boundaries.
Production/beta promotion and actual provider consent require their own authority.


## 2026-10-26 — Before authorized dashboard TEST release

# Active Context

<!-- archived-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- archived-scope:end -->

## State now

The last successful deployment workflows observed by the lead report production
v2.2.25 and TEST v2.2.32. Those workflow reports are deployment evidence, not a
fresh browser verification of every deployed feature. The current unpublished
v2.2.33 candidate starts from exact TEST commit c2b2a589, preserving the deployed
session guard, manifest-driven editor and legacy callback/provider identity.

The candidate has readable pending skill summaries and collapsed exact details,
safe resource-refusal guidance, and explicit business-bound Google consent.
Account retains its global flow with clarified wording. Assistant configuration
separates account metadata from default business availability; negative or
malformed checks remain unknown. Pending proposals and explicit Save/probe remain
unchanged. See the [plan](execution-plans/2026-10-26-readable-skill-preview.md),
[chat contract](integration/zylch-integration.md) and
[Google contract](integration/google-oauth.md).

The current candidate's local scripted acceptance is recorded in its scoped
receipts, separately from the historical dirty-tree 110-case candidate. Read-only
TEST evidence identifies an account connection matching the requested calendar
and no business grant; it does not establish fresh provider access. Real Google
consent, live skill Save/activation and deployment remain open.

Session ownership remains with the deployed guard: every route requires a session
unless public, the Axios interceptor alone ends it, and components suppress
failure UI for isSessionEnded. The browser fixture retains mocked backend calls.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor;
  see [harness-backlog](harness-backlog.md).
- WebSocket connections do not pass through that interceptor.
- Real model quality, Google consent/provider grants and actual enabled skill
  Save/activation are unverified. A positive availability check is not a booking.
- The retained unit-test timing and repeated mobile OAuth enable-wait instability
  remain unresolved; one passing candidate run does not establish their cause.

## Next

Coordinate any separately authorized TEST release using the scoped candidate
gates recorded in its plan. Preserve unknown pending operations and exact business grant boundaries.
Production/beta promotion and actual provider consent require their own authority.


## 2026-10-26 — Before clean TEST assistant Google candidate

## State now

Production and beta run `v2.2.21` (`6d3b5dd`, a commit on `v2.2.19`). It carries the
restaurant booking page, the hiding of platform-only skill fields from owners, and
the credit balance shown net of debt. A balance that StarChat does not give is shown
as a dash, not as zero. Each deployment was checked on its live domain: served
bundle, 57 static routes and the Businesses page.

Test runs `v2.2.24`, the tip of branch `v2.2`. It carries the restaurant bookings
page on named tables, which needs StarChat 9.34.68 or later (9.34.69 for the
tables) on the same environment; see
[the restaurant integration](integration/restaurant-booking.md). Production stays
off until StarChat reaches production. It also carries the Configure-via-chat
skill work, which needs the mrcall-agent deployed on test: the
agent on beta and production lacks the pending and reconcile endpoints, and the
skill fields of apply-changes. See the
[integration contract](integration/zylch-integration.md).

And it carries the session guard and the single owner of 401
([brief](briefs/2026-10-13-shell-session-guard.md),
[plan](execution-plans/2026-10-13-shell-session-guard.md)):

- Every route needs a session unless it declares `meta.public`.
- The Axios interceptor alone ends a session. Components skip their failure UI
  for `isSessionEnded(error)`.
- The browser-test fixture mocks mrcall-agent, as it already mocked StarChat.

Before release: vitest 120 of 120, and Playwright 733 passed with 3 skipped on
desktop, tablet and mobile. On the test domain, a fresh browser without a session is
sent from a deep link to sign-in with the full link to return to, and a public page
stays open. With a real session, the configuration page and its chat load, and the
session stays open. The session-expired dialog is covered only by the browser
tests, because it needs a real session that the server refuses.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor;
  see [harness-backlog](harness-backlog.md).
- WebSocket connections (Whatsappweb, the Aladdin configurator, TestChat, the
  webcall text chat and voice button) do not pass through the interceptor either.
- Real model quality, and actual Google consent and provider grants, remain
  unverified.
- `tests/unit/skillsOwnerSave.spec.js` takes 3.5 to 5.3 s against a 5 s timeout
  in a fresh worktree, and can time out there.

## Next

- Bring the session guard to production: either with the whole `v2.2` line once
  mrcall-agent and StarChat are promoted, or as a tag on `v2.2.21`. Either way
  needs authorization.
- `tests/e2e/skills/oauth.spec.js` fails on the mobile project under repeated runs:
  3 and 4 of 78 tests failed in the second and third of three repeats, on 5 s waits
  for a button to become enabled. The cause is not yet measured.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first,
  plus authorization.


## 2026-10-08 — v2.2.15 test release snapshot

# Active Context

## State now

Configure via chat supports ordinary and installed-skill proposals with readable
before/after preview, explicit Save, persisted discard and uncertain-write
reconciliation. Saved instances can open the existing supported Google Calendar
authorization editor with bound business/grant/owner/state and safe return.
The manual skill editor remains a separate flow. See the
[integration contract](integration/zylch-integration.md) and
[workstream plan](execution-plans/2026-10-08-agent-skills-chat-configuration.md).

Test runs `v2.2.15-test`, source `d52785ef`, deployed by successful GitHub
run `37785829478`. The integration preserves the v2.2 modular manual editor,
retention behavior, provider account identity and existing translations. Lint,
97 unit tests, 72 desktop/mobile browser checks and the optimized test-mode
build pass. Chat authorization uses the exact saved grant and excludes manual
inferred-grant calendar checks.

Live dashboard HTML and referenced assets return 200; the served app includes
ID-only Save/discard/reconcile and `https://zylch-test.mrcall.ai`. The backend
runs `dev-9acb567d`: authenticated history/schema checks and deployed catalogue/
configuration reads pass. Its six GenColor instances remain unchanged.
The release plan (mrcall-agent `docs/execution-plans/2026-10-08-agent-skills-test-release.md`)
records routing and rollback. Production tags remain unchanged.

Prior actual local browser/backend GenColor Save/readback/restoration remains
valid acceptance evidence. Model replies are scripted and focused OAuth
exchanges mocked; the release smoke performs read-only configuration checks.

## Unresolved

The existing AI chat SSE client uses native fetch and bypasses the required
Axios 401 interceptor; see [harness-backlog](harness-backlog.md). Real model
quality and actual Google consent/provider grants remain unverified. Live
release smoke covers served assets and authenticated backend contracts; it does
not establish a real-model browser Save or provider authorization.

## Next

Production promotion requires separate authorization. Preserve uncertain
pending attempts on rollback. Resolve the SSE interceptor discrepancy in its
separately scoped application task.

## 2026-10-08 — Test release preparation snapshot

# Active Context


## State now

Configure via chat supports ordinary and installed-skill proposals with readable
before/after preview, explicit Save, persisted discard and uncertain-write
reconciliation. Saved instances can open the existing supported Google Calendar
authorization editor with bound business/grant/owner/state and safe return.
The manual skill editor remains a separate flow. See the
[integration contract](integration/zylch-integration.md) and
[workstream plan](execution-plans/2026-10-08-agent-skills-chat-configuration.md).

Local desktop Chromium/mobile WebKit checks pass 20 pending and 50 OAuth cases;
the production build passes. An actual local browser/backend connected to
StarChat test passes disabled GenColor label Save/readback/restoration with
siblings and grants unchanged. Model replies are scripted; OAuth exchanges in
the focused browser cases are mocked. The feature is integrated onto current `v2.2`, preserving the modular manual
skill editor, retention changes and provider account identity. Lint and 97 unit
tests pass; the optimized test-mode build passes. Desktop/mobile browser
verification passes 72 cases. The authorized `v2.2.15-test` release awaits
publication and deployed read-only checks.

## Unresolved

The existing AI chat SSE client uses native fetch and bypasses the required
Axios 401 interceptor; see [harness-backlog](harness-backlog.md). Real model
quality, actual Google consent/provider grants and deployed compatibility are
not established by local acceptance.

## Next

Finish the authorized test deployment and live read-only verification. Preserve uncertain
pending attempts on rollback. Resolve the SSE interceptor discrepancy in its
separately scoped application task.

## 2026-10-08 — Approved local skill configuration before test release

# Active Context


## State now

Configure via chat supports ordinary and installed-skill proposals with readable
before/after preview, explicit Save, persisted discard and uncertain-write
reconciliation. Saved instances can open the existing supported Google Calendar
authorization editor with bound business/grant/owner/state and safe return.
The manual skill editor remains a separate flow. See the
[integration contract](integration/zylch-integration.md) and
[workstream plan](execution-plans/2026-10-08-agent-skills-chat-configuration.md).

Local desktop Chromium/mobile WebKit checks pass 20 pending and 50 OAuth cases;
the production build passes. An actual local browser/backend connected to
StarChat test passes disabled GenColor label Save/readback/restoration with
siblings and grants unchanged. Model replies are scripted; OAuth exchanges in
the focused browser cases are mocked. These changes remain local and unreleased.

## Unresolved

The existing AI chat SSE client uses native fetch and bypasses the required
Axios 401 interceptor; see [harness-backlog](harness-backlog.md). Real model
quality, actual Google consent/provider grants and deployed compatibility are
not established by local acceptance.

## Next

Release and deployment require separate authorization. Preserve uncertain
pending attempts on rollback. Resolve the SSE interceptor discrepancy in its
separately scoped application task.

## 2026-10-08 — Documentation bootstrap snapshot

---
doc_baseline_commit: 59a798bd92372ad593f989245588cc09790eb94f
doc_baseline_date: 2026-10-08
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

- This repository owns the MrCall dashboard Vue 3 application, its configuration, and Playwright tests.
- Package scripts use Vue CLI for development and production builds.
- Existing architecture, development rules, and integration guides are indexed in docs/README.md.
- The baseline identifies the existing repository commit; local bootstrap edits are not part of that commit.

## Unresolved

- The AI chat SSE path uses native fetch and bypasses the required Axios 401 interceptor; see docs/harness-backlog.md.
- Client runtime compatibility and deployed backend behavior are not evaluated by the documentation migration.
- Application build and browser tests have not been run during this documentation bootstrap.

## Next

- Run doc-start before repository development.
- Resolve the authenticated SSE interceptor discrepancy in a separately scoped application task.
