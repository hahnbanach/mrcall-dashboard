---
doc_baseline_commit: d09c2a074c0f3b69e3ddef7ef09b3707b74cf2ee
doc_baseline_date: 2026-11-10
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Production, beta and test serve `v2.2.59` (`d09c2a0`, test, beta and production 2026-11-10), with StarChat 9.34.132
behind production since 2026-11-10 (from StarChat's session), which accepts corrections of a call's checks. Beyond the
classification feedback, the analytics UX rework, the `redirected` outcome, the dashboard load work, the billing data
chip and the call id (each with its brief and plan routed in [the index](README.md)), the `v2.2` line holds the card's
credit decided on net alone, one readable amber for warning pills and `vue-i18n` 11.4.14, and since `v2.2.56` to
`v2.2.59`:
- the runtime dependencies: `axios` 1.21.0 pinned, `google-auth-library` and `node-fetch` removed; the published vendor
  chunk of all three environments carries `axios` 1.21.0;
- a call's checks `caller_repeated` and `caller_unsatisfied` corrected from the call view as chips, the assistant's
  words for `caller_repeated` and the call's subject when the details carry them
  ([brief](briefs/2026-11-09-caller-checks-correction.md), [plan](execution-plans/2026-11-09-caller-checks-correction.md)).
  On test, StarChat's API applied a check's correction with the call's state and undid it (the recordings, before the
  release); in the browser, a real call drew both check chips, one corrected. Feedback #25 to #29 on test, from an admin
  account on `v2.2.57-test`, are corrections and confirmations made from the chips; an undo from the dashboard on a
  real call was not observed;
- a call link without its business (`?conversation=<id>`) takes the business from the call. Checked live on test by
  StarChat's session: the address gained `id=`, both check chips drawn;
- the development tools: `vite` 6.4.6, `webpack` 5.112.2, `vitest` 4.1.12, `vite.config.js` and
  `@intlify/unplugin-vue-i18n` removed ([brief](briefs/2026-11-09-dependency-audit.md),
  [plan](execution-plans/2026-11-09-dependency-audit.md)); the deploy's `npm ci` on Node 18 succeeds.

GitHub's default branch, which Dependabot reads, is `v2.2`.

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
  alone with one worker; the count follows the machine's load, the cause is not measured further. Once
  (`count-list-body.spec.js:54`, desktop) the failure was a search body caught after the list's 10-second poll rather
  than a timeout; it passed alone.
- A blank first load of about a minute was seen once in a Chrome with extensions, right after a deploy, and not in a
  clean Chromium: not reproduced, not explained.
- Dependencies after the audit: `npm audit` lists 32 entries with no fix or only a downgrade, recorded in the
  [brief](briefs/2026-11-09-dependency-audit.md): six runtime (`firebase` and its Firestore and `grpc-js` chain, none
  of which reaches the browser; `vuex-persist` and `deepmerge`) and 26 development (the Vue CLI 5 chain and its
  plugins, `eslint`, `@vue/test-utils`). Whether CI should fail on new advisories is not decided.
- Correcting a check to the model's own value writes a new correction rather than restoring the model's; restore and
  Undo are the ways back. StarChat's session recorded this as the control's design.
- The `__BOOKING__` section's move into `__CONVERSATION__` by StarChat, and the U19r6 field names assumed against
  StarChat's U19r7a, were not re-checked on 2026-11-02.
- The issuer of the electronic invoice is outside StarChat, which fills the Stripe customer and creates Stripe invoices
  but sends nothing to SDI; the billing chip's rule rests on StarChat's field descriptions, not on that issuer's
  requirements.

## Next

- Production: look at a real call's check chips, and one correction undone, with an owner's account.
- Billing chip and credit: watch whether owners fill in their billing data, and whether covered debts stop being
  reported as negative credit.
- `redirected`: look at a call analysed at version 8 that carries it, in an environment.
- Analytics UX: S3 checked live once a window has a skill error or an extraction problem.
- Operator: verify the production flow and actual call results with the chosen account.
- Remove `__BOOKING__` from `menuGroups` once StarChat's move is on test.
