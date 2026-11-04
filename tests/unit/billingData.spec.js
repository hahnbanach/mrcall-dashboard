import { describe, it, expect } from 'vitest'
import { billingDataState, BILLING_GROUPS, BILLING_SECTION } from '@/utils/BillingData'

/** Complete Italian billing data, as the customer registry merges it into `variables`. */
const ITALIAN = Object.freeze({
  'customer.companyName': 'Acme S.r.l.',
  'customer.vatId': 'IT12345678901',
  'customer.fiscalCode': '',
  'customer.sdi': 'ABCDEF1',
  'customer.pec': '',
  'customer.address.line1': 'Via Roma 1',
  'customer.address.line2': '',
  'customer.address.postal_code': '20121',
  'customer.address.city': 'Milano',
  'customer.address.state': 'MI',
  'customer.address.country': 'IT',
})

/** What a business created without billing data carries: the template defaults. */
const DEFAULTS = Object.freeze({
  'customer.companyName': '',
  'customer.vatId': '0000000',
  'customer.fiscalCode': '',
  'customer.sdi': '',
  'customer.pec': '',
  'customer.address.line1': '',
  'customer.address.line2': '',
  'customer.address.postal_code': '',
  'customer.address.city': '',
  'customer.address.state': '',
  'customer.address.country': '',
})

const business = (variables, countryAlpha2 = 'IT') => ({ countryAlpha2, variables: { OTHER: 'x', ...variables } })

describe('billingDataState', () => {
  it('names the section the chip links to', () => {
    expect(BILLING_SECTION).toBe('__INVOICING__')
  })

  it('gives no state without variables, so a card never shows a false "missing"', () => {
    expect(billingDataState(undefined)).toBeNull()
    expect(billingDataState({})).toBeNull()
    expect(billingDataState({ variables: null })).toBeNull()
  })

  it('is complete for complete Italian data', () => {
    expect(billingDataState(business(ITALIAN))).toEqual({ state: 'complete', missing: [] })
  })

  it('is missing with the template defaults only, the vatId placeholder counting as no value', () => {
    expect(billingDataState(business(DEFAULTS))).toEqual({ state: 'missing', missing: [...BILLING_GROUPS] })
  })

  it('outside Italy, missing names only the groups that apply there', () => {
    expect(billingDataState(business(DEFAULTS, 'DE'))).toEqual({ state: 'missing', missing: ['name', 'address'] })
  })

  it('is missing when the section has no key at all', () => {
    expect(billingDataState(business({})).state).toBe('missing')
  })

  it('is missing with only blanks made of spaces and an SDI of zeros', () => {
    const v = { ...DEFAULTS, 'customer.companyName': '   ', 'customer.sdi': '0000000' }
    expect(billingDataState(business(v)).state).toBe('missing')
  })

  it('is incomplete as soon as one field carries a value', () => {
    const r = billingDataState(business({ ...DEFAULTS, 'customer.companyName': 'Acme' }))
    expect(r.state).toBe('incomplete')
    expect(r.missing).toEqual(['address', 'province', 'taxId', 'channel'])
  })

  it('names the groups in their fixed order', () => {
    const r = billingDataState(business({ ...DEFAULTS, 'customer.address.city': 'Milano' }))
    expect(r.missing).toEqual(['name', 'address', 'province', 'taxId', 'channel'])
  })

  describe('name', () => {
    it('needs a company name that is not blank', () => {
      expect(billingDataState(business({ ...ITALIAN, 'customer.companyName': '  ' })).missing).toEqual(['name'])
    })
  })

  describe('address', () => {
    for (const field of ['line1', 'postal_code', 'city', 'country']) {
      it(`needs ${field}`, () => {
        const v = { ...ITALIAN, [`customer.address.${field}`]: '' }
        expect(billingDataState(business(v)).missing).toContain('address')
      })
    }

    it('does not need line2', () => {
      expect(billingDataState(business({ ...ITALIAN, 'customer.address.line2': '' })).state).toBe('complete')
    })

    it('in Italy needs the province, named on its own', () => {
      expect(billingDataState(business({ ...ITALIAN, 'customer.address.state': '' })).missing).toEqual(['province'])
    })
  })

  describe('tax identifier, in Italy', () => {
    const noTaxId = { ...ITALIAN, 'customer.vatId': '', 'customer.fiscalCode': '' }

    it('is missing without VAT number and fiscal code', () => {
      expect(billingDataState(business(noTaxId)).missing).toEqual(['taxId'])
    })

    it('is not given by the placeholder 0000000 nor by a typed 0', () => {
      expect(billingDataState(business({ ...noTaxId, 'customer.vatId': '0000000' })).missing).toEqual(['taxId'])
      expect(billingDataState(business({ ...noTaxId, 'customer.vatId': '0' })).missing).toEqual(['taxId'])
      expect(billingDataState(business({ ...noTaxId, 'customer.vatId': ' 0 0 ' })).missing).toEqual(['taxId'])
    })

    it('is given by a fiscal code alone', () => {
      const v = { ...noTaxId, 'customer.fiscalCode': 'RSSMRA80A01F205X' }
      expect(billingDataState(business(v)).state).toBe('complete')
    })

    it('is given by a VAT number written with spaces', () => {
      const v = { ...noTaxId, 'customer.vatId': 'IT 123 456 789 01' }
      expect(billingDataState(business(v)).state).toBe('complete')
    })
  })

  describe('delivery channel, in Italy', () => {
    const noChannel = { ...ITALIAN, 'customer.sdi': '', 'customer.pec': '' }

    it('is missing without SDI and PEC', () => {
      expect(billingDataState(business(noChannel)).missing).toEqual(['channel'])
    })

    it('is not given by SDI 0000000 alone', () => {
      expect(billingDataState(business({ ...noChannel, 'customer.sdi': '0000000' })).missing).toEqual(['channel'])
    })

    it('is given by SDI 0000000 with a PEC', () => {
      const v = { ...noChannel, 'customer.sdi': '0000000', 'customer.pec': 'acme@pec.it' }
      expect(billingDataState(business(v)).state).toBe('complete')
    })

    it('is given by a PEC alone', () => {
      expect(billingDataState(business({ ...noChannel, 'customer.pec': 'acme@pec.it' })).state).toBe('complete')
    })
  })

  describe('outside Italy', () => {
    const german = {
      ...ITALIAN,
      'customer.address.country': 'DE',
      'customer.address.state': '',
      'customer.vatId': '0',
      'customer.fiscalCode': '',
      'customer.sdi': '',
      'customer.pec': '',
    }

    it('needs no province, tax identifier or delivery channel', () => {
      expect(billingDataState(business(german, 'DE'))).toEqual({ state: 'complete', missing: [] })
    })

    it('follows the billing address country over the business country', () => {
      expect(billingDataState(business(german, 'IT')).state).toBe('complete')
    })

    it('reads the country case-insensitively', () => {
      const v = { ...ITALIAN, 'customer.address.country': 'it', 'customer.address.state': '' }
      expect(billingDataState(business(v)).missing).toEqual(['province'])
    })
  })

  describe('country from the business when the address has none', () => {
    const noCountry = { ...ITALIAN, 'customer.address.country': '', 'customer.sdi': '', 'customer.pec': '' }

    it('applies the Italian rules for an Italian business', () => {
      expect(billingDataState(business(noCountry, 'IT')).missing).toEqual(['address', 'channel'])
    })

    it('does not for a business elsewhere, the address still asking for its country', () => {
      expect(billingDataState(business(noCountry, 'FR')).missing).toEqual(['address'])
    })
  })
})
