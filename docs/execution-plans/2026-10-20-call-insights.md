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
| D1 | `CallInsights.js`: outcome rule, clients, 404/503/session handling, `timezone` required, paging end | `tests/unit/callInsights.spec.js`: bodies and paths sent, 404 → null, 503 → unavailable, session-ended rethrown, zone-less `outcomes` refused, `outcomeKind` | done 2026-10-20 on the version-1 contract (4c36318): 16/16, failing first (module missing) |
| D2 | Panel section | `tests/unit/callDetailsPanel.spec.js` extended (each insight kind, none, markup in a question as text, assessed marking) and Playwright on the deep link `?conversation=` (`tests/e2e/auth/conversations-insights.spec.js`) | done (42c498a): vitest 12/12 (5 failed first), Playwright 3/3 per project (2 failed first) |
| D3 | List filters through `searchBody` | the same Playwright spec intercepts `**/customer/conversation/search*`, `**/stream/tsv/**`, `**/stream/json/**`, `**/customer/conversation/archive*`, `**/customer/conversation/delete*` and asserts the same filters in list, export, bulk archive and bulk delete; the poll's body through `page.clock` advanced past its 10 s interval; first page on change; the filter's option groups | done (d8462d6): Playwright 3/3 per project (3 failed first) |
| D4 | Analytics: the role established on mount; owner business page, reseller scope page, admin page; reports; assistants; integrations and suggestions | `tests/e2e/auth/analytics-insights.spec.js` (owner, and reseller via the role fixture opening `/analytics` directly in a fresh context: the scope page appears) and `tests/e2e/admin/analytics-insights.spec.js` (admin), on the real StarChat paths: empty and partial coverage; a 404 hiding a section with no toast; a 503 note; assessed marking in chart legend, report topics and assistants header and sort; reports paging to the end; example links for the owner only and with `id=`; `mrcall_config` hidden for an owner even when the mocked answer carries it, shown for an admin; an assistants row opening the business (reseller: business sections appear after the click; admin: the business filter set); the outcomes request carrying granularity and the browser's zone (`timezoneId` as `tests/e2e/auth/analytics.spec.js:43-61`) | done (9600e36, fba1b35): 12/12 (12 failed first); the fixed assistance button covered the last element of a page on mobile: space reserved in its own component (582381e), the corner-click workarounds removed, two `businesses` snapshots updated for that space only |
| D5 | Locales and their test; docs | `callInsightsLocales.spec.js`; `npm run lint`; no reference to the root guide outside `docs/briefs/` and `docs/execution-plans/` (`grep`) | done (b476cbd): 13/13, a removed key seen failing; root guide removed |
| D5b | Version 2 (brief amended 5dd0dc8, StarChat M12): `CallInsights.js` (the value table: judged `resolution`/`message` with the assessed marking, `booked` true/false, `transferred` true or "not known", a version-1 call showing none), the panel, the filters (`resolution`, `message`, `booked`, `transferred` true only), the analytics (resolution and message series and totals, booked over the calls carrying it, transferred as a count), the reports' per-topic dimensions, the assistants table, the 12 locales; field names from StarChat's regenerated OpenAPI with M12, not guessed. The Playwright timeouts, measured 2026-10-21: no leak in this work's code, the dev server flat on both sides, startup equal to the base (initial bundle +1.15% gzip, load and interactive time within noise over 40 fresh mobile contexts each), the base clean in two full runs and the branch with 1-8 `page.goto` timeouts in each of its runs, cause still open. One concrete defect found: `conversations-insights.spec.js` installs `page.clock` after the page loaded, which also fakes the dev server client's timers and raised its error overlay over the page once; the clock is installed before navigation, as Playwright prescribes. The full suite is run again after this rework, and the timeouts are compared with the base before D6 | every row of the brief's value table pinned in vitest and Playwright, seen failing first on the version-1 code; the German caller's text shown as received | done (bdb08da, 1b85f4e, 980ede7): milestone review REVISE on stale outcomes shown without a loading signal, repaired with a test failing first (6 failed on bdb08da, 45 passed after), then APPROVED by the same reviewer |
| D6 | Gates on the branch | `npm run lint`, full vitest, full Playwright (desktop, tablet, mobile), counts recorded | done on 6f9cd42, Node 26.5, load ~30: `npm run lint` exit 0; vitest 274 passed, 1 failed, `skillOAuthIntegration.spec.js` "starts legacy authorization without retaining an abandoned chat context" (`localStorage` undefined: Node 26 defines its own global without `--localstorage-file`), failing the same on the merge base 0515932, so it comes from v2.2, not from this branch; Playwright 1054 passed, 5 skipped, 16 failed on timeouts (admin, navbar, signin pages, tablet and mobile), all 16 passed on `--last-failed` |
| D7 | Milestone review of D1-D6 (fresh reviewer) | verdict recorded | done (6e272a7), APPROVED on re-review by the same reviewer. First verdict REVISE: the quality section counted calls with no extraction outcome as extraction issues (`totalCalls - ok`). Repaired: issues are the non-ok outcomes over the calls that carry one, as StarChat's `extractions` counts them (`callQuality.spec.js`, failing first). Also repaired from the non-blocking findings, each with an e2e failing first: an earlier answer of a section arriving after a later one no longer replaces it (`CallInsights.latestOnly`, owner and admin pages), and an earlier reports page that fails keeps the reports shown. Brief outcome 5 is read as "integrations do not react to the filters": they cover StarChat's default 30 days and say so |
| D8 | Test release: merge into `v2.2` with the line holder, tag `vX.Y.Z` and `vX.Y.Z-test` | on dashboard-test against StarChat 9.34.87 or later, a real session: the clinic's test calls with their insights in the panel; the analytics equal to those calls; the clinic's report readable after the job's run; the cadence editable; a reseller's scope page; with StarChat carrying M11, an Archive export filtered by outcome containing only archived calls of that outcome | in progress: v2.2 fast-forwarded to 3bede80 (Angelo chose the whole v2.2 line for production, 2026-10-21; production runs v2.2.25 on 0515932, so nothing else changes), tagged v2.2.27 and v2.2.27-test, deploy run 39611305521 success. Gates on 3bede80: Playwright 1051 passed, 25 mobile timeouts under load all passed on `--last-failed`, 5 skipped; vitest 277 passed, 1 failed (the v2.2 `skillOAuthIntegration` one, D6). StarChat 9.34.93 on test: 874 today, outcomes 47 calls, 21 with version-2 insights (resolution handed_over 4, unresolved 5, resolved 3, spam_wrong_number 2, caller_left 7; message none 12, complete 6, incomplete 2, unintelligible 1), quality 46 extractions ok. Open: the panel, analytics and reports seen in the browser by a user who can see 874 |
| D10 | Brief outcome 8 (amendment of 2026-10-21, StarChat M13): the call panel shows `unkept` from the call details, the duplicated check line hidden, in the 12 locales; the field's name and its `{action, said}` shape checked against StarChat's customer-conversation guide and OpenAPI after M13, not guessed | vitest seen failing first on the panel and `insightRows`, the locale parity test, a Playwright spec intercepting the details; the full gates before the tag; its own test tag after v2.2.28 (D9 waits for it), on test against the StarChat tag carrying M13 | done in code and on dashboard-test as v2.2.29 (42e95a1, ff598f2; milestone review APPROVED): lint 0, vitest 290 (the v2.2 skillOAuthIntegration failure aside), Playwright 1080 passed, 8 public-page timeouts passed on rerun 8/8; open: the panel of a real GPT-Live call with an unkept claim on test against StarChat 9.34.96 |
| D11 | Brief outcome 9 (amendment of 2026-10-21, StarChat M14), started once M14's routes and fields are in StarChat's regenerated `openapi.yaml`, whose names it uses (as D5b and D10): the outcomes section retitled, with the calls without a conversation under neutral labels per reason outside every rate; the resolution share over resolved + unresolved + handed over, `caller_left` and `spam_wrong_number` beside it in distinct neutral colours, `caller_left` labelled for its meaning; extraction problems without `not_managed`; the assistants table's "Non risolte" on StarChat's new base and the `caller_silent`, `not_answered`, `caller_left` columns and sorts; a topics section for one business from StarChat's topics route, a note for several; every string in the 12 locales | vitest on the share bases; Playwright with StarChat mocked (brief acceptance, outcome 9), each no-conversation reason asserted under its own label, `not_answered` included; lint; on test against the StarChat release carrying M14 | planned |
| D9 | Final review and doc-end; production only in StarChat's combined pass (its tag containing M11, and M14 for D11) with Angelo's go | | pending |

## Rollback

The pages read only, except the bulk archive and delete, which now carry the two filters (StarChat's
`updateByQuery` applies them): a wrong body would archive or delete another set of calls. Both actions are
reversible from the Archive and Trash views (`/archive?value=false`, `/delete?value=false`), and D3 pins
their bodies. A test or production tag is rolled back by deploying the previous tag; the cadence is a
business variable written by the existing configuration page.
