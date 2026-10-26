---
status: completed
---

# Refresh the editor after confirmed chat skill Save

## Scope and ownership

The [approved brief](../briefs/2026-10-26-skill-save-refresh.md) governs work on
clean v2.2.34 from a775f4d (released application source8190c4b). Lead owns the two
components, necessary12-locale warnings, focused saved-refresh browser fixture/spec
and documentation. Independent reviewers own each gate; preserve original WIP.
Baseline external browser reproducer passes while explicitly observing the defect.

## M1 — Confirmed outcome and guarded parent refresh

After plan approval, ConfigureAIPanel captures business/owner/selected operations
before Save. Emit saved phase IDs only for known operations whose outcome is saved,
including partial successes and removes; refused/conflict/unconfirmed outcomes
produce no refresh. Existing pending adoption and explicit handoff remain intact.

BusinessConfiguration listens and reads existing authoritative saved configuration.
Keep a phase baseline from initial load, successful manual Save and explicit saved
handoff. Update only clean affected phases through the existing phase serializer,
leaving ordinary edits intact. A dirty local phase differing from both baseline and
remote stays untouched with an explicit localized warning; refresh failure is a
separate warning and cannot turn a saved outcome into a failed Save. Respect
session-ended suppression. Guard owner, actual route/business identity, original
business object and generation; owner/route change, unmount or renewed baseline
invalidate delayed responses. No auto-Save or provider mutation.

Before dependent closure, run actual browser paths: create Save then same-page
editor shows active instance; ordinary edit survives; partial success refreshes only
saved phases; all refused/uncertain does not refresh; dirty phase preserved; delayed
read after route change ignored. A failed/malformed refresh preserves cached state
and shows truthful recovery. Use local mocked transport only. Run affected existing
pending/OAuth browser checks, focused lint and production-optimized TEST build.
Obtain fresh M1 integration review against actual retained results.

## Closure and authorized TEST delivery

Lead reconciles changed/unchanged architecture, chat contract, Google contract and
living state, preserving old narrative verbatim in archive. First-call callback
cause and actual booking remain open, distinct from this UI repair. Run required
mechanical/keyword/focused checks, explicit doc-critic and separate final review;
checker alone finalizes baseline/status. Retain immutable approved artifact copies.

After approval, commit and explicit ff-only pull latest base before branch push;
no force history. Publish new TEST tag on exact reviewed source. CI success and
served index/assets bind deployment; no production tag or backend/provider action.
Docs-only post-release receipt may land on the version branch without redeploying.
Restore owned source through a reviewed successor if rollback is needed; preserve
server pending and unsaved edits. Target M1 within20minutes,5minute checkpoints;
external CI delays reported separately, no paid model acceptance loops.


## Current verification

Brief and plan are independently approved. The released-source reproducer binds
all597 prior build hashes and observes zero same-page cards versus one after reload.
The first candidate passes focused lint, optimized TEST build,45 affected browser
cases and two strengthened read-timing cases. Superseded failures are retained:
the original assertion counted an existing editor read after navigation rather
than checking only the Save-triggered delta.

M1 returns REVISE for an actual overlapping-save race: newer refresh invalidation
could drop an earlier saved phase. The repaired candidate coalesces pending phases,
retains them through read failure/dirty phases, and invalidates obsolete scope.
New two-Save and failed-latest-read/three-Save browser regressions require every
saved phase to appear. The resulting build/check/review evidence is recorded below. The original
13:42 UTC integration target is missed; revised completion estimates preserve it.
First-call callback cause and real booking remain open; no live acceptance runs.


The operator now excludes booking setup and the first-call diagnosis from this
assignment; Save and its UI projection are the only current acceptance scope.
The coalesced-phase repair passes11 exact-build browser regressions, including
both delayed cross-phase saves and recovery after the newest read fails. Full47
new/existing cases pass on the same frozen source; the resulting same-reviewer M1 approval is recorded below.


Final frozen source passes lint, the optimized TEST build and47 affected browser
cases (11 new,36 existing pending/OAuth). The same M1 reviewer independently
approves the repaired queue; immutable panel/source hashes and actual reports are
retained in /tmp/mrcall-ui-save-refresh. Earlier11-case and two timing checks are
separate evidence, not added to47. No further source refinement is planned unless
a required check/review finds a blocking failure. Closure/release follows the
revised estimate14:00–14:03 UTC, retaining the missed original13:42 milestone.


## Verified TEST delivery

Reviewed commit `a1897a3dbb00d5c0eaf484c3c1af1e89ed0345da` is published under
`v2.2.34-test`. Actual ff-only pulls of origin/v2.2.33 and then origin/v2.2.34
precede the branch and tag pushes respectively; both are already up to date.
No forced history, production tag or original-worktree WIP is included.

[Workflow40335393257](https://github.com/hahnbanach/mrcall-dashboard/actions/runs/40335393257)
completes successfully on that exact tag/commit. Observed at14:01:13 UTC, public
TEST serves104 index JS/CSS assets, allHTTP200 and names matching the CI build.
The new app is `/js/app.b0847d40.js`, SHA256
`0513afff38c7674eda9bb2333eec424e9b861b1630715bf334a2fa9276268fdc`;
its content includes skills-saved, skillRefreshPhases and both refresh warning
markers. This is served filename/build association plus markers, not byte identity
against a downloaded CI artifact. Receipts are deploy-completed.json/log and
served-assets.json in /tmp/mrcall-ui-save-refresh.

No new live Save, provider action, model trial or call is performed. Earlier real
Save persistence is retained evidence, while repaired same-page behavior uses the
47-case browser acceptance. Booking configuration/callback diagnosis belongs to
the operator's separate session. This docs-only follow-up does not move the TEST
tag or redeploy. The original13:42 milestone miss remains recorded above.
