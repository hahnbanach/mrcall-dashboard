# Brief: the call id, shown and copied, wherever a call is drawn

## Intent

When an owner or the CTO reports a problem with a call, the StarChat side (logs, replay, recompute) needs the call's
conversation id. The dashboard never shows it today: it can be found only in the devtools. Every place that draws a
call shows its id, shortened, with the whole value on hover, and a button that copies the whole id with a short
"copied" confirmation.

## The id

- The id is the conversation's `id` as the dashboard receives it from StarChat (`conversation.id`, the key
  `ConversationApi.get` and `Classifications` already use). It is the session id StarChat's tools key on (StarChat
  session `starchat-15`, 2026-11-06, reading branch `9.34`): on Vonage calls Vonage's `conversation_uuid`,
  `CON-<uuid>`, about 40 characters; on the other channels the bridge's session id, whose format is not fixed (a
  plain UUID, `sanitization-<uuid>`, `voice-sample-N` in test paths). The copy is that string, byte for byte; the
  dashboard assumes no format and no prefix.
- Vonage's per-leg `uuid` is not the call id and is never shown as one.

## Decision: how much of the id is shown

The first 16 characters (the CTO's choice), followed by `…` when the id is longer; an id of 16 characters or fewer is
shown whole, with no ellipsis.

Measured against random UUIDs (4 000 lists of 50, 1 000 of 200): with the `CON-` prefix (12 random characters
visible) or none (16), two ids in one list never shared their first 16 characters; with a 13-character prefix such as
`sanitization-` (3 random characters visible) they did in 25% of lists of 50 and 99% of lists of 200. So where the
ids drawn together share their first 16 characters, each of those is shown up to the shortest length that tells it
apart from the others (never shorter than 16). The rule is a pure function of the list of ids drawn together: one
id alone is always 16.

## Scope

1. A pure util, `src/utils/CallId.js`: `shortIds(ids, min = 16)` returns, for each id, its shown length (the whole
   length when it is no longer than that), applying the decision above. No imports.
2. A small component, `src/components/conversations/CallIdCopy.vue`:
   - The whole id is in the DOM, in a monospace `<code class="call-id">`, clipped visually to the shown length
     (`max-width` in `ch`, `overflow: hidden`, `text-overflow: ellipsis`, the width given by `shortIds`): what is
     read, selected or copied by hand is always the whole id, and a screen reader reads it whole. `title` holds the
     whole id for mouse hover.
   - A copy button (icon `pi pi-copy`, the icon `aria-hidden`) named per call, "Copy call id {id}" with the shown
     id, so that a page of rows does not read one name a hundred times. It calls `navigator.clipboard.writeText(id)`.
   - A live region (`aria-live="polite"`), present and empty from the first render, into which "Copied" is written on
     success and cleared after about 2 seconds; the same text is visible beside the button.
   - On failure (no clipboard API, a refused write) the clip is removed so the whole id shows, on touch and keyboard
     as well as mouse, its text is selected, and "Could not copy: select the id" is written into the same region.
   - A long press on the id does not start the list's bulk selection on phones: `src/utils/Selection.js`'s
     `pressStart` ignores presses inside `.call-id` (its ignore list today: buttons, links, form controls, audio,
     listbox and option roles), so the press selects the text instead.
3. `CallDetailsPanel.vue`, the one panel that draws a call's content: the id at its top, before the actions. Because
   that panel draws every call the dashboard shows, this covers, by inventory of `CallDetailsPanel`'s users:
   - the conversations page's list (one panel per row) and its opened call (`?conversation=`);
   - `CallDialog.vue`, which opens a call over the page from every analytics page (through `AnalyticsOverlayHost`:
     outcomes, quality signals, unanswered questions, category requests, feedback queue and proposals' call links)
     and from the restaurant page's bookings.
   The panel takes an optional `idLength` prop; the conversations list passes the length `shortIds` computed over the
   ids of its current page, every other user leaves it out and gets 16.
4. The rule for what draws a call: a call is drawn where its content (summary, judgements, transcript, recording)
   is shown by `CallDetailsPanel`. The places that only name or list calls and open them are out of scope, since the
   opened call then shows the id, and an id column would crowd tables already narrow on mobile: the `CallLink`
   buttons (analytics sections, feedback queue, my proposals, category requests, request categories' examples), the
   unanswered-questions rows, the counted-calls rows (`CountedCallsList.vue`, which show each call's summary but open
   the call for anything more), the example and call-back links of `CallReportDetail.vue`, and the access-record
   rows of `CallsAccessSettings.vue`.
5. Labels in all 12 locales: `copy` ("Copy call id {id}"), `copied` ("Copied"), `copyFailed` ("Could not copy:
   select the id"), and a visually hidden label for the id ("Call id").
6. Tests:
   - `tests/unit/callId.spec.js`: 16 characters and the ellipsis, an id of 16 or fewer whole, `CON-` and plain UUIDs
     at 16, long shared prefixes extended until distinct, duplicates of one id not extended against themselves.
   - a Playwright spec on the three projects: the id on a conversations-list row, on the opened call and in the
     analytics call dialog, its text content and `title` the whole id and its visible width the shown length; the
     copy button, named with the shown id, writes the whole id and "Copied" is announced in the region that was
     already present. Writes are observed and refused the same way on every project, by an init script that wraps
     `navigator.clipboard.writeText` (recording its argument, or rejecting for the failure case), since Chromium
     grants writes to a focused page and WebKit grants the test no clipboard permission; on chromium one case also
     reads the real clipboard back after `grantPermissions(['clipboard-read', 'clipboard-write'])`. The refused write
     unclips and selects the whole id and announces the failure. Two ids sharing a long prefix in one list are shown
     distinct. On the mobile project a long press on a row's id does not enter selection mode.
7. `docs/ARCHITECTURE.md`: the call id in the conversation panel's passage.

## Constraints

- The copied text is the whole id, never the shortened one.
- No new request: the id is already in every conversation the dashboard draws.
- New PrimeVue components, if any, registered in `src/main.js`; none is expected (a plain button styled like the
  panel's actions).
- The copy works for a read-only reader too (an admin or a reseller opening a call): reporting a problem is not an
  owner action.

## Acceptance

- Every call drawn by `CallDetailsPanel` shows its id's first 16 characters (more only where needed to tell ids
  apart in the conversations list), the whole id on hover, and a copy button that puts the whole id on the
  clipboard and says so.
- Keyboard: the button is reachable and works with Enter and Space; the confirmation and the failure are announced
  through a region present before them; each button's name carries its call's shown id.
- On a phone, a long press on the id selects it and does not start bulk selection; a refused copy shows the whole id.
- Unit tests and the new browser spec green on desktop, tablet and mobile; the full Playwright run shows no failure
  beyond the known load-dependent ones, each passing rerun alone.

## Assumptions

- `conversation.id` is the id StarChat's log, replay and recompute tools take. StarChat's session believes so and has
  not read each tool.
- A forwarded Vonage call gets a new `conversation_uuid` after the transfer, linked by StarChat
  (`VonageTransfers.conversationAlias`). Which of the two the dashboard receives is not verified; if a forwarded
  call in the test data carries two ids, StarChat's session traces it before implementation.
