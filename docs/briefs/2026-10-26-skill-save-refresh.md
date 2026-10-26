# Show confirmed skill saves in the current dashboard page

## Problem and evidence

On released TEST source8190c4b, a real browser with mocked API responses reproduces:
chat Save confirms an enabled skill and clears pending; navigating to the skill
editor in the same mounted page shows no instance; full reload shows it. The
editor reads the parent's cached business phase variables. Chat Save updates only
its own pending/outcome state. External receipts and reproducer are retained in
/tmp/mrcall-ui-save-repro; all597 reviewed build hashes match the baseline.

## Intended behavior and scope

A confirmed saved skill outcome refreshes the selected business's authoritative
skill phase projection in the parent without a page reload. Refresh only phases
with known saved operations, including create/replace/remove; partial Save refreshes
its successful phases while refused/conflicting/uncertain operations remain pending.
No new Save, activation, provider action or ordinary configuration write occurs.

Only ConfigureAIPanel, BusinessConfiguration, focused browser fixtures/regressions,
necessary localized refresh warnings and documentation change. Use the existing
saved-configuration reader. Preserve unsaved ordinary edits. Preserve unsaved manual
skill edits: compare against the loaded phase baseline and retain dirty phases with
an explicit warning instead of silently overwriting them. Changed business/owner,
stale async responses, failed reads and malformed configuration must not replace
current state or claim refresh success. Existing session-ended suppression remains.

## Acceptance and boundaries

The local browser reproducer becomes a regression: after confirmed Save, navigation
shows the saved enabled instance without reload; unsaved ordinary edits survive.
Relevant partial/failed/uncertain Save, dirty manual phase and route-change cases
prove the guarded boundary. Lint, production-optimized TEST build and independent
reviews pass. Source is based on latest clean v2.2.33/a775f4d with original WIP
preserved. Dashboard TEST publication is authorized; pull/integrate before every
push, normal tag deployment, CI and served-artifact checks; production excluded.

The user's first callback response is a separate unresolved acceptance condition.
Actual later availability does not prove booking creation or explain that first
response. No paid model trial, live consent, live Save, new call or booking test.
Target first repair/integration review within20minutes, with5minute checkpoints.


## Operator scope clarification

The operator assigns booking setup and the earlier callback diagnosis to a separate
session. Current acceptance is Save persistence and a consistent dashboard view.
The earlier callback remains unexplained; no booking success is claimed here.
