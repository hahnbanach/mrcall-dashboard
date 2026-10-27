---
doc_baseline_commit: e5ce20e3751374825c0242b44db1f48fe327407b
doc_baseline_date: 2026-10-27
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

TEST serves v2.2.37-test at e5ce20e3, successful workflow40546056223.
All 104 published JS/CSS assets answer HTTP200 and match the CI build names;
served code contains the Sheets intent, provider, write scope and get_call_log_setup
continuation, retaining prior booking paths and the TEST backend reference.
The companion backend dev-69223983 is ready with matching source hashes and health.
See the [Sheets plan](execution-plans/2026-10-27-sheets-oauth-call-log.md).

The Sheets button authorizes the account and returns to actual column review before
explicit Save. Customer consent, real model review/language and an actual append
remain operator-owned. No customer configuration or conversation is changed by this
release. Production and beta receive no promotion; the dirty v2.1 checkout is untouched.

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
- Actual Sheets consent, model column-review quality and post-call append remain
  operator-owned acceptance; the operator confirms the existing booking flow works.
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

- Operator: reload TEST and verify Sheets consent, actual column review/editing and post-call append.
- Remove `__BOOKING__` from `menuGroups` after StarChat's move is on test.
- Classification feedback (StarChat plan step C8) is being built on a branch from `v2.2` and
  lands by fast-forward after review.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first, plus
  authorization.
