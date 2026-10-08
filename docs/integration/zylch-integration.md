# Zylch AI integration

## Ownership and configuration

The dashboard's AI configuration client is `src/utils/Zylch.js`, targeting
`VUE_APP_ZYLCH_URL`. StarChat remains the owner of business configuration and
resource counters, accessed through `VUE_APP_STARCHAT_URL`. The AI backend is
mrcall-agent; its deployment and internal implementation belong to that repository.

The integration requires both services to accept the dashboard's Firebase token
and target the same StarChat environment. The shared Firebase project contract
is `talkmeapp-e696c`. Local and deployed backend configuration and server-side
sandbox enforcement require verification in the owning repository.

## Runtime path

`src/views/business/BusinessConfiguration.vue` renders `ConfigureAIPanel.vue`,
which embeds `ZylchChat.vue`. The panel scopes sessions by owner and business:
`mrcall_config_<uid>_<businessId>`.

On mount, the chat loads history using the initial session ID. The panel silently
sends `/mrcall open <businessId>` with the response hidden. After this request
finishes, the panel enables quick actions and transforms ordinary user messages
into `/agent mrcall run "<text>"`. Slash commands pass through directly.

The chat sends messages through `sendMessageStream`, parses SSE events, and
renders text deltas, replacements, tool results, progress, errors and completion.
It supports file attachments encoded as base64 with `name`, `media_type` and
`data`. The component limits each file to 20 MB. History and streamed metadata
can emit `pending-changes` to the parent panel.

## Client API

Methods take the Firebase user as their first argument. Requests use
`Authorization: Bearer <user.accessToken>`. Both message methods add
`X-Client-Source: mrcall_dashboard`.

| Method | HTTP request | Purpose |
|---|---|---|
| `sendMessage` | `POST /api/chat/message` | JSON message request |
| `sendMessageStream` | `POST /api/chat/message/stream` | SSE message request used by the chat |
| `getHistory` | `GET /api/chat/history` | History and pending changes for a session |
| `listSessions` | `GET /api/chat/sessions` | Session listing helper |
| `deleteSession` | `DELETE /api/chat/session/{sessionId}` | Session deletion helper |
| `getJobStatus` | `GET /api/jobs/{jobId}` | Job status helper |
| `getActiveJob` | `GET /api/jobs/active` | Active job lookup helper |
| `stopJob` | `POST /api/jobs/{jobId}/stop` | Job cancellation helper |
| `applyChanges` | `POST /api/mrcall/apply-changes` | Save ordinary changes and stored skill operation IDs |
| `discardPending` | `POST /api/mrcall/pending/discard` | Persist discard of matching unsent proposals |
| `reconcilePending` | `POST /api/mrcall/pending/reconcile` | Read or explicitly resolve an uncertain skill attempt |

This table describes implemented client methods, not a guarantee that every
helper has a current UI caller or that the server is reachable. There is no
`healthCheck`, `getTrainingStatus`, `startTraining`, or `resetVariables` method
in the current client.

Axios requests use the global response interceptor installed by `src/main.js`
from `src/firebase/axiosConfig.js`, which refreshes Firebase tokens and retries
401 responses. The SSE method uses native `fetch` and does not receive that
interceptor; streaming HTTP failures go to the chat error callback. The project
rule remains to use the configured Axios instance for authenticated requests;
the existing SSE path is a discrepancy requiring a separate application fix.

## Pending changes and Save

ConfigureAIPanel accepts the backend's complete pending snapshot from history,
streamed metadata and action responses, including empty cancellations. Ordinary
items use variable_name; typed skill items use kind=skill_instance and operation_id.
Preview shows safe before/after values with served localized skill/field labels,
phase, action and saved instance or draft identity. Values render as text.

Save sends ordinary values and skill operation IDs:

```json
{
  "business_id": "<businessId>",
  "changes": [{"variable_name": "<name>", "new_value": "<value>"}],
  "skill_operation_ids": ["<server-stored-operation-id>"],
  "session_id": "mrcall_config_<uid>_<businessId>"
}
```

The backend owns skill parameters, revisions, authority checks and write journals;
they are not Save inputs from the browser. Additive skill_outcomes distinguish
saved, refused, conflict, pending and unconfirmed results. The panel adopts
remaining_pending; a successful response does not erase concurrent proposals.
Legacy responses without a snapshot cause a history reload. Chat edits and
Save/discard/reconcile requests are mutually disabled while processing.

Discard posts business/session, ordinary name/value matches and skill operation
IDs. The returned snapshot retains active or uncertain work. An uncertain create
is excluded from a new Save; the user can reread its outcome and then explicitly
accept a candidate or close without retry when the backend allows those actions.
Initial history is unresolved until an authoritative pending array or null is
received. Failure keeps a visible recovery control and blocks proposals/actions;
a delayed history response cannot expose an empty list as confirmed.
Closing an uncertain attempt is not a claim that it saved. A lost action response
causes history reload; failed reload blocks further actions until refresh succeeds.

Wizard sessions retain ordinary auto-apply with their own session ID. Typed skill
operations never enter that batch. Backend proposal support requires the explicit
ConfigureAI session; wizard guidance opens that flow without claiming that
navigation transfers a pending proposal between different session identifiers.
Local browser/runtime acceptance and deployment state are recorded in
[active-context](../active-context.md) and the
[workstream plan](../execution-plans/2026-10-08-agent-skills-chat-configuration.md).

## Skill authorization handoff

Confirmed Save outcomes can open the existing skill editor for the saved
phase/instance. BusinessConfiguration rereads the dedicated configuration and
selects the visible collection containing the skill widget dynamically. Missing
instances or inaccessible template sections produce an unavailable handoff.
The editor uses the exact saved grant reference; it does not invent one from
instanceId or silently change configuration. Empty references are shared
rather than per-instance authorization.

The supported flow is Google Calendar with the existing allowed scopes. Other
providers/scopes remain unavailable. GoogleAuthFlow.begin accepts a normalized
skill context containing provider, business, grant, phase, instance, owner UID,
local return destination and scopes. Its single-use state includes a digest of
that context. consumeWithContext clears verifier/state/context, verifies the
returned state and digest, and rejects missing/changed context or unsafe return
locations. The callback verifies the restored Firebase owner before exchange
and connect, then sends the exact businessId/grantName to the existing provider
connect endpoint. Tokens stay in the existing authorization transport and never
enter chat or pending previews. Legacy sign-in/calendar flows remain separate.

Returning to the bound business/phase/instance refreshes saved configuration
and supported calendar availability. A positive calendar list establishes
effective availability, including possible shared fallback; it does not prove
exclusive ownership of a named grant. Empty/error/malformed responses remain
unknown. Current-user provider-list absence does not prove business grants are
missing. The existing calendar GET can persist provider account metadata;
these editor checks are outside chat/proposal validation. Authorization does
not enable an instance or perform a configuration write. A new grant reference
requires an explicit configuration proposal and Save before it is used.

## Credits display

`Businesses.vue` reads `CALLCREDIT` directly from StarChat's
`/mrcall/v1/mrcall0/crm/business/resources/count` and displays euros by dividing
credits by 100. It fetches `CALLCREDIT`, `CALL`, and `SMS` separately. The dashboard
has no call to `/api/desktop/llm/balance`. Tooltip keys are
`mrcallCredits.title` and `mrcallCredits.tooltip`, present in all 12 locales;
`creditTooltipFactor` selects the template's `CALLCREDIT_FACTOR`, defaulting to 25.
See [architecture](../ARCHITECTURE.md#per-business-credits-tile-businessesvue).

## Troubleshooting

- Missing business data: verify that the dashboard's StarChat target matches
  the AI backend's StarChat target; backend configuration belongs to mrcall-agent.
- 401: verify token validity and the shared Firebase configuration. Axios can
  retry after refresh; streaming requests require a fresh attempt.
- Empty or failed chat: check `VUE_APP_ZYLCH_URL`, browser network responses and
  AI backend availability. The client has no health-check helper.
- Pending changes after Discard: active or uncertain attempts are retained for
  reconciliation. Refresh the owned session and inspect its operation state.

## Cross-project billing contract requiring verification

The adopted project guidance describes `CALLCREDIT` as a shared pool for phone
calls, configurator chat and MrCall Desktop, with topups named `call50_euros`,
`call300_euros`, and `call600_euros` under resource category `CALLCREDIT`.
Those backend product names and cross-client charging semantics are not
established by the current dashboard source. Preserve them as an unverified
cross-project contract and check StarChat and mrcall-agent before relying on
them. The dashboard's `/plan` route is implemented; its presence alone does not
verify that product catalogue.
