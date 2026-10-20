# What calls said, in the dashboard (call insights)

## Intent and authority

StarChat 9.34.87 records, for every managed call, what the call was about and what it left open
(the call insights: topics, outcome, unanswered questions with the reason and what the business could
add, three quality checks), and serves them through analytics routes, the conversation search, the
call's `details` and a periodic call report per business. The contract is StarChat's: its brief
(`docs/briefs/2026-10-20-call-insights.md` in the StarChat repository, intents 6 and 9) and its
`docs/analytics-api-guide.md` §7-10 and `docs/customer-conversation-api-guide.md`.

Angelo, 2026-10-20: the work must be production-ready "including the dashboard changes for the new
analytics and the new, more informative notifications". This brief is the dashboard side. Releases
beyond test are authorized separately; production is one combined pass with StarChat, with Angelo
present.

## Evidence

- The analytics page (`src/components/Analytics.vue`, `AnalyticsAdmin.vue`, `src/utils/Analytics.js`)
  shows calls, durations, hours and callers: nothing about what happened in a call.
- A call's detail (`src/components/conversations/CallDetailsPanel.vue`) shows summary, extracted fields,
  booking, previous calls, transcript: not the insights StarChat now puts in `details` (`outcome`,
  `topics`, `unanswered`, `checks`).
- The conversation list (`src/components/Conversations.vue`) has no filter on what a call said. The list,
  its poll and both exports build their request bodies inline (`Conversations.vue:661,700,745,817`); only
  the bulk actions use `buildSearchFilter` (`:1103`).
- StarChat's export stream ignores the view's `archived` and `deleted` flags
  (`SessionService.streamSource`, StarChat): an export from Archive or Trash exports the Inbox's calls.
  Fixed on the StarChat side (its plan, M11), which this work depends on for outcome 2.
- Only admins have a page over many businesses (`AnalyticsAdmin.vue`, its entry shown to admins only,
  `Businesses.vue:59-64`); a reseller's analytics entry opens `/analytics` without a business
  (`ResellerDashboard.vue:87`), where the page fetches nothing (`Analytics.vue:443`).
- The router lets an owner into a route that declares `requiresRole` ("let component verify",
  `src/router/index.js:529-536`): the server's answers are the gate.
- Conversations are read on the caller's own user id (StarChat `FirebaseCustomerConversationService`):
  a reseller or an admin cannot open an owner's call through the conversation routes.
- The repository root holds `analytics-api-guide.md`, a copy of StarChat's guide from before §7-10: a
  second, stale truth of a contract StarChat owns.
- `CALL_INSIGHTS_REPORT_CADENCE` is an enum business variable under `__NOTIFICATIONS__`; the configuration
  page renders catalogue enums generically (`BusinessConfiguration.vue:164-186`), so it needs no code if the
  catalogue serves it with its values.

## Outcome

One rule wherever an outcome appears (a call's panel, the list's filter, the analytics, the reports, the
assistants table): `booked` and `transferred` are recorded facts and shown as such; `resolved`,
`message_taken`, `unresolved`, `caller_left` and `spam_wrong_number` are the assistant's assessment and
always shown marked as such (a label in the panel and the filter, a legend in a chart or a table, the
`not_solved` sort described as assessed), until StarChat calibrates them (Mycelium 5e6dbb40).

| Section | Owner | Reseller | Admin | Where |
|---|---|---|---|---|
| A call's insights | own calls | — (no conversation access, see Evidence) | — | the call's panel in Conversations |
| Outcome and "unanswered" filters | yes | — | — | Conversations |
| Outcomes and quality | the business | one business, or all its owners | any scope | `/analytics?id=<business>`; for resellers also `/analytics` without a business, over its scope (owner selector); admins `/analytics-admin` |
| Call reports | the business | a business of its owners | any business | `/analytics?id=<business>`, a reports section |
| Assistants to review | — | its scope | any scope | resellers `/analytics` without a business; admins `/analytics-admin` |
| Integrations and information asked | — | its whole scope | the whole platform | as the assistants table |
| MrCall configuration suggestions | — | — | yes | `/analytics-admin` |

1. **A call's detail says what the call left open.** The panel of a call shows its topics, the questions
   the assistant could not answer with the reason and the suggestion, the checks that fired, and the
   outcome under the rule above, every label in the user's language. A call without insights shows the
   panel it shows today.
2. **The list can be filtered on it.** The conversation list gains an outcome filter and an "unanswered
   questions" filter, sent by the list, its poll, both exports and the bulk actions alike, from one
   function, so the export and a bulk action act on the calls the list shows, in every view (Inbox,
   Archive, Trash: with StarChat's M11).
3. **The analytics show what calls said**: outcomes over the period and against the previous one, the
   quality signals (unanswered questions by reason, checks, skill errors, extraction failures), each
   number beside the number of calls it counts on, never as a score, and how many calls of the period have
   insights at all (calls before the feature have none).
4. **The call reports are readable**: a business's latest report and the earlier ones, its topics with
   their share and whether they are new, the unanswered questions grouped by reason, the suggestions for
   the business; an admin sees MrCall's configuration suggestions too (the server removes them for anyone
   else). A report's example calls open the call for the business's owner; for a reseller or an admin they
   are listed without a link, and the StarChat need (reading a managed owner's call) is recorded as a
   Mycelium task.
5. **Resellers and admins see which assistants to review**: the per-business table of signals sorted by
   StarChat's keys, each row opening that business's analytics, and the integrations and information
   businesses ask for; admins also MrCall's configuration suggestions. These last two cover the caller's
   whole scope from the start of the chosen period (StarChat reads neither a business, an owner, a plan nor
   an end date for them): they sit apart from the filtered sections, labelled as covering every business
   the user can see, and do not react to the page's filters.
6. **The report cadence is configurable** by the owner in the notifications section, with no new code
   (StarChat's catalogue serves it as an enum with its values; its labels in 6 languages, English in the
   others); checked on test.
7. **One truth for the API.** The stale root `analytics-api-guide.md` is removed; the documentation points
   to StarChat's guide.

## Constraints

- Every request through the configured Axios instance; components show no failure UI for
  `isSessionEnded(error)`. A section is shown by the role the store holds; a 404 from a role-restricted
  route (`assistants`, `integrations`, `config-suggestions`, `reports` of a business out of scope) hides
  its section without an error toast, since it means "not for you". The server is the gate; no route-level
  claim is made beyond what the router does.
- Every new string in all 12 locale files; a unit test fails when one of the keys this work adds is
  missing from a locale (a whole-file parity test would fail today: the locales already differ).
- New PrimeVue components registered globally; colours and layout consistent with the existing page.
- No secret or credential in the repository (public); nothing private in `VUE_APP_*`.
- Model-written text (questions, suggestions, topics) is rendered as text, never as HTML.
- Branch from `v2.2` in its own worktree; the `v2.2` line holder informed before merge and tag; Playwright
  e2e (desktop, tablet, mobile) green before any tag; vitest green.

## Acceptance

- Playwright, with StarChat mocked at its real paths (`customer/analytics/...`, `customer/insights/...`,
  `customer/conversation/search`): a call's panel with each kind of insight, a call without; the list's
  filters reaching the search, the export and a bulk action with the same body; the analytics sections for
  owner, reseller (one business and its scope page) and admin, with an empty and a partial coverage; a 404
  from a role-restricted route hiding its section with no toast; every outcome marked by the rule above;
  the reports list and one report, an admin's suggestions shown and an owner's not, example calls linked
  for the owner only; the assistants table sorted and opening a business.
  Each new spec seen failing on the code before the change.
- On test (dashboard `vX.Y.Z-test` against StarChat 9.34.87 or later, a real session): the clinic's test
  calls show their insights in the panel; the analytics match the counts of those calls; the report of the
  clinic is readable after the job's run; the cadence variable is editable.
- The 12 locales hold every new key; `npm run lint`, vitest and Playwright green.

## Out of scope

- Calibration of the outcome and any quality score (Mycelium 5e6dbb40).
- Reading an owner's conversation as its reseller or an admin (StarChat; a Mycelium task).
- The pre-existing gaps the exploration found, fixed here where this work touches the same code
  (the reseller's `/analytics` without a business becomes its scope page), otherwise recorded in the
  backlog: the conversation list does not use `isSessionEnded`; the router's owner pass-through.
