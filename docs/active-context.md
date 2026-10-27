---
doc_baseline_commit: fd4c94d1e5b9dd2cd693b0ee24a282926c7fd4ce
doc_baseline_date: 2026-10-27
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

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

Session ownership: every nonpublic route needs a session, the Axios interceptor alone ends it,
and components suppress their failure UI for `isSessionEnded`. Browser tests mock StarChat and
mrcall-agent.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor; WebSockets
  (Whatsappweb, the Aladdin configurator, TestChat, the webcall text chat and voice button) do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Real model quality, actual Google consent and provider grants, and booking creation through a
  calendar skill remain unverified live.
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

## Next

- Complete source closure/review and publish this booking continuation to TEST, verify
  the actual served artifact and coordinate the backend/chat cleanup. Real consent/model
  verification belongs to the operator.
- Remove `__BOOKING__` from `menuGroups` after StarChat's move is on test.
- Classification feedback (StarChat plan step C8) is being built on a branch from `v2.2` and
  lands by fast-forward after review.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first, plus
  authorization.
