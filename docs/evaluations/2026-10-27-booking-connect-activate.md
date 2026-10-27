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

## Mandatory delivery

Source closure/final review precede the authorized TEST deployment. Successful
workflow and actual served-artifact checks, coordinated backend readiness, a fresh
delivery review and exact assistant conversation cleanup remain required. Actual
Google consent, real-model conversation and caller booking remain operator-owned.
