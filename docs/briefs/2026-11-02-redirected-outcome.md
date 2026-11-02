# Brief: the `redirected` outcome and the `handed_over` label

## Intent

StarChat's insight version 8 (StarChat branch `extraction-configuration-and-resolution`, head `d85eb2b70`, its brief
`docs/briefs/2026-11-02-extraction-configuration-and-resolution.md`, decisions 5 and 6) adds one value, `redirected`:
the business handles the caller's request through a concrete channel of its own that the assistant gave the caller (a
WhatsApp link, an email address, an app, a phone number). It is not a failure. The CTO also decided that `handed_over`
keeps its key and changes its label, from "a person" to staff.

The dashboard lists these values by hand, so without this change a `redirected` call shows no resolution, falls out of
the outcome lines (which then no longer add up to their base), and cannot be filtered or corrected.

## The contract (read in StarChat at `d85eb2b70`)

- Resolution (`CallOutcome.Resolution.Redirected`): a call's `resolution`, and the search `resolution` filter. It is a
  call where the caller asked something, so it is inside `callsWithRequest`.
- Outcome line (`OutcomeLine.Redirected`, `notSolved = false`): the analytics `outcome.totals` and `previousTotals`
  carry `redirected`; the lines resolved, forwarded_complete, forwarded_incomplete, handed_over, unresolved, redirected
  add up to `callsWithRequest`. Search `outcomeLine=redirected` is accepted.
- Request outcome (`RequestResult.Redirected`): `insights_call_requests.outcome`, search `requestOutcomes`, the request
  rows' per-outcome counts (`redirected` key when non-zero). Not in `RequestCategoryRows.NotFulfilled`; next action
  `Handled`.
- Reports: `content.resolution` (and each topic's `resolution`) is a map by value and may hold `redirected`.
- Calls analysed before version 8 never carry it; every reader must work with and without it.

## Scope

1. The value lists: `CallInsights` resolution keys, resolution-with-request keys and outcome lines;
   `Classifications` request outcome keys (`NOT_FULFILLED` unchanged); `InsightsReports` report outcome keys.
2. Order, the same in every list: `redirected` right after `forwarded` (resolution, outcome lines) and right after
   `taken` (request outcomes), so the "handled by the business" values sit together, before the escalation and the
   failure values.
3. The outcome chart: its own colour for `redirected`, distinct from the others on the same chart.
4. Labels in all 12 locales: `redirected` in the three blocks (resolution, outcome line, request outcome), and the new
   `handed_over` wording in the same three, keeping each block's grammatical agreement. en-US: "Sent to the business's
   channel" and "Escalated to staff"; it-IT: "Indirizzato/Indirizzate/Indirizzata al canale dell'attività" and
   "Passato/Passate/Passata a un operatore"; the other ten with the same meaning.
5. Code comments and durable docs that enumerate the lines or quote the old label, updated: in particular
   `docs/ARCHITECTURE.md`'s "How the calls went" passage ("four lines ... passed to a person").
6. Unit and browser tests: the key lists, the outcome lines adding up with `redirected`, a report holding it, a request
   outcome counted and not in the default not-fulfilled view, the new label where tests read the old one.

Out of scope: StarChat itself; reading the report's `content.outcome` (StarChat writes it, the dashboard does not read
it yet: a separate change); any new view; the `notSolved` definition (StarChat's, unchanged: `redirected` is not in
it); the deploy (release and deployment are separately authorised).

## Constraints

- StarChat owns the values; the dashboard adds no inference of its own.
- No regression on calls without the value (older versions).
- Branch `redirected` from `origin/v2.2` at `c02054f`, local until the release is authorised. The unreleased
  `dashboard-load` branch is not part of this work; it is reconciled with `v2.2` afterwards.

## Acceptance

1. A call whose resolution is `redirected` shows the label in the call's insights, the conversations list filter, the
   counted-calls list, and the correction chip offers it.
2. With `redirected` in `outcome.totals`, the outcome section shows its line with its own colour and link
   (`outcomeLine=redirected`), and the lines' counts add up to `callsWithRequest`.
3. A report whose `content.resolution` holds `redirected` shows the line, and the base includes it.
4. A category row whose `outcomes` holds `redirected` shows it. The not-fulfilled default is StarChat's: the dashboard's
   default request still sends no `all` and no outcome, and with `all=true` a redirected request is listed.
5. `handed_over` reads "Escalated to staff" (en-US) and "Passato/Passate/Passata a un operatore" (it-IT) in all three
   blocks; every locale has both keys in all three blocks.
6. `docs/ARCHITECTURE.md` describes five outcome lines and the staff label.
7. Lint, vitest, build, and the full Playwright run pass (load-sensitive cases retried with one worker, as recorded).

## Assumptions

- StarChat's version-8 tag goes to test in one combined pass with this dashboard tag (StarChat's release constraint);
  until then no environment sends `redirected`, and the change is inert apart from the `handed_over` label.
