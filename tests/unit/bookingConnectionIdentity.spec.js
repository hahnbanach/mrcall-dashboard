import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import BookingCalendarConnection from '@/components/BookingCalendarConnection.vue'
import zylch from '@/utils/Zylch'
import messages from '@/i18n/locales/en-US.json'

vi.mock('@/utils/Zylch', () => ({ default: { getBookingSetup: vi.fn(), activateBooking: vi.fn() } }))
vi.mock('@/utils/BookingConnection', () => ({ bookingAuthorizationUrl: vi.fn(),
  clearBookingIntent: vi.fn(), consumeBookingConnection: vi.fn(() => 'missing') }))
vi.mock('@/firebase/axiosConfig', () => ({ isSessionEnded: () => false }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/businessconfiguration', query: {} }),
  useRouter: () => ({ replace: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
  zylch.getBookingSetup.mockResolvedValue({ available: true, state: 'prepared',
    setup_token: 'a'.repeat(64), oauth_scopes: [], connection_status: 'available',
    calendars: [{ id: 'calendar', summary: 'Appointments', primary: true }] })
})

describe('in-flight booking activation identity', () => {
  for (const change of ['owner', 'business']) it(`ignores an old ${change} result and releases busy state`, async () => {
    let release
    zylch.activateBooking.mockReturnValue(new Promise(resolve => { release = resolve }))
    const store = createStore({ state: { user: { uid: 'owner-1', accessToken: 'test-token' } } })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': messages } })
    const wrapper = mount(BookingCalendarConnection, {
      props: { businessId: 'business-1', sessionId: 'session-1', ready: true },
      global: { plugins: [store, i18n, PrimeVue], components: { Button, Dropdown } },
    })
    await flushPromises()
    wrapper.findComponent(Dropdown).vm.$emit('update:modelValue', 'calendar')
    await flushPromises()
    await wrapper.find('.booking-activate').trigger('click')
    expect(zylch.activateBooking).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('busy-change').at(-1)).toEqual([true])

    if (change === 'owner') store.state.user = { uid: 'owner-2', accessToken: 'other-token' }
    await wrapper.setProps({ sessionId: 'session-2', ...(change === 'business' ? { businessId: 'business-2' } : {}) })
    await flushPromises()
    expect(wrapper.emitted('busy-change').at(-1)).toEqual([false])
    expect(zylch.getBookingSetup.mock.calls.at(-1)[2]).toBe('session-2')

    release({ success: true, booking_active: true, remaining_pending: [], skill_outcomes: [] })
    await flushPromises()
    expect(wrapper.emitted('result')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Booking is active.')
    expect(zylch.activateBooking).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
