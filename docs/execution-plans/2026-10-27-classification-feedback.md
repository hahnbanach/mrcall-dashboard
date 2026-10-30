---
status: active
brief: ../briefs/2026-10-27-classification-feedback.md
created: 2026-10-27
owner: the session building StarChat plan docs/execution-plans/2026-10-26-classification-feedback.md row C8, on a temporary branch off v2.2 a837d56, rebased onto fd4c94d when the line moved, fast-forwarded by the v2.2 line holder
---

# Execution plan: classifications a person can check, correct and undo, in the dashboard

Excerpt: the ordered steps that build the brief's scope (one API module and its pure rules; the chip, its listbox
and bottom sheet, and the undo bar; the call's judgements and caller rules; the conversations list's filters,
selection and non-owner view; the count links, the categories view on requests and a category's requests; the
queues; the settings section; locales and documents), each with its tests seen failing first, then the full gates,
the code review (StarChat plan C10) and the hand-over; and P16, the dashboard's repairs of the U19c attack (StarChat
plan insights-reports-ux, U19r6) with the StarChat fields they assume.

## Classification

Substantial: new API client, new components on five screens, new behaviour for three roles, 12 locales. No StarChat
change. The contract is StarChat 9.34.118 (test) plus `3abdd92d1`; the category list read is a proposal to StarChat
(brief, "What StarChat does not serve").

## Reviews

- Brief: REVISE (seven findings: spam over a category's requests, records multiplying, scope 6 against the gap
  table, "Sposta in categoria…" on calls, the queues' server gaps, C8's own verification, the "Throughout" rules),
  then REVISE (chips going stale after a gesture), then APPROVED, by the same fresh reviewer, 2026-10-27.
- Plan: REVISE (one-worker run, the doc lifecycle closure, named fallback cases, locales per step, milestone
  reviews, the hand-over's content), then APPROVED, by a second fresh reviewer, 2026-10-27.
- R1 (P1): REVISE (a rejection dated against a later-applied correction, "right" on an unset value, ownership unknown
  read as owned), REVISE (a waiting proposal hidden by an older rejection), APPROVED on `a77364f` (now `908b905`).
- R2 (P2-P4): REVISE (chips stale after a bulk gesture, a count's list dropping archived calls, the bulk bar off
  screen, focus lost after a choice, the restaurant dialog reading judgements unasked, the contract moved: confirmations,
  facts, masked numbers), repaired in `cff5331`; the scope change it named (fact reports) is the brief's amendment of
  2026-10-27, under a fresh brief review.
- Brief amendment of 2026-10-27 (the contract moved): REVISE (item 7 narrowed on a wrong reach and reason, item 4
  saying more than the server), then APPROVED on `0f4a17c`, by a fresh reviewer; item 7 was built rather than narrowed.
- The line moved to `fd4c94d` (v2.2 pushed, with the v2.2.34 merge): the branch was rebased onto it, no conflict.
- Port: the Playwright runs use `E2E_PORT=8097`, not 8095: another session's dev server (`land-v2.2`) holds 8095, and
  Playwright would have reused it, testing that tree instead of this one.

## Dependencies and ownership

- Base `a837d56` (local `v2.2`), rebased onto `fd4c94d` when the line was pushed (see Reviews); the branch `classification-feedback` in the worktree
  `/Users/angelo/data/WORK/elegans.io/mrcall-dashboard-wt/classification-feedback`. If the line holder lands
  something on `v2.2` (it notifies; a one-line removal of `__BOOKING__` from `menuGroups` in
  `BusinessConfiguration.vue` may land first), the branch is rebased onto the new head before hand-over, and the
  gates are run again on the rebased head.
- The StarChat lead owns the contract and receives the not-built items and the category list proposal.
- `.env.test` copied from the main checkout; `npm ci`; Playwright with `E2E_PORT=8095` as asked for the baseline (P0), then `E2E_PORT=8097`: another session's dev server holds 8095 (see Reviews).

## Steps

| Step | What | Verification | Status |
|---|---|---|---|
| P0 | Baseline: full Playwright on `a837d56` with `E2E_PORT=8095`, vitest, lint | Figures recorded here; failures named as pre-existing | done: lint clean, vitest 480 of 480; Playwright 1 492 passed, 5 failed, 5 skipped (29.4 min), the failures `overview-repairs.spec.js:59` (desktop), `wizard-responsive.spec.js:48` twice, `wizard.spec.js:80` and `:109` (tablet), named as pre-existing and rerun singly at P9 |
| P1 | `src/utils/Classifications.js`: every route of the brief's "What StarChat serves" (classifications, signal, bulk, gesture revert, revert, apply, reject, queue, caller rules, category requests, the proposed category list, audio link, access log), errors through `refusalOf`/`unwrap`; the closed value sets (resolution, message, request outcome); the chip's state from a judgement and the call's history; the menu's entries for a reader (revert for the author and for an admin); the one filter table and the address ↔ search body mapping; `gestureId` minted per gesture | vitest `tests/unit/classifications.spec.js`, written first and seen failing on the missing module, then each rule by perturbation; the filter table tested against every count kind of brief scope 6 by name: outcome lines (`outcomeLine`), caller left and spam (`resolution`), message, booked, transferred, no-conversation reasons, topics (`topic` / `topicLabels`), gaps, checks, a category with and without an outcome (request list) and "Da classificare"; every link carries `counted` and the window | done (`5b03105`, `89c3089`, `908b905`) |
| R1 | Milestone review of P1 by a fresh reviewer, before P3-P6 build on it (the module and the filter table are shared by four steps) | APPROVED, or REVISE repaired with the same reviewer | APPROVED |
| P2 | `JudgementChip.vue` (button, listbox popover, bottom sheet under 600 px, keyboard: arrows, Enter, Escape), `UndoBar.vue` (live region, no time limit, replaced by the next gesture) | Exercised through P3's and P4's Playwright specs on desktop, tablet and mobile | done (`54e09f5`) |
| P3 | The call's judgements in `CallDetailsPanel.vue` (a new `CallJudgements.vue` inside it): chips for resolution, message, each request's outcome and category; history; revert by the author or an admin; the call's judgements read again after every gesture, undo and 409; proposals' states; the spam caller-rule offer naming no number, and the rule's removal on "Non è spam"; an owner's call read when opened or in view, a non-owner's only when the person first opens a chip | Playwright `tests/e2e/insights/classification-chips.spec.js` and `caller-rules-offer.spec.js`, seen failing before the code; named cases: the category list answering 404 draws no category chip, no "Sposta in categoria…" and no raw key; the classifications route answering 404 or 503 leaves the call's panel as today | done (`54e09f5`, `dec211e`, `cff5331`) |
| P4 | The conversations list (`src/components/Conversations.vue`; its address read by `Classifications.searchFromQuery`): address filters and their chips; selection, long-press, bulk bar with one gesture and one undo; non-owner rows ("Apri la chiamata", "Visualizzazione in sola lettura", owner-only controls not drawn, audio by one-time link) | Playwright `tests/e2e/insights/conversations-feedback.spec.js`, `conversations-non-owner.spec.js`, seen failing first; a case asserting no read by id and no judgements read for a non-owner's list; the existing `tests/e2e/auth/conversations*.spec.js` still green | done (`263a9cc`, `494512f`, `cff5331`) |
| R2 | Milestone review of P2-P4 by a fresh reviewer, before P5 links counts to P4's address filters | APPROVED, or REVISE repaired with the same reviewer | APPROVED (re-review on `2a33d18`) |
| P5 | Count links on Panoramica (`CallOutcomes.vue`, `CallTopics.vue`, `CallQuality.vue`, given a link builder by the business page only); the report detail's links for every role and "Corretta dopo il report" (`CallReportDetail.vue`); "Richieste dei chiamanti" on requests (`RequestCategories.vue`: purpose, all switch, calls, outcome split opening the request list, "Da classificare", share over businesses with calls, backlog, example links) and `CategoryRequests.vue` (paged, outcome and category chips, selection, bulk "Cambia esito", "Sposta in categoria…", "Conferma"; no spam there, brief's gap table) | Playwright `count-links.spec.js`, `categories-requests.spec.js`, updates of the existing request and report specs, each seen failing first; named cases: on a page over several businesses the counts are not links; the categories and request routes answering 404 or 503 draw their state and the rest of the page stays | done (`03498d5`, `94bbcfd` for the report lists' `leftOut`) |
| P6 | Queues: `FeedbackQueue.vue` ("Correzioni da rivedere", admin: server-paged, grouped within the page, apply and reject one by one or for the selected rows sent one by one, an orphan re-attached to a request of its call) and `MyProposals.vue` ("Le mie proposte", owner on its business page, reseller and admin on the admin page) | Playwright `feedback-queues.spec.js`, seen failing first; the route answering 404 hides the section | done (`3378344`) |
| P7 | The business settings section (`__CALLS_ACCESS__`, synthetic as `__DATA_RETENTION__`), owner only: caller rules list and delete, and the access record | Playwright `settings-calls-access.spec.js`, seen failing first; the existing configuration specs still green | done (`ffbba4e`) |
| P8 | Documents: `docs/ARCHITECTURE.md` (call insights section), `docs/README.md` (the insights contract paragraph: the new module and filters), `docs/active-context.md`, this plan | Read against the code at P12 | done (this commit) |
| P9 | Gates on the final head: lint, vitest, full Playwright (desktop, tablet, mobile, `E2E_PORT=8097`); load flakes rerun singly and named; the insights specs (`tests/e2e/insights/` with the new ones) again with `--workers=1` | Figures recorded here, with the head they ran on | on the final code head `8c1060c` (the final review's repair: no call-back or WhatsApp action for a masked number): lint clean; vitest 512 of 512; full Playwright (desktop, tablet, mobile, `E2E_PORT=8097`) 1 728 passed, 5 skipped, 9 failed under load, each rerun alone and passing: `insights/request.spec.js:145` (desktop), `auth/skills.spec.js:183`, `:408`, `:435`, `auth/wizard.spec.js:109`, `responsive/public-responsive.spec.js:63`, `:69`, `:77`, `skills/pending.spec.js:37` (mobile); `tests/e2e/insights/` with `--workers=1` 433 passed, 5 failed, rerun alone: `conversations-feedback.spec.js:139` (desktop), `request.spec.js:278` (tablet, mobile) and `minors.spec.js:14` (mobile) passed, `minors.spec.js:14` (tablet) failed once more alone and then passed 23 times (13 alone, 10 with `--repeat-each`), an intermittent redirect whose cause is not measured. On `1af164b`, before the repair, the same full run had 0 failures (1 737 passed) and the one-worker run 438 passed |
| P10 | Code review by a fresh reviewer (StarChat plan C10); REVISE repaired with the same reviewer | APPROVED | APPROVED on `5853dc6` after REVISE (selection outliving its rows, overlapping reads, direct corrections listed as proposals, the undo outliving its page, an unknown owner shown as a non-owner), by a fresh reviewer. P15's delta re-reviewed against StarChat 9.34.122 by another fresh reviewer: REVISE on `a88c6fc` (an undo answered without the call's state left a corrected chip when its read was refused; contract statements naming 9.34.121), repaired in `14a2a29`, APPROVED there (`classification-chips.spec.js` 17 passed on desktop, the new case failing without the repair) |
| P11 | Rebase onto the then-current `v2.2` head if it moved; gates of P9 again on the rebased head. A rebase that only replays commits over a non-overlapping change goes back to nobody; one that needs a conflict resolved in code goes back to P10's reviewer with the resolution | `git merge-base --is-ancestor <v2.2 head> HEAD` true; figures recorded | the line moved once, to `fd4c94d`, rebased without conflict before P5; at hand-over `v2.2` and `origin/v2.2` are still `fd4c94d`, an ancestor of the branch |
| P12 | Documentation closure (`doc-end`, as AGENTS.md requires): the lead's reconciliation of the affected docs, the archive of any replaced narrative in `docs/active-context-archive.md` verbatim, `doc-check.py --completion check`, `doc-critic` over the affected docs and the active-context shape; STALE repaired. The baseline is not finalized here: that is the line holder's, at merge | `doc-critic` verdict recorded; mechanical gate clean | in progress: task `c8-classification-feedback`; prior reviews recorded; impact, reconciliation, mechanical and the focused check (the nine specs of this work, 49 passed) recorded; doc-critic STALE on this plan (base, port, P4's files, P9's head), repaired here |
| P13 | Final review of the whole branch through the final user's path (the Playwright screens, desktop and mobile) by a fresh reviewer, after P12 | APPROVED | planned |
| P15 | StarChat's additions for the hand-over (brief, second amendment, items 8-11; StarChat `a012b6926`, `f87578328`): the category chip and move on the category list; the six facts reported from one chip; every gesture's answer taken instead of a re-read (signal, revert, apply, reject, bulk, gesture undo), the history kept from what the gesture wrote, a 409 taking its current values; spam over a category's requests on their calls' resolution | Specs first: `classifications.spec` (the state, history, revert, decision and 409 helpers; a correction made elsewhere), `classification-chips.spec` (no read after a gesture or an undo; the six facts), `conversations-feedback.spec` (an opened call's chips from a bulk answer, no read), `categories-requests.spec` (spam with the resolution), each seen failing on `2d39e13`; then lint, vitest, full Playwright; C10 and P13 brought up to date for the changed parts | in progress |
| P16 | StarChat plan `docs/execution-plans/2026-10-24-insights-reports-ux.md` step U19r6, and U19r5's dashboard part (6): the dashboard's repairs of the U19c attack (StarChat brief `docs/briefs/2026-10-24-insights-reports-ux.md`, "Amendment 2026-10-30", rules 1-6, 8-10 and "Dashboard (minors)"), on this branch, against the fields StarChat is building beside it (section "U19r6: the StarChat fields assumed") | New specs `tests/e2e/insights/u19c-{reports,scope,feedback,calls,contrast}.spec.js` and `tests/unit/u19cRules.spec.js`, written first and seen failing on `c0a4e35` with the fixtures already amended (Playwright desktop 30 of 31, the 31st the version-5 caption kept; vitest 22 of 23, the 23rd a whole-days period kept); then lint, vitest, the full Playwright run; the fixture-against-recorded-answer shape check after StarChat's U19r7a on test; code review U19r6b | code `4e25bb2`, `9ef5e61` (the first full run's repair: the phone tables' header row kept for assistive technology, a share read as one phrase, two pins moved to m13's words). Gates on `9ef5e61`: lint clean; vitest 561 of 561; full Playwright (desktop, tablet, mobile, `E2E_PORT=8097`) 1 948 passed, 4 failed, 9 skipped, the four (mobile, `page.goto` timing out under load: `u19c-reports.spec.js:79`, `:137`, `u19c-scope.spec.js:94`, `:142`) passing alone, 3 times each. On `4e25bb2` the same run had 14 failures, repaired in `9ef5e61`. Not run: the shape check against answers recorded on test, U19r6b |
| P14 | Hand-over to the StarChat lead and the line holder: the branch and its head; the brief and plan with their verdicts; each acceptance item's code and tests; how each test failed first; the full Playwright line; the not-built items of the brief's gap table; the category-list read proposed to StarChat; the server changes asked (effective values in the signal, bulk and revert answers; the opening recorded once; masked numbers in caller rules; the budget's amount against the no-amount rule); the live re-run after C11 stated as outside this hand-over. No push, tag or deploy | — | planned |

## U19r6: the StarChat fields assumed

The amendment of 2026-10-30 names what StarChat serves, not its field names; StarChat builds them beside this work.
Each is read in one place, named here so the lead aligns them before the shape check:

| Rule | Field the dashboard reads | Read in |
|---|---|---|
| 1 | the report estimate's `finalised` (finalised calls of the period) and `analysed` (those the report reads); "no calls" only from `fits: false, reason: "no_calls"` | `InsightsReports.reportReach`, `InsightsRequestDialog.followEstimate` |
| 2 | a report's `content.version` (5 for the new `flagged_calls`) | `InsightsReports.flaggedCaption` |
| 3 | `analytics/assistants` rows' `requestCategories[]` `{category, label, questions}` (as served by 9.34.123) and `latestReport.periodStart`; the requests list `POST insights/categories/{c}/requests?businessId=&all=true` | `AssistantsToReview.asksOf`, `CategoryRequests` |
| 4 | category rows' `nextActionKind`: `business_info`, `integration` (with `nextAction`), `delegate`, `handled`, `withdrawn`, `unrated`; the unclassified row by `category: null` / `unclassified` | `InsightsReports.nextAction` |
| 5 | `POST insights/feedback/{id}/withdraw` answering the signal with `status: "withdrawn"` (and `call` when readable); the status `withdrawn` in histories and `GET insights/feedback?mine=true&status=…,withdrawn`; the gesture undo's `items[]` each with `status` (`reverted` or `withdrawn`), `reverted[]` kept for an older answer | `Classifications.withdraw`, `.undoOutcome`, `.withReverted`, `.ownFactReports` |
| 8 (m7) | report rows' `requesterRole`, as on jobs: no dashboard change | `InsightsReports.requesterLabel` |
| 9 | history rows' `status: "no_calls"` for a cycle with no calls | `InsightsReports.REPORT_STATUS` |
| 10 | `previousPartial: true` on `analytics/outcomes` answers and on each `analytics/assistants` row | `InsightsReports.previousPartial` |

Not covered by an assumed field: the KPI cards' changes (`analytics/dashboard`) against a partial window (StarChat
computes those changes; no `previousPartial` is read there). Rule 7 (the owner's language) and rule 6's server part
are StarChat's.

## Locales and intermediate heads

Each step adds its strings to the 12 locale files in the same commit, so `tests/unit/callInsightsLocales.spec.js` (it
asserts the 11 other locales carry exactly en-US's `components.callInsights` keys) stays green on every head.

## Rollback

The branch is not merged, or is reverted as a whole on `v2.2`; nothing persistent is written by the dashboard.

## Measurements

The figures are in the steps: P0 (the baseline on `a837d56`), P9 (the gates on the final head) and P12 (the focused
check of the closure).
