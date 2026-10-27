---
status: completed
---

# Sheets OAuth call log

Approved [brief](../briefs/2026-10-27-sheets-oauth-call-log.md). Lead owns backend,
integration and documentation. A bounded worker owns only the clean dashboard
v2.2.37 worktree. Backend and frontend can proceed independently after plan approval.

## M1 — Backend policy and model contract

Move skill prompt constants to a small skill_prompts module to retain the file-size
rule. Replace fixed-eight/shared-only instructions with the requested seven-step
OAuth flow. Configure final/google_sheets_write from a pasted spreadsheet URL;
normalize a valid private Google Sheets URL to its ID. New OAuth drafts use no
invented grant name; preserve existing opaque refs. Default mapping is the five
production columns, header=true; permit user-requested mapping changes through
installed-schema validation. Retain explicitly existing shared/preset instances
without forcing migration, but remove the consulting-only restriction on generic
OAuth mappings. No action runs during proposal or consent.

Expose an owned read-only get_call_log_setup tool over the current business,
effective drafts/saved instances and ASSISTANT_TOOL_VARIABLE_EXTRACTION. It reports
actual ordered mappings, available extracted fields/templates and resource status,
without secrets. After consent the model must call it, explain the columns in the
chat's language, ask approval/change requests and queue changes; final Save remains
explicit. Do not invent fields or change extraction collection merely to add a column.

Teach Save/probe acceptance the exact known Google Sheets OAuth read-only probe
shape: reachable/grant, write permission and target-tab unchecked. Preserve those
limits in safe evidence; unknown/refused/mismatched results still block. Changed
spreadsheet destination or OAuth ref must re-probe even when already enabled.
Suppress fixed English summaries for this flow and remove contradictory prompts.

## M1 — Frontend consent and return

Worker owns src/utils/OAuth.js, BusinessSkillConnection.js, new sheets intent helper,
BusinessSkillConnection.vue, GoogleCallback.vue, ConfigureAIPanel.vue, locale blocks
and focused tests in the isolated dashboard only. Not alone in the workspace; preserve
others' edits. Reuse existing PKCE/state/context-digest/owner/business checks. Add a
provider-specific google_sheets context permitting only identity+spreadsheets write
scope; do not widen sign-in or Calendar to cross-provider scopes. Offer a dedicated
Sheets button beside the unsaved final proposal (including edits with saved opaque
refs when applicable). Preserve calendar controls even if both proposals exist.

A finite-lived intent binds owner/business/configuration session, pending target and
exact OAuth state. Mark it connected only after verified provider connect succeeds.
On return to the same ready chat, consume once and request only the read/check/explain
model turn via the existing silent chat mechanism. It does not Save or append. Query
markers, stale/missing context, owner/business/session changes and denied consent
never trigger a turn. Pending drafts survive redirect; user edits and Save stay normal.
Explain conditional Google Advanced/unverified-app steps in all twelve locales using
official Google guidance, without claiming verification or bypassing an admin refusal.

## Verification and closure

Use focused isolated PostgreSQL/tool/Save tests for editable mappings, actual
extraction metadata, safe URL handling, opaque refs, stale/unauthorized reads,
partial probe evidence and sibling preservation. Frontend intercepted browser tests
cover real callback→same chat continuation, no query-only turn/Save, denied/changed
identity/scope, exact write scope, retained Calendar behavior and translated copy.
Run exact lint/format and frontend build. No paid model, live OAuth or append.

Fresh integration review, lead documentation reconciliation, mechanical/doc-critic
and separate final source review precede completion. Update durable contracts in
both repos; archive only owned superseded state verbatim. Release is not authorized
by this source task; deliver a concrete reviewed implementation for TEST promotion.

## Rollback

Revert source normally, never force-push. No production/customer configuration or
provider rows are changed by implementation checks. Existing shared/custom/OAuth
instances and earlier calendar/booking flows retain their stored state.

## Source acceptance

M1 integration is APPROVED for both repositories. Backend affected PostgreSQL,
actual HTTP-client Save/readback and strict scripted SSE checks pass; the final
bound receipt covers editable OAuth mapping, extracted fields, grant preservation,
known partial probes and prior Calendar/booking safeguards. Frontend final Sheets
browser acceptance passes ten cases and focused intent/readiness units pass thirteen;
61 existing Calendar/manual/booking regressions pass, with final callback smokes
covering later readiness/localization adjustments. Exact lint/format and TEST-mode
build pass. All provider/model effects in these checks are intercepted or scripted.

Source closure uses explicit doc-critic, mechanical and separate final source review.
The continuation request is localized to UI locale and explicitly preserves prior
chat language; actual model compliance remains unverified. No deployment, customer
configuration, live consent or append is part of this source task. Release needs
separate authorization. Evidence is retained outside source in the task cache.

## Authorized TEST publication

The operator separately authorized publication after source completion. Backend
main→dev promotion publishes 69223983722e4ee771b736d2007a74cd73d1ac4d through successful pipeline2995603142.
Ready image digest sha256:475d13cd1ed9df0adf3d7c522b4c5e07507ef06665edbe2e578fde41f470dd25, nineteen deployed source hashes, actual
get_call_log_setup registration and HTTP200 health are verified. Dashboard
v2.2.37-test at e5ce20e3751374825c0242b44db1f48fe327407b succeeds in workflow40546056223; all
104 served JS/CSS assets return HTTP200 and match CI names, including the new Sheets
intent/provider/write-scope/review-turn markers and retained booking paths.

The initial pipeline2995577615 refused an obsolete assembled-prompt assertion that
still required service-account sharing. A test-only corrective commit aligns that
expectation with the already-reviewed OAuth flow; twelve focused prompt checks and
exact CI lint/format pass. Runtime implementation is unchanged from f8713820.

The authorized release performs no customer Google consent, model trial, append,
configuration write or conversation reset. Actual consent/column-review quality,
write permission/tab and runtime append remain operator-owned. No production/beta
promotion occurs. Runtime/workflow/asset receipts are retained in the external task
cache's release directory; operational documentation closure and separate final
release review bind readiness without changing the source acceptance boundary.
