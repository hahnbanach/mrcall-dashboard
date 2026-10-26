---
status: completed
---

# Clean TEST delivery and assistant-scoped Google connection

## Basis, dependencies and ownership

The [brief](../briefs/2026-10-26-readable-skill-preview.md) governs this fresh
candidate. The worktree starts clean at c2b2a589 (deployed TEST v2.2.32), branch
v2.2.33. Historical dirty-tree approvals and 110-case/build receipts do not
approve this composition. Fresh brief and plan gates precede implementation.

Parent owns the clean-base port and packaging. Worker owns M3 implementation,
twelve-locale copy, affected documentation and closure. They are not alone in
the workspace and must preserve each other's approved changes. No original WIP
is copied as a complete directory or callback replacement.

## PORT — Minimal reviewed source port

After plan approval, parent applies only the owned source/test patch at
/tmp/mrcall-calendar-access/delivery/source-only-on-test.patch, adapting conflicting
hunks deliberately. Retain deployed session guard/isSessionEnded, manual-editor
manifest scopes and the legacy callback/providerAccountId path. Verify source
composition against the clean deployed base and run its meaningful smoke/build
checks. Obtain a fresh integration review before dependent M3 implementation.

## M3 — Truthful account and assistant connection screens

After PORT approval, worker owns:

- src/components/ConnectCalendar.vue: optional businessId mode; Account's default
  transport remains unchanged with minimal account-level explanatory copy, while
  business mode delegates to a small scoped component and shows global
  information separately. Session-ended errors remain quiet via isSessionEnded.
- src/views/business/BusinessConfiguration.vue: pass its actual current ID only.
- New src/components/AssistantCalendarConnection.vue and, if needed,
  src/utils/AssistantCalendarConnection.js: exact business/default-grant status,
  explicit existing business consent URL, unknown negative/malformed states,
  race/owner/business handling and no global disconnect masquerade.
- Twelve locale files and new tests/e2e/skills/assistant-calendar-connection.spec.js
  plus a bounded fixture if useful.

Use the existing business authorization URL helper from the port. Business
status GET uses businessId and grantName=''. Nonempty list means availability,
not ready/booked; all negative/empty/unknown responses remain unknown. No new
OAuth provider, scope registry, grant mutation API or calendar selection write.
The component must not auto-Save or alter the server-owned pending proposal.

Capture a baseline smoke on the port before M3 source edits. Test global-connected
same-calendar/no-business case on both screens, unchanged Account registry writes,
business-bound authorization/callback and exact queries, draft retention and
explicit Save/probe, negative/empty/malformed/revoked cases, locale coverage and
busy/error handling. Run affected combined desktop/mobile browser cases, focused
lint and production build on the resulting candidate. Obtain fresh M3 review.

## Documentation and separate final review

The lead personally reconciles current facts against newer deployed docs; no
blanket overwrite from the historical worktree. Affected contracts include
ARCHITECTURE, system rules, Google OAuth and Zylch integration, indexes and living
context. Preserve superseded snapshot prose verbatim in the archive. Record
actual source composition, command counts and live limits; scripted acceptance
is distinct from real consent or live Save. Run mechanical/keyword checks and
explicit doc-critic including active-context shape, then a separate final review
of all prior approvals and the final-user path. Checker alone transitions this
plan to completed and updates baseline metadata.

## Risk, bounds and rollback

Fresh approvals aim within five minutes. The coordinator’s later resource bound
is one overall 25-minute target from 10:54:50 UTC, including PORT, M3 and checks;
external consent is excluded. This narrows the execution budget without changing
the approved feature scope.
Do not loop paid/model tests. The new source is reversible without stored-data
changes: restore only owned hunks on this clean base if a regression is found.
Failed or unknown resource access must preserve the pending operation and the
business boundary. No commit, push, release, deployment or live consent authority
is granted here; coordinator owns any further delivery instruction.

## Current verification

Fresh brief and plan are approved. PORT is separately approved against exact
c2b2a589; the retained immutable Vue milestone and all reviewed source hashes
bind that composition. Corrected configured TEST build and two browser user paths
pass; no original WIP or callback overwrite was imported.

M3 introduces the scoped component and minimal wiring; Account transport stays
unchanged while its description clarifies account scope. New two-screen fixtures
exercise same-calendar global connection with absent business availability,
legacy registry writes, bound consent, retained pending and explicit Save, plus
negative/malformed/other-business availability and refresh. The initial fixture
failures came from route shadowing and a missing ordinary-field dependency array;
those fixtures were corrected without weakening assertions or app workarounds.
Command results and exact counts remain in retained scoped receipts outside the
repository. The local checks claim no live consent, grant write or Save/activation; actual
TEST publication is recorded separately below.


Coordinator-directed M3 negative-case refinement keeps unresolved or changed
route IDs in explicit assistant mode. An omitted component prop is Account
context; an explicit empty ID is unresolved assistant context, with no consent
or status requests. Two actual in-app VueRouter tests cover missing and changed
IDs without adding page reinitialization or changing backend policy. The source
change requires affected M3 desktop/mobile checks and build/lint; unchanged
summary and OAuth evidence is retained only with matching source hashes.


## Authorized TEST release evidence

The coordinator relayed explicit operator approval to publish dashboard TEST.
Tag `v2.2.33-test` targets commit `8190c4b51bf3bbae1a9af189b4f09be802701c62`,
tree `8e0674f785165351372fb44422f8d6d545662a8b`, identical to the frozen reviewed
34-path package. The original dirty worktree is excluded. The branch push was
already in flight when the operator requested pull first; before tag publication,
actual `git pull --ff-only origin v2.2` and `origin v2.2.33` both reported already
up to date. No forced history or deployment tag movement occurred.

[Deployment 40318787864](https://github.com/hahnbanach/mrcall-dashboard/actions/runs/40318787864)
completed successfully at 2026-10-26 11:58:56 UTC. Public TEST index references
104 JS/CSS assets, all HTTP 200 and all names present in that CI build.
The app is `app.c34fcf69.js`, SHA256
`6ea8d3df406082cfe305475b890f09cc72cfacc1de0616bb98540a9eb8b026f4`.
This binds observed served filenames to the CI build, not a byte comparison
against a downloaded CI artifact.

Read-only browser navigation uses the genuinely configured Support Firebase
session with no API response mocks. Account renders clarified account-level
copy with registry GET 200. The exact target assistant renders both separate
status cards, unknown availability, registry GET 200 and exact business-scoped
GET 200. This is Support's account metadata, not a Mario-authenticated browser
check. An ID-token-only restoration first failed the client's forced refresh;
the normal stored Support refresh session established the successful check.
No consent, Connect, Disconnect or Save action ran. Receipts remain outside
source in `/tmp/mrcall-assistant-google-test/`, including `served-assets.json`,
`live-readonly-receipt.json` and `deploy-completed.log`.

Real Google consent, Mario's live enabled Save/activation, actual booking,
production/beta promotion and backend prompt publication remain open. The backend
local guidance commits need separate disposition; this dashboard tag does not
publish them. This documentation follow-up changes no application source and
requires no new deployment tag.
