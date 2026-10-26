---
doc_baseline_commit: 8190c4b51bf3bbae1a9af189b4f09be802701c62
doc_baseline_date: 2026-10-26
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

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
