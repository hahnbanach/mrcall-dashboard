## 2026-11-03 — Before the v2.2.48, v2.2.49 and v2.2.50 releases

### State now

Production, beta and test serve `v2.2.47` (production and beta at `adbb851`, test at `8f194be`, the same code), with
StarChat 9.34.128 behind production (all three pods, 2026-11-02) and the analytics routes it added on beta too. The
`v2.2` line holds the classification feedback and the analytics UX rework, both live since `v2.2.45`
([analytics UX brief](briefs/2026-10-31-analytics-ux.md), [plan](execution-plans/2026-10-31-analytics-ux.md)), and the
bundles uploaded gzipped (`v2.2.47`): 7.9 MB of JavaScript on a first load became 1.98 MB, the login page's first
paint at 9 Mbps 9.3 s to 3.8 s.

The rest of the load work is on branch `dashboard-load` (worktree `mrcall-dashboard-wt/dashboard-load`, local only,
not deployed): pages, locales, the call client and the JSON editor on demand (initial JS 462 027 B gzip in 2 files,
from 1 991 975 B in 103), a splash and mounting without waiting for the router, one auth readiness with a claim check
instead of forced refreshes, and the upload with 14-day retention and a per-environment cache header, rehearsed on a
local S3 ([brief](briefs/2026-10-23-dashboard-load.md), [plan](execution-plans/2026-10-23-dashboard-load.md), its
Status table). Its release (M9) is not authorised yet and needs `ASSET_CACHE_CONTROL` on each GitHub environment first:
the new Deploy step stops without it.

Branch `redirected` (worktree `mrcall-dashboard-wt/redirected`, local, from `v2.2` at `c02054f`) reads StarChat's
insight version 8: `redirected` (the business handles the request through a channel of its own the assistant gave the
caller) as a resolution, an outcome line shown only when it or the period before has calls, and a request outcome
outside the not-fulfilled default; `handed_over` labelled as staff ("Escalated to staff", "Passato a un operatore")
([brief](briefs/2026-11-02-redirected-outcome.md), [plan](execution-plans/2026-11-02-redirected-outcome.md)). Verified
on the repository's mocks against StarChat's code at `d85eb2b70` (branch `extraction-configuration-and-resolution`, not
in 9.34 yet); no environment sends the value until that StarChat is deployed, while the `handed_over` label changes as
soon as the dashboard ships.

Session ownership: every nonpublic route needs a session, the Axios interceptor alone ends it, and components suppress
their failure UI for `isSessionEnded`. Browser tests mock StarChat and mrcall-agent (on `dashboard-load`
their ID tokens are JWT-shaped and the StarChat mock refuses an unverified one, as StarChat does; on `v2.2` the token
is a fixed string).

### Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor; WebSockets
  (Whatsappweb, the Aladdin configurator, TestChat, the webcall text chat and voice button) do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Actual production consent, model behavior, caller booking and post-call append
  remain operator-owned acceptance; the operator confirms TEST setup works.
- On `v2.2.34`, the first callback response of the reported calendar Save is unexplained; the
  call-history reads available returned no record for it.
- `tests/unit/skillsOwnerSave.spec.js` takes 3.5 to 5.3 s against a 5 s timeout in a fresh
  worktree, and can time out there.
- Under a full Playwright run, 10 to 21 cases, mostly tablet and mobile, fail under load and pass when rerun alone
  (commit `c61ddf2`: 10; the `redirected` run: 17, all 54 runs of them passing with one worker, its plan's Status
  table; `dashboard-load`'s M7 run there: 21 of 24, the other 3 a real defect it fixed); it follows the machine's load,
  the cause is not measured further.
- A blank first load of about a minute was seen once in a Chrome with extensions, right after a deploy, and not in a
  clean Chromium (5 cold runs, 1.0 to 1.3 s): not reproduced, not explained.
- The `__BOOKING__` section's move into `__CONVERSATION__` by StarChat, and the U19r6 field names assumed against
  StarChat's U19r7a, were not re-checked on 2026-11-02.

### Next

- `redirected`: Angelo authorises the fast-forward of `v2.2` and the test tag, deployed to test in one pass with
  StarChat's tag of the same work (StarChat plan step C13); the commit and tag go back to that StarChat session. If it
  lands first, `dashboard-load` merges `v2.2` before its own release.
- Dashboard load, M9: Angelo authorises creating `ASSET_CACHE_CONTROL` (`none`) on the test, beta and production
  environments and the test deploy; then the 60 s probe, the immutable header, the protocol's measurements on test,
  and beta and production with their fallback tags verified.
- Analytics UX: the final review through the final-user path, then this file's closure with `doc-end`.
- Operator: verify the production flow and actual call results with the chosen account.
- Remove `__BOOKING__` from `menuGroups` once StarChat's move is on test.

## 2026-11-02 — Before the analytics UX and dashboard load closures

### State now

Production and TEST serve the tested v2.2.38 source ab4ca78f.
Production tag v2.2.38-production succeeds in workflow40879746700; all
104 served JS/CSS assets match the CI build names and answer HTTP200.
The production bundle contains Sheets/booking/configured-state paths and points to
zylch.mrcall.ai and api.mrcall.ai. Backend prod-c40fef81 is healthy,
with 21 matching source hashes. See the [release plan](execution-plans/2026-10-29-chat-skills-production.md).

Sheets authorization returns to actual editable column review before explicit Save.
Booking uses five separate skills, calendar selection and scoped activation; passive
setup is hidden for configured groups. The operator confirms TEST setup. Actual
production consent, model behavior, caller booking and append remain operator-owned.
The release changes no customer configuration, history or grant and performs no
model/provider action. Beta and the dirty v2.1 checkout receive no changes.

Session ownership: every nonpublic route needs a session, the Axios interceptor alone ends it,
and components suppress their failure UI for `isSessionEnded`. Browser tests mock StarChat and
mrcall-agent.

Branch `classification-feedback` (a fast-forward from `de91ac6`, not merged, not deployed) carries the dashboard side
of StarChat's classification feedback (its plan's step C8): a call's judgements as chips with one undo, the six facts
reported from one chip, bulk corrections, every count opening its calls, callers' requests on request records with
their category chip, "Move to category" and "Mark as spam", the queues, caller rules and the access record, a
non-owner's read-only call ([brief](briefs/2026-10-27-classification-feedback.md),
[plan](execution-plans/2026-10-27-classification-feedback.md)). Verified on the repository's mocks only (vitest and
the full Playwright run); the StarChat pieces it reads are in StarChat 9.34.121 and, for the bulk and undo answers
of the brief's second amendment (item 10), 9.34.122; the live check comes with StarChat's C11 on 9.34.122.

The same branch carries the dashboard's repairs of the U19c attack (StarChat plan insights-reports-ux, step U19r6,
and the dashboard part of U19r5: plan step P16): a report requested over analysed calls reaches its confirmation, the
older reports' caption, "What callers ask", every category's next action, an author's withdrawal and an undo that
says what StarChat's answer lists, the Report and Processing tabs without Panoramica's reads, the empty cycle's row,
"n/a" over a partial window, and the amendment's minors. It is written against StarChat fields that StarChat is
building beside it and whose names are assumed (the plan's "U19r6: the StarChat fields assumed"): until that StarChat
is on test the screens that read them show what they showed before (no reach line, no withdrawal answered, no
partial "n/a").

### Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor; WebSockets
  (Whatsappweb, the Aladdin configurator, TestChat, the webcall text chat and voice button) do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Actual production consent, model behavior, caller booking and post-call append
  remain operator-owned acceptance; the operator confirms TEST setup works.
- On `v2.2.34`, the first callback response of the reported calendar Save is unexplained; the
  call-history reads available returned no record for it.
- `tests/unit/skillsOwnerSave.spec.js` takes 3.5 to 5.3 s against a 5 s timeout in a fresh
  worktree, and can time out there.
- Under a full Playwright run, some tablet and mobile cases fail intermittently and pass alone
  (`skills/oauth.spec.js`, `admin.spec.js`, `analytics-insights.spec.js`); the cause is not
  measured.
- The `__BOOKING__` section is not legacy: StarChat serves in it `BOOKING_TRIGGER`,
  `NO_BOOKING_INSTRUCTIONS` and the hidden `BOOKING_CALENDAR_ID` (a skill's fallback calendar,
  which businesses booking through the platform's service account rely on). StarChat moves them
  into `__CONVERSATION__`; the dashboard drops `__BOOKING__` from `menuGroups` once that StarChat
  version is on test.

### Next

- Operator: verify the production flow and actual call results with the chosen account.
- Remove `__BOOKING__` from `menuGroups` after StarChat's move is on test.
- Classification feedback (StarChat plan step C8) is built and reviewed on branch
  `classification-feedback`, a fast-forward from `de91ac6`; the line holder lands it.
- U19r6 (plan step P16): once StarChat's U19r7a is on test, align the assumed field names, check the fixtures'
  shapes against answers recorded there, then the code review U19r6b.

## 2026-10-29 — Before authorized chat skills production promotion

TEST serves v2.2.38-test at ab4ca78f, successful workflow40563308648.
All 104 served JS/CSS assets answer HTTP200 and match CI build names; booking
configured visibility and prior Sheets/booking paths are present. The backend
dev-7b9cec51 is ready with nineteen matching hashes and HTTP200 health.
The reported assistant's read-only status returns configured=true; passive setup
is hidden despite managed alignment state=prepared. Disabled/pending groups
and explicit local failure recovery retain their controls. No customer configuration
or history is changed. See the [plan](execution-plans/2026-10-27-booking-card-visibility.md).

The Sheets button authorizes the account and returns to actual column review before
explicit Save. Customer consent, real model review/language and an actual append
remain operator-owned. No customer configuration or conversation is changed by this
release. Production and beta receive no promotion; the dirty v2.1 checkout is untouched.

The five-skill review is compact, the existing connection flow continues to calendar
selection by name and scoped activation, and fixed English booking summaries are suppressed.
Local scripted browser/component/layout acceptance and build/lint pass. Actual consent,
real-model chat and caller booking remain operator-owned. Production retains v2.2.34;
the dirty v2.1 checkout is untouched. The prior TEST baseline is fd4c94d.



- Actual Sheets consent, model column-review quality and post-call append remain
  operator-owned acceptance; the operator confirms the existing booking flow works.


- Operator: reload TEST and verify Sheets consent, actual column review/editing and post-call append.


- Promoting the chat skill work beyond test requires promoting mrcall-agent first, plus
  authorization.



## 2026-10-27 — Booking-card candidate before authorized TEST publication

The booking-card visibility candidate separates saved skill readiness from managed
prompt alignment. It hides passive setup for five already-configured skills while
retaining pending/disabled/failure controls. Focused checks and build pass; it is not
yet deployed. See the [plan](execution-plans/2026-10-27-booking-card-visibility.md).

TEST serves v2.2.37-test at e5ce20e3, successful workflow40546056223.
All 104 published JS/CSS assets answer HTTP200 and match the CI build names;
served code contains the Sheets intent, provider, write scope and get_call_log_setup
continuation, retaining prior booking paths and the TEST backend reference.
The companion backend dev-69223983 is ready with matching source hashes and health.
See the [Sheets plan](execution-plans/2026-10-27-sheets-oauth-call-log.md).


## 2026-10-27 — Sheets source candidate before authorized TEST publication

The v2.2.37 Sheets candidate adds a Google Sheets OAuth action and verified return
to column review in the chat. Intercepted browser, unit, lint and build checks pass;
source integration is approved. It is not released. See the
[Sheets plan](execution-plans/2026-10-27-sheets-oauth-call-log.md).

TEST retains v2.2.36-test at 3c19137, successful workflow40492024562, with the
booking routing backend dev-3db594b4. The operator confirms booking works. Production
retains v2.2.34; the dirty v2.1 checkout is untouched.

- Review the OAuth Sheets candidate and authorize a separate TEST release when ready.

## 2026-10-27 — Booking handoff before operator confirmation and Sheets work

TEST serves v2.2.36-test at 3c19137 through successful workflow40492024562.
All 104 published JavaScript/CSS assets answer HTTP200 and match the CI asset names;
served code contains the booking setup/activation and bound connection-intent paths.
The companion backend runs dev-9c482083 with a successful authenticated setup check.
The authorized conversation is empty and its five saved skills are preserved.
See the [plan](execution-plans/2026-10-27-booking-connect-activate.md) and
[evidence](evaluations/2026-10-27-booking-connect-activate.md).


- Operator: reload TEST and verify the actual conversation, Google consent when needed,
  calendar selection and booking. Existing accessible calendars can be selected directly.
- Real model quality, actual Google consent and provider grants, and booking creation through a
  calendar skill remain unverified live.

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

## 2026-10-27 — Next steps replaced when v2.2 was pushed and the classification-feedback branch was reviewed

- Push `v2.2`; deploying it to test needs its own authorization, and it is the release that
  removes the calendar connect from `/account` on the live domains.
- Classification feedback (StarChat plan step C8) is being built on a branch from `v2.2` and
  lands by fast-forward after review.

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
