---
doc_baseline_commit: a775f4d231bd91ce9905e39f051a100f7b96efeb
doc_baseline_date: 2026-10-26
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Production remains v2.2.25 in the last observed delivery evidence. TEST runs
v2.2.33-test on8190c4b (workflow40318787864, observed served app.c34fcf69.js).
The local v2.2.34 refresh candidate starts from clean a775f4d and is unpublished.
It refreshes confirmed saved skill phases in the mounted parent while preserving
ordinary/dirty skill edits and owner/business identity. Coalesced reads protect
successive saves; the [plan](execution-plans/2026-10-26-skill-save-refresh.md)
tracks the remaining integration/final gates and actual verification.

The reported calendar draft is saved and enabled on TEST: authoritative skill and
business reads agree, pending is cleared, and Save has confirmed readback. An
existing subsequent call invokes the loaded skill and reads calendar availability.
That is not proof of booking creation or an explanation of the earlier callback
response. The initial account-only grant observation is historical: subsequent
read-only metadata now includes an active exact-business/default grant.

The UI defect is reproduced locally on released source: confirmed Save leaves
zero displayed instances until page reload, while mocked server state has one
enabled instance. The final47 affected browser cases pass on the exact frozen build; independent
integration review approves coalescing overlapping saves, failed-read recovery and
unsaved-edit/identity guards.
No live Save, consent, call or model trial is part of this UI repair verification.

Session ownership remains with the deployed guard: every nonpublic route needs a
session, the Axios interceptor alone ends it, and components suppress failure UI
for isSessionEnded. Local browser fixtures use mocked backend calls.

## Unresolved

- Outside this Save assignment, the first callback response remains unexplained. Retained runtime
  correlation exists, but available exact-ID and bounded-time call-history reads
  return no record under the available identity; archived trace access is unknown.
- The refresh repair needs final approval and authorized TEST publication.
- Actual booking creation is unverified; availability and Save are separate facts.
- AI chat SSE uses native fetch and bypasses the Axios interceptor; WebSockets do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Retained unit-test timing and mobile OAuth enable-wait instability remain open.

## Next

Finish final review and authorized TEST rollout for Save and its consistent view.
Preserve unsaved edits, pending operations and exact business grant boundaries.
The operator assigns booking setup and first callback diagnosis to another session; no new
provider/model action or production promotion is authorized by this UI work.
