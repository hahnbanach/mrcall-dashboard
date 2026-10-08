---
doc_baseline_commit: d52785ef965c256ebb192c7e9484602d350a5e15
doc_baseline_date: 2026-10-08
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Configure via chat supports ordinary and installed-skill proposals with readable
before/after preview, explicit Save, persisted discard and uncertain-write
reconciliation. Saved instances can open the existing supported Google Calendar
authorization editor with bound business/grant/owner/state and safe return.
The manual skill editor remains a separate flow. See the
[integration contract](integration/zylch-integration.md) and
[workstream plan](execution-plans/2026-10-08-agent-skills-chat-configuration.md).

Test runs `v2.2.15-test`, source `d52785ef`, deployed by successful GitHub
run `37785829478`. The integration preserves the v2.2 modular manual editor,
retention behavior, provider account identity and existing translations. Lint,
97 unit tests, 72 desktop/mobile browser checks and the optimized test-mode
build pass. Chat authorization uses the exact saved grant and excludes manual
inferred-grant calendar checks.

Live dashboard HTML and referenced assets return 200; the served app includes
ID-only Save/discard/reconcile and `https://zylch-test.mrcall.ai`. The backend
runs `dev-9acb567d`: authenticated history/schema checks and deployed catalogue/
configuration reads pass. Its six GenColor instances remain unchanged.
The [release plan](../../mrcall-agent/docs/execution-plans/2026-10-08-agent-skills-test-release.md)
records routing and rollback. Production tags remain unchanged.

Prior actual local browser/backend GenColor Save/readback/restoration remains
valid acceptance evidence. Model replies are scripted and focused OAuth
exchanges mocked; the release smoke performs read-only configuration checks.

## Unresolved

The existing AI chat SSE client uses native fetch and bypasses the required
Axios 401 interceptor; see [harness-backlog](harness-backlog.md). Real model
quality and actual Google consent/provider grants remain unverified. Live
release smoke covers served assets and authenticated backend contracts; it does
not establish a real-model browser Save or provider authorization.

## Next

Production promotion requires separate authorization. Preserve uncertain
pending attempts on rollback. Resolve the SSE interceptor discrepancy in its
separately scoped application task.
