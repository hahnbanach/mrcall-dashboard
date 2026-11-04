/**
 * Whether a business carries the billing data an invoice is issued to, read from the business
 * object the business search already returns.
 *
 * The data is the configuration's `__INVOICING__` section: the `customer.*` variables. StarChat
 * keeps them per owner, in its customer registry, and merges them into every business's
 * `variables` on `business/search`, so all the cards of one owner share one state and no request
 * is needed to know it. StarChat sends them to the Stripe customer (name, VAT number, fiscal code,
 * PEC, SDI code as metadata; the address as the customer's address), and the electronic invoice is
 * issued from there.
 *
 * StarChat exposes no verdict of its own, so the rule is written here, and it is presence, not
 * format: the values are StarChat's to validate. It follows StarChat's own field descriptions,
 * which are stricter for Italy, where the electronic invoice goes through SDI:
 *
 * - name: `companyName`;
 * - address: `line1`, `postal_code`, `city`, `country`; in Italy also `state`, the province, without
 *   which SDI rejects the invoice;
 * - tax identifier, Italy only: a `vatId` that is not all zeros, or a `fiscalCode`. Elsewhere a
 *   consumer may have none, and StarChat tells the user to write `0` then;
 * - delivery channel, Italy only: an `sdi` code that is not all zeros, or a `pec`. `0000000` is the
 *   SDI code for "no delivery code": without a PEC the invoice reaches no inbox, which is the
 *   complaint this check exists for.
 *
 * The country that decides the Italian rules is the billing address's, or the business's own when
 * the address has none (the address group still asks for its own country).
 *
 * `missing` means that no field carries a value: a business created without billing data has only
 * the template defaults, blanks and the `vatId` placeholder `0000000`. Anything between that and
 * complete is `incomplete`.
 */

const PREFIX = 'customer.'

/** The groups in the order they are named to the user. */
export const BILLING_GROUPS = Object.freeze(['name', 'address', 'province', 'taxId', 'channel'])

/** The configuration section holding the billing data, as `?section=` takes it. */
export const BILLING_SECTION = '__INVOICING__'

const FIELDS = Object.freeze([
  'companyName', 'vatId', 'fiscalCode', 'sdi', 'pec',
  'address.line1', 'address.line2', 'address.postal_code', 'address.city', 'address.state', 'address.country',
])

/** Codes whose all-zeros value is a placeholder rather than an answer. */
const ZERO_PLACEHOLDERS = Object.freeze(['vatId', 'sdi'])

function blank (value) {
  return value === undefined || value === null || String(value).trim() === ''
}

function allZeros (value) {
  const compact = blank(value) ? '' : String(value).replace(/\s+/g, '')
  return compact !== '' && /^0+$/.test(compact)
}

/** A code carries a value: not blank and not the all-zeros placeholder. */
function present (value) {
  return !blank(value) && !allZeros(value)
}

/**
 * @param {{ variables?: Object<string, string>, countryAlpha2?: string } | null | undefined} business
 * @returns {{ state: 'complete' | 'incomplete' | 'missing', missing: string[] } | null}
 *   null when the business carries no variables, so that a card never shows a false "missing".
 */
export function billingDataState (business) {
  const variables = business?.variables
  if (!variables || typeof variables !== 'object') {
    return null
  }
  const get = (field) => variables[PREFIX + field]

  const addressCountry = blank(get('address.country')) ? '' : String(get('address.country')).trim().toUpperCase()
  const businessCountry = blank(business.countryAlpha2) ? '' : String(business.countryAlpha2).trim().toUpperCase()
  const italy = (addressCountry || businessCountry) === 'IT'

  const satisfied = {
    name: !blank(get('companyName')),
    address: ['address.line1', 'address.postal_code', 'address.city', 'address.country']
      .every((field) => !blank(get(field))),
    province: !italy || !blank(get('address.state')),
    taxId: !italy || present(get('vatId')) || !blank(get('fiscalCode')),
    channel: !italy || present(get('sdi')) || !blank(get('pec')),
  }
  const missing = BILLING_GROUPS.filter((group) => !satisfied[group])
  if (missing.length === 0) {
    return { state: 'complete', missing }
  }
  // the groups named are the ones that apply to this country, in every state
  const anyValue = FIELDS.some((field) =>
    ZERO_PLACEHOLDERS.includes(field) ? present(get(field)) : !blank(get(field)))
  return { state: anyValue ? 'incomplete' : 'missing', missing }
}
