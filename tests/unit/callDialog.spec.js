import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import enUS from '@/i18n/locales/en-US.json'
import CallDialog from '@/components/conversations/CallDialog.vue'
import CountedCallsPanel from '@/components/analytics/CountedCallsPanel.vue'
import CallInsights from '@/utils/CallInsights'
import Classifications from '@/utils/Classifications'
import ConversationApi from '@/utils/Conversation'

/**
 * Plan docs/execution-plans/2026-10-31-analytics-ux.md, step A2.
 *
 * The call dialog serves calls of several businesses on one analytics page: the owner is read per business, so a reader
 * who opens a call of a business it owns and then, in the same dialog, a call of one it does not own sees the second
 * read-only (no owner action, no judgements read until a chip is opened: CallDetailsPanel's `readOnly`).
 * Seen failing, 2026-11-01, against RestaurantCallModal's rule (the owner read once, before the first call): the second
 * call was drawn with `readOnly` false.
 *
 * The counted-calls panel lists exactly the calls of a count's link with the conversations list's own body, states
 * the count it was opened from and, for a report's count, the calls it leaves out; a row asks the page to open the call.
 * Seen failing, 2026-11-01, before the panel existed.
 */
const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
const READER = { uid: 'reseller-1', accessToken: 't' }

// PrimeVue's Dialog and Drawer teleport to the body; these stand-ins draw their content in place while visible and
// emit `show` when they become visible, as the real ones do.
const overlay = (name) => ({
  name,
  props: ['visible', 'header'],
  emits: ['show', 'update:visible'],
  watch: { visible: { immediate: true, handler (v) { if (v) this.$nextTick(() => this.$emit('show')) } } },
  template: '<div v-if="visible" :class="name"><h2>{{ header }}</h2><slot /></div>',
  data: () => ({ name })
})
const PanelProbe = { name: 'CallDetailsPanel', props: ['conversation', 'readOnly', 'businessId'], template: '<div class="probe" :data-read-only="String(readOnly)">{{ conversation.id }}</div>' }

describe('CallDialog', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('reads each business\'s owner: an owned call, then another business\'s call in the same dialog, read-only', async () => {
    vi.spyOn(CallInsights, 'business').mockImplementation((user, businessId) =>
      Promise.resolve({ businessId, owner: businessId === 'own-biz' ? 'reseller-1' : 'someone-else' }))
    vi.spyOn(ConversationApi, 'get').mockImplementation((user, businessId, id) => Promise.resolve({ id, businessId, startTimestamp: 1 }))
    const wrapper = mount(CallDialog, {
      props: { visible: true, ids: ['CON-own'], businessId: 'own-biz', user: READER },
      global: { plugins: [i18n], stubs: { Dialog: overlay('dialog'), CallDetailsPanel: PanelProbe, UndoBar: true } }
    })
    await flushPromises()
    expect(wrapper.find('.probe').text()).toBe('CON-own')
    expect(wrapper.find('.probe').attributes('data-read-only')).toBe('false')

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ ids: ['CON-other'], businessId: 'other-biz', visible: true })
    await flushPromises()
    expect(wrapper.find('.probe').text()).toBe('CON-other')
    expect(wrapper.find('.probe').attributes('data-read-only')).toBe('true')
    expect(CallInsights.business.mock.calls.map((c) => c[1])).toEqual(['own-biz', 'other-biz'])

    // back to the first business: its owner is known, not read again
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ ids: ['CON-own'], businessId: 'own-biz', visible: true })
    await flushPromises()
    expect(wrapper.find('.probe').attributes('data-read-only')).toBe('false')
    expect(CallInsights.business).toHaveBeenCalledTimes(2)
  })

  it('is read-only while the owner is not known, and when the owner cannot be read', async () => {
    vi.spyOn(CallInsights, 'business').mockRejectedValue(new Error('down'))
    vi.spyOn(ConversationApi, 'get').mockResolvedValue({ id: 'CON-1', startTimestamp: 1 })
    const wrapper = mount(CallDialog, {
      props: { visible: true, ids: ['CON-1'], businessId: 'b', user: READER },
      global: { plugins: [i18n], stubs: { Dialog: overlay('dialog'), CallDetailsPanel: PanelProbe, UndoBar: true } }
    })
    await flushPromises()
    expect(wrapper.find('.probe').attributes('data-read-only')).toBe('true')
  })
})

describe('CountedCallsPanel', () => {
  beforeEach(() => vi.restoreAllMocks())

  const docs = [
    { id: 'CON-1', startTimestamp: 1790900000000, details: { callerName: 'Rita', summary: 'Asked for the price list.' } },
    { id: 'CON-2', startTimestamp: 1790800000000, contactNumber: 'uid:abc', details: { summary: 'Web question.' } }
  ]

  function draw (link, count = 2) {
    return mount(CountedCallsPanel, {
      props: { visible: true, link, label: 'Out of scope', count, user: READER },
      global: { plugins: [i18n, PrimeVue], components: { Button, ProgressBar }, stubs: { Drawer: overlay('drawer'), 'router-link': { props: ['to'], template: '<a class="to-conversations" :data-to="JSON.stringify(to)"><slot /></a>' } } }
    })
  }

  it('lists the count\'s calls with the conversations list\'s own body, states the count, and opens a call through the page', async () => {
    const page = vi.spyOn(ConversationApi, 'page').mockResolvedValue({ items: docs, total: 2, leftOut: 0 })
    const link = Classifications.countLink('biz-1', { from: 10, to: 20 }, 'gap', 'out_of_scope')
    const wrapper = draw(link)
    await flushPromises()
    const [, body, options] = page.mock.calls[0]
    expect(body).toEqual({ businessId: 'biz-1', counted: true, timestampGte: 10, timestampLte: 20, gap: 'out_of_scope' })
    expect(options).toMatchObject({ from: 0, querySuffix: '' })
    const text = wrapper.text()
    expect(text).toContain('Out of scope')
    expect(text).toContain('2 calls')
    expect(text).toContain('Rita')
    expect(text).toContain('Asked for the price list.')
    expect(text).toContain('Web call')
    expect(text).not.toContain('uid:abc')
    expect(text).not.toMatch(/components\.callInsights/)
    expect(JSON.parse(wrapper.find('.to-conversations').attributes('data-to'))).toEqual(link)
    await wrapper.findAll('button').find((b) => b.text() === 'Open the call').trigger('click')
    expect(wrapper.emitted('open-call')[0]).toEqual(['biz-1', 'CON-1'])
  })

  it('a report\'s count asks how many calls it leaves out, in the query, and says so', async () => {
    const page = vi.spyOn(ConversationApi, 'page').mockResolvedValue({ items: docs.slice(0, 1), total: 1, leftOut: 3 })
    const link = Classifications.countLink('biz-1', { from: 10, to: 20 }, 'gap', 'missing_info', { report: true })
    const wrapper = draw(link, 4)
    await flushPromises()
    expect(page.mock.calls[0][2]).toMatchObject({ querySuffix: '&leftOut=true' })
    expect(page.mock.calls[0][1]).not.toHaveProperty('leftOut')
    expect(wrapper.text()).toContain('4 calls')
    expect(wrapper.find('.counted-calls-note').text()).toMatch(/3/)
  })

  it('an empty answer is said, a failure offers a retry', async () => {
    vi.spyOn(ConversationApi, 'page').mockResolvedValueOnce({ items: [], total: 0, leftOut: 0 }).mockRejectedValueOnce(new Error('500'))
    const wrapper = draw(Classifications.countLink('biz-1', { from: 10, to: 20 }, 'check', 'caller_repeated'), 0)
    await flushPromises()
    expect(wrapper.text()).toContain('No calls to show.')
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
