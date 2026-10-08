# Active context archive

Historical snapshots preserved verbatim, newest first. This cold storage is not
startup context; it records prior state without making current capability claims.

## 2026-10-08 — Approved local skill configuration before test release

# Active Context


## State now

Configure via chat supports ordinary and installed-skill proposals with readable
before/after preview, explicit Save, persisted discard and uncertain-write
reconciliation. Saved instances can open the existing supported Google Calendar
authorization editor with bound business/grant/owner/state and safe return.
The manual skill editor remains a separate flow. See the
[integration contract](integration/zylch-integration.md) and
[workstream plan](execution-plans/2026-10-08-agent-skills-chat-configuration.md).

Local desktop Chromium/mobile WebKit checks pass 20 pending and 50 OAuth cases;
the production build passes. An actual local browser/backend connected to
StarChat test passes disabled GenColor label Save/readback/restoration with
siblings and grants unchanged. Model replies are scripted; OAuth exchanges in
the focused browser cases are mocked. These changes remain local and unreleased.

## Unresolved

The existing AI chat SSE client uses native fetch and bypasses the required
Axios 401 interceptor; see [harness-backlog](harness-backlog.md). Real model
quality, actual Google consent/provider grants and deployed compatibility are
not established by local acceptance.

## Next

Release and deployment require separate authorization. Preserve uncertain
pending attempts on rollback. Resolve the SSE interceptor discrepancy in its
separately scoped application task.

## 2026-10-08 — Documentation bootstrap snapshot

---
doc_baseline_commit: 59a798bd92372ad593f989245588cc09790eb94f
doc_baseline_date: 2026-10-08
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

- This repository owns the MrCall dashboard Vue 3 application, its configuration, and Playwright tests.
- Package scripts use Vue CLI for development and production builds.
- Existing architecture, development rules, and integration guides are indexed in docs/README.md.
- The baseline identifies the existing repository commit; local bootstrap edits are not part of that commit.

## Unresolved

- The AI chat SSE path uses native fetch and bypasses the required Axios 401 interceptor; see docs/harness-backlog.md.
- Client runtime compatibility and deployed backend behavior are not evaluated by the documentation migration.
- Application build and browser tests have not been run during this documentation bootstrap.

## Next

- Run doc-start before repository development.
- Resolve the authenticated SSE interceptor discrepancy in a separately scoped application task.
