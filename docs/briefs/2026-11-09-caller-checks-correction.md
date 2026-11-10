# Correcting a call's checks: "the caller had to repeat" and "the caller seemed unsatisfied"

## Intent

Let a person correct two of a call's checks, `caller_repeated` and `caller_unsatisfied`, from the call view, in the
same way that resolution and message are corrected. StarChat made them correctable judgements in 9.34.131 (its brief
`docs/briefs/2026-11-06-caller-repeated-check.md`, decision 12; its plan
`docs/execution-plans/2026-11-06-caller-repeated-check.md`, step K13, handed to the dashboard's `v2.2` line). About
half of version 8's `caller_repeated` marks are false. A correction moves the counts and the analytics, which follow
the corrected value, while the call's details keep the model's answer.

## The contract (StarChat 9.34.131 on test, read in its code at `91ca9df8d`)

- `POST insights/feedback` accepts `field` `caller_repeated` and `caller_unsatisfied`, with `subject: "call"`. It
  takes the signals `wrong_value` (`valueTo` `"true"` or `"false"`), `right` and `wrong`, under the same rule as
  resolution and message. A signed-in person's `wrong_value` is applied; `wrong` is only a proposal; an agent
  credential only proposes. `promise_not_kept_in_call` is refused with a plain 400.
- `GET insights/calls/{id}/classifications` gains `checks`: `{caller_repeated: {model, value, corrected},
  caller_unsatisfied: {...}}` (`InsightsFeedback.effectiveJson`). `model` and `value` are `"true"`, `"false"` or null.
  Null means the call recorded no such check. A correction of a check the call never recorded is refused with a plain
  400.
- A gesture's answer carries the call's state (`call`), and that state includes the same `checks` object. The
  history lists the signals on checks like any other call field.
- The call details may carry two new optional fields: `checkCauses` (a check's name to the assistant's words that
  caused it) and `subject`. No call served by this release carries either, because test serves the version-8
  document; they need structures 10 and 9.

## Scope

1. **The chips.** In `CallJudgements`, one chip per correctable check whose `checks.<name>.model` is non-null, after
   resolution and message. A chip is drawn for a model "false" as well as for a "true": StarChat accepts and tests the
   correction from false to true, and it moves the counts as the other direction does, so a check the model missed
   must be correctable too. The cost is up to two more rows on every call that has insights; they sit in the
   judgements' own list, under the call's insights, not above the call's facts. The row's label is the check's own sentence (`components.callInsights.checks.<name>`) and
   the value reads Yes or No. The chip's state, history, restore, withdraw, Undo and stale handling are those of
   resolution and message (`Classifications.chipState`, `withGesture`), with these changes to
   `src/utils/Classifications.js`: `FIELDS` and `valuesOf` learn the two checks (values `"true"`, `"false"`), so that
   `ask` accepts them; `menuEntries` branches for a check as scope 2 says; `withCurrent` writes a check's value at
   `checks.<name>.value`, since a check does not live at the top of the call's judgements. Today it writes
   `next[field]` only when that key exists, so a check's value would be dropped silently on three paths: a 409
   `stale_value`, a signal's answer without the call's state (`withGesture`), and the undo of a reader who does not
   own the call, which StarChat answers without the call's state (`revertGesture` returns it for owned calls only).
   `promise_not_kept_in_call` never gets a chip.
2. **The menu.** It offers the other value, then "right", restore and withdraw where allowed, and history. It does
   not offer "wrong": a yes/no check has exactly one other value, so "this is wrong" is that value, applied at once.
   A "wrong" without a value would only wait for an admin to apply what is already determined.
3. **The fired-checks list.** While chips are drawn, the panel's list of fired checks leaves out the two that now
   have a chip, as the plain resolution and message rows already step aside for theirs. `promise_not_kept_in_call`
   stays in the list. While no chips are drawn (before the read, a 404 or 503, a call without checks), the list is
   as today.
4. **A reader who does not own the call** (`readOnly`). No check chip is drawn before the read: until then the fired
   list shows the checks as today, and the chips replace them once the read answers with `checks`. Unlike resolution
   and message, a check is correctable only on a StarChat from 9.34.131, and the details cannot tell which StarChat
   answers. A chip drawn from the details would, on an older StarChat, vanish after the read. (Amended 2026-11-09
   after the plan's review; the brief first drew pre-read chips from `details.checks`.)
5. **Labels wherever a signal is said.** `labels.js` names the two fields and their values. The admin's queue and
   the reader's own proposals list will then show an agent's proposal on a check in words, not as a raw key.
6. **The cause and the subject, when present.** When `details.checkCauses.caller_repeated` is a non-empty string,
   it is shown as a quote under the `caller_repeated` chip, or under its line in the fired list when there are no
   chips. When `details.subject` is a non-empty string, it is shown at the top of the call's insights box. Both are
   rendered as text only, and nothing depends on them.
7. **Refusals.** No branching on a 400's text. Gating on `model` and never offering `promise_not_kept_in_call` avoid
   both refusals up front. A 400 that still arrives gets the existing generic failure alert. A 409 `stale_value` on
   a check takes the current value it carries, as for any other field.
8. **Translations.** Every new string (Yes and No for a check, the cause's and the subject's captions, the menu's
   wording if any) goes into all 12 locales.

## Out of scope

- Bulk correction of checks from the conversations list. The list's bulk actions stay on resolution.
- Any count, filter or analytics change. StarChat's counts follow the corrected value by themselves.
- Recomputing past calls (the CTO's decision per business, on StarChat's side).

## Constraints

- No request outside `src/utils/Classifications.js` and the configured Axios instance; the session rule of
  `docs/system-rules.md` holds (`isSessionEnded` before any failure message).
- An answer whose `checks` is missing or malformed draws no check chip: an older StarChat, or production before
  9.34.131, keeps today's panel exactly.
- No visual baseline is re-recorded to make a run pass. A baseline that changes because the panel changes is
  re-recorded only for a call that carries checks, with the new rows shown in the review.
- The full Playwright run passes before the tag. Commit, release and deployment need the CTO's authorisation, and
  beta and production each need StarChat 9.34.131 or later there.

## Acceptance

- On a mocked call whose classifications carry `checks` with `caller_repeated` `{model: "true", value: "true"}` and
  `caller_unsatisfied` `{model: null}`: one check chip, "Yes". Choosing "No" sends `{subject: "call", field:
  "caller_repeated", signal: "wrong_value", valueFrom: "true", valueTo: "false"}`, and the chip then reads No,
  corrected. Undo restores it. No chip and no request ever exist for `caller_unsatisfied` or
  `promise_not_kept_in_call`.
- The fired-checks list then omits `caller_repeated` and still shows `promise_not_kept_in_call` when it fired.
- An answer without `checks` draws the panel exactly as `v2.2.55` does.
- A queue item on `caller_repeated` reads in words in en-US and it-IT.
- With `checkCauses` and `subject` in the details, both show; without them, nothing changes.
- Unit tests cover a check's state, its menu (no "wrong"), `ask` for a check, and `withCurrent` for a check on its
  three paths: a 409 `stale_value` whose `current` names `caller_repeated`, a signal's answer without the call's state,
  and a non-owner's undo answered without the call's state, after which the chip reads the reverted value. The
  browser tests cover the gesture and its Undo on the three viewports; the locale test covers the new keys in 12 files.
- The fixture-shape gate (`tests/unit/fixtureShapes.spec.js`) compares the check fixtures with answers recorded from
  StarChat 9.34.131 on test, scrubbed as the 9.34.124 ones were: a classifications read whose `checks` holds both
  checks, a check signal's answer with the call's state, and that signal's undo (made on a test call and undone, so
  the call ends as it was). No `checks` path is added to the gate's OPTIONAL list: that would let a fixture carry a
  shape StarChat was never seen to send.
- On test, against StarChat 9.34.131, a real call with checks shows its chips and a correction is applied. StarChat's
  session is told when the release is on test, so that it can see the control working.

## Assumptions

- Checks' values are the strings `"true"` and `"false"` everywhere in the contract (classifications, history,
  `valueFrom`/`valueTo`), as StarChat's route test reads them.
- The two checks' existing sentences read correctly as a row label beside Yes or No in all 12 locales; the reviewer
  of the plan checks them.
