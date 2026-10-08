---
status: completed
brief: ../briefs/2026-10-08-agent-skills-chat-configuration.md
owner: dashboard implementer; cross-repository lead owns acceptance
created: 2026-10-08
---

# Skill proposals in Configure via chat

## Classification and dependencies

Substantial development: the dashboard changes its authenticated Save contract,
persisted pending-state behavior and OAuth grant binding. Fast path does not apply.
This plan implements only the approved local brief and its canonical backend
brief/plan. It does not authorize release, deployment or production writes.

The local brief received independent APPROVED framing review. A fresh plan review
must approve this artifact before source edits. Backend M2 and M3 must receive
their integration approvals before UI implementation consumes their contracts.
Record their exact public pending, apply, discard and reconciliation shapes at
that dependency gate. Do not invent route paths or infer capabilities from M1.

The dashboard implementer owns source and focused browser tests below. The lead
owns backend integration, live test credentials, safe restoration, documentation
closure and review evidence. Keep backend changes in its implementation lane.
Preserve unrelated harness migration edits; no commits are authorized here.

## Verified starting point

Read the dashboard brief, AGENTS.md, documentation index, development guide and
AI integration guide; inspected ConfigureAIPanel, ZylchChat, Zylch.js, the wizard,
AgentSkillsConfigurator, AgentSkills.js, OAuth.js, GoogleCallback, configuration
menu/initialization paths, router and browser auth fixtures. Read the exact
StarChat OAuth resource and calendar grant consumers for interface feasibility.
Detailed evidence: `/tmp/mrcall-ai-kit/skill-configuration/inspect-dashboard/findings.log`.

ConfigureAIPanel merges all items by variable_name, sends only ordinary values,
clears all on success and discards locally. ZylchChat history emits only nonempty
pending arrays. The wizard independently merges variable changes and auto-applies
them without session_id. These consumers need deliberate compatibility handling.

BusinessConfiguration always initializes its chat menu. Its manual skill widget
appears in the template collection containing SKILL_PREFETCH_CONFIGURATION,
subject to visibility rules; there is no existing query route to that widget.
The widget reads the old catalogue and manages whole-phase form values. This
work must not replace that editor or introduce hidden configuration writes.

Existing OAuth UI sends only provider credentials, without business/grant binding.
StarChat already accepts businessId and grantName on provider connect; provider
listing returns those fields for the current user only. The calendar-list route
accepts businessId/grantName for google_calendar. Existing client scope allowance
is openid, email, profile and https://www.googleapis.com/auth/calendar only.

Calendar runtime passes the saved SKILL_CALENDAR_AUTH unchanged. Missing is empty;
there is no runtime default to instanceId. Empty and missing references use
existing shared/fallback semantics, and a business-wide grant may satisfy a named
request. A calendar result therefore establishes effective availability, not
exclusive existence of a newly named grant. Never substitute instanceId silently.

The lead's pre-change production build passes. Playwright test discovery works.
After the inspector found no browser, the lead installed Chromium and verified
launch, page text assertion and close. The test-mode development server is running
on localhost:8080; startup log is under the workstream's temporary evidence
directory. These checks establish browser readiness, not feature acceptance.

## D1 — Authoritative pending UI and Save

Owner: dashboard implementer. Depends on approved backend M2/M3.

Extend Zylch.js additively for the approved backend contract, using configured
Axios for authenticated requests. Preserve legacy applyChanges callers and
ordinary changes; add skill_operation_ids and session_id explicitly. Never send
skill params, client revisions or execution metadata as Save authority.

ConfigureAIPanel adopts complete pending snapshots, including empty snapshots,
from history, streamed metadata and action responses. Key ordinary items by
variable_name and skills by operation_id; do not union stale local proposals back
into server snapshots. Repeated edits retain the server-issued operation identity.
Render localized skill/action/phase, saved instance or draft, and safe before/after
values from preview. Use ordinary text binding, not rendered HTML for field data.
Show refused, conflicting, partial and uncertain outcomes truthfully, retaining
exactly remaining_pending. A full-success response alone must not clear proposals
queued concurrently. Disable duplicate actions and prevent chat proposal edits
while the panel's Save/discard/reconcile request is in progress.

Persist discard through the approved owned/business-bound endpoint; update from
its response. Active and uncertain attempts remain visible. Offer only the
explicit reconciliation actions supported by the backend; reread evidence before
closing uncertain work. Do not convert an uncertain create into a new automatic
Save or hide it through generic Discard. If an action's response is lost, reload
authoritative pending state and show unresolved status instead of guessing.

ZylchChat emits empty history snapshots and forwards complete metadata. Its
configure_skill_instance fallback must not say a failed tool queued or saved
anything. Restrict changes to this integration, preserving the existing SSE
transport; its unrelated native-fetch/interceptor discrepancy is outside scope.

The wizard keeps ordinary auto-apply behavior, passes its existing session ID,
and filters typed skill operations out of the ordinary batch. It never silently
auto-applies skills. Retain unexpected skill proposals server-side and provide
truthful navigation to the explicit chat Save path rather than reporting them
saved. ConfigureAI and wizard sessions differ: navigation must not claim it
transfers a proposal. The backend restricts new skill proposals to the explicit
ConfigureAI Save flow; a wizard request directs the user there before staging.
Update translations in all twelve locales. Register any new PrimeVue
component globally; prefer existing components.

Verification: focused browser cases with stateful backend route mocks must show
ordinary plus skill preview, reload hydration, repeated edit of the same draft,
empty cancellation snapshot, persisted discard and subsequent reload. Assert
the exact Save body contains ordinary values and operation IDs but no skill
params/revisions. Simulate mixed partial success, conflict, concurrent new work,
lost response, uncertain create and explicit reconciliation; assert exact pending
items and no automatic resend. Confirm wizard sends only ordinary values and
its session ID. Run production build and check every new locale key across all
twelve files. Capture traces/screenshots outside the repository. Independent D1
integration review precedes dependent D2 wiring.

## D2 — Existing supported OAuth handoff

Owner: dashboard implementer. Depends on D1 approval and confirmed saved instance
readback. Supports the existing Google Calendar flow and allowed scopes only.

After confirmed Save, provide navigation to the actual existing editor. Locate
the collection containing the phase-variable widget dynamically, refresh saved
configuration, select the target phase/instance and expand its card. If template
visibility prevents reaching it, show unavailable handoff. Do not hardcode a
collection ID, navigate as proof of connection, or auto-enable the instance.

Carry the exact saved opaque grant reference and business ID through the existing
widget and callback. Empty references must be identified as shared authorization,
not per-instance authorization. A new scoped reference can be explicitly staged
through chat before create, or staged after the server assigns an instance ID and
then explicitly Saved again. Authorization never silently changes that field.

Bind provider, businessId, grantName, phase, instanceId, owner UID and local return
destination to the generated single-use OAuth state. Consume and clear context
alongside verified state, validate the restored Firebase owner, and reject changed
context or unsafe external return destinations before connecting. Store no token
values in handoff context. Preserve existing calendar/sign-in flows when no skill
context exists. Send businessId/grantName through the existing connect endpoint;
do not add a provider or expand ALLOWED_SCOPES.

Refresh saved configuration and connection status after return/remount. Use the
existing business/grant calendar route for supported effective availability;
distinguish unknown/error from disconnected. A missing current-user list entry
cannot prove no colleague grant. Avoid claiming a specific grant exclusively
backs an effective calendar result. Unsupported provider/scopes remain visible
limitations. Do not widen this task into whole-phase editor persistence changes.

Verification: browser mocks exercise navigation to the actual widget and exact
saved grant binding; capture the authorization URL and prevent real navigation.
Mock exchange/connect and test callback state mismatch, missing context, changed
owner, unsupported scopes, safe return and successful refresh. Assert connect
body has exact business/grant and no automatic configuration write. Test shared
empty-reference labeling and effective-status fallback/unknown outcomes. No real
Google consent, token exchange or grant mutation is performed. Run production
build; fresh D2 integration review checks the supported user path and boundaries.

## D3 — Integrated test-environment acceptance and closure

Owner: lead integrates; dashboard implementer owns browser fixtures. Depends on
D1/D2 approvals and approved backend milestones. A fresh final reviewer judges
the combined path after documentation closure.

Use a local agent with isolated PostgreSQL and scripted model responses, targeting
only StarChat test. Mint/load test Firebase credentials outside repository files;
never attach real credentials to browser artifacts. The known GenColor test
business is fd81e076-9287-362e-8fa5-8ee51b2cdebf. Recheck identity and target before
writing; verify gencolor_create_ticket is disabled and retain its complete private
configuration snapshot. Through the actual local dashboard, ask for a label-only
change, observe preview, explicitly Save, reread through the dedicated API and
verify siblings/grants unchanged. Restore the original label through the same
guarded flow using a fresh revision and verify final equality. Stop restoration
on conflict; preserve evidence and report the pending obligation. Never invoke
a ticket, phone association, call or skill action.

Browser fixture setup:

1. Use Playwright with service workers blocked. Before initial page navigation,
   install a context-level catchall that aborts requests outside the exact local
   app origin unless an explicit mock handles them. Reject all unintended hosts,
   including www Google analytics/tag-manager hosts and Clarity. Audit requests;
   no tracker receives test text. Do not rely on existing narrow blocker globs.
2. Reuse buildFirebaseUserRecord/seedFirebaseIndexedDB and mocked Firebase REST
   restoration from tests/e2e/fixtures/auth.js. Keep the catchall in place before
   setupAuthPage. Install specific mocks after generic mocks; Playwright resolves
   matching routes in reverse registration order. Give template-variable mocks
   nested [{collection: {id, humanName}, variables: [[variable]]}] shape for
   GET /mrcall/v1/mrcall0/crm/variables?nested=true so configuration builds its menu.
3. D1/D2 tests mock all StarChat and agent requests with stateful pending snapshots.
   Serve history, open-command SSE, proposal SSE, Save, discard and reconciliation
   according to approved backend shapes. Assert request counts and bodies.
4. Live acceptance seeds the real test UID/token into Firebase IndexedDB privately,
   mocks only Firebase REST restoration and incidental dashboard reads, and routes
   agent chat/history/Save to the actual local agent. Explicitly allow those local
   backend URLs; do not mock its skill configuration writes or readback. Browser
   StarChat requests remain mocked unless an exact test read is required. The
   local agent authenticates and talks to the verified StarChat test endpoint.
5. Store browser output, reports and traces under /tmp/mrcall-ai-kit/skill-configuration/.
   Mock tests may retain full trace. Disable live trace/HAR capture because network
   headers contain real tokens; retain sanitized request/result receipts and
   screenshots of safe preview/outcome only. Do not capture browser console objects
   containing Firebase users or full configuration.

Run focused desktop browser cases and mobile layout/interaction checks for the
new preview/actions, then npm run build. Record exact commands and actual results.
Full historical browser suites are not acceptance evidence for this feature;
several existing wizard assertions target a previous UI. Do not fix unrelated
tests or analytics transport inside this workstream.

Reconcile the local AI integration guide, active context and documentation index
for the implemented behavior, preserving historical narrative in its archive.
Review unchanged architecture/system rules for affected claims. Lead runs doc-end,
mechanical checks and independent doc-critic, then completion check and separate
fresh final review against actual browser and runtime evidence. Advance baseline
only after approval. Keep the canonical cross-repository plan's obligations linked.

## Risk and rollback

Revert the additive client/UI branch if required, preserving backend pending
attempts. Do not roll back by clearing uncertain JSON, rewriting whole phases,
revoking grants or enabling instances. Existing manual-editor whole-phase behavior
is unchanged. Test restoration is a revision-guarded operation, never a blind PUT.
Preserve real result references and outstanding restoration work across handoffs.

## What this plan does not establish

This plan does not establish final M2/M3 response shapes, browser acceptance,
live provider consent, exclusive named-grant ownership, live model quality or a
successful GenColor save/restore. Those require the named checks above. Mocked
OAuth verifies dashboard binding and state handling only. It does not authorize
paid inference, new providers/scopes, StarChat implementation, external customer
actions, production changes, release or deployment.

## Execution evidence

D1 is independently APPROVED after repairing initial-history failure/delay
recovery and the mobile startup input race. Sixteen focused browser cases pass
on desktop Chromium and mobile WebKit; production build succeeds (hash
2ceac4ff6555d223). All twelve locales contain the 33 new translated keys.
Independent failure/delay probes confirm blocked actions, visible recovery and
retention of uncertain operations. Actual reports are retained under
/tmp/mrcall-ai-kit/skill-configuration/.


D2 and overall canonical M4 independently receive APPROVED. Final frozen checks
pass 20 pending cases and 50 OAuth cases across desktop Chromium/mobile WebKit;
production build passes (hash 1e655aac4ab1a8ba). All twelve locales match 33
pending and 11 handoff keys/placeholders. Real nested field labels, readable
mobile before/after, actual scrolled Save and empty cancellation are covered.
Callback tests exercise exact business/grant/owner/state, replay/tamper rejection,
safe return and effective status refresh with no configuration writes. Unknown
malformed grants are not labeled shared; missing legacy keys remain exactly
empty/shared. Independent reconciliation navigates to the confirmed saved
instance with zero extra Save/connect/write. Actual GenColor test proposal,
preview and persisted discard pass; D3 live Save/readback/restore passes; independent runtime review is approved.
Mock OAuth establishes binding and UI behavior, not live provider consent.


### Integrated GenColor test acceptance

Actual local dashboard → Firebase-authenticated FastAPI → isolated PostgreSQL →
StarChat test passes label-only proposal, readable preview, explicit Save,
dedicated readback, reload with no saved pending, original-label proposal and
explicit guarded restore. Exactly two instance PUTs return200; full phase arrays
match the sole label change and then the original snapshot. Six instances,
siblings/grants and disabled state are preserved. The temporary write gate is
removed; no provider probe or skill action occurs. Model responses are scripted;
this establishes real tool/API/session/UI integration, not live model quality,
real Google consent or deployment. Sanitized actual receipts and raw logs are
under /tmp/mrcall-ai-kit/skill-configuration/. Independent M5 runtime review is APPROVED: separate authenticated history and
array/egress checks confirm restoration, two PUT200, zero OAuth calls and no
pending work. Upstream enabled-invalid candidates return structured refusals;
disabled validation does not establish activation readiness. Documentation and
separate final review govern completion; release remains outside scope.
