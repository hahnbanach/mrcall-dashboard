---
doc_baseline_commit: 3c19137f1584e6c846ad4fbee3cbf23d62b639ea
doc_baseline_date: 2026-10-27
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

TEST serves v2.2.36-test at 3c19137 through successful workflow40492024562.
All 104 published JavaScript/CSS assets answer HTTP200 and match the CI asset names;
served code contains the booking setup/activation and bound connection-intent paths.
The companion backend runs dev-9c482083 with a successful authenticated setup check.
The authorized conversation is empty and its five saved skills are preserved.
See the [plan](execution-plans/2026-10-27-booking-connect-activate.md) and
[evidence](evaluations/2026-10-27-booking-connect-activate.md).

The five-skill review is compact, the existing connection flow continues to calendar
selection by name and scoped activation, and fixed English booking summaries are suppressed.
Local scripted browser/component/layout acceptance and build/lint pass. Actual consent,
real-model chat and caller booking remain operator-owned. Production retains v2.2.34;
the dirty v2.1 checkout is untouched. The prior TEST baseline is fd4c94d.

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

- Operator: reload TEST and verify the actual conversation, Google consent when needed,
  calendar selection and booking. Existing accessible calendars can be selected directly.
- Remove `__BOOKING__` from `menuGroups` after StarChat's move is on test.
- Classification feedback (StarChat plan step C8) is being built on a branch from `v2.2` and
  lands by fast-forward after review.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first, plus
  authorization.
