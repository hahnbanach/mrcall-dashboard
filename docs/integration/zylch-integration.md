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
| `getBookingSetup` | `GET /api/mrcall/booking/setup` | Owned five-skill setup token and safe calendar choices |
| `activateBooking` | `POST /api/mrcall/booking/activate` | Explicit connection/selection completes only that five-skill group |
| `reconcilePending` | `POST /api/mrcall/pending/reconcile` | Read or explicitly resolve an uncertain skill attempt |

This table describes implemented client methods, not a guarantee that every
helper has a current UI caller or that the server is reachable. There is no
`healthCheck`, `getTrainingStatus`, `startTraining`, or `resetVariables` method
in the current client.

Axios requests use the global response interceptor installed by `src/main.js`
from `src/firebase/axiosConfig.js`, which refreshes Firebase tokens and retries
401 responses, and ends the session when a retry is refused again (see
[architecture](../ARCHITECTURE.md#authenticated-axios-request)). The SSE method uses native `fetch` and does not receive that
interceptor; streaming HTTP failures go to the chat error callback. The project
rule remains to use the configured Axios instance for authenticated requests;
the existing SSE path is a discrepancy requiring a separate application fix.

## Pending changes and Save

ConfigureAIPanel accepts the backend's complete pending snapshot from history,
streamed metadata and action responses, including empty cancellations. Ordinary
items use variable_name; typed skill items use kind=skill_instance and operation_id.
Preview uses served localized labels, readable values and explicit proposed
activation state. Exact changed values and technical identities remain in
collapsed details; creates omit empty Before values while edits retain both
sides. Safe resource-access guidance identifies the skill rather than exposing
operation IDs by default. Values render as text.

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

The panel emits confirmed saved phases, bound to the original
owner/business, to BusinessConfiguration. The parent reads authoritative saved
configuration and updates only those phase projections in its existing business
object; ordinary edits stay intact. Successive notices coalesce outstanding phases
so a newer read cannot lose an earlier saved phase. Failed reads retain the queue;
dirty local phases stay queued and unchanged with an explicit warning. Baseline,
owner/route and unmount invalidation discard obsolete responses. Refresh never
performs Save, activation or provider authorization. The plan records current
verification and deployment status.

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

Unsaved create proposals with an applicable unnamed Google Calendar reference
can start explicit business authorization before Save. The supported catalogue
and stored pending parameters determine eligibility; named/default-named grants,
saved edits, unsupported metadata and uncertain operations remain excluded.
The business target binds owner, provider, business, scopes, state/digest and a
safe return without a fabricated saved-instance identity. It uses the existing
connect endpoint with exact businessId and empty grantName. Generic consent never
changes pending parameters or enables an instance. The booking-only continuation
below is a separate explicit activation action through the backend Save/probe path.

There is no calendar connection on Account or in `__SEND_DATA__`. See
[Google OAuth](google-oauth.md#business-wide-consent-from-the-chat).

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
enter chat or pending previews. Google sign-in remains separate, and there is no
account-level calendar connection. The v2.2 manual editor retains its
manifest-driven authorization and explicit automatic save before redirect; its
callback refuses, before the code exchange, a connect that carries no business,
which StarChat would store as the owner's account-level row. Chat
handoff cards use the exact already-saved reference without that automatic write.
Both skill callbacks preserve the provider account identity from the exchanged
ID token when supplied; see [Google OAuth](google-oauth.md).

Returning to the bound business/phase/instance refreshes saved configuration
and supported calendar availability. A positive calendar list establishes
effective availability, including possible shared fallback; it does not prove
exclusive ownership of a named grant. Empty/error/malformed responses remain
unknown. Current-user provider-list absence does not prove business grants are
missing. The existing calendar GET can persist provider account metadata;
these editor checks are outside chat/proposal validation. Generic authorization does
not enable an instance or perform a configuration write; the explicitly authorized
five-skill booking continuation below is separate. A new grant reference
requires an explicit configuration proposal and Save before it is used.

## Five-skill booking connection

`BookingCalendarConnection.vue` recognizes the complete booking group through the backend's
owned-session setup status, for unsaved drafts and saved disabled instances. Its Connect
Calendar action explains activation. `BookingConnection.js` stores a 15-minute sessionStorage
intent binding owner, business, session, setup token and exact OAuth state. GoogleCallback
marks it connected only after the existing context/state/owner/scope checks and successful
provider/connect. Failure clears it. A query marker alone never authorizes activation.

Returning to the same chat consumes the successful intent once. A matching unchanged setup
with one verified calendar can finish automatically; multiple calendars require a choice by
name. Already-connected configurations require an explicit destination/activation action.
Owner/business changes and unmount invalidate old responses and release busy state. Reload
cannot replay an activation. Existing generic/manual connection behavior stays separate.

The authenticated GET setup response supplies available/state/setup_token/connection_status,
calendar rows `{id, summary, primary}` and served oauth_scopes. POST activation sends only
business_id/session_id/setup_token/calendar_id. The backend owns exact-group validation,
plan, fresh calendar access, staging and revisioned Save/probe/journal/readback. The panel
adopts authoritative remaining_pending and per-operation outcomes, and refreshes confirmed
saved phases through the existing guarded parent path. Partial/uncertain results never
claim booking active or silently retry. Named/unsupported grants keep their existing route.

Booking tool results with display_summary=false do not append a fixed English summary;
pending metadata and the model's closing response remain intact. The five-skill review is
collapsed by default; runtime instruction/template fields remain only in exact details.
The chat/composer has a usable minimum size and the panel scrolls when constrained, keeping
connection, review and Save controls separate. New UI copy is translated in all 12 locales.
Advanced settings is a fallback only when the supported booking connection action is unavailable.

## Credits display

`Businesses.vue` reads `CALLCREDIT` from StarChat's
`/mrcall/v1/mrcall0/crm/business/resources/balance` (net of debt; `count` only when
that endpoint answers 404) and displays euros by dividing credits by 100. `CALL`
and `SMS` come from `.../resources/count`. The dashboard
has no call to `/api/desktop/llm/balance`. Tooltip keys are
`mrcallCredits.title` and `mrcallCredits.tooltip`, present in all 12 locales;
`creditTooltipFactor` selects the template's `CALLCREDIT_FACTOR`, defaulting to 25.
See [architecture](../ARCHITECTURE.md#per-business-credits-tile-businessesvue).

## Troubleshooting

- Missing business data: verify that the dashboard's StarChat target matches
  the AI backend's StarChat target; backend configuration belongs to mrcall-agent.
- 401: verify token validity and the shared Firebase configuration. Axios
  retries once after refresh and then ends the session (sign-in with the
  session-expired dialog); streaming requests require a fresh attempt.
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
