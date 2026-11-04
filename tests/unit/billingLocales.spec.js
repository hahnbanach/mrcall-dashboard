import { describe, it, expect } from 'vitest'
import enUS from '@/i18n/locales/en-US.json'
import itIT from '@/i18n/locales/it-IT.json'
import esES from '@/i18n/locales/es-ES.json'
import frFR from '@/i18n/locales/fr-FR.json'
import deDE from '@/i18n/locales/de-DE.json'
import nlNL from '@/i18n/locales/nl-NL.json'
import svSE from '@/i18n/locales/sv-SE.json'
import daDK from '@/i18n/locales/da-DK.json'
import nbNO from '@/i18n/locales/nb-NO.json'
import fiFI from '@/i18n/locales/fi-FI.json'
import etEE from '@/i18n/locales/et-EE.json'
import elGR from '@/i18n/locales/el-GR.json'
import { BILLING_GROUPS } from '@/utils/BillingData'

/**
 * The billing chip on the business card (`docs/briefs/2026-11-04-billing-data-chip.md`) reads
 * `components.businesses.billing.*`. Narrow to those keys: a whole-file parity test would fail on
 * keys the locales already disagree on elsewhere. A missing key would show the raw dotted path on
 * every card of that language.
 */
const LOCALES = {
  'en-US': enUS, 'it-IT': itIT, 'es-ES': esES, 'fr-FR': frFR, 'de-DE': deDE, 'nl-NL': nlNL,
  'sv-SE': svSE, 'da-DK': daDK, 'nb-NO': nbNO, 'fi-FI': fiFI, 'et-EE': etEE, 'el-GR': elGR,
}

function flatten (obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' ? flatten(value, path) : [[path, value]]
  })
}

const reference = Object.fromEntries(flatten(enUS.components.businesses.billing))

describe('billing chip: every key in all 12 locales', () => {
  it('en-US names the three states and every group the rule can report', () => {
    expect(Object.keys(reference)).toEqual(expect.arrayContaining([
      'complete', 'incomplete', 'missing', 'needed', ...BILLING_GROUPS.map((g) => `groups.${g}`),
    ]))
  })

  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} carries the same keys, each a non-empty string, and keeps {fields}`, () => {
      const billing = messages.components?.businesses?.billing
      expect(billing, `${locale} has no components.businesses.billing`).toBeTruthy()
      const entries = Object.fromEntries(flatten(billing))
      expect(Object.keys(entries).sort()).toEqual(Object.keys(reference).sort())
      for (const [key, value] of Object.entries(entries)) {
        expect(typeof value === 'string' && value.trim() !== '', `${locale} ${key}`).toBe(true)
      }
      expect(entries.needed).toContain('{fields}')
      if (locale !== 'en-US') {
        expect(entries.complete, `${locale} copies the English label`).not.toBe(reference.complete)
      }
    })
  }
})
