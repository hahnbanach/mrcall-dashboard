# Google Sheets call log through account authorization

Replace the chat's shared-service-account/eight-fixed-column policy with the
operator's requested flow: ask for a blank Google spreadsheet's copied link;
prepare google_sheets_write in final; offer Google account consent in chat;
after verified consent reread the draft/saved mapping and extracted variables,
explain columns, ask approval or edit them, and finally use explicit Save.

Default columns match production assistant3375577063: Timestamp, Phone, Contact,
Reason and ConversationId. Extracted fields in ASSISTANT_TOOL_VARIABLE_EXTRACTION
can be mapped through crm.contact.variables.<name>. Existing custom mappings and
opaque grant references must survive. No public-link permission or service-account
sharing instruction; copying a restricted file link does not change its ACL.

Reuse authenticated skill APIs, owned durable drafts, PKCE/state/owner/business
binding and revisioned Save/probes. Extend chat support to google_sheets with the
manifest's spreadsheets write scope. A verified callback resumes a read/check/explain
turn only; it never saves or appends. Unknown/denied/mismatched scope/owner/session
must not resume. Save may report verified read access with write permission/tab
explicitly unchecked, because the probe cannot prove writing without appending.
No test row. All customer-facing copy follows the chat language; no fixed English
summary. Explain Advanced → Go to the MrCall app (unsafe) → review permissions /
Continue only when Google presents that unverified-app warning; never claim Google
verification or promise bypass of an administrator block.

Scope: mrcall-agent and isolated dashboard worktree. Preserve Calendar/booking,
sign-in and manual-editor flows. Source implementation and focused checks/reviews
are authorized; release requires separate authorization. No production changes,
customer OAuth, provider writes, model trial or conversation reset in this task.
