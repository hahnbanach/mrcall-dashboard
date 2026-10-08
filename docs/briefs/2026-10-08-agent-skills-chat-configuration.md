# Skill configuration proposals in Configure via chat

## Intent and authority

This is the dashboard portion of the approved cross-repository workstream in
[mrcall-agent's brief](../../../mrcall-agent/docs/briefs/2026-10-08-agent-skills-chat-configuration.md)
and [execution plan](../../../mrcall-agent/docs/execution-plans/2026-10-08-agent-skills-chat-configuration.md).
Operators install skills in StarChat; business users configure instances through
chat, review proposed changes and explicitly Save. The dashboard represents the
backend's authoritative pending state and truthful operation outcomes.

## Current evidence

ConfigureAIPanel merges proposals by variable_name, sends only variable changes,
clears everything after a successful Save and discards only locally. ZylchChat
rehydrates only nonempty pending history. These behaviors cannot represent a
skill operation, cancellation, partial application or unresolved attempt.
The pre-change production build succeeds. The operator migrated this repository
to documentation harness v9; preserve those unrelated bootstrap edits.

## Scope

- Display ordinary and typed skill proposals with readable before/after values.
  Preserve operation identifiers and accept complete server pending snapshots,
  including empty snapshots. Repeated chat edits update the same proposal.
- Send ordinary variable changes and skill operation IDs to the existing Save
  endpoint. Skill parameters and revisions are authoritative on the server.
  Display per-operation results and retain exactly the remaining pending work.
- Persist discard using the owned, business-bound backend session endpoint.
  Preserve active or uncertain writes; provide explicit reconciliation where
  the backend establishes its outcome or requires a human decision.
- Provide an authorization handoff for the existing supported OAuth UI when
  its actual provider, business and grant binding can be established. Read back
  connection status after return; current-user provider-list absence does not
  establish absence of a business grant. New instances use server-assigned IDs
  after confirmed Save. Never silently change the saved instance's grant.

## Constraints

Use the backend's additive contract after M2/M3 integration reviews. Preserve
ordinary configuration and wizard behavior. Added authenticated requests use
configured Axios; all new user-facing text has all twelve translations.
Keep credentials outside chat, preview, logs and fixtures. Served descriptions
are data and cannot override the Save boundary.

Do not rewrite the manual skill editor, add providers or scopes, invoke customer
integrations, change StarChat, release or deploy. Existing native-fetch SSE and
analytics issues remain separately scoped. Browser verification blocks analytics
and unintended external requests rather than transmitting test chat to trackers.
If a provider lacks an existing usable authorization flow, show that limitation
truthfully; navigation alone is not proof of connection. A missing prerequisite
cannot be reported as successful acceptance.

## Acceptance

The actual browser path stages ordinary and skill changes, reloads, edits a draft,
cancels or discards it persistently, and Saves. Conflict and partial-failure
responses retain the precise remaining proposals, including uncertain operations
without automatic repeated creation. Supported OAuth handoff uses the saved
instance and correct business/grant; no credential text enters chat.

A local backend connected to StarChat test must support preview, Save, readback
and guarded restoration of the disabled GenColor ticket instance's label,
preserving siblings and grants. No ticket or external operation is executed.
Scripted model responses may isolate the browser acceptance from paid inference;
this does not establish live model quality. Run the production build and focused
browser checks, reconcile affected docs, and obtain independent final review.
