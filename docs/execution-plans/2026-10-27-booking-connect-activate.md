---
status: completed
---

# Booking connect and activate UI

Scope: [brief](../briefs/2026-10-27-booking-connect-activate.md). Backend counterpart
is the same dated workstream in mrcall-agent. Both briefs have fresh APPROVED review.

## Ownership and dependencies

The dashboard worker owns only this clean isolated v2.2.36 worktree, based on
origin/v2.2 at fd4c94d. Preserve upstream code, the dirty sibling checkout and
unrelated analytics changes. Lead owns backend contract and combined delivery.
The worker does not deploy or publish; source gates precede authorized TEST release.

## M1 — Flow and readable UI

1. Add a booking-only connection component and small utility over authenticated
   Axios methods in Zylch.js. GET `/api/mrcall/booking/setup` with business_id and
   session_id returns `{available, state, setup_token, connection_status, calendars,
   oauth_scopes}` plus safe code when unavailable. Calendar rows are `{id, summary,
   primary}`. POST `/api/mrcall/booking/activate` sends only those identities,
   setup_token and calendar_id, receiving `{success, applied, errors, skill_outcomes,
   remaining_pending, booking_active}`. Never send raw skill params or broaden Save.
2. Reuse businessCalendarAuthorizationUrl and GoogleAuthFlow. Store a finite-lived
   booking intent in sessionStorage binding owner/business/session/setup token and
   exact OAuth state. GoogleCallback marks it successful only after all existing
   context/state/owner/scope checks and successful provider/connect; failures clear
   it. A query marker alone never activates. On return to this assistant's chat,
   consume intent once. One verified calendar can auto-complete only if setup token
   still matches; multiple calendars require named choice. Already-connected state
   still needs explicit destination/activation action. Guard identity/unmount and
   avoid replay on reload or uncertain/partial results.
3. Integrate with ConfigureAIPanel's busy state, authoritative pending/outcomes and
   confirmed saved-phase refresh. The booking card replaces the generic connect
   card only for supported complete five-skill groups, including saved disabled
   groups; preserve other integrations' existing connection behavior. Keep status
   failures truthful and actionable without settings detours when button support exists.
4. Honor backend booking `display_summary:false` in ZylchChat; retain metadata and
   other tool summaries. Collapse runtime prompts/templates into exact details.
   Keep compact summary and non-overlapping composer, connection and review areas
   in screenshot-sized desktop and mobile layouts. Translate all new UI strings
   in every one of the 12 locale files.
5. Add focused local browser acceptance using existing intercepted fixtures for
   actual callback→named selection→activation, single-calendar continuation, denied
   OAuth, missing/changed intent, stale setup, malformed list, partial outcomes,
   preserved sibling proposals and saved-view refresh. Assert bounding boxes at
   desktop/mobile widths and inspect a screenshot. Run lint and exact test build.

## Closure, release and rollback

M1 integration review is combined with backend contract checks. Reconcile durable
integration/OAuth docs and active context, explicit doc-critic/mechanical checks and
separate fresh final source review before publication. Source completion covers
local acceptance; actual TEST release has a later operational closure/final review.
The lead publishes a unique TEST tag from the reviewed numbered branch, verifies
the successful workflow and served artifact identity, and clears only the authorized
assistant's chat through the backend. No production/beta promotion, real OAuth or
paid model trial. The operator owns real consent and conversation verification.
Rollback uses the prior TEST artifact via the normal workflow, never retagging or
force-pushing existing releases.

## Current source evidence

M1 integration is APPROVED for both implementations. Evidence records 156 backend
checks, 46 affected browser cases, 19 booking cases, two final identity component
checks, five final browser reruns and three layout sizes, plus final frontend
build/lint. No live OAuth/model/calendar actions occur. Current TEST inspection
is read-only; saved skills remain unchanged. Source closure and separate final source review are approved. The verified delivery
results below satisfy publication and cleanup; real customer effects remain operator-owned.

## Verified delivery and handoff

Backend main→dev publication succeeds at 9c482083 in pipeline2993947619; the ready
image, fourteen source hashes and health are verified. Dashboard v2.2.36-test at
3c19137 succeeds in workflow40492024562; all 104 served assets match CI names and
contain the booking paths. The authenticated TEST setup GET recognizes five prepared
skills and three accessible calendars without configuration changes. The requested
history reset verifies zero messages and preserves the saved five. Production is
unchanged. Exact receipts are bound in the paired evaluation and external task cache.

The 9c482083 follow-up only aligns tool/prompt copy with the reviewed connection
flow, with 26 focused checks, exact lint and a separate corrective fast-path review.
Operational documentation closure and a fresh final delivery review precede checker
finalization of this plan. The user owns actual consent/model/caller verification;
no paid model, OAuth consent or calendar event action was run by the delivery agent.
