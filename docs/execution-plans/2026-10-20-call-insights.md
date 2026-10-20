---
status: active
brief: ../briefs/2026-10-20-call-insights.md
owner: the call-insights session (StarChat plan docs/execution-plans/2026-10-20-call-insights.md, M10), branch call-insights from v2.2
created: 2026-10-20
---

# What calls said, in the dashboard

## Classification

Substantial: new API clients, a new conversation panel section, new analytics sections for three roles,
new filters shared by the list, its poll, both exports and the bulk actions, 12 locales. No backend
change here. The StarChat contract is 9.34.87; the export of Archive and Trash with filters needs
StarChat M11 (commit 1c767fb0c), which ships with the next StarChat tag.

## Dependencies and ownership

- StarChat 9.34.87 on test for every route this plan reads; StarChat with M11 on test before D8 checks
  an Archive or Trash export, and in the production StarChat tag of the combined pass. The StarChat side
  is owned by the same session.
- The `v2.2` line holder is told before the merge into `v2.2` and before any tag; a tag needs Playwright
  green on desktop, tablet and mobile and vitest green; deployment beyond test needs Angelo's go.
- Mycelium 8ae39c50 (dashboard analytics) follows this plan; 8e6c21c9 (reseller/admin reading an owner's
  call) is out of scope.

## Design

- **Outcome rule, one helper.** `src/utils/CallInsights.js` exports `outcomeKind(key)` (`fact` for
  `booked`/`transferred`, `assessed` otherwise) and the gap and check keys. Every place an outcome appears
  uses it and shows the same "assessed by the assistant" marking: the panel (a label beside the outcome),
  the list's outcome filter (options in two groups, "Recorded" and "Assessed by the assistant"), the
  analytics outcome chart and totals (legend entries suffixed), a report's per-topic outcomes (same
  legend), the assistants table (the "not solved" column header and its sort option marked assessed).
- **Clients** in `CallInsights.js`, on the default axios (the 401 interceptor is installed on it,
  `src/firebase/axiosConfig.js:97`), the same `auth` header and base URL as `src/utils/Analytics.js`:
  - `outcomes(user, body, granularity, timezone)`, `quality(user, body)`, `assistants(user, body, sort, limit)`
    (`customer/analytics/...`). `outcomes` refuses a call without `timezone`, as `Analytics.js:19-24` does for
    the time series (the zone-less 400 of 2026-10-04); the page passes the same granularity it computes and
    the browser's zone.
  - `reports(user, businessId, before, limit)`, `report(user, businessId, periodStart)`,
    `integrations(user, since)`, `configSuggestions(user, since)` (`customer/insights/...`).
  - A 404 resolves to `null` (absent section), a 503 to `{ unavailable: true }` (the section shows a short
    "not available yet" note, no toast), `isSessionEnded` errors are rethrown untouched; any other error is
    rethrown for the page's existing toast.
  - Reports paging: `before` is the last loaded item's `periodEnd`; fewer items than `limit` means the end.
- **Panel** (`CallDetailsPanel.vue`): after the summary, the topics as PrimeVue `Tag`s (registered,
  `src/main.js:194`), the unanswered questions (reason label, question, suggestion), the checks that fired,
  the outcome with the rule's marking. Model text through `{{ }}` only, never `v-html`. With none of
  `details.outcome`/`topics`/`unanswered`/`checks`, the panel as today.
- **List** (`Conversations.vue`): one `searchBody(extra)` builds the bodies now written inline at `:661`
  (TSV export), `:701` (JSON export), `:745` (list search), `:817` (poll) and the one `buildSearchFilter`
  (`:1103`) returns to the bulk actions; it carries the view, the date range and the two filters (outcome
  `Dropdown` grouped as above, "unanswered questions" `ToggleButton`, both registered). A filter change
  resets to the first page.
- **Analytics, owner and business** (`/analytics?id=<business>`, `Analytics.vue`): a "What calls said"
  section (outcomes over time as a stacked bar, totals against the previous period, coverage
  `callsWithOutcome` of `totalCalls`), a "Quality" section (gaps, checks, skill errors, extraction failures
  as "n of N calls"; N for skill errors and extraction failures is `totalCalls` of the outcomes answer, the
  quality answer has none), a "Call reports" section (latest report open, earlier ones by `before` paging;
  topics with share, "new" and per-topic outcomes; gaps with summaries and example calls linked to
  `/conversations?id=<business>&conversation=<id>` for the owner only; suggestions; `mrcall_config` shown only
  when the store's role is admin, even if present in the answer). The page watches `$route.query.id` and
  refetches, so moving from the scope page to a business loads the business (`<router-view/>` has no key,
  `App.vue:14`; `Analytics.vue:376` reads the id only in `mounted`).
- **Analytics, reseller scope page** (`/analytics` without a business, `Analytics.vue`): the existing KPI
  and chart sections and the two new ones over the reseller's scope (the owner selector narrows to one
  owner), the assistants table (each row to `/analytics?id=<business>`) and the integrations, which sit
  apart, labelled "all your businesses since <start>", and ignore the selector.
- **Analytics, admin** (`/analytics-admin`, `AnalyticsAdmin.vue`): the two new sections under its filters,
  the assistants table (each row sets the page's own business filter, as a breakdown row does,
  `AnalyticsAdmin.vue:580`), the integrations and the configuration suggestions apart as above.
- **The role on the analytics pages.** Today only the businesses and configuration pages set the store's
  role (`src/utils/Business.js:209,271`, `Businesses.vue:740,787`); a user opening `/analytics` or
  `/analytics-admin` directly (a bookmark, a new device) keeps the default `owner` (`src/store/index.js:50`)
  and a reseller would see nothing. Both pages establish the role on mount through the existing business
  search that sets it (`Business.js:262-275`, `crm/business/search` with `limit: 1`, which commits
  `x-mrcall-role`), before choosing their sections; if that search fails, the page keeps the persisted role and handles the error as its other requests do (`isSessionEnded` silent, otherwise the page's toast). The server stays the gate.
- **Roles in tests**: `tests/e2e/fixtures/auth.js` `setupAuthPage` honours its `role` argument: the
  business search answers with `x-mrcall-role: <role>` and `access-control-expose-headers: x-mrcall-role`,
  as `tests/e2e/auth/retention.spec.js:33-36` does; reseller and admin specs pass their role and open the
  analytics page directly in a fresh context, the path a bookmark takes.
- **Locales**: new keys under `components.callInsights.*` in all 12 files;
  `tests/unit/callInsightsLocales.spec.js` fails when one of these keys is missing from a locale.
- **Docs**: the root `analytics-api-guide.md` removed; `docs/ARCHITECTURE.md` (utils, the panel, the
  analytics sections) and `docs/README.md` point to StarChat's guide; `active-context.md` at closure.

## Steps

Every new or extended test is run once on the code before its change and recorded failing.

| # | Content | Verification | Status |
|---|---|---|---|
| D0 | Brief and plan reviewed | fresh reviewers | done 2026-10-20: brief APPROVED after two REVISE, plan APPROVED after two REVISE |
| D1 | `CallInsights.js`: outcome rule, clients, 404/503/session handling, `timezone` required, paging end | `tests/unit/callInsights.spec.js`: bodies and paths sent, 404 → null, 503 → unavailable, session-ended rethrown, zone-less `outcomes` refused, `outcomeKind` | pending |
| D2 | Panel section | `tests/unit/callDetailsPanel.spec.js` extended (each insight kind, none, markup in a question as text, assessed marking) and Playwright on the deep link `?conversation=` (`tests/e2e/auth/conversations-insights.spec.js`) | pending |
| D3 | List filters through `searchBody` | the same Playwright spec intercepts `**/customer/conversation/search*`, `**/stream/tsv/**`, `**/stream/json/**`, `**/customer/conversation/archive*`, `**/customer/conversation/delete*` and asserts the same filters in list, export, bulk archive and bulk delete; the poll's body through `page.clock` advanced past its 10 s interval; first page on change; the filter's option groups | pending |
| D4 | Analytics: the role established on mount; owner business page, reseller scope page, admin page; reports; assistants; integrations and suggestions | `tests/e2e/auth/analytics-insights.spec.js` (owner, and reseller via the role fixture opening `/analytics` directly in a fresh context: the scope page appears) and `tests/e2e/admin/analytics-insights.spec.js` (admin), on the real StarChat paths: empty and partial coverage; a 404 hiding a section with no toast; a 503 note; assessed marking in chart legend, report topics and assistants header and sort; reports paging to the end; example links for the owner only and with `id=`; `mrcall_config` hidden for an owner even when the mocked answer carries it, shown for an admin; an assistants row opening the business (reseller: business sections appear after the click; admin: the business filter set); the outcomes request carrying granularity and the browser's zone (`timezoneId` as `tests/e2e/auth/analytics.spec.js:43-61`) | pending |
| D5 | Locales and their test; docs | `callInsightsLocales.spec.js`; `npm run lint`; no reference to the root guide outside `docs/briefs/` and `docs/execution-plans/` (`grep`) | pending |
| D6 | Gates on the branch | `npm run lint`, full vitest, full Playwright (desktop, tablet, mobile), counts recorded | pending |
| D7 | Milestone review of D1-D6 (fresh reviewer) | verdict recorded | pending |
| D8 | Test release: merge into `v2.2` with the line holder, tag `vX.Y.Z` and `vX.Y.Z-test` | on dashboard-test against StarChat 9.34.87 or later, a real session: the clinic's test calls with their insights in the panel; the analytics equal to those calls; the clinic's report readable after the job's run; the cadence editable; a reseller's scope page; with StarChat carrying M11, an Archive export filtered by outcome containing only archived calls of that outcome | pending |
| D9 | Final review and doc-end; production only in StarChat's combined pass (its tag containing M11) with Angelo's go | | pending |

## Rollback

The pages read only, except the bulk archive and delete, which now carry the two filters (StarChat's
`updateByQuery` applies them): a wrong body would archive or delete another set of calls. Both actions are
reversible from the Archive and Trash views (`/archive?value=false`, `/delete?value=false`), and D3 pins
their bodies. A test or production tag is rolled back by deploying the previous tag; the cadence is a
business variable written by the existing configuration page.
