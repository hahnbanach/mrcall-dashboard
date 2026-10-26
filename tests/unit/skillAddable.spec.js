import { describe, it, expect } from 'vitest'
import agentSkills from '@/utils/AgentSkills'
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

/** A catalogue row the server marks `addable: false`.
  *
  * StarChat 9.34.115 answers every row of `GET /apidomain/agent/skills` with `addable`. It is false
  * for a skill only admins may add (today `calendar_booking`) when the caller is not an admin, and
  * such a row is sent only because the business already runs an instance of it: the row is there
  * so that instance can be drawn and configured, not so another one can be made. A row without the
  * field is a server older than that, and is addable as it always was.
  *
  * Seen failing on 2026-10-26 before the fix: `getAddableSkills` offered the `addable: false` row,
  * `duplicateInPhase` copied its instance, and no locale carried `code.admin_only_skill`.
  */

const row = (name, extra = {}) => ({
  name,
  configSchema: { phases: ['during'], instances: { max: null, maxPerPhase: null }, fields: [] },
  ...extra
})

const legacy = row('calendar_availability')
const offered = row('calendar_events', { addable: true })
const adminOnly = row('calendar_booking', { addable: false })

const config = {
  prefetch: [],
  during: [{ skill: 'calendar_booking', instanceId: 'calendar_booking_1', params: { enabled: 'true' } }],
  final: []
}

describe('a catalogue row the caller may not add', () => {
  it('is not offered as addable, while a row without the field and a row marked true are', () => {
    const names = agentSkills.getAddableSkills([legacy, offered, adminOnly], config, 'during').map(s => s.name)
    expect(names).toEqual(['calendar_availability', 'calendar_events'])
  })

  it('is not duplicated: the configuration comes back as it was', () => {
    const after = agentSkills.duplicateInPhase(config, adminOnly, 'during', 0, [])
    expect(after.during).toHaveLength(1)
  })

  it('says so through isAddable, which the card asks before drawing a duplicate button', () => {
    expect(agentSkills.isAddable(adminOnly)).toBe(false)
    expect(agentSkills.isAddable(offered)).toBe(true)
    expect(agentSkills.isAddable(legacy)).toBe(true)
  })

  it('still duplicates an instance of a row that is addable', () => {
    const own = { ...config, during: [{ skill: 'calendar_events', instanceId: 'calendar_events_1', params: {} }] }
    expect(agentSkills.duplicateInPhase(own, offered, 'during', 0, []).during).toHaveLength(2)
  })
})

const LOCALES = {
  'en-US': enUS, 'it-IT': itIT, 'es-ES': esES, 'fr-FR': frFR, 'de-DE': deDE, 'nl-NL': nlNL,
  'sv-SE': svSE, 'da-DK': daDK, 'nb-NO': nbNO, 'fi-FI': fiFI, 'et-EE': etEE, 'el-GR': elGR
}

describe('the refusal admin_only_skill, said in the person\'s language', () => {
  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} carries widgets.agentSkills.code.admin_only_skill`, () => {
      const text = messages.widgets.agentSkills.code.admin_only_skill
      expect(typeof text === 'string' && text.trim().length > 0, `${locale} has no message`).toBe(true)
    })
  }
})
