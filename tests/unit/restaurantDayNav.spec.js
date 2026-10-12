import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import enUS from '@/i18n/locales/en-US.json'
import RestaurantDayNav from '@/components/widgets/restaurant/RestaurantDayNav.vue'

/** The one day navigation of the page: the day view and the room editor's preview both move through days with
  * it. Seen failing on 2026-10-12 before it existed (the preview had only Today and Tomorrow). */

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
const draw = (date, today = '2026-10-12', compact = false) =>
  mount(RestaurantDayNav, { props: { date, today, compact }, global: { plugins: [i18n] } })

describe('the day navigation', () => {
  it('goes to the previous and the next day, across a month', () => {
    const back = draw('2026-11-01')
    back.find('[aria-label="Previous day"]').trigger('click')
    const ahead = draw('2026-10-31')
    ahead.find('[aria-label="Next day"]').trigger('click')
    expect(back.emitted('go-day')[0][0]).toBe('2026-10-31')
    expect(ahead.emitted('go-day')[0][0]).toBe('2026-11-01')
  })

  it('moves one day per click even before the page has drawn the day it asked for', () => {
    const w = draw('2026-10-13')
    const next = w.find('[aria-label="Next day"]')
    next.trigger('click'); next.trigger('click'); next.trigger('click')
    expect(w.emitted('go-day').map(e => e[0])).toEqual(['2026-10-14', '2026-10-15', '2026-10-16'])
  })

  it('goes back to today, and offers it only away from today', async () => {
    const away = draw('2026-10-20')
    const back = away.findAll('button').find(b => b.text() === 'Today')
    await back.trigger('click')
    expect(away.emitted('go-day')[0][0]).toBe('2026-10-12')
    expect(draw('2026-10-12').findAll('button').find(b => b.text() === 'Today').attributes('disabled')).toBeDefined()
  })

  it('goes to a picked date', async () => {
    const w = draw('2026-10-20', '2026-10-12', true)
    const input = w.find('input[type="date"]')
    input.element.value = '2026-12-24'
    await input.trigger('change')
    expect(w.emitted('go-day')[0][0]).toBe('2026-12-24')
  })
})
