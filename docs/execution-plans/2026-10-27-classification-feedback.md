---
status: active
brief: ../briefs/2026-10-27-classification-feedback.md
created: 2026-10-27
owner: the session building StarChat plan docs/execution-plans/2026-10-26-classification-feedback.md row C8, on a temporary branch off v2.2 a837d56, fast-forwarded by the v2.2 line holder
---

# Execution plan: classifications a person can check, correct and undo, in the dashboard

Excerpt: the ordered steps that build the brief's scope (one API module and its pure rules; the chip, its listbox
and bottom sheet, and the undo bar; the call's judgements and caller rules; the conversations list's filters,
selection and non-owner view; the count links, the categories view on requests and a category's requests; the
queues; the settings section; locales and documents), each with its tests seen failing first, then the full gates,
the code review (StarChat plan C10) and the hand-over.

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

- Base `a837d56` (local `v2.2`); the branch `classification-feedback` in the worktree
  `/Users/angelo/data/WORK/elegans.io/mrcall-dashboard-wt/classification-feedback`. If the line holder lands
  something on `v2.2` (it notifies; a one-line removal of `__BOOKING__` from `menuGroups` in
  `BusinessConfiguration.vue` may land first), the branch is rebased onto the new head before hand-over, and the
  gates are run again on the rebased head.
- The StarChat lead owns the contract and receives the not-built items and the category list proposal.
- `.env.test` copied from the main checkout; `npm ci`; Playwright with `E2E_PORT=8095`.

## Steps

| Step | What | Verification | Status |
|---|---|---|---|
| P0 | Baseline: full Playwright on `a837d56` with `E2E_PORT=8095`, vitest, lint | Figures recorded here; failures named as pre-existing | done: lint clean, vitest 480 of 480; Playwright 1 492 passed, 5 failed, 5 skipped (29.4 min), the failures `overview-repairs.spec.js:59` (desktop), `wizard-responsive.spec.js:48` twice, `wizard.spec.js:80` and `:109` (tablet), named as pre-existing and rerun singly at P9 |
| P1 | `src/utils/Classifications.js`: every route of the brief's "What StarChat serves" (classifications, signal, bulk, gesture revert, revert, apply, reject, queue, caller rules, category requests, the proposed category list, audio link, access log), errors through `refusalOf`/`unwrap`; the closed value sets (resolution, message, request outcome); the chip's state from a judgement and the call's history; the menu's entries for a reader (revert for the author and for an admin); the one filter table and the address ↔ search body mapping; `gestureId` minted per gesture | vitest `tests/unit/classifications.spec.js`, written first and seen failing on the missing module, then each rule by perturbation; the filter table tested against every count kind of brief scope 6 by name: outcome lines (`outcomeLine`), caller left and spam (`resolution`), message, booked, transferred, no-conversation reasons, topics (`topic` / `topicLabels`), gaps, checks, a category with and without an outcome (request list) and "Da classificare"; every link carries `counted` and the window | done (`5b03105`, `89c3089`, `908b905`) |
| R1 | Milestone review of P1 by a fresh reviewer, before P3-P6 build on it (the module and the filter table are shared by four steps) | APPROVED, or REVISE repaired with the same reviewer | APPROVED |
| P2 | `JudgementChip.vue` (button, listbox popover, bottom sheet under 600 px, keyboard: arrows, Enter, Escape), `UndoBar.vue` (live region, no time limit, replaced by the next gesture) | Exercised through P3's and P4's Playwright specs on desktop, tablet and mobile | done (`54e09f5`) |
| P3 | The call's judgements in `CallDetailsPanel.vue` (a new `CallJudgements.vue` inside it): chips for resolution, message, each request's outcome and category; history; revert by the author or an admin; the call's judgements read again after every gesture, undo and 409; proposals' states; the spam caller-rule offer naming no number, and the rule's removal on "Non è spam"; an owner's call read when opened or in view, a non-owner's only when the person first opens a chip | Playwright `tests/e2e/insights/classification-chips.spec.js` and `caller-rules-offer.spec.js`, seen failing before the code; named cases: the category list answering 404 draws no category chip, no "Sposta in categoria…" and no raw key; the classifications route answering 404 or 503 leaves the call's panel as today | done (`54e09f5`, `dec211e`, `cff5331`) |
| P4 | The conversations list (`src/components/Conversations.vue`, `src/utils/Conversation.js`): address filters and their chips; selection, long-press, bulk bar with one gesture and one undo; non-owner rows ("Apri la chiamata", "Visualizzazione in sola lettura", owner-only controls not drawn, audio by one-time link) | Playwright `tests/e2e/insights/conversations-feedback.spec.js`, `conversations-non-owner.spec.js`, seen failing first; a case asserting no read by id and no judgements read for a non-owner's list; the existing `tests/e2e/auth/conversations*.spec.js` still green | done (`263a9cc`, `494512f`, `cff5331`) |
| R2 | Milestone review of P2-P4 by a fresh reviewer, before P5 links counts to P4's address filters | APPROVED, or REVISE repaired with the same reviewer | APPROVED (re-review on `2a33d18`) |
| P5 | Count links on Panoramica (`CallOutcomes.vue`, `CallTopics.vue`, `CallQuality.vue`, given a link builder by the business page only); the report detail's links for every role and "Corretta dopo il report" (`CallReportDetail.vue`); "Richieste dei chiamanti" on requests (`RequestCategories.vue`: purpose, all switch, calls, outcome split opening the request list, "Da classificare", share over businesses with calls, backlog, example links) and `CategoryRequests.vue` (paged, outcome and category chips, selection, bulk "Cambia esito", "Sposta in categoria…", "Conferma"; no spam there, brief's gap table) | Playwright `count-links.spec.js`, `categories-requests.spec.js`, updates of the existing request and report specs, each seen failing first; named cases: on a page over several businesses the counts are not links; the categories and request routes answering 404 or 503 draw their state and the rest of the page stays | done (`03498d5`, `94bbcfd` for the report lists' `leftOut`) |
| P6 | Queues: `FeedbackQueue.vue` ("Correzioni da rivedere", admin: server-paged, grouped within the page, apply and reject one by one or for the selected rows sent one by one, an orphan re-attached to a request of its call) and `MyProposals.vue` ("Le mie proposte", owner on its business page, reseller and admin on the admin page) | Playwright `feedback-queues.spec.js`, seen failing first; the route answering 404 hides the section | done (`3378344`) |
| P7 | The business settings section (`__CALLS_ACCESS__`, synthetic as `__DATA_RETENTION__`), owner only: caller rules list and delete, and the access record | Playwright `settings-calls-access.spec.js`, seen failing first; the existing configuration specs still green | done (`ffbba4e`) |
| P8 | Documents: `docs/ARCHITECTURE.md` (call insights section), `docs/README.md` (the insights contract paragraph: the new module and filters), `docs/active-context.md`, this plan | Read against the code at P12 | done (this commit) |
| P9 | Gates on the final head: lint, vitest, full Playwright (desktop, tablet, mobile, `E2E_PORT=8095`); load flakes rerun singly and named; the insights specs (`tests/e2e/insights/` with the new ones) again with `--workers=1` | Figures recorded here, with the head they ran on | done on `1af164b`: lint clean; vitest 512 of 512 (35 files); full Playwright (desktop, tablet, mobile, `E2E_PORT=8097`) 1 737 passed, 5 skipped, 0 failed (28.9 min); `tests/e2e/insights/` with `--workers=1` 438 passed (20.3 min). The run before the code review's repairs (`b516496`) had failed two existing cases of `conversations-insights.spec.js`, a regression repaired in `5853dc6`, and the non-owner settings case on tablet and mobile (its menu is collapsed there), repaired in the spec |
| P10 | Code review by a fresh reviewer (StarChat plan C10); REVISE repaired with the same reviewer | APPROVED | APPROVED on `5853dc6` after REVISE (selection outliving its rows, overlapping reads, direct corrections listed as proposals, the undo outliving its page, an unknown owner shown as a non-owner), by a fresh reviewer |
| P11 | Rebase onto the then-current `v2.2` head if it moved; gates of P9 again on the rebased head. A rebase that only replays commits over a non-overlapping change goes back to nobody; one that needs a conflict resolved in code goes back to P10's reviewer with the resolution | `git merge-base --is-ancestor <v2.2 head> HEAD` true; figures recorded | the line moved once, to `fd4c94d`, rebased without conflict before P5; at hand-over `v2.2` and `origin/v2.2` are still `fd4c94d`, an ancestor of the branch |
| P12 | Documentation closure (`doc-end`, as AGENTS.md requires): the lead's reconciliation of the affected docs, the archive of any replaced narrative in `docs/active-context-archive.md` verbatim, `doc-check.py --completion check`, `doc-critic` over the affected docs and the active-context shape; STALE repaired. The baseline is not finalized here: that is the line holder's, at merge | `doc-critic` verdict recorded; mechanical gate clean | planned |
| P13 | Final review of the whole branch through the final user's path (the Playwright screens, desktop and mobile) by a fresh reviewer, after P12 | APPROVED | planned |
| P14 | Hand-over to the StarChat lead and the line holder: the branch and its head; the brief and plan with their verdicts; each acceptance item's code and tests; how each test failed first; the full Playwright line; the not-built items of the brief's gap table; the category-list read proposed to StarChat; the server changes asked (effective values in the signal, bulk and revert answers; the opening recorded once; masked numbers in caller rules; the budget's amount against the no-amount rule); the live re-run after C11 stated as outside this hand-over. No push, tag or deploy | — | planned |

## Locales and intermediate heads

Each step adds its strings to the 12 locale files in the same commit, so `tests/unit/callInsightsLocales.spec.js` (it
asserts the 11 other locales carry exactly en-US's `components.callInsights` keys) stays green on every head.

## Rollback

The branch is not merged, or is reverted as a whole on `v2.2`; nothing persistent is written by the dashboard.

## Measurements

(filled as the steps run)
