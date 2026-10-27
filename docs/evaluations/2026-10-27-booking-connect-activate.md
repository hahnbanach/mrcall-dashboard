# Booking connection UI acceptance

Scope: [brief](../briefs/2026-10-27-booking-connect-activate.md) and
[plan](../execution-plans/2026-10-27-booking-connect-activate.md).

## Source acceptance

Local authenticated browser fixtures cover the actual callback/PKCE return,
single/multiple calendar choices, saved-disabled groups, no query-only Save,
identity/setup/expiry changes, denied consent, partial/reload behavior, invalid
lists and responses, stale activation and fixed-English-summary suppression.
The 19 booking cases pass. The 46 affected browser regression cases for generic
connection, readable previews and saved refresh pass. Two held-request component
tests and five final browser cases verify the last owner/business busy-state fix.

Layout checks pass at 1440×900, 964×640 and 375×812. Collapsed and expanded images
are retained externally; runtime templates stay in exact collapsed details and
the composer, connection card and review do not overlap. Constrained panels scroll
to lower controls. The final production-mode TEST build, lint and diff check pass.
All 12 new locale blocks parse and prior translations are preserved.

The coordinated backend has 156 focused PostgreSQL/API/Save tests passing. Its
status/activation contract validates exact stored groups, snapshot tokens and
current calendar access; raw browser parameters never become Save values. Partial
and uncertain results retain recovery controls. Provider effects are scripted,
with no actual customer consent, paid model or calendar event action.

Evidence lives outside this public repository in the task cache under the workstream
date: frontend-focused-tests.txt, frontend-booking-final-tests.txt,
frontend-identity-unit.txt, frontend-identity-final-tests.txt,
frontend-layout-final-tests.txt, frontend-build-final-identity.txt and
frontend-lint-final-identity.txt, plus ui-screenshots/booking-*-collapsed.png.

## Verified TEST delivery

Backend source 358973f has approved brief, plan, M1, doc-critic and separate final
source review. The reviewed 9c482083 copy correction aligns tool/prompt Save wording
with that same approved connection action; 26 focused checks and exact lint/format pass.
It changes no API, data or authorization contract. Pipeline2993947619 succeeds,
including 1,312 CI tests passing with 562 skips. The ready TEST image is dev-9c482083,
digest sha256:398a4c2ea0a7133762dec4cb5106f3a54a5d925021ac1d9211669d6fdc6dc521.
Fourteen deployed source hashes match and health is HTTP200.

Dashboard v2.2.36-test at 3c19137 is published through successful workflow40492024562.
All 104 public JS/CSS assets answer HTTP200, match CI names and include the booking
setup/activation, intent and summary-suppression paths, targeting the TEST backend.
The prior fd4c94d baseline is retained. No beta or production release occurs.

The authenticated live setup GET returns available=true, state=prepared,
connection_status=available and three calendars. It changes no saved configuration.
Conversation cleanup verifies zero messages in the authorized configuration and wizard
sessions; all five saved skills remain unchanged. No model call, OAuth consent or
calendar event action occurs. Existing available calendars permit direct selection;
new consent is required only when no effective connection exists.

Raw delivery receipts are backend-live-verification.json, frontend-live-verification.json,
backend-live-status.json, history-clear-result.json, backend-ci-tests.log and the reviewed
copy-consistency report in the external task cache. Production remains untouched.
Actual Google consent, real-model conversation and caller booking are operator-owned
verification limits, not claims established by the scripted source checks or deployment.
