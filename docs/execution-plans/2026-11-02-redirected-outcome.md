---
status: active
---

# Plan: the `redirected` outcome and the `handed_over` label

Brief: [2026-11-02-redirected-outcome](../briefs/2026-11-02-redirected-outcome.md). Owner: the lead of the dashboard
session holding the `v2.2` line. Worktree `mrcall-dashboard-wt/redirected`, branch `redirected` from `origin/v2.2`
(`c02054f`), local until authorised.

## Dependencies

- StarChat `extraction-configuration-and-resolution` (`d85eb2b70`) defines the values; it is not on any environment yet.
  The dashboard tag goes to test in one pass with StarChat's tag of this work.
- None on the unreleased `dashboard-load` branch; it merges `v2.2` after this lands.

## Steps

### R1. The value lists (one milestone with R2 and R3)

Decision, the redirected line's visibility: it shows when its count or its previous count is above zero, and is absent
otherwise. A period analysed before version 8 cannot carry the value, so a zero line there would state a measurement
that was never possible, and it would change the section of every business that does not use the value (the brief's
"no regression without the value"). The four existing lines keep showing at zero as today. The base is StarChat's
`callsWithRequest` either way, so the lines shown still add up to it. The same rule holds for a report's lines
(count above zero; a report has no previous count) and for its themes (already filtered on count above zero).


- `src/utils/CallInsights.js`: `RESOLUTION_KEYS` and `RESOLUTION_REQUEST_KEYS` gain `redirected` after `forwarded`;
  `OUTCOME_LINES` gains `{ key: "redirected", parts: ["redirected"], whenPresent: true }` after the forwarded line,
  and `outcomeShare` drops a `whenPresent` line whose count and previous count are both zero (so `OUTCOME_KEYS`, the
  `outcomeLine` filter and the chart datasets follow; StarChat's `outcome.buckets[].counts` are keyed by
  `OutcomeLine.key`, `CallInsightsAnalytics.scala:80` at `d85eb2b70`, so the series carry `redirected` too). The comments that say "four lines" say five.
- `src/utils/Classifications.js`: `REQUEST_OUTCOME_KEYS` gains `redirected` after `taken` (the chips, the
  `requestOutcomes` filter and `RequestCategories.outcomeSplit` follow); `NOT_FULFILLED` unchanged, with a comment that
  StarChat leaves `redirected` out of it.
- `src/utils/InsightsReports.js`: `REPORT_OUTCOME_KEYS` gains `redirected` after `forwarded` (base and themes follow);
  `reportOutcome` leaves the redirected line out at zero. The comment at its head lists the lines.
- `src/components/analytics/CallOutcomes.vue`: a colour for `redirected` not used by any other key of the outcome chart;
  its template comment (line 20) and header comment (lines 143-146, which quote "Passate a una persona") list the lines
  and the staff label.
- `src/components/analytics/CallReportDetail.vue`: the comment at line 52 ("four lines").
- `src/utils/Classifications.js:21`: the comment listing request outcomes.
- `docs/ARCHITECTURE.md`, "How the calls went": five lines (redirected beside passed to the business), the staff label.
- The brief review found no other reader: every one in `src/` goes through these lists or the three locale blocks.

### R2. Labels, 12 locales

`components.callInsights.resolution`, `.outcome` and `.feedback.outcome`: add `redirected`, change `handed_over`, per the
brief (en-US and it-IT as decided; the other ten translated to the same meaning, keeping each block's agreement).

### R3. Tests

- Unit: the key lists and their order (`callInsights.spec.js`, `classifications.spec.js`, including the menu entries'
  value list); `insightRows` with resolution `redirected` gives its row; `outcomeShare` with `redirected` in the totals
  gives five lines adding up to `callsWithRequest`, with it only in the previous totals gives the line at zero with its
  previous count, and without it gives exactly today's four lines (the existing exact-array cases stay as they are and
  prove it); `reportOutcome` with `redirected` gives five lines and a base including it, without it today's four;
  `reportThemes` with `redirected`; the locale spec reads the new it-IT label and checks every locale has both keys in all three blocks.
- Browser: the opened call's insights read the redirected label (beside the "Handed over" case of
  `tests/e2e/auth/conversations-insights.spec.js`), and so does the counted-calls list of the outcome line; the outcome
  section shows the redirected line with its count and its `outcomeLine=redirected` link, the lines
  adding up; a report with `redirected`; a category row with a redirected count, the default request sending no `all` and no outcome, and with `all=true` a
  redirected request listed; the resolution filter offers it (its exact option list updated). The
  tests that read "Handed over" / "Passed to a person" read the new label: `conversations-insights.spec.js`,
  `conversations-feedback.spec.js`, `classification-chips.spec.js`, `admin.spec.js`, `report-detail.spec.js`,
  `callInsightsLocales.spec.js`. The exact-array cases without the value (`report-detail.spec.js`, the outcome-share and
  report-outcome units) stay unchanged and must still pass.

## Verification

- `npm run lint`, `npx vitest run`, `npm run build`.
- The full Playwright run (all three projects). A failure is rerun alone; a case this change touches (the insights,
  admin and report specs) that fails under the full run is investigated, not waived, because `docs/active-context.md`
  lists `admin.spec.js` and `analytics-insights.spec.js` among the intermittent ones.
- A look at the outcome section in the dev build with a mocked `redirected` count (colour and legend).

## Reviews

Brief review, plan review, one milestone review after R1-R3, final review through the final-user path, then `doc-end`.

## Release (separately authorised)

Fast-forward `v2.2` to `redirected` (rebased first if `v2.2` has moved), push, tag `v2.2.<next>` and `-test` in the combined pass with StarChat; beta and
production later, each authorised. Rollback: redeploy the previous tag of the environment (`v2.2.47-<env>`).

## Status

| Step | State | Evidence |
|---|---|---|
| Brief | APPROVED at 50c60f1 after one REVISE (ARCHITECTURE.md passage); item 6 worded as acceptance 4 | 956b5a8, 50c60f1 |
| Plan | APPROVED at f13567e after one REVISE (zero line, acceptance 1 checks, comments) | d9db588, f13567e |
| R1-R3 | implemented | e3909d8: vitest 622/622, lint clean, build done; the six touched browser specs 63/63 on desktop; the new redirected.spec.js seen failing on the base source (5 of 6, the sixth the no-change case) |
| Full Playwright run | done | e3909d8: 2137 passed, 14 skipped, 17 failed under load (tablet and mobile wizard, skills, info pages, u19c-scope, u19r7-start; one desktop time zone case), none in a spec this change touches; the 17 rerun alone with one worker on all three projects, 54 of 54 passed |
| Milestone review | APPROVED at 8822c4b after one REVISE (a header comment; the counted-calls assertion read the panel header; all=true untested; a title claiming the fall) | 8822c4b: redirected.spec.js 18 of 18 on the three projects |
| Colour | looked at | the outcome section in the dev build with 10 redirected calls: violet line after the request passed on, the stacked bar in the same order |
| Documentation | reconciled | active-context.md carried over from the `dashboard-load` closure (its archive section too, so the two branches agree), with this branch added; ARCHITECTURE.md's outcome passage |
