# Brief: billing data chip on the business card

## Intent

Many owners never fill in the business configuration's billing section (`__INVOICING__`, "Fatturazione") and then
report that they do not receive the Italian electronic invoice. The business card on the Businesses page says nothing
about it today. The card gets a chip that states whether the billing data is in place, names what is missing, and
opens the billing section (`/businessconfiguration?id=<businessId>&section=__INVOICING__`) in one click.

## The data (read in StarChat at `733374915`, branch `9.34`)

- The section holds eleven `__BASE__` variables, all visible, modifiable and not mandatory, identical in the test and
  production tables (`decision-tables/variables/*/template_business_variable.json`): `customer.companyName`,
  `customer.vatId`, `customer.fiscalCode`, `customer.sdi`, `customer.pec`, `customer.address.line1`,
  `customer.address.line2`, `customer.address.postal_code`, `customer.address.city`, `customer.address.state`,
  `customer.address.country` (an ISO 3166 alpha-2 enum).
- They are stored per owner in StarChat's customer registry, not per business: `business/search` reaches
  `BusinessPsqlService.select`, which LEFT JOINs `customers_registry` on the owner and merges its `variables` into each
  business's `variables` under the `customer.` prefix, the registry winning (`BusinessPsqlService.scala` near line
  902). Every card of one owner therefore shows the same billing state, and the card already holds the data: no new
  request.
- Defaults: every field `""` except `customer.vatId`, whose template default is the placeholder `"0000000"`. A business
  created without billing data carries that placeholder.
- StarChat's own field descriptions (`business_variable.json`, Italian text) state the Italian requirements:
  `customer.address.state` "Lo SDI richiede la PROVINCIA ... Senza la provincia le fatture vengono rifiutate
  dall'agenzia delle entrate"; `customer.fiscalCode` "NECESSARIO PER LA FATTURAZIONE ELETTRONICA"; `customer.vatId`
  "inserisci il codice paese ... Se non necessario scrivi 0"; `customer.sdi` "Necessario per fatturazione elettronica
  italiana"; `customer.sdi` and `customer.pec` "Only Italy" in English.
- StarChat pushes `companyName`, `vatId`, `fiscalCode` (as `fiscal_code`), `pec` and `sdi` (as `codice_destinatario`)
  to the Stripe customer's metadata and the `address.*` fields to the Stripe customer's address
  (`CustomerService.scala`, `application.conf` `customerVariablesSelection`); a VAT number made only of zeros is not
  sent as a Stripe tax id (`CustomerService.update`).
- StarChat exposes no completeness verdict and contains no invoice issuer.

## Decision: what "billing data in place" means

The rule is presence, not format. It follows StarChat's field descriptions, and it is stricter for Italy, where the
electronic invoice goes through SDI.

A value is "blank" when it is empty after trimming. A code is "all zeros" when, spaces removed, it is non-empty and
made only of `0`. The country is `customer.address.country`, or the business's `countryAlpha2` when that is blank
(only to choose which rules apply; the address group still needs its own country).

| group | every country | Italy (`IT`) in addition |
|---|---|---|
| name | `companyName` not blank | |
| address | `line1`, `postal_code`, `city`, `country` not blank | `state` (province) not blank |
| tax identifier | not required | `vatId` not blank and not all zeros, or `fiscalCode` not blank |
| delivery channel | not required | `sdi` not blank and not all zeros, or `pec` not blank |

Outside Italy a consumer may have no tax identifier and StarChat documents `0` as the answer, so it is not required
there. In Italy an SDI code of all zeros is the "no delivery code" value: without a PEC the invoice reaches no inbox,
which is exactly the complaint, so it does not count as a channel.

Three states: **complete** (every applicable group satisfied); **missing** (no field of the section carries a value,
where an all-zeros `vatId` or `sdi` counts as no value); **incomplete** (anything else). The unsatisfied groups are
named to the user.

## Scope

1. A pure function in `src/utils/` that takes a business (its `variables` and `countryAlpha2`) and returns the state
   and the unsatisfied groups. No Vue or store import; its head comment carries the rule above and its reasons.
2. In `src/components/Businesses.vue`, a chip in the card's health strip after the plan and credit pills, in the same
   visual language: green with a check when complete, amber with a warning icon otherwise. It is a real link (a
   `router-link` to the billing section), so click, Enter, middle-click and "open in new tab" work, and it shows a
   pointer and a focus ring. When not complete, the missing groups are written visibly on the card under the strip
   (a tooltip alone does not reach touch screens and the app's webview), with a sentence saying the electronic invoice
   needs them; the chip's accessible name is its state and its accessible description is that note, so a screen
   reader announces both. The complete chip stays a link, to review or change.
3. Labels in all 12 locales: the three states, the five group names (name, address, province, tax identifier,
   delivery channel "SDI code or PEC"), the explanatory sentence.
4. Tests: unit tests of the rule (each group; placeholder `0000000` and typed `0`; blank with spaces; Italy's province,
   tax identifier and channel; SDI all zeros with and without PEC; a non-Italian country; country from
   `countryAlpha2`; no variables); a unit test that every new key exists in all 12 locales, in the style of
   `tests/unit/callInsightsLocales.spec.js`; a browser test rendering each state from the business-search mock, the
   link's `href`, keyboard activation landing on `/businessconfiguration?id=...&section=__INVOICING__`, and, with an
   `__INVOICING__` collection in the template-variable mock, that section shown.
5. The default e2e `mockBusiness` gets complete Italian billing data, so existing cards show the green chip; the
   `businesses-{desktop,tablet,mobile}` baselines in `tests/e2e/visual/visual-auth.spec.js` change and are re-recorded
   on purpose, and the new images inspected.
6. `docs/ARCHITECTURE.md`: a short passage beside the credits tile on what the chip reads and the rule.

Out of scope: StarChat (no endpoint, no validation change); the billing section's own form; format validation of VAT
numbers, fiscal codes, SDI codes, PEC addresses; notices outside the card (banner, email, blocking); release and
deployment.

## Constraints

- The chip reads only the business object already loaded; no request is added per card.
- A business without `variables` shows no chip, rather than a false "missing".
- Existing pills, their order and the card layout at 375, 768 and 1440 px are otherwise unchanged.
- Work on `v2.2` locally; commit, release and deploy each need the CTO's authorisation.

## Acceptance

1. Complete Italian data shows the green "billing data entered" chip; template defaults only (`vatId = "0000000"`, the
   rest blank) show "billing data missing"; name and address without a tax identifier in Italy show "incomplete"
   naming the tax identifier.
2. An Italian business with everything but SDI and PEC is incomplete; SDI `0000000` with a PEC is complete; SDI
   `0000000` without PEC is incomplete; the same data with country `DE` and no tax identifier, SDI or province is
   complete.
3. Activating the chip by click or Enter opens `/businessconfiguration?id=<businessId>&section=__INVOICING__` and the
   billing section is the one shown (browser test with the collection in the mock).
4. The new locale unit test passes for all 12 files.
5. `npm run test:unit` passes; the full Playwright suite shows no failure other than the known load-dependent ones
   (each rerun alone with one worker passes), with the three businesses baselines re-recorded deliberately.

## Assumptions

- The issuer of the electronic invoice is outside StarChat and reads the Stripe customer's metadata and address; it is
  not identified here, and the rule rests on StarChat's field descriptions, not on the issuer's own requirements.
- An Italian private consumer who legitimately has no PEC and SDI `0000000` sees "incomplete" naming the channel; that
  is accurate (the invoice reaches only the tax agency's portal) and is accepted.
- The rule is the CTO's to change; it lives in one function, so a change is one edit and its tests.
