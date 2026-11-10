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
 * The corrections of a call's checks (docs/briefs/2026-11-09-caller-checks-correction.md, scope 8): a check's Yes and
 * No, the caption of the assistant's words that caused it, and the caption of the call's subject. A missing key would
 * show its dotted path on every check chip of that language.
 */
const LOCALES = {
  'en-US': enUS, 'it-IT': itIT, 'es-ES': esES, 'fr-FR': frFR, 'de-DE': deDE, 'nl-NL': nlNL,
  'sv-SE': svSE, 'da-DK': daDK, 'nb-NO': nbNO, 'fi-FI': fiFI, 'et-EE': etEE, 'el-GR': elGR,
}
const read = (m) => {
  const c = m.components.callInsights
  return {
    yes: c.feedback.checkValue && c.feedback.checkValue.true,
    no: c.feedback.checkValue && c.feedback.checkValue.false,
    cause: c.feedback.checkCause,
    subject: c.panel.subject,
  }
}

describe('caller checks: every key in all 12 locales', () => {
  for (const [name, messages] of Object.entries(LOCALES)) {
    it(`${name} has the four keys, non-empty, Yes distinct from No`, () => {
      const k = read(messages)
      for (const key of ['yes', 'no', 'cause', 'subject']) {
        expect(typeof k[key], key).toBe('string')
        expect(k[key].trim().length, key).toBeGreaterThan(0)
      }
      expect(k.yes).not.toBe(k.no)
      expect(Object.keys(messages.components.callInsights.feedback.checkValue).sort()).toEqual(['false', 'true'])
    })
  }

  it('is translated, not copied from English', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      if (name === 'en-US') continue
      expect(read(messages).cause, name).not.toBe(read(enUS).cause)
    }
  })
})
