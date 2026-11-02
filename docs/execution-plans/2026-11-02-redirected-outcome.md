---
status: planned
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

- `src/utils/CallInsights.js`: `RESOLUTION_KEYS` and `RESOLUTION_REQUEST_KEYS` gain `redirected` after `forwarded`;
  `OUTCOME_LINES` gains `{ key: "redirected", parts: ["redirected"] }` after the forwarded line (so `OUTCOME_KEYS`, the
  `outcomeLine` filter and the chart datasets follow; StarChat's `outcome.buckets[].counts` are keyed by
  `OutcomeLine.key`, `CallInsightsAnalytics.scala:80` at `d85eb2b70`, so the series carry `redirected` too). The comments that say "four lines" say five.
- `src/utils/Classifications.js`: `REQUEST_OUTCOME_KEYS` gains `redirected` after `taken` (the chips, the
  `requestOutcomes` filter and `RequestCategories.outcomeSplit` follow); `NOT_FULFILLED` unchanged, with a comment that
  StarChat leaves `redirected` out of it.
- `src/utils/InsightsReports.js`: `REPORT_OUTCOME_KEYS` gains `redirected` after `forwarded` (base and themes follow).
- `src/components/analytics/CallOutcomes.vue`: a colour for `redirected` not used by any other key of the outcome chart;
  the header comment lists the five lines.
- `docs/ARCHITECTURE.md`, "How the calls went": five lines (redirected beside passed to the business), the staff label.
- The brief review found no other reader: every one in `src/` goes through these lists or the three locale blocks.

### R2. Labels, 12 locales

`components.callInsights.resolution`, `.outcome` and `.feedback.outcome`: add `redirected`, change `handed_over`, per the
brief (en-US and it-IT as decided; the other ten translated to the same meaning, keeping each block's agreement).

### R3. Tests

- Unit: the key lists and their order (`callInsights.spec.js`, `classifications.spec.js`); `outcomeShare` with
  `redirected` adds up to `callsWithRequest` and without it is unchanged; `reportOutcome` and `reportThemes` with
  `redirected`; the locale spec reads the new it-IT label and checks every locale has both keys in all three blocks.
- Browser: the outcome section shows the redirected line with its count and its `outcomeLine=redirected` link, the lines
  adding up; a report with `redirected`; a category row with a redirected count, the default request sending no `all` and no outcome, and with `all=true` a
  redirected request listed; the resolution filter offers it. The
  tests that read "Handed over" / "Passed to a person" read the new label.

## Verification

- `npm run lint`, `npx vitest run`, `npm run build`.
- The full Playwright run (all three projects); failures under load rerun with one worker, as recorded in
  `docs/active-context.md`.
- A look at the outcome section in the dev build with a mocked `redirected` count (colour and legend).

## Reviews

Brief review, plan review, one milestone review after R1-R3, final review through the final-user path, then `doc-end`.

## Release (separately authorised)

Fast-forward `v2.2` to `redirected`, push, tag `v2.2.<next>` and `-test` in the combined pass with StarChat; beta and
production later, each authorised. Rollback: redeploy the previous tag of the environment (`v2.2.47-<env>`).

## Status

| Step | State | Evidence |
|---|---|---|
| Brief | APPROVED at 50c60f1 after one REVISE (ARCHITECTURE.md passage); item 6 worded as acceptance 4 | 956b5a8, 50c60f1 |
| Plan | written | this commit |
