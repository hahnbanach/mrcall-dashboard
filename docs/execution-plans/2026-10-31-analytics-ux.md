---
status: active
brief: ../briefs/2026-10-31-analytics-ux.md
created: 2026-11-01
owner: this session (mrcall-dashboard lead), on a temporary branch `analytics-ux` off v2.2 508b014 in the worktree mrcall-dashboard-wt/analytics-ux, merged into v2.2 by the line holder
depends_on: StarChat 9.34, the patch after 9.34.126 (S1-S4 of the brief), for steps A5b, A6b, A6c and A7 only
---

# Execution plan: analytics navigation, call dialog, sticky headers, quality drill-down

Excerpt: the ordered steps that build the brief's outcomes O1-O6. First the StarChat-independent steps: one search
composition shared by the conversations page and the counted-calls panel (A1), the call dialog and the panel (A2),
every call link and count opened over the page (A3), one sticky header mechanism, phone cards for every table and the
column tooltips replacing the legend (A4), the narrowed admin and scope pages without one-row rankings (A5a), the
quality meanings, next actions and StarChat's extraction definition on every quality surface (A6a). Then the
StarChat-dependent steps: narrowed requests (A5b), skill error and extraction links (A6b), the drill from a quality
count to its businesses (A6c), the unanswered questions (A7). Last the gates, reviews and documentation (A8).

## Classification

Substantial: new shared components used on four pages, one moved search composition, a changed counting definition
(extraction problems), three roles affected, 12 locales, and a dependency on four StarChat reads not yet published.

## Reviews

- Brief: REVISE (six findings: the existing legend, one-row breakdown and narrowed requests, the two extraction
  definitions, O2's rejected alternative and guarantees, S2's coverage, acceptance coverage), then APPROVED, same fresh
  reviewer, 2026-11-01.
- Plan: REVISE (seven findings: A1 would freeze a count list's live edits and treated `leftOut` as a body field; the
  pages scroll inside `#app-central-content`, not the window, and a header with no filter bar would sit under the
  navbar; phone cards and the report's quality table unplanned; StarChat-independent parts of O3 held behind S1 and no
  UI for the pre-S1 state; the report page's quality signals unplanned; one dialog keeping one business's owner; the
  locale check's namespace, the e2e extraction pin and the S2-S4 refusal mocks), then REVISE (the report's quality
  counts not linked), then APPROVED, same fresh reviewer, 2026-11-01.

- Milestone A1-A6a: REVISE (16 browser regressions in `tests/e2e/admin/` and `tests/e2e/visual/`, which no run after the
  baseline had covered; the business card dropping to a lone "Loading" while the page reloads; the panel printing
  " call" for a count not known; the per-signal unit test missing; O1 untested on the scope page), fresh reviewer,
  2026-11-01. Repaired: the card keeps its content while loading and the section keeps its name (the business is the
  card's heading); the panel states no number for an unknown count; `tests/unit/signals.spec.js`; the scope page cases
  in `overlays.spec.js` and `signals.spec.js`; the admin and visual specs moved to the brief's behaviour. Full suite on
  the repaired tree: 2083 passed, 14 skipped, 17 failed, the 17 passing alone (`--last-failed`, 21.5 s); against the
  baseline's 9 such failures, the difference is not explained (none of the 17 is in a spec this work changed but
  `u19r7-start` and `u19c-scope:144`, both passing alone).

## Dependencies and order

A1 → A2 → A3. A4 is independent of A1-A3. A5a needs A4 (the card replaces a table). A6a needs A4 (its texts sit beside
rows the help mechanism also serves). A5b, A6b, A6c and A7 need A2 and the StarChat patch on test (the StarChat session
messages its tag); A6c and A7 also need A6a.

The StarChat-dependent steps are written against the published guide and merged only once that StarChat is on test,
so no dashboard on test or production asks StarChat for a read it does not serve; until then the screens they change
keep today's behaviour, and the one screen that today would mislead once narrowed (the requests section) says so
(A5a). Rejected: a runtime probe of StarChat's capabilities (a 400 on an unknown sort would be read as absence, the
same answer a malformed request gets).

## Steps

Every step writes its tests first and sees them fail against the tree before the change, recorded in the step's commit
message. New user-facing strings go under `components.callInsights` in all 12 locales in the same commit, so that
`tests/unit/callInsightsLocales.spec.js` (which checks that namespace only) covers every one of them; the restaurant
dialog's strings move there with the dialog (A2). Each step keeps `npm run test:unit` and its Playwright specs green.
StarChat mocks in `tests/e2e` implement the published contract with its refusals: S1 out of scope answered empty and a
body `businessId` differing from the query parameter 400; S2 an unknown reason or check 400, `present=true` with
`sort=calls` 400; S3 both booleans and their complement; S4 a missing or unknown `gap` 400.

### A1. One search composition for a count's calls

The conversations page reads a count's address once (`readAddress` in `Conversations.vue`: controls, window, extra
filters, `counted`) and then composes every request from its live state in `searchBody` (the range, the controls and
the chips can all change afterwards). The panel (A2) needs the same composition from a link, with no later edits.

- Move `readAddress` into `Classifications.js` as `readCountAddress(query)`, unchanged in output, and move the body
  composition into `Classifications.composeSearch({businessId, window, controls, extra, counted, viewFilters})`,
  where `controls` is in body form (`resolution`, `message`, `booked` boolean, `transferred: true`,
  `hasUnanswered: true`). `Conversations.vue`'s `searchBody(extra)` converts its live state to that form and
  delegates; the panel calls `composeSearch` with `readCountAddress(link.query)`.
- `leftOut` is not part of the body: `Classifications.searchQuery({leftOut})` returns the query suffix both callers
  append (today's `leftOutQuery` at `Conversations.vue` 1159).
- Tests (unit, written before the move against today's `searchBody` through a mounted `Conversations.vue` with the
  search mocked): the body sent equals the pinned body for every `COUNT_KINDS` address on first load, after a range
  change, after a control change (resolution, booked, unanswered), and after a chip removed; the `leftOut` suffix on a
  report count's address. The same pins pass after the move, and the panel's body for each address equals the
  first-load pin.

### A2. The call dialog and the counted-calls panel

- `src/components/conversations/CallDialog.vue`: `RestaurantCallModal.vue` generalised (props `businessId`, `ids`,
  `title`, `visible`), the same `CallDetailsPanel` with judgements and `UndoBar`. The owner is looked up per business
  (`CallInsights.business`, cached by `businessId` for the page's life) and `readOnly` is computed for the business of
  the call shown, so one dialog serving several businesses never shows an owner's action on a call the reader does not
  own. The restaurant page uses it; `RestaurantCallModal.vue` and its references are deleted, its strings moved to
  `components.callInsights.callDialog`.
- `src/components/analytics/CountedCallsPanel.vue`: PrimeVue `Drawer` (registered in `src/main.js`), right side,
  full width under 640 px. Input: a count link, its label and count. It states the count and label, pages the calls
  with `composeSearch` (archived included through `counted`) and the `leftOut` suffix (its "n calls left out" line),
  each row (time, caller, summary line) a button opening `CallDialog`; "Apri in Conversazioni" is a `router-link` to
  the same link. Opening the panel reads the search only; opening a call reads the call.
- One instance of each per page, reached through a provide/inject seam (`openCall(businessId, id)`,
  `openCount(link, label, count)`) provided by `Analytics.vue`, `AnalyticsAdmin.vue` and `views/AnalyticsReport.vue`.
- Tests: unit for the panel's paging, states and `leftOut` line; unit for the dialog opening a call the reader owns
  and then, in the same instance, one of another business it does not own (no owner action, no judgements read until
  a chip is opened); Playwright (three viewports) that dialog and panel open and close without changing `page.url()`
  or `history.length`, `#app-central-content`'s `scrollTop` equal before and after, an expanded category still
  expanded; the panel's total equals the count on the mock.

### A3. Every call link and count opens over the page (O1, O2, O6)

- `CountLink.vue` becomes a button calling `openCount` when the seam is provided, and stays a link where it is not (the
  conversations page's own counts).
- The call links of `RequestCategories.vue`, `CategoryRequests.vue`, `FeedbackQueue.vue`, `MyProposals.vue` and
  `CallReportDetail.vue` (example calls, a gap's calls) call `openCall` / `openCount`.
- The report page's quality table, a plain number today (`CallReportDetail.vue` 178): each non-zero "now" count
  becomes a `CountLink` over the page's existing `link('gap', key)` (`report: true`, so its panel states `leftOut`).
  The "before" column stays a number: it counts the period before the report, which has no report of its own to
  scope a list to.
- Tests: Playwright per page (admin, scope, business Overview, report page) per link kind, the report's quality
  counts included (the panel's total equals the cell, `leftOut` stated).

### A4. Sticky headers, phone cards and column help (O4)

- **Sticky header**: a directive `v-sticky-head` (`src/directives/stickyHead.js`, a new directory, registered in
  `src/main.js`) on a table's wrapper. It finds the table's scroll container with the function `scrollBelowBar.js`
  already uses (exported from there, not copied), resolved lazily (on the first scroll or resize after mount, and
  again whenever the table resizes) because that function needs the content to overflow already and would otherwise
  fall back to the document; the first scroll is caught by a capture-phase `scroll` listener on `document` (a container's scroll does not
  bubble), after which it listens to that container's `scroll`, and observes the table with a
  `ResizeObserver` (a row expanded, a page changed, a column grown). The header's reference line is the lowest bottom
  among the container's top and the elements inside it marked `data-sticky-anchor` (the analytics filter bar gets the
  attribute); with no anchor it is the container's top, which is already below the fixed navbar (the navbar is outside
  `#app-central-content`). It translates the real `thead` by `clamp(line - tableTop, 0, tableHeight - headHeight)`,
  so the header stays inside its table's box: the `overflow-x: auto` wrapper does not clip it, sideways scroll stays
  native, the frozen business column keeps working, and the sort buttons keep their handlers and `aria-sort`. Off
  under 641 px.
- First sub-step, before applying it anywhere: a Playwright measurement on `desktop` and `tablet` of the assistants
  table scrolled (in `#app-central-content`) to its last row and then sideways: the header's box below the bar and in
  the viewport, the business cell's left edge unchanged. If the translated header and the sticky-left column interfere
  on WebKit, the fallback is a header row in its own sticky container scrolled in sync with the body, measured the same
  way and recorded here before going on.
- Applied to `PagedTable.vue` (so also `widgets/CallsAccessSettings.vue`, with no filter bar), `RequestCategories.vue`,
  `CallTopics.vue`, the business breakdown and callers tables of `Analytics.vue` and `AnalyticsAdmin.vue`, and the
  report's quality table (`CallReportDetail.vue`).
- **Phone cards**: one LESS mixin (`src/assets/style/tableCards.less`) drawing a table's rows as cards with each cell
  under its `data-label`, extracted from `PagedTable.vue`'s current rules, which then use it. The PrimeVue `DataTable`
  tables (callers, breakdown, `CallTopics`) get `data-label` through each `Column`'s `pt.bodyCell`; the report's
  quality table and `RequestCategories.vue` through the attribute in the template.
- **Column help**: `ColumnHelp.vue` (a `pi-info-circle` button, `v-tooltip` on hover and focus, `aria-label` "Come si
  conta: {column}", the text also referenced by `aria-describedby`) on the brief's listed headers, beside the card's
  label on phones. The strings of `components.callInsights.assistants.legend.*` become the tooltips' source and the
  legend `<dl>` is removed; the other tables' texts are new keys under `components.callInsights.help`.
- Tests: the measurement as a permanent spec, plus one on the report page (no filter bar: header below the navbar);
  unit, every listed column has a help key; Playwright that each help control is reachable by Tab and named, and on
  `mobile` each table's cards show their labels.

### A5a. A narrowed page draws no one-row ranking (O3, StarChat-independent)

- `AnalyticsAdmin.vue` with `businessId`: `BusinessCard.vue` (the facts of that business's assistants row, read with
  the same `analytics/assistants` body, and the link to `/analytics?id=`) replaces `AssistantsToReview` and the
  breakdown section.
- `RequestCategories.vue` takes `narrowed` (`business` | `owner` | null, from the page's filters). Narrowed: no archive
  or restore, and a note naming where to do it. Until A5b: a visible line under the title saying the section counts
  every business of the scope (admin page) or every owner (scope page), so the section never reads as narrowed when
  it is not.
- Tests: Playwright on admin with a business (card drawn, no ranking or breakdown, no archive, the note and the "every
  business" line), admin with an owner, scope page with an owner (no archive, the line).

### A5b. Narrowed requests (O3) — needs S1 on test

- The "every business" line is removed; with `business`, the businesses, trend and reopened columns and the "who
  asked" expansion are not drawn; `requestBusinesses` and `CategoryRequests` pass `businessId`/`ownerId` as S1
  publishes (the query parameter kept on a category's requests, the body agreeing with it). `ARCHITECTURE.md` and the
  comment at `Analytics.vue` 409 say the requests follow the owner filter only from this step.
- Tests: Playwright on the S1 mock (narrowed body, out of scope answered empty, no business columns).

### A6a. Quality explains itself everywhere (O5, O6, StarChat-independent)

- `EXTRACTION_PROBLEM_KEYS` becomes `["http_error", "failed", "too_long"]`; in the same commit the pins move:
  `tests/unit/callInsights.spec.js` (406), `tests/unit/callQuality.spec.js` (26) and
  `tests/e2e/auth/analytics-insights.spec.js` (315, its title included).
- Every gap reason, check, skill errors and extraction problems gets `meaning` and `action` keys under
  `components.callInsights.signals`, drawn under its row in `CallQuality.vue` and under each reason's row of the report
  page's quality table and gap groups (`CallReportDetail.vue`), one string per signal for both.
- Tests: unit for one key per signal; Playwright that every row shows its meaning and action on the three viewports,
  on Overview, admin, scope and report pages, and that the extraction count includes `too_long`.

### A6b. Skill errors and extraction open their calls (O5) — needs S3 on test

- `COUNT_KINDS` gains `skillErrors` and `extractionFailed` (address keys, body `skillErrors: true`,
  `extractionFailed: true`, chips on the conversations page); `CallQuality.vue` links them on a business's page.
- Tests: unit for both kinds through `countLink`, `readCountAddress` and `composeSearch`; Playwright on the S3 mock.

### A6c. From a quality count to where it happened (O5) — needs S2 on test

- On the admin and scope pages `CallQuality`'s `linkFor` returns a signal (`unanswered`, `gap:<reason>`,
  `check:<check>`, `skill_errors`, `extraction_failures`) and the count opens `SignalBusinessesPanel.vue` (the same
  `Drawer` shell): `analytics/assistants?sort=<signal>&present=true`, paged on the server, each row the business, its
  count over its base and share, and a button opening that business's calls of the signal in `CountedCallsPanel` (the
  business-page link of that signal; for skill errors and extraction only once A6b is in).
- Tests: unit for the signal mapping (every quality row has one; an unknown one throws); Playwright on the S2 mock:
  only non-zero businesses, ordered by share, one opening its calls, the 400 of an unknown key shown as an error.

### A7. The unanswered questions of a reason (O5) — needs S4 on test

- `CallInsights.unanswered(user, body, {gap, from, size, asOf})`; `UnansweredQuestionsPanel.vue` (the same shell):
  the questions newest first, each with its suggestion, its business (admin and scope pages) and a button opening the
  call in `CallDialog`; reached from each reason's row ("Vedi le domande") on Overview, admin and scope pages, with the
  page's window.
- The report page does not use S4: a report's questions are its own frozen gap groups with their example calls,
  already drawn; S4 reads the calls as they are now and would not match the report's counts.
- Tests: unit for the client; Playwright on the S4 mock (paging, a call opened, empty answer, 400 on a missing gap).

### A8. Gates, reviews, documentation, hand-over

- Milestone integration reviews by a fresh reviewer after A6a (all StarChat-independent steps) and after A7.
- Full gates: `npm run test:unit` (eslint and vitest), `npx playwright test` (three viewports), and the build as CI
  runs it (`vue-cli-service build --mode test`; without `--mode` the sitemap plugin has no URLs and fails, as on the
  baseline); results with the revision they ran on.
- Live check against StarChat on test once S1-S4 are there: one per S-piece from the admin page, recorded here.
- Documentation: `ARCHITECTURE.md` "The analytics pages" (the dialog, the panels, the seam, the sticky header, phone
  cards, the narrowed page), `docs/README.md` for the new contract pieces, `active-context.md`; then `doc-end`.
- Final review through the final-user path by a fresh reviewer.

## Baseline (2026-11-01, worktree at 508b014)

- `npm run test:unit`: 40 files, 574 tests passed.
- `vue-cli-service build --mode test`: complete, sitemap generated. `npm run build` without `--mode` fails in the
  sitemap plugin (no environment file read), unrelated to this work.
- `npx playwright test`: 2009 passed, 9 skipped, 9 failed (25.0 min), none in analytics or insights; the 9 passed
  when re-run alone (`--last-failed`, 14.8 s): load flakiness of admin, skills, wizard, session-guard, signup and
  responsive specs, as `active-context.md` already records for a full run.

## Verification table

| Step | Status | Evidence |
|---|---|---|
| A1 | done | Pins at the network edge instead of a mounted unit test (the page needs the store, router and PrimeVue; the request body is the contract): `tests/e2e/insights/count-list-body.spec.js`, 14 cases x 3 viewports, snapshots recorded on 508b014 before the move, passing after it; perturbation (the `hasUnanswered` rule dropped from `composeSearch`) fails `edit-2-control-changed`. `tests/unit/countSearch.spec.js` seen failing before the functions existed, 6 passing after. `npm run test:unit` 41 files, 580 tests. |
| A2 | done | `CallDialog.vue` replaces `RestaurantCallModal.vue` (restaurant specs 142 passed); owner read per business, `tests/unit/callDialog.spec.js` seen failing with the old rule (owner read once) by perturbation. `CountedCallsPanel.vue` (PrimeVue `Drawer`, registered), `AnalyticsOverlayHost.vue` on the three pages; the pages' undo bar moved into the host and hidden (not removed) while the dialog is open, so one live region speaks at a time. Added `@mrcall_radius_pill` to `colors.less` (no radius token existed). |
| A3 | done | `CallLink.vue` for every "Open the call"; `CountLink.vue` opens the panel under a host, keeps its link elsewhere, accepts an unknown count. The report's quality counts link (`CallReportDetail.vue`). Eight specs that asserted `/conversations` hrefs now assert the panel's search and the dialog's read (`tests/e2e/fixtures/overlays.js`). `tests/e2e/insights/overlays.spec.js` (address, history, scroll of `#app-central-content`, expanded section, panel total, non-owner read-only) seen failing with `src/` stashed, 6 passed on three viewports. Insights, restaurant and analytics specs: 858 passed, 6 skipped, 9 failed, the 9 passing alone (`--last-failed`); none of the 9 was failing in the baseline full run, not yet explained, re-checked at A8. |
| A4 | done | `v-sticky-head` (`src/directives/stickyHead.js`) moves the real header cells, measured first by `tests/e2e/insights/sticky-head.spec.js`: header at the filter bar's bottom on desktop (Chromium, 1440 px, the table fits) and tablet (WebKit, 768 px, sideways scroll with the business column frozen at the wrapper's edge), and on the report page (no bar) at the container's top below the navbar; seen failing with the directive removed (header 120 px and 20 px out of place). The two engines showed no interference, so the fallback was not needed. A nested sticky table stops under its outer table's header. Phone cards: one mixin (`src/assets/style/tableCards.less`), PrimeVue tables through `pt.bodyCell` (`src/utils/tableCells.js`), whose inline `position: sticky` on the thead needs the mixin's one `!important`. Column help: `ColumnHelp.vue` (own WAI-ARIA tooltip: PrimeVue's directive listens to hover or focus, not both; drawn on the body, following its button when something scrolls, since on WebKit focus scrolls after the focus event); header cells named by the column alone. Deviation from this step: on a phone the help is a folded list above the cards (`ColumnHelpList.vue`), not a button beside each label, which is drawn by CSS `::before` and cannot hold one. The assistants legend removed, its strings the tooltips; `assistants.legendTitle` removed in favour of `help.title`. `tests/unit/columnHelp.spec.js`, `tests/e2e/insights/column-help.spec.js`. Insights, restaurant, analytics and responsive specs: one regression found and fixed (header names forced onto one line widened the assistants table by 256 px), the rest passing or passing alone. |
| A5a | done | The business card is a `focused` mode of `AssistantsToReview.vue` (its own row, drawn with the table's own rules and column help), not a second component repeating them; `AnalyticsAdmin.vue` hides the breakdown for one business. `RequestCategories.vue` `narrowed`: no archive, restore or hide-example, a note on where to do it, and until S1 the line saying it counts every business (or every owner). `tests/e2e/insights/narrowed.spec.js` (admin with a business, with an owner, the whole platform as control, reseller with an owner) seen failing with `src/` stashed (3 of 4; the control passes by construction), 12 passed on three viewports. |
| A5b | planned (blocked on S1) | |
| A6a | done | `EXTRACTION_PROBLEM_KEYS` adds `too_long`; the three pins moved first and seen failing. `SignalExplain.vue`: meaning and next action per signal (StarChat's definitions, `CallInsights.scala`), under each row of `CallQuality.vue` and, on the report page, as the quality table's fourth column (not in the row header, whose name a screen reader repeats for every cell) and under each gap group. `tests/e2e/insights/signals.spec.js` seen failing with `src/` stashed. Broad run: one real failure, on WebKit only (a click does not focus a button, so two column-help tooltips stayed open): one tooltip open at a time, unit test seen failing by perturbation; the other failures passed alone. |
| A6b | planned (blocked on S3) | |
| A6c | planned (blocked on S2) | |
| A7 | planned (blocked on S4) | |
| A8 | planned | |

## Rollback

Each step is its own commit on `analytics-ux`; before the merge into v2.2 the branch is dropped or reverted step by
step. After the merge a step reverts alone, except A1 (A2, A3, A6b build on it), A2 (A3, A6c, A7 build on it) and A4
(A5a builds on it). The extraction definition change (A6a) reverts with its pins. No persistent data or StarChat state
is touched.
