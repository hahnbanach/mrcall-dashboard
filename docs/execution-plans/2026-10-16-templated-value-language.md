---
status: active
brief: ../briefs/2026-10-16-templated-value-language.md
owner: dashboard release lead (this line, v2.2)
created: 2026-10-16
---

# Held templated value judged by its engine

## Classification

This changes the validation that gates Save, so it is not on the fast path. It is a single
function, one widget binding and their tests, with no dependency, data or backend change. One
commit carries both the fix and its test. Release and deployment are authorized separately.

## Steps

1. Unit cases in `tests/unit/templatedVoiceOptions.spec.js`, run on `d2b96fc` and seen failing.
   - Done: 2 of 7 failed. voice55 was reported under live on it_IT, and `templatedChoices` did
     not exist.
2. `unavailableTemplatedValue` judges `dependsOn` only. `templatedChoices` lists the held valid
   value. `TemplatedVariable.vue` binds `templatedChoices`.
   - Done: 7 of 7 pass.
3. Gates on `v2.2`: lint, full vitest, full Playwright.
   - Done: lint clean; vitest 213 of 213; Playwright 992 passed, 5 skipped, 0 failed.
4. Cherry-pick onto `6d3b5dd` (`v2.2.21`), then vitest and Playwright there. The tag on that
   line is cut only with Angelo's go.
5. A fresh reviewer reads the diff against this brief before the commit is tagged.
   - Done: APPROVED. Reviewed copies of the brief, the plan and the diff are retained outside
     the repository.

## Rollback

Revert the commit. No data is written by the change itself.
