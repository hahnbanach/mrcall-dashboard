import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import enUS from '@/i18n/locales/en-US.json'
import itIT from '@/i18n/locales/it-IT.json'
import { layoutMessage, VALUES_NEEDED } from '@/components/widgets/restaurant/layoutMessages'

/** A refusal or warning about the room, in the owner's words, with the server's values when it sends them and
  * without numbers when it does not; never the server's English, never a bare placeholder. */

const i18n = createI18n({ legacy: false, locale: 'it-IT', messages: { 'it-IT': itIT, 'en-US': enUS } })
const say = (p, locale = 'en-US', whoOn) => {
  i18n.global.locale.value = locale
  return layoutMessage(p, { t: (k, a) => i18n.global.t(k, a || {}), te: k => i18n.global.te(k, locale), whoOn })
}

describe('a message about the room', () => {
  it('says party_larger_than_room with its numbers, the first size it refuses included', () => {
    const p = { code: 'party_larger_than_room', detail: '10 people fit no seating', values: { maxPartySize: 10, largestSeating: 8 } }
    expect(say(p, 'it-IT')).toBe("L'assistente accetta gruppi fino a 10 persone, ma il tavolo o l'unione più grande ne tiene 8. I gruppi da 9 a 10 persone non li prenota: li registra come richieste da confermare voi. Per prenotarli, aggiungete un'unione più grande o abbassate il numero massimo di persone.")
    expect(say(p)).toContain('It does not book parties of 9 to 10')
  })

  it('says it without numbers when the values are absent or incomplete, never with a bare placeholder', () => {
    for (const values of [undefined, {}, { maxPartySize: 10 }]) {
      const text = say({ code: 'party_larger_than_room', detail: 'server English', values })
      expect(text).toContain('The assistant accepts parties larger than the largest table or join')
      expect(text).not.toMatch(/[{}]|server English/)
    }
  })

  it('names who is booked on a table that cannot go, when the page knows', () => {
    const p = { code: 'table_has_holds', values: { table: 'T4' } }
    expect(say(p, 'en-US', () => 'Rossi (13 Oct 20:00, 4)')).toBe('T4 has future bookings (Rossi (13 Oct 20:00, 4)): move or cancel them before you remove the table, switch it off or move it to another area.')
    expect(say(p, 'en-US', () => '')).toBe('T4 has future bookings: move or cancel them before you remove the table, switch it off or move it to another area.')
  })

  it('joins a list of sizes, and falls back to a general sentence for a code it does not know', () => {
    expect(say({ code: 'size_never_bookable', values: { sizes: [3, 4] } })).toContain('a party of 3, 4')
    expect(say({ code: 'something_new', detail: 'server English' })).toBe('The room was not saved: check the areas, tables and joins and try again.')
  })

  it('has a sentence with numbers and one without for every code it lists, in every language', () => {
    const fs = require('fs')
    const dir = require('path').resolve(process.cwd(), 'src/i18n/locales')
    fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
      const r = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')).components.restaurant
      Object.keys(VALUES_NEEDED).forEach(code => {
        expect(r.layoutValues[code], `${f} layoutValues.${code}`).toBeTruthy()
        expect(r.layoutCode[code], `${f} layoutCode.${code}`).toBeTruthy()
        VALUES_NEEDED[code].forEach(k => expect(r.layoutValues[code], `${f} ${code} {${k}}`).toContain(`{${k}}`))
      })
    })
  })
})
