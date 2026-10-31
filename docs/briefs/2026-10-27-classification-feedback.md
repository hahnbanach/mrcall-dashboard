# Brief: classifications a person can check, correct and undo, in the dashboard

Excerpt: the dashboard side of StarChat's classification-feedback work (its step C8): every judgement of a call is a
chip that a person marks right or wrong and corrects, with one undo; lists select and correct in bulk; every count
opens the calls behind it; corrections queue for an admin and proposals for their author; caller rules and the call
access record sit in the business settings; a non-owner opens a call read-only and recorded. It states what StarChat
9.34.118 serves for this, what it does not (and is therefore not built here), the scope, the alternatives rejected,
the acceptance and the rollback, two amendments for the contract changes StarChat made while it was built, and a
third that designs the screens of the caller's mood and the assistant's evaluation (StarChat brief
`2026-10-30-call-satisfaction-scorecard`): the call's evaluation, Panoramica's mood card, Qualità's evaluation, "Cosa
sistemare", MrCall's worklist, the assistants table's column set, with every state, base, link and Italian string.

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

## Amendment 2026-10-30 (third): the caller's mood and the assistant's evaluation

StarChat's brief `docs/briefs/2026-10-30-call-satisfaction-scorecard.md` (approved, 955998699), its amendment of
2026-10-30 (business-data fix area, `criterionFix`, the admin's platform to-do, `appliedFilters`, suggestion call ids,
named bases, the configuration chat checked live) and its plan (5e2d01388, step S2) add, at extraction version 8, the
caller's mood at the start and in the closing exchange with its cause, an evaluation of the assistant on four criteria
with the setting that would fix each failure, and one to-do list. This amendment is the dashboard's design for them:
screens, every state, every number's base and the list it opens, keyboard and screen-reader names, Italian copy. Where
it differs from the sections and amendments above, it wins; they stay as written. The code is StarChat plan step S15,
after the reports plan's U19r6 (committed: 4e25bb2, 9ef5e61, 630d78b) and U19r6b on this branch.

**One name for the feature:** "Valutazione dell'assistente" in the call's detail, in Qualità and as the assistants
table's column set ("Valutazione"); never "Scheda".

### 13. Facts this design rests on (read 2026-10-30)

- **Panoramica** (`/analytics?id=`, tab "Panoramica"), top to bottom: KPI cards; volume, duration, hourly map;
  "Analisi chiamanti"; "Chiamanti che non hanno parlato" (when there are some); "Come sono andate le chiamate"
  (outcome lines over "le {n} chiamate in cui il chiamante ha chiesto qualcosa", "Fuori dalla quota" with "Ha parlato
  senza dire cosa voleva" and "Spam o numero sbagliato", message, booked, transferred, calls without a conversation);
  "Di cosa hanno parlato le chiamate"; "Qualità" (Domande senza risposta by gap, Controlli, Errori delle funzioni,
  Problemi di estrazione); "Le mie proposte" (874 as reseller, U19c capture `reseller-analytics-874-overview-loaded`).
- **The platform page** draws the same sections over every business, then "Assistenti da rivedere": besides the name,
  Chiamate, Non risolte, Silenziosi, Non risposte, Nessuna richiesta, Domande aperte, Controlli, Errori skill,
  Estrazione, Variazione (the change of Non risolte, per the table's legend), Suggerimenti MrCall, Cosa chiedono (from
  4e25bb2), Account.
- `CountLink` draws a link named "Apri le {n} chiamate: {label}", or a plain number over several businesses (the open
  gap). `Classifications.countLink` builds links from `COUNT_KINDS` and throws on an unknown kind or key.
- `InsightsState` is the one mechanism for loading, empty, `unavailable` (503), error with retry, `absent` (404).
- `JudgementChip` is a button (`aria-haspopup="listbox"`) named "{field}: {value}" plus state; the call's judgements
  are drawn as rows, a label column and a value chip ("Di cosa parlava la chiamata").
- The transcript is a toggle "Conversazione ({count} messaggi)" over `conversation_transcription`, **with empty turns
  filtered out** (`CallDetailsPanel.vue` `turns`): a drawn position is not the original index.
- There is **no recompute of one call**: recomputation is per interval (`InsightsRequestDialog`, the banner, Elaborazioni).
- **Where each fix area is edited** (`template_business_variable.json`, `BusinessVariables.isVariableVisible`):
  question-and-answer pairs in `__KNOWLEDGE_BASE__` (owner, with `?draftQuestion=`); opening hours and address in
  `__BUSINESS_DATA__` (owner); transfer rows in `__MRCALL_FORWARDING__` (owner); booking in `__BOOKING__`; the classic
  greeting's parts (`WELCOME_BIZ_OPENING`, `WELCOME_PART3_*`) in `__CONVERSATION__` (owner); the GPT-Live greeting
  (`INBOUND_WELCOME_MESSAGE_PROMPT`, used when `ENABLE_INBOUND_WELCOME_MESSAGE_PROMPT` is true) and the instructions
  (`CONVERSATION_PROMPT`) are not `visible`: in the settings only an admin sees them.
- **The configuration chat, checked live on test on 2026-10-30** (Playwright, saved sessions; owner on business
  80e23bdc, reseller on 874; each value read from the database before, after the change and after the restore; the
  whole variable map of both businesses identical before and after):
  - it proposed and saved a change to the instructions and to the GPT-Live greeting, for the owner and for the reseller;
  - it warned in its reply when the matching `ENABLE_…` flag is false ("va attivato. Fammi sapere se vuoi che lo
    attivi") and did not turn it on unasked;
  - on an empty `CONVERSATION_PROMPT` it wrote the whole standard template, about 2 900 characters in English with
    placeholders, plus the change;
  - its review shows the raw variable name and the whole new value in a `<pre>`, and **"Prima: —" even where the
    previous value was not empty**; asked to undo, it once claimed the line it had added was already in the original
    and changed nothing, and restored it only when told the exact line: the review's "before" is not reliable;
  - a message typed into the input after the panel settled stayed there (12 s); the panel clears the input when its
    open completes (`currentMessage = ''` in the open's `finally`), so a pre-fill must be placed after `agentReady`;
  - **the save route takes any change, not only the chat's proposals**: `POST /api/mrcall/apply-changes` on the
    configuration agent (mrcall-agent, `mrcall_agent/api/routes/mrcall.py`, origin/main of 2026-10-29) writes the
    `changes` of its body through the same validation the chat's proposals pass, with no tie to the session's pending
    list; checked by one round trip on test on 80e23bdc only (the greeting set to a value the chat never proposed,
    read back, then set back to the exact previous value, read back; the whole variable map identical to the first
    snapshot);
  - **the business record the dashboard reads carries the non-visible variables**: `GET crm/business` answered the owner
    (80e23bdc, 318 variables) and the reseller (874, 351) with `CONVERSATION_PROMPT`, `ENABLE_CONVERSATION_PROMPT`,
    `INBOUND_WELCOME_MESSAGE_PROMPT` and `ENABLE_INBOUND_WELCOME_MESSAGE_PROMPT` present;
  - **an open defect, outside this work** (recorded for the configuration agent's owners): the chat, asked to change
    empty instructions, writes a template it reconstructs instead of the standard instructions in effect, and its undo
    contradicted itself about the previous value. This design does not send anyone to the chat to change MrCall's
    standard instructions (§15), and does not rely on the chat's undo (§15, "Ripristina il testo precedente").

### 14. What StarChat serves, and what is drawn without it

- Routes and fields: `analytics/satisfaction` (with the two bases, the per-criterion split by `criterionFix`, the
  criteria failed among the dissatisfied for the assistant); `analytics/satisfaction/todo` (one business; without a
  business, admins only: MrCall's failures across businesses); `analytics/assistants` (new columns, sorts, each with
  its base and change, `mrcallOnly`); search filters `satisfactionBase`, `scored`, `notScored`, `satisfactionStart`,
  `satisfactionEnd`, `satisfactionCause`, `trajectory`, `criterion` with `criterionResult`, `criterionFix`, `fixArea`,
  `correctedField`, `analysed` (every analysed call, any version), and `ids` (existing); the search's `appliedFilters`; the call's `satisfaction` and `scorecard`
  (model and effective values, quotes with speaker, `turn`, suggestions, history); the feedback fields.
- **A filter this amendment adds counts as applied only when StarChat echoes it** (`appliedFilters`). An answer
  without `appliedFilters` (an older StarChat) counts today's filters (resolution, gap, check, request category, …)
  as applied, as today, and the new ones as not applied. When any filter sent is not applied, the list says "Alcuni
  filtri non sono disponibili su questo server: l'elenco non li applica." above it, each such filter's chip reads
  "{filtro}: non disponibile", and no selection or bulk gesture is offered on that list.
- Against a StarChat without these routes (404): every new section is `absent`; a call without `satisfaction` or
  `scorecard` draws no evaluation section.
- The closed sets (mood values, causes, criteria, results, fix areas) live in one place (`CallInsights.js`, beside
  `GAP_KEYS`), with a parity test against the locales.

### 15. A call's detail: "Valutazione dell'assistente"

**Where.** In `CallDetailsPanel.vue`, under the judgement rows (resolution, message, requests), wherever chips are drawn
(amendment item 7). It follows the existing row layout: a label column and a value chip. **Superseding decision:** the
StarChat brief draws the mood as one chip; here it is three rows, start, end and cause, because each is corrected on its
own (StarChat brief §7) and a chip edits one field.

**Desktop:**
```
Valutazione dell'assistente
  Umore all'inizio      [neutro ▾]
  Umore alla fine       [insoddisfatto ▾]
  Causa                 [l'assistente ▾]
                        Il chiamante ha detto: «va bene, tanto non risolvete niente»
                        Vai al punto della conversazione
  Ha capito             [sì ▾]
  Informazioni corrette [no ▾]
  Ha seguito le istruzioni [non valutabile ▾]
  Conversazione scorrevole [sì ▾]

  Cosa non è andato
  ▸ Informazioni corrette: no
      L'assistente ha detto: «siamo aperti anche la domenica»     Vai al punto della conversazione
      Da sistemare in  [Dati dell'attività ▾]
      Aggiorna gli orari della domenica nei dati dell'attività.
      [Apri i dati dell'attività]
  ▸ Ha capito: no
      Il chiamante ha detto: «gliel'ho già detto due volte»       Vai al punto della conversazione
      Da sistemare in  [MrCall ▾]
      Non dipende dalle impostazioni dell'attività: lo sistemiamo noi.
```
**Under 600 px:** label above chip, each row full width; each chip a bottom sheet; "Vai al punto della conversazione"
a full-width text button under its quote; "Cosa non è andato" items stacked.

**Rules.**
- **Values as words.** Start: "ben disposto", "neutro", "irritato" (a caller is not "satisfied" before anything
  happened). End: "soddisfatto", "neutro", "insoddisfatto". Cause: "l'assistente", "l'attività", "la situazione del
  chiamante", "nessuna". Criteria: "sì", "no", "non valutabile". Fix areas: "Base di conoscenza", "Dati dell'attività",
  "Istruzioni dell'assistente", "Trasferimento chiamate", "Prenotazioni", "Saluto", "MrCall".
- **Chips** are `JudgementChip`s with the menu, history, undo bar, proposal states (scope 1: "Proposta inviata",
  "Applicata", "Respinta") and 409 handling every judgement has. The cause chip is always drawn.
- **Remainders asked for at once.** Setting a criterion to "no" draws its failure item with its fix chip reading "Area
  non indicata" and moves focus to that chip, whose menu opens with the heading "In quale area va sistemato?"; setting
  the end to "insoddisfatto" while the cause is "nessuna" moves focus to the cause chip the same way. Nothing forces an
  answer: an unset area or cause is counted as such (§17, §16).
- **"Cosa non è andato"** is a list (`<ul>`, under an `<h4>`), one item per criterion whose effective result is "no",
  in the criteria's order. An item: "{criterio}: no" as its heading; the quote with its speaker ("L'assistente ha
  detto:" / "Il chiamante ha detto:"); "Vai al punto della conversazione" when it has a `turn`; its fix chip; its
  suggestion; the action of its area (table below). "✕" is not used.
- **Actions by area and role:**

  | Area | Owner and reseller | Admin |
  |---|---|---|
  | Base di conoscenza | "Apri la base di conoscenza" (`__KNOWLEDGE_BASE__`) | same |
  | Dati dell'attività | "Apri i dati dell'attività" (`__BUSINESS_DATA__`); for hours read from Google Business the suggestion says so | same |
  | Trasferimento chiamate | "Apri il trasferimento chiamate" (`__MRCALL_FORWARDING__`) | same |
  | Prenotazioni | "Apri le prenotazioni" (`__BOOKING__`) | same |
  | Istruzioni dell'assistente (only on a business with its own enabled instructions: StarChat assigns an instructions failure on MrCall's standard instructions to MrCall, its amendment item 10) | "Configura con la chat" (`__CONFIGURE_AI__`, suggestion pre-filled) | "Apri le istruzioni" (`__CONVERSATION__`) and "Configura con la chat" |
  | Saluto, `ENABLE_INBOUND_WELCOME_MESSAGE_PROMPT` true and `INBOUND_WELCOME_MESSAGE_PROMPT` with its own text (the greeting is generated from the business's prompt) | "Configura con la chat", pre-filled | "Apri il saluto" (`__CONVERSATION__`) and the chat |
  | Saluto, flag true and an empty prompt (MrCall's standard greeting) | never reached: StarChat assigns the failure to MrCall (its amendment item 10) | — |
  | Saluto, flag false (the classic greeting) | "Apri il saluto" (`__CONVERSATION__`, where the owner edits it, as the silent-callers card's link) | same |
  | MrCall | no action: "Non dipende dalle impostazioni dell'attività: lo sistemiamo noi." | no action here; MrCall's worklist is the platform to-do (§19) |

  The flag is read from the business record the page already holds; while it is not known, the greeting's action is
  not drawn.
- **The chat's pre-fill.** `?section=__CONFIGURE_AI__&draft=<suggestion>`: `ConfigureAIPanel` takes `draft` once,
  **after `agentReady` and after its open's `finally` has cleared the input**, puts it in the input, moves focus there,
  sends nothing, and drops `draft` from the address (a reload does not paste it again).
- **The chat's review, made readable** (verified needed, §13): for a text variable the review names it by its label in
  the person's language (`human_name_multilang`), shows "Prima" from the business's current value read by the dashboard
  (never the chat's `old_value`), and the change as a line diff (removed lines struck through and prefixed "−", added
  lines prefixed "+", unchanged lines folded as "… {n} righe invariate"), with the whole new value behind "Mostra il
  testo completo". When the variable's `ENABLE_…` flag is false, the review says "Queste istruzioni non sono attive:
  salvarle non cambia le chiamate finché non le attivi."
- **"Ripristina il testo precedente".** When the panel saves a change to a text variable it reached from a failure (or
  any change to `CONVERSATION_PROMPT` or `INBOUND_WELCOME_MESSAGE_PROMPT`, which the owner cannot edit elsewhere), it
  keeps the "Prima" it read from the business record and, after the save, shows an undo bar "Istruzioni salvate ·
  Ripristina il testo precedente" with no time limit, a live region, replaced by the next save and closed by its own
  button. "Ripristina il testo precedente" first reads the business record again and compares the current value with
  the one the save wrote: if it differs (someone changed it since), it says "Il testo è stato modificato dopo il
  salvataggio: vuoi comunque rimettere quello precedente?" and writes only after "Sì, ripristina". It then writes the
  kept value through the same `apply-changes` route (checked, §13), reads the business record again and says "Testo precedente ripristinato." only when the value read equals the
  kept one; otherwise it says "Il ripristino non è riuscito: il testo attuale è diverso da quello precedente." and
  keeps the bar. It does not go through the chat.
- These `ConfigureAIPanel` changes (pre-fill, readable review, not-active notice, the restore bar) belong to StarChat
  plan step S15's scope; the plan is amended to say so when this amendment is committed.
- **The turn.** StarChat's `turn` is an index into the call's full transcript. The panel keeps each turn's original
  index when it filters empty turns and finds the drawn turn by it; a `turn` that points at a filtered (empty) turn or
  outside the array draws no link. "Vai al punto della conversazione" opens the transcript, scrolls the turn to the
  middle, marks it with an outline and the text "Qui" and moves focus to it (`tabindex="-1"`, accessible name "Messaggio
  {n} di {total}, {chi}: {testo}", counted over the drawn turns). The mark and a link "Torna alla valutazione" at the
  top of the transcript stay until the next jump or until the transcript is closed: no time limit, no Escape binding
  (Escape belongs to the panel). A test checks, on a recorded call, that the array the panel draws is StarChat's
  `CONVERSATION_JSON` in length and order.
- **MrCall's failures** are drawn for every role, the owner included (StarChat brief D4); a signal touching `none` is a
  proposal for everyone but an admin, so the chip says "Proposta inviata".
- The former "Dagli altri dati della chiamata" line is dropped: message and transfer are already rows of the panel.

**States.**
| State | What is drawn |
|---|---|
| The call has insights below version 8 | "Questa chiamata è stata analizzata prima che esistesse la valutazione dell'assistente." with, where the reader may run it, a link to the period's recompute ("Analizza di nuovo il periodo", the banner's dialog); no chips |
| Not in the satisfaction base (the caller did not ask anything, spam, no conversation) | the three mood rows read "Umore: non contato — {motivo}" with the reason in the existing words ("Ha parlato senza dire cosa voleva", "Spam o numero sbagliato", "Nessuna conversazione"); the mood chips stay correctable, and correcting the resolution above brings the call into the base; the four criteria are drawn |
| A criterion `not_applicable` | its row "non valutabile", no failure item |
| The two prompt criteria withdrawn by the gate (StarChat plan S12) | no rows for them, and one line "Informazioni corrette e istruzioni non sono valutate per questa attività." |
| Loading | the chips busy, as `JudgementChip` draws them |
| Error | `InsightsState` error with retry, for the section |
| A non-owner, the call opened | as the owner, quotes and suggestions included. **This changes amendment item 7** (judgements read when the person first opens a chip): an opened call's classifications are read when it is opened, since quotes come only from that read; the opening is recorded once per actor and call within 10 minutes (StarChat classification brief, amendment 2026-10-27), so the read adds no record to the opening it is part of |
| A non-owner, a list hit only | no section (a list hit carries no quote or suggestion) |

### 16. Panoramica: "Come si sono sentiti i chiamanti"

**Where.** After "Come sono andate le chiamate", before "Di cosa hanno parlato le chiamate"; read with Panoramica's
other reads, on the overview tab only (reports brief, second amendment, rule 6 (6)). A pointer in the KPI row (§18)
leads to "Cosa sistemare".

**Desktop** (figures consistent: 364 calls with an evaluation = 312 in the base + 40 + 12):
```
┌ Come si sono sentiti i chiamanti ─────────────────────────────────────────────────────────────┐
│ Alla fine della chiamata, su 312 chiamate in cui il chiamante ha chiesto qualcosa               │
│ [███████████████████████░░░░░░░░░░░░▓▓]                                                         │
│ Soddisfatti 198 (63%) · Neutri 96 (31%) · Insoddisfatti 18 (6%), 2 punti in più del periodo     │
│ precedente (era 4%)                                                                             │
│   Insoddisfatti per: l'assistente 7 · l'attività 9 · la situazione del chiamante 1 ·            │
│   causa non indicata 1                                                                          │
│   Nelle 7 per l'assistente non è andato: Ha capito 4 · Informazioni corrette 2 · Ha seguito le  │
│   istruzioni 1 → Cosa sistemare                                                                 │
│ All'inizio: ben disposti 41 · neutri 240 · irritati 31                                          │
│ Durante la chiamata: umore migliorato 18 · peggiorato 7 · invariato 287                         │
│                                                                                                 │
│ Insoddisfatti alla fine, per settimana                                                          │
│   6 ott  4% (3 su 80) · 13 ott  6% (5 su 82) · 20 ott  7% (6 su 85) · 27 ott  4 su 65, parziale │
│                                                                                                 │
│ Non contate qui: 40 in cui il chiamante ha parlato senza dire cosa voleva · 12 spam o numero    │
│ sbagliato · 9 senza conversazione · 55 analizzate prima che esistesse la valutazione            │
│ Il controllo «Il chiamante sembrava insoddisfatto» conta chi lo è sembrato in qualunque momento │
│ della chiamata; qui conta come si sentiva alla fine.                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```
**Under 600 px:** the bar full width; each count on its own line ("Insoddisfatti · 18 · 6%"); the weekly figures a
list; the "Non contate" items a list.

**Every number, its base and its list** (new `COUNT_KINDS`; every link carries the business, the window and
`counted=true`, and is drawn as filtered only under §14's `appliedFilters` rule):
| Number | Base | Filter |
|---|---|---|
| 312 | it is the base | `satisfactionBase=true` |
| Soddisfatti / Neutri / Insoddisfatti | 312 | `satisfactionBase=true&satisfactionEnd=<v>` |
| per l'assistente / l'attività / la situazione / causa non indicata | Insoddisfatti | `…&satisfactionEnd=negative&satisfactionCause=<c>` (`none` for "causa non indicata") |
| "Ha capito 4" etc. among the 7 | the 7 | `…&satisfactionEnd=negative&satisfactionCause=assistant&criterion=<c>&criterionResult=fail` |
| All'inizio: … | 312 | `satisfactionBase=true&satisfactionStart=<v>` |
| umore migliorato / peggiorato / invariato | 312 | `satisfactionBase=true&trajectory=<t>` |
| a week's "3 su 80" | the week's base, 80 | the base filter, `satisfactionEnd=negative`, the week's window (and its 80 the base filter alone) |
| 40 / 12 | none | `resolution=caller_left` / `resolution=spam_wrong_number` (existing kinds), with `scored=true` |
| 9 | none | `noConversation` (existing kind) |
| 55 | none | `notScored=true` |

- Percentages only when their base is 20 or more; the change in percentage points only under StarChat's rule (brief
  §3), otherwise "n.d." followed by its reason **as visible text** ("n.d.: il periodo precedente ha meno di 20 chiamate
  contate", "n.d.: nel periodo precedente la valutazione non c'era ancora per tutte le chiamate"). The outcomes card
  draws its "n.d." since U19r6 as an `<abbr>` whose reason is a `title`; here the reason is written beside it, as the
  review asked. A change is drawn neutral, as every change is since U19r6 (U19c m1).
- **The weekly figures** are the dissatisfied share of each bucket's base where that base is 20 or more, and "{k} su
  {n}" otherwise; a bucket holding calls analysed before the evaluation is drawn as "{k} su {n}, parziale" whatever its
  base, with no share, as the reports brief's rule 4 marks partial buckets. The weeks add up to the section's figures
  (3 + 5 + 6 + 4 = 18 dissatisfied; 80 + 82 + 85 + 65 = 312). No change is drawn per bucket.
- The "→ Cosa sistemare" link moves to that section and focus to its heading.

**States.**
| State | What is drawn |
|---|---|
| Loading / error / 404 | `InsightsState` (loading keeps the height with `keepContent`; error with retry; 404 absent) |
| No call in the window | section not drawn (Panoramica's empty state already says it) |
| No call with an evaluation | "Nessuna chiamata con la valutazione dell'assistente nel periodo: {n} sono state analizzate prima che esistesse." with the count linked (`notScored=true`) and the banner's action where it is offered |
| Base under 20 | counts only, no percentages, no change; "Pochi dati per una percentuale: {n} chiamate contate." |
| "n.d." | as above, reason in text |
| Partly evaluated window | the "Non contate" line names the 55; nothing else changes |
| Platform page | plain numbers and "Scegli un'attività per aprire le chiamate." (the open gap) |
| Reseller or admin on a business | as the owner; the lists are a non-owner's reduced lists (decision 14) |

### 17. Qualità: "Valutazione dell'assistente"

**Where.** Inside "Qualità", a group after "CONTROLLI", before "ERRORI DELLE FUNZIONI".

**Desktop** (scored base 364):
```
VALUTAZIONE DELL'ASSISTENTE   su 364 chiamate con la valutazione
                           No / valutabili   Nelle impostazioni   Da sistemare   Area non     Prima
                                             dell'attività        da MrCall      indicata
Ha capito                  21 di 357          4                    16             1            18 di 340
Informazioni corrette       9 di 280          9                    0              0            n.d.: …
Ha seguito le istruzioni    6 di 230          5                    1              0            4 di 210
Conversazione scorrevole   11 di 364          8                    3              0            12 di 350
"Ha capito: no" comprende le volte in cui il chiamante ha dovuto ripetersi (il controllo qui sopra) e quelle in cui
l'assistente ha frainteso un nome, una data o un numero.
```
**Under 600 px:** one card per criterion with labelled rows.

| Number | Base | Filter |
|---|---|---|
| "21" | "357" | `criterion=<c>&criterionResult=fail` |
| "357" | 364 | `criterion=<c>&criterionResult=applicable` |
| 364 | it is the base | `scored=true` |
| "Nelle impostazioni dell'attività" | 21 | `criterion=<c>&criterionResult=fail&criterionFix=owner` |
| "Da sistemare da MrCall" | 21 | `…&criterionFix=mrcall` |
| "Area non indicata" | 21 | `…&criterionFix=unset` |
| "Prima" | the previous period's applicable | none, as the outcomes' changes |

The three parts add up to the failures (StarChat amendment item 2). States as §16; a criterion the gate withdrew has
no row and one line names it.

### 18. "Cosa sistemare"

**Where.** After "Qualità", before "Le mie proposte", on a business's page. The KPI row gains a pointer card "Cosa
sistemare: {n} aree" linking to it (moving focus to its heading). The report detail keeps its own list of questions
without an answer (its counts are the report's frozen figures).

**Desktop:**
```
┌ Cosa sistemare ── su 419 chiamate analizzate nel periodo ───────────────────────────────────────┐
│ Dati dell'attività                      12 chiamate              [Apri i dati dell'attività]     │
│   · Aggiorna gli orari della domenica.                                  9 chiamate               │
│   · Correggi l'indirizzo: manca il numero civico.                       3 chiamate               │
│ Base di conoscenza                      11 chiamate              [Apri la base di conoscenza]    │
│   · «Il parcheggio è gratuito?» senza risposta           4 chiamate     [Aggiungi la risposta]   │
│   · Indica se si accettano i buoni pasto.                               2 chiamate               │
│   Mostra tutte (5)                                                                              │
│ Trasferimento chiamate                   3 chiamate              [Apri il trasferimento chiamate]│
│ Istruzioni dell'assistente               2 chiamate              [Configura con la chat]         │
│ ────────────────────────────────────────────────────────────────────────────────────────────── │
│ Da sistemare da MrCall                  17 chiamate                                              │
│   Non dipende dalle impostazioni dell'attività: lo sistemiamo noi.                               │
│ «Informazioni mancanti» in Qualità conta le domande senza risposta; qui la base di conoscenza    │
│ conta anche le risposte sbagliate da correggere.                                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```
**Under 600 px:** a card per area, its action a full-width button at its foot.

- **Base:** every analysed call in the window, of any version (StarChat amendment item 6), said in the heading and
  linked (`analysed=true`); the
  areas that rest on gaps count version-7 calls too, so a business with no evaluated call still sees its to-do.
- **Rows:** StarChat's areas ordered by calls, "Da sistemare da MrCall" last and apart for every role; an area with no
  call is not drawn. An area's calls open `fixArea=<area>`.
- **Suggestions:** up to 5 per area, **ordered by calls** (StarChat amendment item 5), each with its call count linked
  through `ids` (its calls' ids, at most 500; above that the count is plain and the area's link opens them all). A
  `missing_info` question is drawn between « » with an "Aggiungi la risposta" button that opens
  `?section=__KNOWLEDGE_BASE__&draftQuestion=` with the question `/todo` answered, so no call is read for it (the report
  detail's button, since U19r6 m5, reads its example call's question for an owner and opens the knowledge base without a
  question for anyone else); it keeps the reports brief's exclusions (no `clinical_advice` question offered for an
  answer, and none on an integration gap).
- **Actions:** §15's table, by role and, for the greeting, by the flag.
- **"Mostra tutte ({n})"** expands in place through `/todo`'s paging, focus on the first new item.
- **States:** loading, error, 404 as §16; nothing to fix: "Niente da sistemare nel periodo, su {n} chiamate
  analizzate."; a reseller or admin: the same, actions by role.

### 19. MrCall's worklist (admin, platform page)

A section "Da sistemare da MrCall, tutte le attività" on the admin's platform page, after "Assistenti da rivedere":
StarChat's `/todo` without a business (admins only). One row per business (named), ordered by calls, with its calls
by criterion and its suggestions (each count a link to that business's calls: `fixArea=mrcall`, and per criterion
`criterion=<c>&criterionResult=fail&criterionFix=mrcall`), server-paged with total and page numbers. States through
`InsightsState`; empty: "Nessun problema da sistemare da MrCall nel periodo." Not drawn for resellers (they see their
businesses' rows in the assistants table and on each business's page).

### 20. "Assistenti da rivedere" (reseller and admin)

- **A view control, not a filter:** a segmented control "Colonne: Esiti | Valutazione", named "Colonne" for assistive
  technology (a radio group), kept in the address (`cols=valutazione`) for a shared link, never drawn as a filter chip.
- **Why a switch:** since U19r6 the scope and admin pages are 1280 px wide and the table fits its card only with
  compact cells (U19c m12); four more columns do not fit.
- **"Esiti"** is today's set unchanged. **"Valutazione"**: name, Chiamate, Insoddisfatti per l'assistente, Umore
  peggiorato, Criteri non rispettati, Da sistemare da MrCall, Account; "Variazione" (the change of Non risolte) is not
  in this set; **each new column carries its own change** against the previous period ("+2 punti", or "n.d." with its
  reason in text).
- Each share is "{p}% ({k} di {n})": Insoddisfatti per l'assistente over the satisfaction base; Umore peggiorato over
  the same; Criteri non rispettati over the calls with an evaluation (`scored`); Da sistemare da MrCall over the
  analysed calls (`mrcallBase`). Each `k` and each `n` opens that business's calls (`k`: `satisfactionEnd=negative&
  satisfactionCause=assistant`, `trajectory=worsened`, `criterionResult=fail` with no criterion, `fixArea=mrcall`; `n`:
  `satisfactionBase=true`, `scored=true`, `analysed=true`). Wilson-ranked, `aria-sort` on the sorted header; sorting
  by a new key switches to its set.
- The table's legend gains each new column with its base and change.
- **"Solo con problemi da MrCall"** (`mrcallOnly`): a filter chip that undoes it.
- **Under 640 px:** stacked cards with the set's columns as labelled rows, no header row (as U19r6 draws the table on a phone, keeping the header for assistive technology). A business with no evaluated call shows "–"
  and sorts last.

### 21. The admin queue

- "Proposte su problemi da MrCall": the proposals on a failure whose fix is or becomes `none`, grouped as StarChat
  groups them, applied or rejected one by one.
- "Valutazioni di correttezza smentite", per business: **its count is calls**, the calls in the window with an applied
  correction of "Informazioni corrette" from "no" to "sì"; it opens exactly those calls
  (`correctedField=criterion_accurate&criterion=accurate&criterionResult=pass`), so count and list agree.
- "Le mie proposte" lists an owner's or reseller's own with their state, as today.

### 22. The conversations list

Every new filter is read from the address and drawn as a chip that undoes it ("Umore alla fine: insoddisfatto",
"Causa: l'assistente", "Criterio: Informazioni corrette, no", "Area del criterio: MrCall", "Area: Dati dell'attività",
"Con la valutazione", "Analizzate prima della valutazione"), under §14's `appliedFilters` rule. **A row of a list
opened from a mood or evaluation count shows the call's failed criteria and their areas** ("Non è andato: Ha capito
(MrCall), Informazioni corrette (Dati dell'attività)"), from the summary values the hit carries, so the person reads
why without opening each call; the value the filter already names is not repeated.

### 23. Keyboard, screen readers, contrast

- Chips as above; failure items a list under a heading; quotes name their speaker in text.
- The mood bar: `role="img"` named with every segment ("Alla fine: soddisfatti 198 su 312, neutri 96, insoddisfatti
  18"); the links are the counts below it. Segment colours and the "Qui" outline at least 3:1 against their
  background, every text at least 4.5:1, checked on the built screens (U19d).
- "n.d." and its reason are text, never only a tooltip.
- The turn jump: focus to the turn, its name read; "Torna alla valutazione" returns focus to the button that moved it.
- Every action reachable by Tab in reading order; nothing on hover; no control with a time limit.

### 24. Copy (Italian), the key strings

| Key (under `components.callInsights`) | Text |
|---|---|
| `evaluation.title` | Valutazione dell'assistente |
| `mood.start` / `mood.end` / `mood.cause` | Umore all'inizio / Umore alla fine / Causa |
| `mood.start.positive/neutral/negative` | ben disposto / neutro / irritato |
| `mood.end.positive/neutral/negative` | soddisfatto / neutro / insoddisfatto |
| `mood.cause.assistant/business/caller/none` | l'assistente / l'attività / la situazione del chiamante / nessuna |
| `mood.notCounted` | Umore: non contato — {reason} |
| `criterion.understood/accurate/followed_instructions/flow` | Ha capito / Informazioni corrette / Ha seguito le istruzioni / Conversazione scorrevole |
| `criterion.result.pass/fail/not_applicable` | sì / no / non valutabile |
| `evaluation.failures` | Cosa non è andato |
| `quote.assistant` / `quote.caller` | L'assistente ha detto: / Il chiamante ha detto: |
| `fix.label` / `fix.ask` / `fix.unset` | Da sistemare in / In quale area va sistemato? / Area non indicata |
| `fix.area.knowledge_base/business_data/instructions/transfer_rules/booking/greeting/mrcall` | Base di conoscenza / Dati dell'attività / Istruzioni dell'assistente / Trasferimento chiamate / Prenotazioni / Saluto / MrCall |
| `fix.mrcallLine` | Non dipende dalle impostazioni dell'attività: lo sistemiamo noi. |
| `fix.action.knowledge_base/business_data/transfer_rules/booking/greeting/instructions` | Apri la base di conoscenza / Apri i dati dell'attività / Apri il trasferimento chiamate / Apri le prenotazioni / Apri il saluto / Apri le istruzioni |
| `fix.action.chat` | Configura con la chat |
| `chat.review.notActive` | Queste istruzioni non sono attive: salvarle non cambia le chiamate finché non le attivi. |
| `chat.restore.bar` / `.action` / `.done` / `.failed` | Istruzioni salvate / Ripristina il testo precedente / Testo precedente ripristinato. / Il ripristino non è riuscito: il testo attuale è diverso da quello precedente. |
| `chat.restore.changedSince` / `.confirm` | Il testo è stato modificato dopo il salvataggio: vuoi comunque rimettere quello precedente? / Sì, ripristina |
| `chat.review.unchanged` / `chat.review.full` | … {n} righe invariate / Mostra il testo completo |
| `turn.jump` / `turn.back` / `turn.here` / `turn.name` | Vai al punto della conversazione / Torna alla valutazione / Qui / Messaggio {n} di {total}, {who}: {text} |
| `evaluation.oldCall` / `evaluation.recompute` | Questa chiamata è stata analizzata prima che esistesse la valutazione dell'assistente. / Analizza di nuovo il periodo |
| `evaluation.withdrawn` | Informazioni corrette e istruzioni non sono valutate per questa attività. |
| `mood.section.title` / `.base` | Come si sono sentiti i chiamanti / Alla fine della chiamata, su {n} chiamate in cui il chiamante ha chiesto qualcosa |
| `mood.section.change` | {n} punti in più del periodo precedente (era {p}%) \| {n} punti in meno del periodo precedente (era {p}%) |
| `mood.section.byCause` | Insoddisfatti per: l'assistente {a} · l'attività {b} · la situazione del chiamante {c} · causa non indicata {d} |
| `mood.section.whyAssistant` / `.toTodo` | Nelle {n} per l'assistente non è andato: / Cosa sistemare |
| `mood.section.trajectory` | Durante la chiamata: umore migliorato {a} · peggiorato {b} · invariato {c} |
| `mood.section.weekly` / `.partial` | Insoddisfatti alla fine, per {bucket} / parziale |
| `mood.section.excluded` | Non contate qui: {a} in cui il chiamante ha parlato senza dire cosa voleva · {b} spam o numero sbagliato · {c} senza conversazione · {d} analizzate prima che esistesse la valutazione |
| `mood.section.vsCheck` | Il controllo «Il chiamante sembrava insoddisfatto» conta chi lo è sembrato in qualunque momento della chiamata; qui conta come si sentiva alla fine. |
| `mood.section.noneEvaluated` | Nessuna chiamata con la valutazione dell'assistente nel periodo: {n} sono state analizzate prima che esistesse. |
| `fewData` | Pochi dati per una percentuale: {n} chiamate contate. |
| `change.nd.small` / `change.nd.partial` | n.d.: il periodo precedente ha meno di 20 chiamate contate / n.d.: nel periodo precedente la valutazione non c'era ancora per tutte le chiamate (beside U19r6's `change.notAvailable`, `notAvailableHelp`, `partialHelp`, which speak of calls and periods, not of evaluated calls) |
| `platform.pickBusiness` | Scegli un'attività per aprire le chiamate. |
| `evaluation.quality.base` | su {n} chiamate con la valutazione |
| `evaluation.quality.columns` | No / valutabili · Nelle impostazioni dell'attività · Da sistemare da MrCall · Area non indicata · Prima |
| `evaluation.quality.vsCheck` | «Ha capito: no» comprende le volte in cui il chiamante ha dovuto ripetersi (il controllo qui sopra) e quelle in cui l'assistente ha frainteso un nome, una data o un numero. |
| `todo.title` / `.base` | Cosa sistemare / su {n} chiamate analizzate nel periodo |
| `todo.calls` | {n} chiamata \| {n} chiamate |
| `todo.mrcall` | Da sistemare da MrCall |
| `todo.nothing` | Niente da sistemare nel periodo, su {n} chiamate analizzate. |
| `todo.more` / `todo.pointer` | Mostra tutte ({n}) / Cosa sistemare: {n} aree |
| `todo.vsGaps` | «Informazioni mancanti» in Qualità conta le domande senza risposta; qui la base di conoscenza conta anche le risposte sbagliate da correggere. |
| `todo.platform.title` / `.empty` | Da sistemare da MrCall, tutte le attività / Nessun problema da sistemare da MrCall nel periodo. |
| `assistants.columns` / `.outcomes` / `.evaluation` | Colonne / Esiti / Valutazione |
| `assistants.col.unsatisfied/worsened/failed/mrcall` | Insoddisfatti per l'assistente / Umore peggiorato / Criteri non rispettati / Da sistemare da MrCall |
| `assistants.mrcallOnly` | Solo con problemi da MrCall |
| `queue.mrcallProposals` / `queue.accurateOverturned` | Proposte su problemi da MrCall / Valutazioni di correttezza smentite |
| `list.failedCriteria` | Non è andato: {items} |
| `filters.*` | Umore all'inizio / Umore alla fine / Causa / Andamento dell'umore / Criterio / Area del criterio / Area / Con la valutazione / Analizzate prima della valutazione |
| `filters.unavailable` / `filters.unavailableChip` | Alcuni filtri non sono disponibili su questo server: l'elenco non li applica. / {filter}: non disponibile |

Every string in the 12 locales under `components.callInsights`, covered by the parity test.

### 25. Acceptance (added)

- Each screen has a Playwright spec on the mocks, selecting by role, seen failing first, under 600 px included.
- Every count of §16-§21 opens a list whose filter is exactly its own (one table test over the new `COUNT_KINDS`); the
  split parts of §17 add up to their failures; a list without every filter echoed offers no bulk gesture.
- The turn jump finds the turn by original index, moves focus and back, and keeps its mark until the next jump.
- The chat's pre-fill lands after `agentReady`, is not sent, is read once; the review shows the label, the business's
  current value as "Prima", a line diff and the not-active notice; after a save, "Ripristina il testo precedente"
  writes the kept value and says it is restored only when the business record reads it back equal.
- An instructions failure is routed to the chat only on a business with its own enabled instructions; on MrCall's
  standard instructions it is in the MrCall row.
- An owner sees MrCall's failures marked and apart, and their correction is a proposal; the admin's worklist lists them
  across businesses.
- Against an older StarChat (404, or no `appliedFilters`) new sections are absent, today's filters keep today's
  behaviour, and a list asked with a new filter is not drawn as filtered and offers no bulk gesture.
- The fresh adversarial UX review of this design holds before code (StarChat plan S2); the built screens are attacked
  in the reports plan's U19d, contrast measured there.

### 26. Rollback

The new sections, filters and the chat's `draft` and review changes go with the branch; nothing persistent is written
by the dashboard beyond what a person saves through existing routes.
