# Brief: classifications a person can check, correct and undo, in the dashboard

Excerpt: the dashboard side of StarChat's classification-feedback work (its step C8): every judgement of a call is a
chip that a person marks right or wrong and corrects, with one undo; lists select and correct in bulk; every count
opens the calls behind it; corrections queue for an admin and proposals for their author; caller rules and the call
access record sit in the business settings; a non-owner opens a call read-only and recorded. It states what StarChat
9.34.118 serves for this, what it does not (and is therefore not built here), the scope, the alternatives rejected,
the acceptance and the rollback, and two amendments for the contract changes StarChat made while it was built.

Date: 2026-10-27. Line: `v2.2` (held by another session); built on a temporary branch off `a837d56`, rebased onto
`fd4c94d` when the line moved, handed over to be fast-forwarded. Authority: StarChat's brief `docs/briefs/2026-10-26-classification-feedback.md` (decisions 6, 9,
11, 12, 13, 14 and "What this changes in the reports brief"), approved, and its plan
`docs/execution-plans/2026-10-26-classification-feedback.md`, rows C8 and C10; the reports brief
`docs/briefs/2026-10-24-insights-reports-ux.md` with its amendment of 2026-10-26 for the screens that exist. All
three live in the StarChat repository. No push, tag or deploy is part of this work.

## Intent

The requirements are StarChat's brief's, as they reach a screen:
- every count a person reads about calls opens the calls behind it, so it can be checked on a sample;
- any judgement on a call can be marked right or wrong and corrected, with effect at once where the person may
  apply it, and as a proposal where they may not; the person can undo it;
- the experience stays non-invasive: nothing asks, everything is one tap away, nothing has a time limit;
- an admin or a reseller opens a call of a business in their scope read-only, every opening recorded, and the owner
  sees who opened their calls.

## What StarChat serves (9.34.118 on test, read from its code)

Paths are StarChat's, under `src/main/scala/com/hahnbanach/starchat/`.

- **A call's judgements:** `GET insights/calls/{id}/classifications?businessId`
  (`resources/mrcall/InsightsFeedbackResource.scala:68`, `services/mrcall/insights/InsightsFeedback.scala:263`):
  `resolution` and `message` each `{model, value, corrected}`; `requests[]` with `requestId`, `ordinal`, `text`,
  `outcome` and `category` each `{model, value, corrected}`, `gap`, `excluded`; `history[]` with `feedbackId`,
  `field`, `signal`, `valueFrom`, `valueTo`, `source`, `status`, `actorRole`, `actorName`, `byMe`, `createdAt`,
  `decidedAt`, `gestureId` (the author's and an admin's only). Absent (404) out of scope. A non-owner's read is
  recorded as an opening.
- **Signals:** `POST insights/feedback` (`subject` call or request, `conversationId` or `requestId`, `field`
  resolution, message, outcome or category, `signal` `wrong_value`, `wrong` or `right`, `valueFrom` required, may be
  null, `valueTo`, `note`, `gestureId`); answers `{feedbackId, status, value, replayed}`. `POST insights/feedback/bulk`
  (`items`, one `gestureId`, 1 to 500, all or nothing) answers `{applied, proposed, items}`. A stale `valueFrom`
  answers 409 `stale_value` with `current[]`. Who applies (`InsightsFeedback.status`, :105): a signed-in person
  applies resolution, message and a request's outcome on a call in scope; a category is applied by an admin and
  proposed by anyone else; `wrong` is always a proposal; an agent proposes everything.
- **Undo and decisions:** `POST insights/feedback/gestures/{gestureId}/revert` (one gesture, one undo; a person's
  own, an admin any); `POST insights/feedback/{id}/revert` (author or admin), `/apply` (admin, optional `requestId`
  to re-attach an orphan), `/reject` (admin). Refusals carry codes: `person_only`, `not_author`, `admin_only`,
  `feedback_state` (`services/mrcall/insights/InsightsRefusal.scala`).
- **Queues:** `GET insights/feedback?status&businessId&field&mine&from&size&asOf`, default statuses proposed and
  orphaned, `{total, asOf, items}` with each item's `requestText` and `businessName`; a non-admin must name
  `businessId` or `mine=true`; proposals are shown to their author and to admins only.
- **Caller rules:** `GET insights/caller-rules?businessId[&conversationId]` (`rules[]`; with a call, whether a rule
  may be made for its number, the reason when not, the number, `ruleExists`, `earlierCalls`, `earlierMore`), `POST`
  (`conversationId`, `applyToEarlier`; a person only; 400 `caller_not_eligible` for anonymous, hidden and web
  callers), `DELETE ?businessId&caller` (reverts what the rule applied).
- **Conversation search** (`entities/io/mrcall/customer_conversation/CustomerConversationSearch.scala`): besides
  today's filters, `counted`, `outcomeLine`, `topic` (needs `businessId`) and `topicLabels`, `gap`, `check`,
  `requestCategory` (`unclassified` for none) with `requestOutcomes`, `noConversation`, `corrected`, `ids`. Each
  analytics count uses the same predicate as one of these filters, with `counted: true`
  (`services/relationaldbms/SessionTimescaleService.scala:900-944`); no analytics answer carries the filter, so the
  mapping is the dashboard's, one table.
- **Who opens a call** (`services/mrcall/ConversationAccess.scala`): for a non-owner (an admin, or a reseller of the
  call's owner) a list search on another owner's business answers reduced hits (`id`, `businessId`,
  `startTimestamp`, a masked number, `duration`, `details` with resolution, message, booked and transferred only,
  `requestCategories`, `archived`, `deleted`); a search with `id` answers the full call without audio, recorded as
  `conversation.opened`; `POST customer/conversation/audio?id=` answers a one-time link `{url, expiresAt}` (24 hours,
  one download), recorded as `conversation.audio`; archive, delete, properties (read marks included) and both exports
  answer 403 `owner_only` on another owner's call. No answer says "read-only"; the hit's `owner` is the business's
  owner variable, not the call's, so the dashboard decides from the business: the reader is a non-owner of a call
  of a business whose owner is not the reader (an owner's own search returns only its own calls). `GET customer/conversation/access-log?businessId&from&size&asOf`
  answers `{total, asOf, items[{at, event opened|audio, conversationId, businessId, callStart, role, name}]}`, never
  an e-mail or a uid.
- **Categories view on requests:** `POST insights/integrations?view=categories&all=` answers per row `category`
  (null with `unclassified: true` for "Da classificare"), `label`, `calls`, `businesses`, `outcomes{}`,
  `dominantOutcome`, `kind`, `nextActionKind`, `nextAction`, `examples[{text, businessId, name, conversationId}]`
  and the existing histogram, freshness, status and dismissal fields; the answer adds `calls`, `businesses`,
  `businessesWithCalls` (the share's denominator) and `backlog.calls`. `POST insights/categories/{category}/requests?businessId&outcome&all&from&size&asOf`
  answers `{total, calls, asOf, items[{requestId, conversationId, callStart, businessId, name, text, outcome,
  outcomeModel, category, categoryModel, gap, corrected}]}`. Owners get 404 on the view.
- **Reports:** a report carries `correctedAfterReport` (request ids corrected after it was written), and its
  `content.requests[]` and `content.gaps[]` carry the `requests` ids they rest on.

## What StarChat does not serve, and what therefore is not built here

| Brief item | Missing on the server | Here |
|---|---|---|
| A category's name outside the categories view (the category chip, "Sposta in categoria…") | No route lists the configured categories with their labels in a language; `classifications` and the request list give the key only, and the categories view lists only categories with requests in its window (`RequestCategoryRows`), and answers 404 to an owner | Built against one read, `GET insights/categories?language` answering `{items[{key, label, active}]}`, proposed to StarChat. The StarChat lead decides on it before C9's tag; while it answers 404 (and if the answer is no) the category is not drawn as a chip and no "move" is offered, never shown as a raw key, and the rest of this scope ships unchanged *Superseded by the second amendment, item 8* |
| "Segna come spam" over a category's requests | The request list carries no call resolution, and every signal needs its `valueFrom` (`InsightsFeedbackPsql:188`); reading each call's judgements would be a recorded opening for the admins and resellers who are that list's readers | Not built there; a call is marked spam from its own chips or from the conversations list *Superseded by the second amendment, item 11* |
| "Sposta in categoria…" in the conversations list | Nothing missing: a category belongs to a request and a call can have several, so a call-level gesture has no single subject | Not offered there; offered on a call's request chips and in a category's request list |
| "Segnala un errore" on a fact | No `fact_wrong` signal is accepted (StarChat plan, C5: the field CHECK has no fact value) | Not built. *Superseded by the amendment below, item 2* |
| The similar panel | The job is off (`similarEnabled` is configuration only, gated by StarChat's C4b); a signal does not return the job it seeded; its proposals are shown to admins only | Not built; an admin sees them in "Correzioni da rivedere" as proposals by MrCall |
| The admin queue ordered by how many calls a correction moves, and applied or rejected in bulk | `GET insights/feedback` is a flat page newest first; `/apply` and `/reject` take one id | Grouped by category and business within the page shown; "apply" and "reject" on the selected rows are sent one by one, each result reported; ordering by calls moved and a bulk route are gaps. *Grouping and ordering superseded by the amendment below, item 3; the bulk route stays a gap* |
| Counts on a page over several businesses (a reseller's scope page, the admin page without a business) opening their calls | The conversation search lists one business's calls | Those counts stay numbers; the same count on a business's page is a link |
| The counts of "Assistenti da rivedere" opening their calls | The row names one business, but most columns have no matching search filter (`not_solved` spans two outcome lines, "any check", skill errors, extraction failures) | The row keeps its link to the business's page, where each count is a link; the columns stay numbers |
| A non-owner's opening recorded once, and a gesture's answer carrying the call's effective values | Each classifications read by a non-owner is recorded as an opening, as is the search by id, with no dedupe (`ConversationAccess.readable`); the signal answer carries only its own field, bulk and undo none | The dashboard reads a non-owner's judgements first when the person opens a judgement, and again after each gesture and undo (scope 1); each read is recorded. Both server changes go back to the lead *Superseded by the second amendment, item 10* |
| Caller rules shown to a non-owner with masked numbers | `GET insights/caller-rules` answers full numbers to resellers and admins, unrecorded, while decision 14 shows them masked numbers | The rules list in the settings is the owner's; the spam offer names no number. The server side goes back to the lead. *Server side superseded by the amendment below, item 4* |
| The admin's platform jobs (`classify`, `audit`, `categories`) and the daily budget | Served (`insights/jobs/{kind}`, `/confirm`, `insights/platform-settings`), but not in C8's row, and the budget is an amount in US dollars while the reports brief shows no amount to anyone, admins included | Not built; the conflict goes back to the lead |

## Scope (what is built)

1. **Chips on every judgement of a call** (`CallDetailsPanel.vue`, wherever a call is drawn): the resolution, the
   message, and each request with its outcome and its category. A chip is a button naming the value and its state;
   one tap opens a listbox: the current value marked, the other values, "È corretta", "È sbagliata, non so quale",
   "Ripristina il valore dell'analisi" (for the author of the correction in force, and for an admin), "Cronologia"
   (each change: from, to, who, when). Choosing applies at once, or proposes where the reader may only propose; the
   chip then says "Corretta" (with "da {X} a {Y}, {nome}, {data}" in its tooltip and accessible name), "Proposta
   inviata", "Applicata" or "Respinta". A correction can change other judgements of the call on the server (a
   message or a request's outcome re-derives the resolution, spam flips the requests' exclusion, an undo restores
   derived values), and the signal's answer carries only the field it named, the bulk and undo answers none: so after
   every gesture and every undo the call's judgements are read again, for every reader; a stale value (409) is
   followed by the same read and said. For a non-owner each such read is one more recorded opening, a true record of a
   read the person caused; the StarChat lead is asked to have the signal, bulk and revert answers carry the call's
   effective values, which the submit transaction already computes (`InsightsFeedbackPsql:162`), and the re-read
   goes once they do. Under 600 px the listbox opens as a bottom sheet. An owner's call reads its judgements when it
   is opened or comes into view; a non-owner's only when the person first opens one of its chips.
2. **The undo bar**: "Modificato · Annulla" after every gesture, a live region, no time limit, replaced by the next
   gesture, closed by its own button; "Annulla" reverts the gesture.
3. **Spam and caller rules**: marking a call `spam_wrong_number` offers, once, "Tratta sempre questo numero come spam"
   and "Anche le {n} chiamate precedenti", never for a caller the server says is not eligible, and naming no number;
   "Non è spam" on a call a rule judged offers to delete the rule.
4. **The conversations list**: every filter of the search above readable from the address (so a count can link to
   it) and shown as a chip that undoes it; a selection column (a long-press mode under 600 px) with "Cambia esito",
   "Segna come spam" and "Conferma" as one gesture with one undo, in a bottom bar under 600 px.
5. **A category's requests**: from "Richieste dei chiamanti", a row opens its requests (paged), each with its text,
   business, call link and its outcome and category chips, with selection and "Cambia esito", "Sposta in
   categoria…" and "Conferma" in one gesture.
6. **Every count opens its calls**: on a business's Panoramica (outcome lines, caller left and spam, message, booked,
   transferred, calls without a conversation by reason, topics, gaps, checks), in the report detail (outcome lines,
   booked, transferred, themes, gap groups, the calls to call back and the examples, for every role): each a link to
   the conversations list filtered to the same calls in the same window. In "Richieste dei chiamanti", a page over
   several businesses, a row's calls and each outcome of its split open the category's request list
   (`categories/{category}/requests`, with `outcome` or `all`) for the same window, and each example its call.
7. **"Richieste dei chiamanti" on requests** (decision 13): its new purpose line; by default the requests the
   assistant did not fulfil, with a switch to all; the calls and the outcome split per row; "Da classificare"; the
   share over the businesses with analysed calls; the backlog said as such; the examples linked to their calls.
8. **Reports**: "Corretta dopo il report" on the items resting on a request corrected since, with the count and the
   existing regeneration.
9. **Queues**: an admin's "Correzioni da rivedere" (proposals, orphans and "da rivedere", server-paged, grouped by
   category and business within the page, with apply and reject one by one or for the selected ones, an orphan
   re-attached to one of its call's requests), and "Le mie proposte" with their state for whoever made them (an owner
   on its business's page, a reseller and an admin on the admin page).
10. **The business settings**: a section, for the business's owner, with "Numeri trattati come spam" (list,
    delete) and "Chi ha aperto le tue chiamate" (the access record, paged: when, what, which call, who by role and
    name).
11. **A non-owner's call**: the list shows reduced rows with "Apri la chiamata", the full read being the recorded
    one; an opened call says "Visualizzazione in sola lettura" and shows no archive, delete, read mark, export or
    bulk archive and delete; its recording comes from the one-time link. The judgement chips stay: decision 6 lets a
    reseller and an admin apply judgements on calls in their scope, and the record's read-only is about the call,
    not about its classification.

The reports brief's "Throughout" rules hold for every new list (the queues, a category's requests, the access
record, the spam numbers): paged on the server with a total and page numbers, `aria-sort` where a column sorts,
stacked cards under 640 px, names and never ids, states through `InsightsState.vue`. Every new string is in the 12
locales, under `components.callInsights` so the existing parity test covers it.

## Constraints

- No StarChat edit. The contract is 9.34.118 plus commits `3abdd92d1` (category counts follow the reader's current
  audit state) and `1c6629964` (business writes refused 422 with codes, which this work does not touch). *(Extended by
  the amendments: see the second amendment, item 12.)*
- One API module for these routes; the value lists are the server's closed sets in one place; one mechanism for
  loading, empty and error states (`InsightsState.vue`); the configured Axios instance, its 401 interceptor and
  `isSessionEnded` as everywhere.
- No call is opened (recorded) by the dashboard without a person asking: a non-owner's list never reads a call by id
  or its judgements on its own.
- Dashboard v2.2.32's behaviour for an owner who touches no chip is unchanged, apart from the new links.
- Commits by path in the worktree, no `-a`; no push, no tag, no deploy.

## Alternatives rejected

- **Judgements read for every row of a list, eagerly**: for a non-owner each read is a recorded opening; for an owner
  a page of 100 rows would be 100 requests. An owner's rows read their judgements when they come into view; a
  non-owner's only when the person opens a chip.
- **Keeping a chip's state from the signal's answer alone, without a re-read**: the answer names only its own field,
  and a correction re-derives others on the server, so the other chips would show values the server no longer holds
  and the next signal on them would be refused as stale.
- **"Segna come spam" over a category's requests by probing**: sending a signal with a guessed `valueFrom` and reading
  the 409 is a blind write in disguise.
- **The category labels copied into the dashboard's locales**: a second copy of StarChat's configured list, which
  changes by configuration (decision 1); it would drift silently. Proposed instead: one read from StarChat.
- **A toast for undo**: today's toast group "undo" does not render (StarChat brief, facts), and a toast has a time
  limit; the bar is new.
- **A non-owner shown no chips**: decision 6 gives resellers and admins the same apply rights as owners on judgements,
  and `InsightsFeedback.status` and its scope apply them on a call of an owner in their scope.

## Acceptance

- Each scope item has a Playwright spec on the repository's mocks, seen failing before its code (or by perturbation,
  recorded beside it), and its pure rules a vitest spec.
- A count's link carries exactly the filter of the count (one table, tested against every count kind).
- Chips are buttons with their value and state in their accessible name, menus are listboxes, the bar is a live
  region, every action is reachable by keyboard; under 600 px a bottom sheet, long-press selection and a bottom bar,
  nothing on hover.
- A non-owner's list makes no read by id until the person opens a call, and no judgements read until the person
  opens a chip, and then one after each gesture or undo; an owner-only control is never drawn for a non-owner.
- Lint, vitest and the full Playwright run (desktop, tablet, mobile) pass on the final head; load flakes rerun singly
  and named; the insights specs also pass with one worker (StarChat plan, C8).
- Not part of this hand-over, and stated so: the live re-run after StarChat's C11, where "a list's length equals its
  count" is measured against real data (StarChat plan, C8 and C11).
- A fresh reviewer reviews the code (StarChat plan, C10).

## Rollback

- The branch is reverted as a whole; nothing persistent is written by the dashboard. A correction made through it is
  StarChat's, undone by StarChat's own routes.
- Against a StarChat without these routes, every new section draws its absent (404) or not-yet (503) state and the
  existing screens work as before.

## Assumptions

- StarChat accepts, or shapes differently, the proposed category list read; the dashboard adapts the one client
  function.
- Labels in languages other than Italian and English are the session's translations; a native check is not part of
  this work.

## Amendment 2026-10-27: the contract moved while this was built

StarChat changed what this brief builds against after it was approved (commits `bdc036f6e`, `a700131a4`, `6d13718c6`,
`a76ff0ffb`, `087eedc34`, `bc67b6c8b`, read in its code); the second milestone review (R2 of the plan) found the
dashboard behind on some of them. Where this amendment differs from the sections above, it wins; they stay as written.

1. **A confirmation is not a correction.** "È corretta" is recorded `confirmed` (`InsightsFeedback.status`): it never
   becomes the correction in force, and an undo of it changes no value. The chip says "Confermata" only while the
   confirmed value is the current one; a correction in force is said first; the history names confirmations, and a
   confirmation offers no "Ripristina".
2. *(Superseded by the second amendment, item 9.)* **"Segnala un errore" on a fact is built, for the two facts a call's details carry.** StarChat accepts `fact_wrong`
   on six facts (booked, transferred, no_conversation, managed_call, skill_errors, unkept), each checked against the
   value the summary holds, as a proposal an admin closes or rejects. The call's details carry `booked` and
   `transferred` in the shape the summary holds them ("true", "false"; transferred absent is unset), so those two rows
   carry the report; the other four are not in the details (or not in the summary's shape), and a report with a value
   the dashboard cannot read exactly would be refused as stale. They are not offered here. Rejected: reading the
   summary's raw values for them, which no route serves to the dashboard.
3. **The queue is grouped by StarChat.** `GET insights/feedback` answers groups (`category`, `businessId`,
   `businessName`, `calls`, `items`, `signals`) ordered by the calls each moves and paged over groups, beside the flat
   `items`; a group carries its newest 50 signals (`items` counts all of them). The dashboard draws the groups as
   served. Apply and reject stay one call per signal (no bulk route).
4. **Caller numbers are masked by StarChat** in a non-owner's list hits (`ConversationAccess.reduced`) and in the
   caller rules' answers (a rule on a call to anyone but the call's owner, the rules' numbers to anyone but the
   business's owner); an opened call carries its full number to whoever opens it (the opening is recorded). The offer
   to delete a rule stays the business's owner's: a rule judges every call of a number for the whole business, a
   decision for whoever owns its calls.
5. **A report's counts stay as generated** (`bc67b6c8b`); the list a report count opens shows the calls the reader can
   open now and says how many it leaves out ("N non visibili con il tuo accesso"): the link carries `leftOut=true`, the
   list asks the conversation search with it, and StarChat answers `leftOut` beside the hits (`dc4d7f7f6`), absent for
   a search by id, without a business or outside the reader's scope. A live count (Panoramica) does not ask it: it is
   scoped as opening is.
6. **A count's list keeps archived calls.** The statistics count finalised calls that are not deleted, archived or not
   (StarChat's `counted`); the list of a count drops the inbox's narrowing, and says so in a chip that undoes it.
7. **The chips are drawn wherever a call is opened on purpose**: the conversations page and the call a restaurant
   booking carries, read from the bookings page (reached by the business's owner, and by admins and resellers). Both
   carry the undo bar and decide the reader's ownership from the business's owner before anything is read: an owner's
   opened call reads its judgements at once (an owner's reads are never recorded); a non-owner's is read-only, its
   judgements read when the person opens one, its recording from the one-time link. A panel drawn by any other page
   draws no chips.

## Amendment 2026-10-27 (second): what StarChat added for this work

StarChat built what the hand-over asked of it (commits `a012b6926` and `f87578328`, on test with its next tag). The
gap table's rows they close are marked here, not rewritten; this amendment wins where it differs from the sections
above.

8. **The category list** (`GET insights/categories?language`, every configured category with its key, its label in
   the language asked, English when none, and whether it is active; never `unclassified`): the category chip and
   "Sposta in categoria…" are drawn, offering the active categories only and naming any by its label. Closes the gap
   row "A category's name outside the categories view".
9. **Facts in a call's judgements** (`facts`: booked, transferred, no_conversation, managed_call, skill_errors,
   unkept, each the summary's value or null): "Segnala un errore" is offered on all six, from one chip of the call,
   each report sending the value read, null included. Supersedes amendment item 2's limit to booked and transferred.
10. **Every gesture's answer carries the touched calls' state** (`call` on a signal and on a revert, apply or reject;
   `calls` on a bulk gesture and a gesture's undo): the chips take it, and the call's judgements are no longer read
   again after a gesture or an undo; the history (which the state does not carry) is kept and updated from what the
   gesture wrote, in every panel of the touched calls (the signals travel with the gesture, a bulk answer's items
   paired with their asks by call, field and request), an applied correction marking the one it replaces reverted as
   StarChat does.
   - *StarChat's gating (`db92e82d8`, on test with 9.34.121):* the state is answered only for a call the reader may
     open now (`ConversationAccess.readable`) and omitted for any other; a signal's answer keeps the judged field's
     effective `value`. A panel whose call's state is absent (or not a full state) takes that `value` for the judged
     field (never for a fact: a report changes none), records the signal in its history, and reads the call's
     judgements again; if that read is refused (404, the reader may not open the call now) the chips stay as the
     answer left them instead of disappearing.
   - *Bulk and undo, built in StarChat 9.34.122 (`385ed995b`):* a bulk gesture and a gesture's undo answer the calls'
     full state only to their owner and record no opening for a non-owner; each answers `items`, every signal with
     its judgement's or fact's effective `value` now, so a non-owner gets the judged values only. A panel whose call's
     state the undo did not carry takes each reverted judgement's value from `items` (never a fact's) and marks the
     reverted signals before it reads the call again, so a refused read leaves the chip undone. A fact signal's
     `value` is the fact as the summary holds it (before 9.34.122 it was null); a report changes no fact either way. After it the dashboard reads only the calls on screen: the opened call, whose read may be its first
     judgements read for a non-owner who has opened no chip of it (the read records its opening once per actor and
     call within 10 minutes, `f87578328`), never a call only listed, so the Constraint on calls opened "without a
     person asking" holds: the person opened that call and made the gesture.
   - A stale value (409) carries only the stale fields' current values, with no model value and no history: the
     chips take them at once and the call's judgements are then read once, so the chip says truly what is in force.
   - An answer arriving while another gesture of the same panel is still out may be the older one: the panel takes it
     and then reads the call's judgements once, so the last answer cannot leave a stale chip.
   - Supersedes, and they stay as written above: scope 1's re-read after every gesture and undo; the rejected
     alternative "Keeping a chip's state from the signal's answer alone", whose reason (the answer names only its own
     field) no longer holds; the acceptance line "and then one after each gesture or undo", which now reads "and then
     one after a stale value, after an answer without the call's state, after an answer that arrived while another
     gesture of the panel was out, or, for the opened call, after a gesture made elsewhere touched it"; the gap row on recorded openings.
11. **A category's requests carry their call's resolution** (`resolution`): "Segna come spam" is offered on the
   selected requests, one signal per call with that resolution as the value read. Closes the gap row "Segna come spam
   over a category's requests".
12. **The release depends on StarChat's.** `a012b6926`, `f87578328` and `db92e82d8` (StarChat 9.34.121) and item 10's
   bulk and undo change with the undo's `items` (StarChat 9.34.122): the dashboard's test tag goes after StarChat
   9.34.122 is on test, and production with it. Before 9.34.122 StarChat answers a bulk's state to every reader who
   may open each call, recording a non-owner's opening of each, which the dashboard takes as it is, and an undo
   carries no `items`. Against an older StarChat:
   - the category list answers 404 and no category chip or move is drawn (as before);
   - a gesture's answer without `call` or `calls` makes the panel read the call's judgements again (the earlier
     behaviour);
   - a request row without `resolution` is left out of "Segna come spam" and said, as any row without a judged
     resolution and any call already spam (StarChat drops a null `resolution`, so absent cannot be told from an older
     server);
   - `facts` absent: no fact is offered for a report, since every fact would read "not recorded" and a report on one
     the summary holds would be refused as stale.

   The Rollback section's "existing screens work as before" holds with these fallbacks. Supersedes the Assumption
   that StarChat "accepts, or shapes differently, the proposed category list read": it built it as proposed; and the
   Constraint "The contract is 9.34.118 plus `3abdd92d1` and `1c6629964`", which now also holds the two amendments'
   commits, `db92e82d8` and item 10's bulk change.

Still not built: the similar panel, the admin's platform jobs and budget, a bulk decision route, counts over several
businesses opening their calls, and the "Assistenti da rivedere" columns opening their calls (unchanged from the gap
table).

