---
doc_baseline_commit: af0e955df165799d0c447fb1ba62bf84272bd4db
doc_baseline_date: 2026-11-06
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Production, beta and test serve `v2.2.55` (`00bcf48`, test 2026-11-06, beta and production 2026-11-09), with
StarChat 9.34.129 behind production, which sends insight version 8. Beyond the classification feedback, the analytics UX rework, the `redirected` outcome and the
dashboard load work (each with its brief and plan routed in [the index](README.md)), the `v2.2` line holds:
- the billing data chip on the business card ([brief](briefs/2026-11-04-billing-data-chip.md),
  [plan](execution-plans/2026-11-04-billing-data-chip.md)), and the card's credit decided on net alone (negative only
  below zero, StarChat's brief `docs/briefs/2026-11-04-debt-state-from-net.md`), both since `v2.2.52`;
- one readable amber for every warning pill, `@mrcall_warn_text` on `@mrcall_warn_surface` in
  `src/assets/style/colors.less` (5.86:1), since `v2.2.53`;
- `vue-i18n` 11.4.14 since `v2.2.54`: the dashboard does not enable `escapeParameter`, and its two translations
  rendered as HTML take no parameters and come from its own locale files.

GitHub's default branch, which Dependabot reads, is `v2.2`.

Since `v2.2.55`, the call's id on every call panel ([brief](briefs/2026-11-06-call-id-copy.md),
[plan](execution-plans/2026-11-06-call-id-copy.md)): its first 16 characters shown and the whole id copied by a
button. Verified against the browser-test mocks on the three viewports; beta and production followed the CTO's check on
test, which did not report on a phone's native long press. The published chunks of all three environments carry the
component and its labels.

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
- Under a full Playwright run, up to about 24 cases, mostly tablet and mobile, fail under load and pass when rerun
  alone with one worker; the count follows the machine's load, the cause is not measured further.
- A blank first load of about a minute was seen once in a Chrome with extensions, right after a deploy, and not in a
  clean Chromium: not reproduced, not explained.
- Dependencies (`npm audit`, 2026-11-06): high-severity entries among the runtime dependencies, among them `axios`
  1.11.0 (every advisory fixed by 1.20.0) and `firebase`, their exposure not assessed. Dependabot's two open `vite`
  alerts concern the direct `vite` 6.3.4 (fixed in 6.4.4); it is used, since `vitest.config.mjs` loads
  `@vitejs/plugin-vue`, which imports it. vitest 2.1.9 nests its own `vite` 5.4.21, also inside the advisories' range.
- The `__BOOKING__` section's move into `__CONVERSATION__` by StarChat, and the U19r6 field names assumed against
  StarChat's U19r7a, were not re-checked on 2026-11-02.
- The issuer of the electronic invoice is outside StarChat, which fills the Stripe customer and creates Stripe invoices
  but sends nothing to SDI; the billing chip's rule rests on StarChat's field descriptions, not on that issuer's
  requirements.

## Next

- Caller-repeated check (StarChat's plan `docs/execution-plans/2026-11-06-caller-repeated-check.md`, step K13): after
  StarChat's test tag, a brief and plan for correcting `caller_repeated` and `caller_unsatisfied` in the call view,
  each offered only when the call recorded that check, `promise_not_kept_in_call` never; Playwright before the tag.
- Dependency audit, after the call id: a brief and plan, the runtime dependencies first (`axios` first), each exposure
  measured, then the development tools (vitest, `vite`, the Vue CLI dev server).
- Billing chip and credit: watch whether owners fill in their billing data, and whether covered debts stop being
  reported as negative credit.
- `redirected`: look at a call analysed at version 8 that carries it, in an environment.
- Analytics UX: S3 checked live once a window has a skill error or an extraction problem.
- Operator: verify the production flow and actual call results with the chosen account.
- Remove `__BOOKING__` from `menuGroups` once StarChat's move is on test.
