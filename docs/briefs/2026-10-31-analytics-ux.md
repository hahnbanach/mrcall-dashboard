# Analytics navigation: open a call in place, drill from a count to where it happened

Scope: Brief for the UX rework of the analytics pages (the admin page, a reseller's scope page and a business's
page with its report page): calls and counted calls opened over the page instead of away from it, the admin and scope
pages narrowed to one business or one owner, table headers and column help, quality signals that lead to the
assistants, calls and questions behind them, and the StarChat 9.34 reads agreed for it.

## Intent and evidence

The CTO reported on 2026-10-31, from https://dashboard.mrcall.ai/analytics-admin, that the analytics pages read as
unfinished, and asked that a business's own page be reviewed with the same eye. Each defect was traced to its cause
in the source on branch `v2.2` (508b014) and in StarChat on branch `9.34` (873ce1ac7):

1. **"Apri la chiamata" leaves the page.** Every call link on the analytics pages is a `router-link` to
   `/conversations?id=&conversation=`: `RequestCategories.vue` examples, `CategoryRequests.vue`, `FeedbackQueue.vue`,
   `MyProposals.vue`, `CallReportDetail.vue` example calls. Every count is one too (`CountLink.vue` through
   `Classifications.countLink`). The route change destroys the analytics page (no `keep-alive`), so the scroll, the
   expanded category and the open requests are lost, and the conversations page rewrites its own address with
   `router.replace`. A modal drawing one call with the conversations page's own panel already exists, fixed to the
   restaurant page and one `businessId` (`widgets/restaurant/RestaurantCallModal.vue`).
2. **One business chosen leaves one-row rankings and platform-wide requests.** The admin page passes its filter body
   (`businessId`, `ownerId`, `plan`) to every section. "Assistenti da rivedere" and the business breakdown honour it
   (StarChat's `scopeOf`), leaving a one-row ranking and a breakdown of "1 business, 100%". StarChat's
   `integrations?view=categories` and `integrations/{category}/businesses` build `CallRequestsQuery` from the window
   and `plan` only (`CallInsightsReportResource.scala:197,214`), and `categories/{category}/requests` (`:255`) takes
   `businessId` as a query parameter but no owner: `businessId` and `ownerId` from the body are dropped, so "Richieste
   dei chiamanti" stays platform-wide, and a reseller's owner selector does not narrow it either (StarChat session
   confirmed, 2026-11-01).
3. **Table headers scroll away; column meanings are far from the columns.** No table on these pages has a sticky
   header, and the tables sit in `overflow-x: auto` wrappers (`PagedTable.vue` `.paged-table-scroll`,
   `AssistantsToReview.vue`, `RequestCategories.vue`, `CallTopics.vue`), which also prevents a header from sticking to
   the viewport. "Assistenti da rivedere" explains its columns in a legend ("Come si conta ogni colonna",
   `AssistantsToReview.vue` 102-114) drawn under a table of up to 20 rows, out of sight while the columns are read;
   the other tables explain nothing. The CTO confirmed (2026-11-01) that the request is a tooltip on the columns.
4. **Quality signals lead nowhere and say nothing.** `CallQuality.vue` shows the gap reasons ("Fuori portata",
   "Errore dell'assistente", ...) and the checks as counts. On a business's page they link to that business's calls;
   on the admin and scope pages `countLinkFor` returns null without a business, so they are plain numbers. No page
   says what a reason means or what to do. Skill errors and extraction problems are plain numbers everywhere: the
   conversation search filters `gap` and `check` but neither of those two. StarChat's assistants read (§9) returns
   each business's `gaps` and `checks` and has nine sorts, none by one reason or one check, so the businesses where
   "Fuori portata" happened cannot be listed. The dashboard also counts extraction problems as `http_error` +
   `failed` (`CallInsights.js` `EXTRACTION_PROBLEM_KEYS`), while StarChat's §8 and the assistants column
   (`extractionsNotOk`) count `too_long` too: the count and any list built on it would disagree.

## Outcomes

- **O1. A call opens over the page.** One call dialog, generalised from `RestaurantCallModal.vue` to any business,
  replaces it on the restaurant page and serves every "Apri la chiamata" on the analytics pages, the report page
  included. Closing it leaves the page exactly as it was. The restaurant dialog's rules carry over unchanged: an
  owner's call with its judgement chips; anyone else's call read-only, read only because the person opened it.
- **O2. A count opens its calls over the page.** A count that links today to the conversations list opens a side
  panel listing exactly the counted calls, each opening the call dialog, with "Apri in Conversazioni" as a secondary
  action for the full list tools. The alternative rejected: the conversations list reached with a return control and
  the analytics state restored. It still unloads the page and rebuilds it (every section re-reads StarChat), and the
  return depends on restoring scroll and expansions by hand. The panel builds its search from the same one
  construction the link carries today (`Classifications.searchFromQuery` and the conversations page's
  `searchBody`, moved where both can call it, never copied), and keeps the count list's guarantees: it states its
  count, includes archived calls, and for a report's count says how many calls it leaves out (`leftOut`). On the admin
  and scope pages, where a count spans several businesses, the count opens "where it happened" (O5) instead.
- **O3. A narrowed page draws no one-row ranking.** With one business chosen on the admin page, "Assistenti da
  rivedere" and the business breakdown are replaced by one card for that business: the facts its row carries today
  (calls, the shares, unresolved against the period before, "What callers ask", account health, latest report) and a
  link to the business's own analytics page. "Richieste dei chiamanti" shows that business's categories (S1), without
  the columns that count businesses (businesses, the trend over businesses, "reopened by n new businesses"), which
  over one business mean nothing; the calls per category and the outcomes stay. Archive and restore, which act
  platform-wide, are not offered while the page is narrowed to a business or an owner, and the section says where
  to do it. With an owner chosen (admin page, or a reseller's scope page) every section narrows to that owner's
  businesses (S1); the rankings stay, since they rank several businesses.
- **O4. Headers stay readable, and each column says what it counts.** On the desktop (Playwright `desktop`, 1280 px)
  and tablet (`tablet`, iPad) viewports, every table's header row stays visible under the page's sticky filter bar
  while any of its rows is on screen, keeping the frozen business column and the horizontal scroll of
  "Assistenti da rivedere". On phones (`mobile`, up to 640 px) every table draws its rows as cards with field labels,
  as `PagedTable.vue` does. These columns get a help control on their header (keyboard reachable, named for
  assistive technology, a tooltip on hover and focus):
  - "Assistenti da rivedere": calls, every share column (not solved, unanswered, checks, skill errors, extraction
    failures, caller silent, not answered, caller left), the change against the period before, "What callers ask",
    configuration suggestions, account health;
  - "Richieste dei chiamanti": businesses, trend, freshness, the status;
  - the business breakdown: calls, and every share it shows;
  - "Di cosa hanno parlato le chiamate": previous period;
  - the Reports tab: version, state, calls (over calls managed); the Processing tab: progress.
  The text is one source per column: the legend of "Assistenti da rivedere" is removed, and its strings become the
  tooltips, so a column's explanation exists once.
- **O5. A quality signal says what it means, what to do, and leads to where it happened.** Every gap reason, check,
  skill errors and extraction problems carries a one-line meaning and a one-line next action, written in the section
  itself, not in a tooltip. Extraction problems are counted as StarChat counts them (`http_error`, `failed`,
  `too_long`), the dashboard's narrower definition removed. On a business's page every quality count opens its calls
  (O2), skill errors and extraction problems included (S3). On the admin and scope pages every quality count (the
  unanswered total, each reason, each check, skill errors, extraction problems) opens the businesses where it
  occurred, ordered by its share, only those where it is not zero (S2), each opening that business's calls of that
  signal. Each reason's count also opens its unanswered questions as a list: question, suggestion, business, and the
  call in the dialog (S4).
- **O6. A business's own page gets the same treatment.** `Analytics.vue` with a business, its Reports and Processing
  tabs and the report page (`CallReportDetail.vue`) take O1, O2, O4 and O5: every call and every count opens over the
  page, every table keeps its header, every quality signal explains itself and opens its calls and questions.

## StarChat reads (agreed with the StarChat session on 2026-11-01)

StarChat implements them on the 9.34 line, in the patch after 9.34.126, test first, production only in a release
combined with the CTO; its analytics API guide and customer conversation API guide carry the contract, and the
dashboard is written against them. As agreed:

- **S1.** The three request routes honour `businessId` and `ownerId` from the body, scope-checked as in §1-6; out of
  scope is answered as absent (empty), never 403. On `categories/{c}/requests` the query parameter `businessId` stays,
  and a different `businessId` in the body is 400.
- **S2.** `analytics/assistants` takes `sort=gap:<reason>` (base `callsWithUnansweredRecorded`) and
  `sort=check:<check>` (base `callsWithChecks`), ranked as the other shares; `present=true` keeps only the businesses
  whose numerator for the sort is above zero, with `total` counting them, valid with every sort but `calls` (400). An
  unknown reason or check is 400 naming the valid keys. With the existing sorts (`unanswered`, `skill_errors`,
  `extraction_failures`) this covers every count O5 drills.
- **S3.** The conversation search body takes `skillErrors` and `extractionFailed` (booleans; false is the
  complement), on the sets the quality read counts (`extractionFailed`: `http_error`, `failed`, `too_long`).
- **S4.** `POST analytics/unanswered?gap=<reason>&from&size&asOf` with the analytics date range body, narrowed by
  `businessId` and `ownerId` as S1: rows `{question, suggestion, gap, businessId, businessName, conversationId,
  startTimestamp}`, newest first, and `total`.

Until a StarChat piece is on test, the screens depending on it keep today's behaviour (no fabricated count, no link to
a list that is not the count's own, no requests section claiming to be narrowed when it is not), and the screens that
do not depend on it ship.

## Constraints

- Vue 3 Options API, PrimeVue 4 components registered in `src/main.js`, every new string in all 12 locales.
- Authenticated reads go through the configured Axios instance; session end is the interceptor's, components suppress
  failure UI for `isSessionEnded`.
- A non-owner's read of a call, its judgements and its recording is recorded by StarChat and happens only on that
  person's explicit gesture (brief 2026-10-27-classification-feedback, amendment item 7). Listing counted calls reads
  the search; opening one reads the call; S4's question texts are StarChat's answer, as the request examples already
  are.
- The analytics pages keep their addresses and the browser history is not altered by the dialog or the panel, unless
  the plan shows a shareable link needs them in the address.
- The frozen business column and horizontal scroll of "Assistenti da rivedere" are preserved under the sticky header.
- No cost, credit amount or token count is shown (unchanged).
- Browser tests mock StarChat; the mocks of S1-S4 implement the contract StarChat publishes, refusals included.

## Acceptance

Each line is a role-based browser test on all three viewports unless it says otherwise; Playwright, the unit suite
and the i18n check pass.

- O1: from each call link on the admin, scope, business and report pages, the dialog opens; closing it leaves the
  same scroll position and the same expanded sections; the address and history are unchanged; a non-owner's dialog
  is read-only.
- O2: a count's panel lists exactly the calls the count names (its total equals the count on the mock), states the
  count, includes archived calls, says `leftOut` for a report's count, and "Apri in Conversazioni" opens the same
  filter.
- O3: with a business chosen no ranking or breakdown of one row is drawn and the business card is; "Richieste dei
  chiamanti" asks with the business, has no business columns and no archive; with an owner chosen every section asks
  with the owner. Before S1 is on test: no requests section claims to be narrowed.
- O4 (desktop and tablet): scrolled to a table's last row, its header is visible under the filter bar, the business
  column stays frozen while scrolling sideways; every listed help control is reachable by keyboard and named; on a
  phone every table's card shows its labels.
- O5: every reason, check, skill errors and extraction problems shows its meaning and next action; the extraction
  count includes `too_long`; on a business's page each count opens its calls (skill errors and extraction with S3);
  on the admin and scope pages each count opens only the businesses where it occurred, ordered by its share, and one
  of them opens that business's calls of the signal; a reason opens its questions with their suggestions and calls.
  Before S2-S4 are on test, those counts stay as today.
- O6: the business page's Overview, Reports, Processing and the report page pass O1, O2, O4 and O5's business-page
  lines.
- Against StarChat on test, once S1-S4 are there: one check per S-piece from the admin page (not on mocks).

## Out of scope

- The report's content and generation, the jobs, the paid-work dialog.
- A redesign of the conversations page itself.
- Release and deployment, which need their own authorisation.
