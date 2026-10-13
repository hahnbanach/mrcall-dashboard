import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import enUS from '@/i18n/locales/en-US.json'
import RestaurantAskEditor from '@/components/widgets/restaurant/RestaurantAskEditor.vue'

/**
 * "Cosa chiediamo per ogni prenotazione": three choices per field, day, time and people fixed, and allergies
 * "required" only where the server says it is available (brief, amended 2026-10-13).
 *
 * Seen failing first, 2026-10-13: with `unavailable` answering false, the not-available test failed (the option was
 * enabled); with `unavailable` ignoring the stored value, the kept-required test failed (a stored required could
 * not be kept); with the phone note keyed on `optional`, the phone test failed.
 */
const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
const DEFAULTS = { name: 'required', phone: 'required', allergies: 'optional', notes: 'optional', zone: 'optional' }

function draw (props) {
  return mount(RestaurantAskEditor, { props: { modelValue: DEFAULTS, stored: DEFAULTS, allergies: null, ...props }, global: { plugins: [i18n] } })
}
const option = (w, field, rule) => w.find(`[data-ask="${field}"]`).findAll('[role="radio"]')[['required', 'optional', 'not_asked'].indexOf(rule)]

describe('what we ask for every booking', () => {
  it('day, time and people are always required; every other field has three choices', async () => {
    const w = draw()
    expect(w.find('.ask-fixed').text()).toContain('Always required')
    expect(w.findAll('[data-ask]')).toHaveLength(5)
    await option(w, 'notes', 'required').trigger('click')
    expect(w.emitted('update:modelValue')[0][0]).toEqual({ ...DEFAULTS, notes: 'required' })
  })

  it('allergies "required" is disabled, with the reason, where the server does not offer it (or does not say)', async () => {
    for (const allergies of [null, { stored: 'optional', effective: 'optional', requiredAvailable: false }]) {
      const w = draw({ allergies })
      expect(option(w, 'allergies', 'required').attributes('disabled')).toBeDefined()
      expect(w.find('[data-ask="allergies"]').text()).toContain('not available in this environment')
      await option(w, 'allergies', 'required').trigger('click')
      expect(w.emitted('update:modelValue')).toBeUndefined()
    }
    const available = draw({ allergies: { stored: 'optional', effective: 'optional', requiredAvailable: true } })
    expect(option(available, 'allergies', 'required').attributes('disabled')).toBeUndefined()
  })

  it('a stored "required" is shown and kept where it is not offered, with the note that it acts as optional', () => {
    const stored = { ...DEFAULTS, allergies: 'required' }
    const w = draw({ modelValue: stored, stored, allergies: { stored: 'required', effective: 'optional', requiredAvailable: false } })
    expect(option(w, 'allergies', 'required').attributes('aria-checked')).toBe('true')
    expect(option(w, 'allergies', 'required').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-ask="allergies"]').text()).toContain('acts as optional')
  })

  it('says plainly what "phone: not asked" means', () => {
    const w = draw({ modelValue: { ...DEFAULTS, phone: 'not_asked' } })
    expect(w.find('[data-ask="phone"]').text()).toContain('no booking will require a number')
  })
})
