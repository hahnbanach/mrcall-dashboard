# Brief: classifications a person can check, correct and undo, in the dashboard

Excerpt: the dashboard side of StarChat's classification-feedback work (its step C8): every judgement of a call is a
chip that a person marks right or wrong and corrects, with one undo; lists select and correct in bulk; every count
opens the calls behind it; corrections queue for an admin and proposals for their author; caller rules and the call
access record sit in the business settings; a non-owner opens a call read-only and recorded. It states what StarChat
9.34.118 serves for this, what it does not (and is therefore not built here), the scope, the alternatives rejected,
the acceptance and the rollback, and an amendment for the contract changes StarChat made while it was built.

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
| A category's name outside the categories view (the category chip, "Sposta in categoria…") | No route lists the configured categories with their labels in a language; `classifications` and the request list give the key only, and the categories view lists only categories with requests in its window (`RequestCategoryRows`), and answers 404 to an owner | Built against one read, `GET insights/categories?language` answering `{items[{key, label, active}]}`, proposed to StarChat. The StarChat lead decides on it before C9's tag; while it answers 404 (and if the answer is no) the category is not drawn as a chip and no "move" is offered, never shown as a raw key, and the rest of this scope ships unchanged |
| "Segna come spam" over a category's requests | The request list carries no call resolution, and every signal needs its `valueFrom` (`InsightsFeedbackPsql:188`); reading each call's judgements would be a recorded opening for the admins and resellers who are that list's readers | Not built there; a call is marked spam from its own chips or from the conversations list |
| "Sposta in categoria…" in the conversations list | Nothing missing: a category belongs to a request and a call can have several, so a call-level gesture has no single subject | Not offered there; offered on a call's request chips and in a category's request list |
| "Segnala un errore" on a fact | No `fact_wrong` signal is accepted (StarChat plan, C5: the field CHECK has no fact value) | Not built. *Superseded by the amendment below, item 2* |
| The similar panel | The job is off (`similarEnabled` is configuration only, gated by StarChat's C4b); a signal does not return the job it seeded; its proposals are shown to admins only | Not built; an admin sees them in "Correzioni da rivedere" as proposals by MrCall |
| The admin queue ordered by how many calls a correction moves, and applied or rejected in bulk | `GET insights/feedback` is a flat page newest first; `/apply` and `/reject` take one id | Grouped by category and business within the page shown; "apply" and "reject" on the selected rows are sent one by one, each result reported; ordering by calls moved and a bulk route are gaps. *Grouping and ordering superseded by the amendment below, item 3; the bulk route stays a gap* |
| Counts on a page over several businesses (a reseller's scope page, the admin page without a business) opening their calls | The conversation search lists one business's calls | Those counts stay numbers; the same count on a business's page is a link |
| The counts of "Assistenti da rivedere" opening their calls | The row names one business, but most columns have no matching search filter (`not_solved` spans two outcome lines, "any check", skill errors, extraction failures) | The row keeps its link to the business's page, where each count is a link; the columns stay numbers |
| A non-owner's opening recorded once, and a gesture's answer carrying the call's effective values | Each classifications read by a non-owner is recorded as an opening, as is the search by id, with no dedupe (`ConversationAccess.readable`); the signal answer carries only its own field, bulk and undo none | The dashboard reads a non-owner's judgements first when the person opens a judgement, and again after each gesture and undo (scope 1); each read is recorded. Both server changes go back to the lead |
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
  audit state) and `1c6629964` (business writes refused 422 with codes, which this work does not touch).
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
2. **"Segnala un errore" on a fact is built, for the two facts a call's details carry.** StarChat accepts `fact_wrong`
   on six facts (booked, transferred, no_conversation, managed_call, skill_errors, unkept), each checked against the
   value the summary holds, as a proposal an admin closes or rejects. The call's details carry `booked` and
   `transferred` in the shape the summary holds them ("true", "false"; transferred absent is unset), so those two rows
   carry the report; the other four are not in the details (or not in the summary's shape), and a report with a value
   the dashboard cannot read exactly would be refused as stale. They are not offered here. Rejected: reading the
   summary's raw values for them, which no route serves to the dashboard.
3. **The queue is grouped by StarChat.** `GET insights/feedback` answers groups (`category`, `businessId`,
   `businessName`, `calls`, `items`, `signals`) ordered by the calls each moves and paged over groups, beside the flat
   `items`. The dashboard draws the groups as served. Apply and reject stay one call per signal (no bulk route).
4. **Caller numbers are masked by StarChat** to anyone but the call's owner, and the rules' numbers to anyone but the
   business's owner. The offer to delete a rule (which needs the number) is the owner's only.
5. **A report's counts stay as generated** (`bc67b6c8b`); the list a report count opens shows the calls the reader can
   open now, and is to say how many it leaves out ("N non visibili con il tuo accesso") from a server field StarChat
   has not named yet. Until it is named that line is not drawn; it goes back to the lead as pending.
6. **A count's list keeps archived calls.** The statistics count finalised calls that are not deleted, archived or not
   (StarChat's `counted`); the list of a count drops the inbox's narrowing, and says so in a chip that undoes it.
7. **The chips are drawn on the conversations page only**, the page that carries the undo bar and knows the reader's
   ownership. The restaurant call dialog (reached by admins and resellers from the configuration) keeps today's panel:
   drawing chips there would read the judgements on its own, a recorded opening nobody asked for, with no undo. This
   is a limit of this release, recorded for the lead.

