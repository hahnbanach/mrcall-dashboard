---
status: completed
---

# Plan: billing data chip on the business card

Brief: [2026-11-04-billing-data-chip](../briefs/2026-11-04-billing-data-chip.md) (APPROVED on its second pass). Owner:
the lead of the dashboard session on `v2.2`. Working tree: the main checkout on `v2.2`, uncommitted until the CTO
authorises a commit.

## Dependencies

None outside this repository. StarChat `9.34` at `733374915` already returns the `customer.*` variables in
`business/search`; nothing changes there.

## Steps

### B1. The rule (`src/utils/BillingData.js`)

- `billingDataState(business)` returns `null` when `business?.variables` is absent, otherwise
  `{ state: 'complete' | 'incomplete' | 'missing', missing: [group, ...] }`, the groups in the fixed order
  `name, address, province, taxId, channel`.
- Helpers kept private: `blank(v)` (absent or empty after trim), `allZeros(v)` (spaces removed, non-empty, only `0`).
- Country: `customer.address.country` trimmed and upper-cased, else `business.countryAlpha2`, decides `IT`.
- Groups as in the brief's table; `province`, `taxId`, `channel` only for `IT`. `missing` state when none of the eleven
  fields carries a value, an all-zeros `vatId` or `sdi` counting as none.
- Exports `BILLING_GROUPS` (the order) and `BILLING_SECTION = '__INVOICING__'`. The head comment states the rule, cites
  StarChat's field descriptions as its source and that StarChat merges the owner's registry into `variables`.
- Imports nothing.

### B2. The card (`src/components/Businesses.vue`)

- A method `billing(business)` calling `billingDataState`.
- In `.health-strip`, after the credit pill: `<router-link v-if="billing(business)" class="health-pill billing-pill"
  :class="complete ? 'health-ok' : 'health-warn'" :to="{ path: '/businessconfiguration', query: { id, section:
  BILLING_SECTION } }" :aria-describedby="note id when not complete">` with `pi pi-check-circle` or
  `pi pi-exclamation-circle` and the state label.
- Under the strip, when not complete: `<p :id="'billing-note-' + businessId" class="billing-note">` with
  `billing.needed` and the missing group labels joined by `Intl.ListFormat` for the current i18n locale
  (`type: 'conjunction'`), falling back to `', '` when `Intl.ListFormat` is absent.
- Accessibility: the link's accessible name is its state label (its text); when not complete its accessible
  description is the note, through `aria-describedby`. Name and description are kept apart on purpose: the name stays
  short and stable for the link list of a screen reader, the description says what to add.
- Styles: `.billing-pill` gets `text-decoration: none`, `cursor: pointer`, a hover darkening, and a
  `:focus-visible` outline in `@mrcall_blue`. Its warn text colour is `#a63c00` (5.86:1 on the pill's `#fff3e0`; the
  shared `.health-warn` `#e65100` measures 3.46:1 there, under AA's 4.5:1 for 0.8rem text). `.billing-note`: 0.8rem,
  `#a63c00` (6.43:1 on the card's white), padded like the strip, wrapping. The shared `.health-*` classes and the other
  pills are not changed (the brief keeps them as they are; their contrast is reported to the CTO separately).
- No new PrimeVue component, so nothing to register in `main.js`.

### B3. Labels (12 locale files)

Under `components.businesses.billing`: `complete` ("Billing data entered"), `incomplete` ("Billing data
incomplete"), `missing` ("Billing data missing"), `needed` ("To receive the electronic invoice, add: {fields}"),
`groups.name` ("company name"), `groups.address` ("billing address"), `groups.province` ("province"),
`groups.taxId` ("VAT number or tax code"), `groups.channel` ("SDI code or PEC"). it-IT: "Dati di fatturazione
inseriti / incompleti / mancanti", "Per ricevere la fattura elettronica aggiungi: {fields}", "ragione sociale",
"indirizzo di fatturazione", "provincia", "partita IVA o codice fiscale", "codice SDI o PEC". The other ten with the
same meaning, keeping SDI and PEC as acronyms.

### B4. Tests

- `tests/unit/billingData.spec.js`: every case listed in the brief's scope 4, plus group order and `null` without
  variables.
- `tests/unit/billingLocales.spec.js`: every `components.businesses.billing.*` key of en-US present and non-empty in
  all 12 locales, and `{fields}` kept in `needed`.
- `tests/e2e/fixtures/mock-data.js`: `mockBusiness.variables` gains complete Italian billing data.
- `tests/e2e/auth/billing-chip.spec.js`, on all three projects:
  - Mocks registered in this order, since Playwright answers from the last registered route first: a spec-level
    `**/crm/business*` (the single business read by the configuration page) before `**/crm/business/search*` (three
    businesses: complete, template defaults only, Italian without a tax identifier), and `**/crm/variables*` holding
    an `__INVOICING__` collection with humanName "Billing".
  - Each card: the chip's label (`toHaveAccessibleName`), its `href` (`/businessconfiguration?id=<id>&section=__INVOICING__`),
    and for the two incomplete ones the visible note naming the missing groups and `toHaveAccessibleDescription` equal to it.
  - Keyboard: on chromium press Tab from the page start, a bounded number of times (at most 40), until the first card's
    chip `toBeFocused` (the pills before it are plain spans and take no focus, so no element of the card is a reliable
    start); on WebKit (tablet, mobile), whose Tab skips links, `chip.focus()` (the pattern of
    `tests/e2e/insights/column-help.spec.js:35-41`); then Enter.
  - Click: a second case clicks the chip.
  - Landing, both cases: `toHaveURL` with `id=<id>` and `section=__INVOICING__`, and the section heading "Billing"
    visible (`BusinessConfiguration.vue`'s page title); `.active-menu-item` checked only when the large menu is visible.
- Visual baselines: `npx playwright test tests/e2e/visual/visual-auth.spec.js --project=desktop -g businesses
  --update-snapshots` (the spec runs only under `desktop` and sizes its own viewports; it rewrites
  `businesses-{mobile,tablet,desktop}-desktop-darwin.png`), then the three images inspected.

### B5. Docs

`docs/ARCHITECTURE.md`, after the credits tile: "Billing data chip" passage (what it reads, the rule pointer to
`src/utils/BillingData.js`, the link). Then `doc-end`.

## Verification

1. `npm run test:unit` green (637 before, plus the new ones).
2. `npx playwright test tests/e2e/auth/billing-chip.spec.js` green on desktop, tablet, mobile.
3. Visual baselines re-recorded with the B4 command, images looked at.
4. Full `npx playwright test`: failures only among the known load-dependent ones, each passing rerun alone with one
   worker.
5. Visual check of the three states at 375 and 1440 px: screenshots written by `billing-chip.spec.js` to its test
   output (`testInfo.outputPath`) under the mobile and desktop projects, inspected. The dev server alone talks to the
   real test StarChat, where the mocks do not exist.

## Rollback

Revert the working-tree changes (one util, one component block and styles, locale keys, tests, docs). No data,
contract or backend change.

## Status

Brief approved at SHA-256 `c8c5d0982d50e72ed1d24272d71b8885bbc0aa169aa14679bb0168f8aedd04a3` (second pass plus the
re-approval of the accessible-name sentence); plan approved on its third pass.

| step | state | evidence |
|---|---|---|
| B1 rule | done | `tests/unit/billingData.spec.js` 29/29; mutating the SDI and province rules fails 5 of them; the M1 review found `missing` naming the Italian groups for every country, repaired (a non-Italian owner is asked only for name and address), with its test |
| B2 card | done | chip and note in `Businesses.vue`; as built, the method is `billingState(business)` (B2 says `billing`) and the warn class is `billing-warn` (B2 says `health-warn`), which carries the darker amber B2 specifies; the icon is `aria-hidden` (its glyph had entered the accessible name, seen failing first) |
| B3 labels | done | 12 locales, additions only; `tests/unit/billingLocales.spec.js` 13/13 |
| B4 tests | done | `billing-chip.spec.js` 9/9 on desktop, tablet, mobile (the keyboard case tabs to the second card's chip, bounded at 60 rather than 40); card screenshots at 1440 and 375 px inspected; three businesses baselines re-recorded and inspected |
| B5 docs | done | `docs/ARCHITECTURE.md` "Billing data chip" |
| unit suite | green | `npm run test:unit` after the M1 repair: 49 files, 679 tests (637 before), lint included |
| full Playwright | green | `npx playwright test`, all three projects: 2225 passed, 18 skipped, 0 failed (26.4 min); run before the M1 repair, which changes only non-Italian owners' results, none of which the browser tests use |
| reviews | done | brief APPROVED (pass 2, plus re-approval of the accessible-name sentence); plan APPROVED (pass 3); M1 APPROVED (pass 2, after the non-Italian `missing` repair); final review REVISE on missing closure evidence only, then APPROVED with that evidence |
| release | test | `v2.2.51-test`, authorised by the CTO on 2026-11-04; then, by the CTO's choice of one release with the credit-from-net fix (`ebca625`), `v2.2.52-test`; beta and production wait for the CTO's check on test |
