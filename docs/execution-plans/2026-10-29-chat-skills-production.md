---
status: completed
---

# Chat skills production promotion

Scope: [release brief](../briefs/2026-10-29-chat-skills-production.md).
Owner: lead; independent readiness review before publication.

1. Verify clean release trees, exact tested commits, successful TEST evidence,
   branch/tag ancestry, current production versions and StarChat API compatibility.
2. After readiness review, fast-forward production from origin/dev c40fef81; run
   its mandatory CI and verify ready prod image, all changed source hashes, pure
   captured-probe replay, production StarChat target and public health.
3. Only after the backend is healthy, create unique v2.2.38-production on the exact
   v2.2.38-test source ab4ca78f. Verify workflow and public production assets/routing.
4. Reconcile active contexts and release evidence, preserving superseded paragraphs
   verbatim; explicit doc-critic and mechanical/final completion before docs push.

## Rollback

Prior backend: prod-142fb336; prior dashboard: v2.2.34-production at a1897a3d.
If release health fails, restore the known prior runtime image without force-pushing
branches. Restore frontend by rerunning its prior production tag workflow, never
moving a tag. Roll back frontend first if both have been promoted. Record actual
runtime/branch divergence; any source repair follows reviewed main→dev→production.
No rollback is needed while verified publication succeeds.

## Remaining acceptance

The operator confirms TEST setup; actual production consent, model behavior,
caller booking and Sheets appends remain customer-owned tests. Publication never
invokes those external actions or copies TEST business data into production.

## Delivery evidence

Readiness APPROVED by the independent release reviewer. Production read-only enabled
OAuth candidate validation returns valid=true, no diagnostics; unresolved-destination
probe confirms the column-deferral contract without Google access. Backend source
c40fef81ee67d2cf62e232cfc5badc2d455b6870 is promoted by fast-forward from dev, pipeline3003971723
successful. Ready digest sha256:81cc8779d964fa2ce1a3882eb546da50fb93d6ecce710d9c01a19ee466aaa064; 21 exact module hashes, runtime no-write replay,
production API target and HTTP200 health verified. Dashboard v2.2.38-production is
on the exact TEST source ab4ca78fcabd47371e4cac3b4e9ea932d6381fa3, workflow40879746700 successful,
104 public JS/CSS assets match CI names, new flow markers and production
API targets present. No customer state, history, consent, provider action, beta or
StarChat deployment occurs. No rollback required. User production acceptance remains
separate from source/runtime publication evidence.
