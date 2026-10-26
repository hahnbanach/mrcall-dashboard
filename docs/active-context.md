---
doc_baseline_commit: c2b2a58976ad9de869bc4ba39cfc753ac88caf62
doc_baseline_date: 2026-10-26
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

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
