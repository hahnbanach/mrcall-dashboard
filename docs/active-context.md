---
doc_baseline_commit: 7d4e541c0dbb0053415f4fb34c87dde281f91aad
doc_baseline_date: 2026-11-04
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Production and beta serve `v2.2.50` (`2d89f42`, 2026-11-03), test serves `v2.2.52` (below), with StarChat 9.34.129
behind production, which sends insight version 8. The `v2.2` line holds:
- the classification feedback and the analytics UX rework, live since `v2.2.45`
  ([analytics UX brief](briefs/2026-10-31-analytics-ux.md), [plan](execution-plans/2026-10-31-analytics-ux.md));
- the `redirected` outcome (`v2.2.48`): StarChat's insight version 8 read as a resolution, an outcome line shown only
  when it or the period before has calls, and a request outcome outside the not-fulfilled default; `handed_over`
  labelled as staff ([brief](briefs/2026-11-02-redirected-outcome.md),
  [plan](execution-plans/2026-11-02-redirected-outcome.md));
- the dashboard load work (`v2.2.49`): pages, locales, the call client and the JSON editor on demand (initial JS
  461 994 B gzip in 2 files, from 1 992 653 B in 103), a splash and mounting without waiting for the router, one auth
  readiness with a claim check, and the upload with 14-day retention and `ASSET_CACHE_CONTROL` set to
  `public, max-age=31536000, immutable` on all three GitHub environments ([brief](briefs/2026-10-23-dashboard-load.md),
  [plan](execution-plans/2026-10-23-dashboard-load.md)). Measured on test against `v2.2.48`: the sign-in form at
  10 Mbps 2 210 to 775 ms (splash 103 ms), Businesses 3 073 to 1 866 ms, Analytics 2 734 to 1 368 ms.

`v2.2.50` adds the Analytics UX final review's repairs: the Quality and no-conversation tables keep their header in
view (checked live on test with the owner account), and the admin filter bar's scope note enters and leaves at
different thresholds (checked on the mocks only: the test account is not an admin).

`v2.2.52` is on test only, with two changes to the business card. The billing data chip
([brief](briefs/2026-11-04-billing-data-chip.md), [plan](execution-plans/2026-11-04-billing-data-chip.md)), which says
whether the owner's billing data is entered, incomplete or missing, names what is missing and links to the billing
section. The credit decided on net alone: negative credit and the suspended-calls notice only when net is below zero,
so an open debt the business's credit still covers no longer shows as negative (StarChat's brief
`docs/briefs/2026-11-04-debt-state-from-net.md`). Both verified against the browser-test mocks on the three viewports
(full run: 2214 passed, 14 failed under load, each passing rerun alone with one worker); the CTO checks them on test
with real data before beta and production.

Session ownership: every nonpublic route needs a session, the Axios interceptor alone ends it, and components suppress
their failure UI for `isSessionEnded`. Browser tests mock StarChat and mrcall-agent; their ID tokens are JWT-shaped and
the StarChat mock refuses an unverified one, as StarChat does.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor; WebSockets
  (Whatsappweb, the Aladdin configurator, TestChat, the webcall text chat and voice button) do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Actual production consent, model behavior, caller booking and post-call append
  remain operator-owned acceptance; the operator confirms TEST setup works.
- On `v2.2.34`, the first callback response of the reported calendar Save is unexplained; the
  call-history reads available returned no record for it.
- `tests/unit/skillsOwnerSave.spec.js` takes 3.5 to 5.3 s against a 5 s timeout in a fresh
  worktree, and can time out there.
- Under a full Playwright run, 2 to 24 cases, mostly tablet and mobile, fail under load and pass when rerun alone with
  one worker (commit `c61ddf2`: 10; the `redirected` run: 17, its plan's Status table; the load plan's runs: up to 24,
  and 2 on the `v2.2.49` head, its Status table); it follows the machine's load (more with a rehearsal or a build
  beside it), the cause is not measured further.
- A blank first load of about a minute was seen once in a Chrome with extensions, right after a deploy, and not in a
  clean Chromium (5 cold runs, 1.0 to 1.3 s): not reproduced, not explained.
- GitHub's Dependabot alert 1: `vite` 6.3.4, listed under `dependencies` but run by no npm script (vitest brings its own
  5.4.21, the app builds with Vue CLI), fixed in 6.4.4; the advisory concerns `launch-editor` on Windows. Not upgraded.
- The `__BOOKING__` section's move into `__CONVERSATION__` by StarChat, and the U19r6 field names assumed against
  StarChat's U19r7a, were not re-checked on 2026-11-02.

- The shared amber `.health-warn` text on the business card (`#e65100` on `#fff3e0`) measures 3.46:1, under the
  4.5:1 its 0.8rem text needs; the billing chip uses a darker amber, the other pills are unchanged.
- The issuer of the electronic invoice is outside StarChat, which fills the Stripe customer and creates Stripe invoices
  but sends nothing to SDI; the billing chip's rule rests on StarChat's field descriptions, not on that issuer's
  requirements.

## Next

- `v2.2.52`: the CTO checks the billing chip's three states and the credit of an owner with a covered debt on test,
  with real data; then `v2.2.52-beta` and `v2.2.52-production` on authorisation.

- `redirected`: look at a call analysed at version 8 that carries it, in an environment.
- Analytics UX: S3 checked live once a window has a skill error or an extraction problem.
- Operator: verify the production flow and actual call results with the chosen account.
- Remove `__BOOKING__` from `menuGroups` once StarChat's move is on test.
