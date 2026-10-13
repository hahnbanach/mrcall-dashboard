import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import enUS from '@/i18n/locales/en-US.json'
import RestaurantDetailsEditor from '@/components/widgets/restaurant/RestaurantDetailsEditor.vue'

/**
 * Staff correct a booking's details, following "what we ask for every booking"; from a call-back request the editor
 * is pre-filled with what the caller asked.
 *
 * Seen failing first, 2026-10-13, one fault at a time: every field drawn whatever the setting (the not-asked test);
 * the required check removed (the required test: the save went out with the name emptied); every field sent, not
 * only the changed ones (the changed-only test); the move not ticked by default (the request test); the required
 * check applied to a field the booking never had (the older-booking test: seen failing in the e2e first, a staff
 * booking without a phone could not take a change).
 */
const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
const RULES = { name: 'required', phone: 'optional', allergies: 'not_asked', notes: 'optional', zone: 'optional' }
const booking = { id: 'b1', date: '2026-10-20', start: 1200, end: 1290, party: 2, name: 'Verdi', phone: '39333', allergies: '', notes: 'Window' }

function draw (props = {}) {
  return mount(RestaurantDetailsEditor, { props: { booking, fieldRules: RULES, ...props }, global: { plugins: [i18n] } })
}

describe('the details editor', () => {
  it('draws only the fields this restaurant asks: allergies not asked is hidden', () => {
    const w = draw()
    expect(w.find('[data-detail="allergies"]').exists()).toBe(false)
    expect(w.find('[data-detail="name"]').text()).toContain('Name *')
    expect(w.find('[data-detail="notes"]').exists()).toBe(true)
  })

  it('a booking that lacks a required field it never had can still be corrected', async () => {
    const w = draw({ booking: { ...booking, phone: '' }, fieldRules: { ...RULES, phone: 'required' } })
    await w.find('[data-detail="notes"] input').setValue('Terrace')
    await w.find('.save-details').trigger('click')
    expect(w.emitted('save')[0][0]).toEqual({ guest: { notes: 'Terrace' }, move: null })
  })

  it('a required field cannot be emptied', async () => {
    const w = draw()
    await w.find('[data-detail="name"] input').setValue('  ')
    await w.find('.save-details').trigger('click')
    expect(w.emitted('save')).toBeUndefined()
    expect(w.text()).toContain('Every booking here needs: Name.')
  })

  it('sends only what changed, an emptied optional field as ""', async () => {
    const w = draw()
    await w.find('[data-detail="name"] input').setValue('Verdi Rossi')
    await w.find('[data-detail="notes"] input').setValue('')
    await w.find('.save-details').trigger('click')
    expect(w.emitted('save')[0][0]).toEqual({ guest: { name: 'Verdi Rossi', notes: '' }, move: null })
  })

  it('from a request: pre-filled, the move ticked, saved in one step', async () => {
    const change = { details: { notes: 'Window · Celiac' }, move: { date: '2026-10-21', start: 1230, party: 3 }, late: null }
    const w = draw({ change, fieldRules: { ...RULES, allergies: 'optional' } })
    expect(w.find('[data-detail="notes"] input').element.value).toBe('Window · Celiac')
    expect(w.find('.apply-move input').element.checked).toBe(true)
    await w.find('.save-details').trigger('click')
    expect(w.emitted('save')[0][0]).toEqual({ guest: { notes: 'Window · Celiac' }, move: change.move })
  })
})
