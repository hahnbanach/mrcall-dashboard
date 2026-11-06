---
status: completed
---

# Plan: the call id, shown and copied, wherever a call is drawn

Brief: [2026-11-06-call-id-copy](../briefs/2026-11-06-call-id-copy.md) (APPROVED on its second pass). Owner: the lead
of the dashboard session on `v2.2`. Working tree: the main checkout on `v2.2`; commit, release and deployment each on
the CTO's authorisation.

## Dependencies

None outside this repository: the id is `conversation.id`, already in every conversation StarChat returns. The
assumptions on StarChat's tools and forwarded calls stay as the brief states them.

## Steps

### C1. The rule (`src/utils/CallId.js`)

- `CALL_ID_MIN = 16`; `shortIds(ids, min = CALL_ID_MIN)` returns a `Map` from each distinct id to its shown length:
  `Math.min(id.length, L)`, where `L` is the smallest length `>= min` at which the id's prefix is shared with no other
  distinct id of the list (the longest common prefix with any other id, plus one, if that exceeds `min`). Duplicates
  of one id are one entry; a non-string or empty id is skipped. Imports nothing.
- `truncated(id, length)`: whether `length < id.length` (the panel adds the ellipsis room only then).

### C2. The component (`src/components/conversations/CallIdCopy.vue`)

- Props: `id` (string, required), `length` (number, default `CALL_ID_MIN`).
- Template: a wrapper `span.call-id-copy`; a visually hidden "Call id" label; `<code class="call-id" :title="id">`
  holding the whole id, `display: inline-block`, monospace, `white-space: nowrap`, `overflow: hidden`,
  `text-overflow: ellipsis`, `vertical-align: bottom`, and while clipped `max-width: (length + 1)ch` so that `length`
  characters and the ellipsis show (the ellipsis takes a character's room); no `max-width` when the id is not longer
  than `length`. Once revealed it wraps (`white-space: normal; overflow-wrap: anywhere`, no `max-width`), so a 40 to
  49 character id stays inside a 375 px card. A `<button type="button" class="call-id-button">` with `pi pi-copy`
  (`aria-hidden`) and `aria-label` `$t('components.conversations.details.callId.copy', { id: shown })`, where `shown`
  is the first `length` characters followed by `…` when truncated. A `<span class="call-id-status" aria-live="polite">`
  rendered from the start, empty.
- `copy()`: when `navigator.clipboard` or its `writeText` is missing it goes straight to the failure path (an awaited
  optional call would resolve `undefined` and read as success); otherwise `await navigator.clipboard.writeText(id)`; on success the status becomes `callId.copied` and is cleared after
  2 000 ms (timer cleared in `beforeUnmount`, and restarted on a repeat copy); on a missing API or a rejection:
  `revealed = true`, then on `$nextTick` the `<code>`'s text is selected (`getSelection().removeAllRanges()`, since
  `addRange` does nothing while a range exists, then `Range.selectNodeContents` and `addRange`) and the status becomes `callId.copyFailed` (not cleared, so it stays readable).
- `@click.stop` on the button and on the `<code>`, so a press on them never toggles a list row.
- No PrimeVue component, nothing to register.

### C3. The panel (`CallDetailsPanel.vue`) and the list (`Conversations.vue`)

- `CallDetailsPanel`: a prop `idLength` (number, default `CALL_ID_MIN`); at the top of `.call-details`, before the
  owner's actions, `<p class="call-id-row"><CallIdCopy v-if="conversation.id" :id="conversation.id"
  :length="idLength" /></p>`, drawn for every reader, owner or not.
- `Conversations.vue`: a computed `idLengths` = `shortIds` over the ids of `filteredItems` (the rows drawn); each row's
  panel gets `:id-length="idLengths.get(key) || 16"` with the row's conversation id. The opened call
  (`?conversation=`) is drawn alone, so it keeps the default.
- `src/utils/Selection.js`: `pressStart` adds `.call-id` to the selector it ignores; its comment says why (a long press
  on the id selects its text).

### C4. Labels (12 locale files)

Under `components.conversations.details.callId`: `label` ("Call id"), `copy` ("Copy call id {id}"), `copied`
("Copied"), `copyFailed` ("Could not copy: select the id"). it-IT: "Id chiamata", "Copia id chiamata {id}",
"Copiato", "Copia non riuscita: seleziona l'id". The other ten with the same meaning. Additions only, by a JSON
round-trip checked byte-identical before writing.

### C5. Tests

- `tests/unit/callId.spec.js`: lengths, not text: an id longer than 16 gets 16; an id of 16 or fewer gets its own
  length; `CON-` ids and plain UUIDs in one list all get 16; two ids sharing a 20-character prefix get 21 each, a third
  unrelated one 16; three ids sharing prefixes of different lengths each get their own distinguishing length;
  duplicates not extended against themselves; empty and non-string ids skipped. `truncated` both ways.
- `tests/unit/callIdLocales.spec.js`: the four keys present and non-empty in all 12 locales, `{id}` kept in `copy`.
- `tests/e2e/insights/call-id.spec.js`, on the three projects, with `mockConversations` and `conversation({ id })` from
  `tests/e2e/fixtures/classifications.js`, and an init script that wraps `navigator.clipboard.writeText`
  (`window.__copied` records the argument; `window.__refuseCopy` makes it reject):
  - list: a row's `.call-id` has text content and `title` equal to the whole id; its rendered width is that of 17 characters of the same font (measured in the page against a probe span: more than
    16.5 and less than 17.5 probe characters), so 16 characters and the ellipsis show, not 15; the button's accessible name is "Copy call id " plus the first 16 characters and `…`.
  - copy: clicking writes the whole id (`__copied`), the status region (present before, empty) shows "Copied", which
    is gone after 3 s; keyboard: focus the button (chromium by Tab from the row's previous focusable, WebKit by
    `focus()`), Enter copies, Space copies.
  - chromium only: after `context.grantPermissions(['clipboard-read', 'clipboard-write'])` and without the wrapper,
    `navigator.clipboard.readText()` returns the whole id.
  - refused: with `__refuseCopy`, the `.call-id` is no longer clipped (`scrollWidth <= clientWidth`), the selection's
    text is the whole id, the region says "Could not copy: select the id". On mobile with a 49-character id
    (`sanitization-<uuid>`): the revealed id lies inside its card and the page has no horizontal overflow. A second
    case with `navigator.clipboard` removed by the init script takes the same failure path.
  - distinct: two rows whose ids share their first 20 characters show 21 characters each (their accessible names
    differ).
  - opened call: `/conversations?id=…&conversation=<id>` shows the id in the opened panel.
  - analytics dialog: on the overlays spec's setup, a request's call opens in the dialog and shows its id
    (`CON-p1`, 5 characters, whole, no ellipsis), copyable, for an admin (read-only).
  - mobile project only: a long press (pointer down, 700 ms, up, as `conversations-feedback.spec.js` does) on a row's
    id does not show the bulk bar and leaves no row selected; the same press on the card's header does start selection
    mode, so the negative assertion cannot pass on a broken harness. That the native long press then selects the id's
    text cannot be simulated: what supports it (no `user-select: none` in `Conversations.vue`, the conversation components or the shared styles, no `preventDefault` in `pressStart`)
    is recorded, and it is checked by hand on a phone on test.
- Visual baselines: none should change. No comparing baseline draws the call panel (`visual-auth`: businesses,
  account, onboarding language; `visual-public`: sign-in, sign-up, magic link, privacy, terms; `insights-screens`
  saves screenshots without comparing). A visual failure is investigated as a regression, never re-recorded.

### C6. Docs

`docs/ARCHITECTURE.md`: in the conversation panel's passage, the call id (what is shown, what is copied,
`src/utils/CallId.js`). Then `doc-end`.

## Milestones

- M1: C1-C5 in the working tree, unit and new browser spec green on the three projects; milestone review against the
  brief before the full run and the docs.
- Final review: after C6 and `doc-end`'s reconciliation, a separate fresh reviewer through the final-user path (the
  conversations page, a call from analytics, the copy and its failure on each project), before any commit.

## Verification

1. `npm run test:unit` green (680 before, plus the new ones), lint included.
2. `npx playwright test tests/e2e/insights/call-id.spec.js` green on desktop, tablet, mobile.
3. Full `npx playwright test`: failures only among the known load-dependent ones, each passing rerun alone with one
   worker; no visual baseline changed.
4. Screenshots of a row, of a revealed long id and of the dialog at 375 and 1440 px from the spec's
   `testInfo.outputPath`, inspected.
5. Unverified until checked by hand on a phone on test: the native long press selects the id's text.

## Rollback

Revert the working-tree changes (one util, one component, two components' lines, `Selection.js`'s selector, locale
keys, tests, docs). No data, contract or backend change.

## Status

| step | state | evidence |
|---|---|---|
| brief | approved | second pass; approved version SHA-256 `ae2f09fc220c8fbcabea5098bdeed7dce74d4487f60834a95769a5c922519be3` |
| plan | approved | second pass; approved version SHA-256 `bce8b625872de412307edf92b19e7e9d676a068c8867768434c7b06472cbd2b7` |
| C1 rule | done | `tests/unit/callId.spec.js` 13/13; checked against a brute force on 3 000 random lists; as built, `truncated` shows whole an id at most one character longer than its length (the ellipsis would take that character's room), a decided deviation from the brief's "16 or fewer", which only ever shows more |
| C2 component | done | `CallIdCopy.vue`; overlapping copies (a fast double click) write only the latest status; a repeated status is emptied and refilled so that it is announced again |
| C3 panel and list | done | the id in `CallDetailsPanel` for every reader; `Conversations.vue` passes `shortIds` over `filteredItems` (a Map); `Selection.js` ignores `.call-id` |
| C4 labels | done | 12 locales, additions only; `tests/unit/callIdLocales.spec.js` 13/13 |
| C5 tests | done | the spec lives in `tests/e2e/insights/` beside the other conversation-panel specs: 26 passed, 4 skipped by design (clipboard readback chromium only, long press mobile only); mutations seen failing: a 16ch box (width read 16.0), `.call-id` out of `Selection.js` (long press), the opened card renamed (opened-call case) |
| M1 review | approved | second pass, after scoping the opened-call case to `.opened-card` |
| C6 docs | done | `docs/ARCHITECTURE.md` "The call's id" and the utils inventory |
| unit suite | green | `npm run test:unit`: 51 files, 702 tests (680 before), lint included |
| full Playwright | green | `npx playwright test`, all three projects, after the M1 repairs: 2257 passed, 22 skipped (18 before, plus the 4 by design), 0 failed (41.3 min); no visual baseline changed |
| unverified | open | a phone's native long press selecting the id's text: checked by hand on test |
| release | test | `v2.2.55-test`, authorised by the CTO on 2026-11-06; beta and production wait for the CTO's check on test |
