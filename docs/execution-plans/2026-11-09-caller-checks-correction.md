---
status: active
---

# Plan: correcting a call's checks from the call view

Brief: [2026-11-09-caller-checks-correction](../briefs/2026-11-09-caller-checks-correction.md) (APPROVED on its second
pass). Owner: the lead of the dashboard session on `v2.2`. Commit, release and deployment each need the CTO's
authorisation.

## Dependencies

- StarChat 9.34.131 on test (`b550d9119`, deployed 2026-11-09). Beta and production each need it, or a later
  version, before this release reaches them; beta's StarChat version is checked, not assumed.
- The order on `v2.2`, one working tree (the main checkout), nothing in parallel: the dependency audit's phase 1
  ([plan](2026-11-09-dependency-audit.md)) is committed first; then this work is written, gated and committed on top
  of that commit; then the dependency audit's phase 2 starts, on top of this commit. Each set of gates runs on the
  exact tree that is committed, so no rebase sits between a gate and its commit. If `v2.2` moves before this commit
  (another session's push), the work is rebased and every gate runs again.
- The saved owner session for test outside the repository (`~/.config/starchat-roles/owner`), used for the recordings.

## Steps

### C1. `src/utils/Classifications.js`

- `CHECK_FIELDS = ["caller_repeated", "caller_unsatisfied"]`, exported, and `isCheck(field)`. `FIELDS` gains both, so
  `ask` accepts them with `subject: "call"`. `valuesOf(check)` is `["true", "false"]`.
- `menuEntries` for a check: the value entries (the current one marked), then "right" when the value is set, restore,
  withdraw and history as now. It offers no "wrong" (brief, scope 2).
- `withCurrent`: for a check field, when the call carries `checks`, it copies them and writes
  `next.checks[field] = {...next.checks[field], value}`; a call answered without `checks` gets none (as built, and
  approved at M1: a `checks` made here would hold a value without a model). This covers the 409's `current`, a signal's answer without the call's state, and a
  non-owner's undo `items`.
- Nothing else changes in `chipState`, `withGesture`, `withCallState` or `isCallState`. The state's `checks` comes
  along whole with the call.

### C2. `src/components/feedback/labels.js`

- `field(check)` returns `components.callInsights.checks.<name>` (the check's own sentence).
- `value(check, "true" | "false")` returns the new `components.callInsights.feedback.checkValue.true` or `.false`
  ("Yes", "No"; it-IT "Sì", "No"). Null keeps `feedback.unset`.
- The queue's and the own-proposals' sentences then read a check in words, with no change in `FeedbackQueue.vue` or
  `MyProposals.vue`.

### C3. `src/components/feedback/CallJudgements.vue`

- `callRows`, once loaded, gives a row for each `CHECK_FIELDS` entry whose `data.checks[name]` is an object with
  `model` non-null. Its state comes from `Classifications.chipState(data.checks[name], data.history, {field: name},
  role)`. A `checks` that is missing or not an object gives no row.
- `callRows` before the read draws no check row, for any reader (brief, scope 4 as amended): the fired list keeps
  showing the checks until the read answers with `checks`.
- `choose` and the rest stay generic: a check row goes through the same code path as the message row.
- A new emit, `checks`, carries the names of the check rows drawn (an array, empty while no chips are drawn), beside
  the existing `chips` boolean.
- The cause: under the `caller_repeated` row, when `details.checkCauses.caller_repeated` is a non-empty string, a
  `<q>` with the text, captioned `feedback.checkCause` ("In the assistant's words"). It is shown whatever the chip's
  current value, because it is the model's reason for its own answer, and the chip already says when that answer was
  corrected.

### C4. `src/components/conversations/CallDetailsPanel.vue`

- `checkChips` (data, from the `checks` emit). `checksFired` leaves out the names in `checkChips`.
  `promise_not_kept_in_call` is never in `checkChips`.
- The fired list: under the `caller_repeated` line, the same cause quote when it is drawn there (no chips).
- `subject`: when `details.subject` is a non-empty string, a line at the top of the insights box, captioned
  `panel.subject` ("Subject"). `hasInsights` counts it.

### C5. Labels in 12 locales

`components.callInsights.feedback.checkValue.true` and `.false`, `components.callInsights.feedback.checkCause`, and
`components.callInsights.panel.subject`. `tests/unit` gains a locale case for these four keys across the 12 files.

### C6. Recordings and fixtures

- With the owner session on test (StarChat 9.34.131), on a call of the owner's business that has insights with
  checks: record `GET .../classifications`, a `wrong_value` signal on `caller_repeated` (its answer, with the call's
  state), and that gesture's undo, which leaves the call's values as they were. Scrub them as the 9.34.124 ones were
  (free text and ids as placeholders, closed-set values kept) into `tests/unit/recorded/starchat-9.34.131/`. The token
  and the session never enter the repository.
- `tests/e2e/fixtures/classifications.js`: `judged()` and `stateOf()` carry `checks` only when a spec passes them, so
  every existing spec and visual baseline is answered as now. The signal, undo, revert (`revertEntry`) and stale
  (`staleOnce`) handlers apply a check's value to `call.checks.<name>`, as they do for message.
- `tests/unit/fixtureShapes.spec.js` reads the 9.34.131 recordings, from their own directory, beside the 9.34.124
  ones, and compares the fixture's classifications, signal and undo answers, with checks passed in, against them.
  Its `MAPS` pattern `/\.checks$/` today treats every path ending in `.checks` as a map keyed by data, which would
  let a fixture carry a check StarChat never sends (such as `promise_not_kept_in_call`). It is narrowed to the
  analytics paths that are maps keyed by data, so that `classifications.checks`, `signal.call.checks` and
  `undo.calls[].checks` are compared field by field: every check a fixture carries must be one the recording
  holds. A case is first seen failing with a fixture that carries `promise_not_kept_in_call` under `checks`.
  Nothing is added to `OPTIONAL` for `checks`.

### C7. Tests, written first and seen failing

- Unit (`tests/unit/classificationsChecks.spec.js`): `ask` for a check; `menuEntries` with no "wrong"; `chipState` on a
  check; `withCurrent` on its three paths (a 409 `current` naming `caller_repeated`, a signal's answer without call
  state, a non-owner's undo `items` without call state), after each of which the check's value is the one carried.
- Browser (`tests/e2e/insights/caller-checks.spec.js`, three projects):
  - a call whose checks are `caller_repeated` `{model: "true", value: "true"}` and `caller_unsatisfied`
    `{model: null}` draws one check chip, Yes;
  - choosing No sends exactly the brief's body, the chip reads No, corrected, and Undo returns it to Yes;
  - no chip and no request ever exist for `caller_unsatisfied` or `promise_not_kept_in_call`;
  - with chips drawn, the fired list leaves out `caller_repeated` and keeps `promise_not_kept_in_call`;
  - an answer without `checks` draws the panel as `v2.2.55` does;
  - a non-owner opening a call by its link (the path on which StarChat sends `details.checks`) sees the fired list
    before the read and the chip after it;
  - `checkCauses` and `subject` show when present and change nothing when absent;
  - a queue item on `caller_repeated` reads in words, in en-US and it-IT.

### Gates (milestone M1, on the tree to be committed)

1. `npm run test:unit` (lint, then vitest, with the new locale and shape cases).
2. `npm run build`.
3. The full Playwright run, with the same rule as the dependency audit: every failing case is rerun alone with one
   worker; it is unrelated when it passes there, or when it is one of the persistent baseline failures with the same
   error; anything else stops the work. No visual baseline is re-recorded.
4. A fresh reviewer reviews the diff and the gates' output (milestone M1) before the commit.

## Release

On the CTO's authorisation: one commit on `v2.2`, the next free `v2.2.x` to test, the published chunks checked for
the new labels. Then, on test against StarChat 9.34.131, a real call's chips and one correction undone. Then StarChat's
session is told that the release is on test. Beta and production follow on authorisation, each only once StarChat
9.34.131 or later is there.

## Closure

- `docs/ARCHITECTURE.md`: the call judgements' passage names the two checks, the menu without "wrong", and the
  `checks` emit.
- `docs/README.md`: the brief and plan routed. `docs/active-context.md`: the state.
- `doc-end`: the mechanical gate, `doc-critic`, the final review, and finalisation.

## Rollback

One commit: revert it and redeploy the previous tag. StarChat keeps accepting the corrections from its own tools, and
the dashboard simply stops offering them.

## Status

| Step | State |
|---|---|
| Brief | APPROVED (second pass, 2026-11-09); scope 4 amended after the plan's first review |
| Plan | APPROVED (second pass, 2026-11-09) |
| StarChat (2026-11-10, from StarChat's session) | test 9.34.131; beta and production are one StarChat, 9.34.130; 9.34.131 reaches them at StarChat's step K16, after its final review K15, which waits for this release on test |
| C1-C7 | written; unit 53 files / 725 tests; build ok; `caller-checks.spec.js` 24/24 on the three projects, its 8 desktop cases failing on `c855a16`; recordings from 9.34.131 on test, the signal applied and its undo leaving the call as it was |
| M1 gates | full Playwright 2273 passed, 8 failed, 22 skipped; all 8 pass alone with one worker (tablet and mobile `page.goto` timeouts) |
| M1 | APPROVED (2026-11-10) |
