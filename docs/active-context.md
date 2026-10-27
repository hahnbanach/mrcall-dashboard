---
doc_baseline_commit: d52785ef965c256ebb192c7e9484602d350a5e15
doc_baseline_date: 2026-10-08
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

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

- Push `v2.2`; deploying it to test needs its own authorization, and it is the release that
  removes the calendar connect from `/account` on the live domains.
- Remove `__BOOKING__` from `menuGroups` after StarChat's move is on test.
- Classification feedback (StarChat plan step C8) is being built on a branch from `v2.2` and
  lands by fast-forward after review.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first, plus
  authorization.
