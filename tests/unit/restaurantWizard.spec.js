import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import enUS from '@/i18n/locales/en-US.json'
import RestaurantWizard from '@/components/widgets/restaurant/RestaurantWizard.vue'
import RestaurantApi from '@/utils/Restaurant'
import { rulesOf } from '@/utils/RestaurantModel'

/** The first run: the server cannot read rules without arrival times, and refuses a first room without
  * them, so the wizard asks for the hours first and writes them to the skill at the revision read. */

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
const MANIFEST = { arrivalEveryMinutes: { default: 15 }, tableMinutes2: { default: 90 }, tableMinutesLarger: { default: 150 } }
const instance = { phase: 'during', instanceId: 'restaurant_booking_1', revision: 'rev-1', params: { enabled: 'true', lunch: '{}', dinner: '{}' } }

function draw (params = instance.params) {
  return mount(RestaurantWizard, {
    props: { user: { accessToken: 't' }, businessId: 'b', instance: { ...instance, params }, rules: rulesOf(params, MANIFEST) },
    global: { plugins: [i18n, PrimeVue], stubs: { WeeklyHoursField: true } }
  })
}

describe('the first-run wizard', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('asks for the hours first when the instance has none, and goes on only with a window', async () => {
    const save = vi.spyOn(RestaurantApi, 'saveInstance').mockResolvedValue({ saved: true })
    const wrapper = draw()
    expect(wrapper.text()).toContain('When do guests arrive?')
    const next = wrapper.find('.wizard-next')
    expect(next.attributes('disabled')).toBeDefined()
    wrapper.vm.hours.dinner = JSON.stringify({ friday: ['19:00-22:00'] })
    await flushPromises()
    await wrapper.find('.wizard-next').trigger('click')
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
    const [, , sentInstance, changes] = save.mock.calls[0]
    expect(sentInstance.revision).toBe('rev-1')
    expect(JSON.parse(changes.dinner)).toEqual({ friday: ['19:00-22:00'] })
    expect(wrapper.emitted('instance-saved')).toHaveLength(1)
    expect(wrapper.text()).toContain('Which areas does the restaurant have?')
  })

  it('starts on the areas when the hours are there', () => {
    expect(draw({ dinner: JSON.stringify({ friday: ['19:00-22:00'] }) }).text()).toContain('Which areas does the restaurant have?')
  })

  it('goes back to the hours when the server says the rules cannot be read', async () => {
    const e = new Error('409')
    e.restaurant = { status: 409, code: 'not_configured' }
    vi.spyOn(RestaurantApi, 'saveLayout').mockRejectedValue(e)
    const wrapper = draw({ dinner: JSON.stringify({ friday: ['19:00-22:00'] }) })
    wrapper.vm.step = 'joins'
    await flushPromises()
    await wrapper.find('.wizard-done').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('When do guests arrive?')
    expect(wrapper.text()).toContain('Set the opening hours first')
  })

  // Only the Axios interceptor ends a session (v2.2, 8fe2152): a failure it marked says nothing here, the person is
  // already on the way to sign-in. Seen failing on 2026-10-14 with the guard removed: the refusal was said.
  it('says nothing for a failure the interceptor ended the session for', async () => {
    const e = new Error('401')
    e.sessionEnded = true
    e.restaurant = { status: 401, code: null }
    vi.spyOn(RestaurantApi, 'saveLayout').mockRejectedValue(e)
    const wrapper = draw({ dinner: JSON.stringify({ friday: ['19:00-22:00'] }) })
    wrapper.vm.step = 'joins'
    await flushPromises()
    await wrapper.find('.wizard-done').trigger('click')
    await flushPromises()
    expect(wrapper.find('.err').exists()).toBe(false)
    expect(wrapper.vm.message).toBe('')
  })
})
