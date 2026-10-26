---
doc_baseline_commit: 12b077136e8de34e2f72bb038a771ae5318a9e9e
doc_baseline_date: 2026-10-26
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Production runs v2.2.34-production on the same tested a1897a3 commit
(successful workflow40336664459, served app.2fa78ebf.js). All104 index JS/CSS
assets returnHTTP200 with names matching production CI; refresh markers and
production backend references are present. The operator reports TEST passed and
explicitly authorizes this production promotion. TEST runs
v2.2.34-test on a1897a3 (successful workflow40335393257). The observed served
app.b0847d40.js contains the refresh markers; all104 index JS/CSS assets return
HTTP200 with filenames matching CI. The release starts from clean a775f4d.
It refreshes confirmed saved skill phases in the mounted parent while preserving
ordinary/dirty skill edits and owner/business identity. Coalesced reads protect
successive saves; the [plan](execution-plans/2026-10-26-skill-save-refresh.md)
records completed integration/final gates and actual verification.

Retained13:10 TEST readback confirms the reported calendar Save: skill and
business reads agree on the enabled instance, pending is cleared and Save has
confirmed readback. An
existing subsequent call invokes the loaded skill and reads calendar availability.
That is not proof of booking creation or an explanation of the earlier callback
response. The initial account-only grant observation is historical: subsequent
read-only metadata now includes an active exact-business/default grant.

The UI defect is reproduced locally on prior released8190c4b source: confirmed Save leaves
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
- The repaired UI has local mocked-browser acceptance, the operator's reported
  TEST acceptance and both environments' published-artifact checks. No new live
  production Save is performed by this deployment task.
- Actual booking creation is unverified; availability and Save are separate facts.
- AI chat SSE uses native fetch and bypasses the Axios interceptor; WebSockets do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Retained unit-test timing and mobile OAuth enable-wait instability remain open.

## Next

Keep Save and its consistent view within the reviewed boundary; use the retained
regressions for subsequent changes.
Preserve unsaved edits, pending operations and exact business grant boundaries.
Booking setup and first callback diagnosis remain assigned to another session.
This same-code dashboard promotion changes no backend deployment, provider grant
or saved customer configuration.
