---
doc_baseline_commit: 4e6fb4faf3f8838da4da58d36b7049f2f73f9c54
doc_baseline_date: 2026-10-29
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

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

## Unresolved

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

## Next

- Operator: verify the production flow and actual call results with the chosen account.
- Remove `__BOOKING__` from `menuGroups` after StarChat's move is on test.
- Classification feedback (StarChat plan step C8) is built and reviewed on branch
  `classification-feedback`, a fast-forward from `de91ac6`; the line holder lands it.
- U19r6 (plan step P16): once StarChat's U19r7a is on test, align the assumed field names, check the fixtures'
  shapes against answers recorded there, then the code review U19r6b.
