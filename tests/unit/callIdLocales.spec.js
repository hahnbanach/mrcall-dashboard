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
 * The call id on the conversation panel (`docs/briefs/2026-11-06-call-id-copy.md`) reads
 * `components.conversations.details.callId.*`. A missing key would show its dotted path on every call of that
 * language, and a `copy` without `{id}` would name every button of a page alike.
 */
const LOCALES = {
  'en-US': enUS, 'it-IT': itIT, 'es-ES': esES, 'fr-FR': frFR, 'de-DE': deDE, 'nl-NL': nlNL,
  'sv-SE': svSE, 'da-DK': daDK, 'nb-NO': nbNO, 'fi-FI': fiFI, 'et-EE': etEE, 'el-GR': elGR,
}
const KEYS = ['label', 'copy', 'copied', 'copyFailed']

describe('call id: every key in all 12 locales', () => {
  for (const [name, messages] of Object.entries(LOCALES)) {
    it(`${name} has every key, non-empty, and {id} in the button name`, () => {
      const labels = messages.components.conversations.details.callId
      expect(Object.keys(labels).sort()).toEqual([...KEYS].sort())
      for (const key of KEYS) {
        expect(typeof labels[key]).toBe('string')
        expect(labels[key].trim().length).toBeGreaterThan(0)
      }
      expect(labels.copy).toContain('{id}')
    })
  }

  it('is translated, not copied from English', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      if (name === 'en-US') continue
      expect(messages.components.conversations.details.callId.copied, name).not.toBe(enUS.components.conversations.details.callId.copied)
    }
  })
})
