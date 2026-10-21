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

/**
 * This work (call insights, `docs/briefs/2026-10-20-call-insights.md`) added every new
 * user-facing string under `components.callInsights.*`. A whole-file parity test would fail
 * today on keys the 12 locales already disagree on elsewhere; this one is narrow to the keys this
 * work added, and fails the moment one of them is missing from a locale, rather than silently
 * falling back to the raw key or to English (`tests/unit/callDetailsPanel.spec.js` already shows
 * what a missing key looks like: the raw dotted key, in place of a label).
 */
const LOCALES = {
  'en-US': enUS, 'it-IT': itIT, 'es-ES': esES, 'fr-FR': frFR, 'de-DE': deDE, 'nl-NL': nlNL,
  'sv-SE': svSE, 'da-DK': daDK, 'nb-NO': nbNO, 'fi-FI': fiFI, 'et-EE': etEE, 'el-GR': elGR,
}

function flattenKeys (obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return (value && typeof value === 'object' && !Array.isArray(value))
      ? flattenKeys(value, path)
      : [path]
  })
}

const referenceKeys = flattenKeys(enUS.components.callInsights).sort()

describe('callInsights: every new key in all 12 locales', () => {
  it('en-US names at least one key (the reference is not accidentally empty)', () => {
    expect(referenceKeys.length).toBeGreaterThan(0)
  })

  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} carries every components.callInsights key en-US does, and none it does not`, () => {
      const ci = messages.components && messages.components.callInsights
      expect(ci, `${locale} is missing components.callInsights entirely`).toBeTruthy()
      const keys = flattenKeys(ci).sort()
      const missing = referenceKeys.filter(k => !keys.includes(k))
      const extra = keys.filter(k => !referenceKeys.includes(k))
      expect(missing, `${locale} is missing these keys`).toEqual([])
      expect(extra, `${locale} carries these keys en-US does not`).toEqual([])
    })
  }
})

/**
 * Insights version 2 (brief amended 2026-10-20): `resolution`, `message`, `booked` and `transferred`
 * are labelled in the viewer's language. A translation that is the English text copied into
 * another file passes the parity test above, so the labels of the value table are compared with
 * en-US one by one: a locale may keep an English word only where the exception list says so.
 */
const VALUE_TABLE_PREFIXES = ['resolution.', 'message.', 'booked.', 'transferred.', 'dimensions.', 'unkept.']
// The same spelling in the other language, checked: French "Message", Danish and Norwegian "Booking".
const ENGLISH_ALLOWED = {
  'fr-FR': ['dimensions.message'],
  'da-DK': ['dimensions.booked'],
  'nb-NO': ['dimensions.booked'],
}

describe('callInsights: the value table is translated, not copied from English', () => {
  const valueKeys = referenceKeys.filter(k => VALUE_TABLE_PREFIXES.some(p => k.startsWith(p)) || k === 'assessedMarking')

  it('names the four dimensions and their values, and no version-1 outcomes', () => {
    expect(valueKeys).toEqual(expect.arrayContaining([
      'resolution.resolved', 'resolution.unresolved', 'resolution.handed_over', 'resolution.caller_left',
      'resolution.spam_wrong_number', 'message.complete', 'message.incomplete', 'message.unintelligible',
      'message.none', 'booked.true', 'booked.false', 'transferred.true', 'transferred.unknown',
      'dimensions.resolution', 'dimensions.message', 'dimensions.booked', 'dimensions.transferred',
      'unkept.title', 'unkept.actions.book', 'unkept.actions.move', 'unkept.actions.cancel',
      'unkept.actions.transfer', 'unkept.actions.other',
    ]))
    expect(referenceKeys.filter(k => k.startsWith('outcomes.'))).toEqual([])
  })

  const get = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj)

  for (const [locale, messages] of Object.entries(LOCALES)) {
    if (locale === 'en-US') continue
    it(`${locale} words the value table in its own language`, () => {
      const ci = messages.components.callInsights
      const copied = valueKeys.filter(k => get(ci, k) === get(enUS.components.callInsights, k) &&
        !(ENGLISH_ALLOWED[locale] || []).includes(k))
      expect(copied, `${locale} carries English text for these keys`).toEqual([])
    })
  }
})
