import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createStore } from 'vuex'
import enUS from '@/i18n/locales/en-US.json'

/**
 * A call's judgements read twice at once (a gesture's re-read and an undo's, say): only the latest read's answer is
 * drawn, whichever answer comes back last (P10 review, finding 2; `CallInsights.latestOnly`). Seen failing on b516496,
 * where the first read, answered last, put back the value the second had replaced.
 */
const answers = []
vi.mock('@/utils/Classifications', async (importOriginal) => {
  const real = (await importOriginal()).default
  return { default: { ...real, classifications: vi.fn(() => new Promise((resolve) => answers.push(resolve))), categories: vi.fn(() => Promise.resolve(null)) } }
})
const CallJudgements = (await import('@/components/feedback/CallJudgements.vue')).default

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
const store = createStore({ state: { role: 'owner', user: { uid: 'u1', accessToken: 't' } } })
const judged = (value) => ({ conversationId: 'CON-1', resolution: { model: 'resolved', value, corrected: value !== 'resolved' }, message: null, requests: [], history: [] })

describe('CallJudgements: the latest read wins', () => {
  it('draws the answer of the latest read, not the one that arrives last', async () => {
    const w = mount(CallJudgements, {
      props: { conversation: { id: 'CON-1', details: {} }, businessId: 'b', user: { accessToken: 't' }, eager: true },
      global: { plugins: [i18n, store], stubs: { Button: true } },
    })
    await flushPromises()
    answers[0](judged('resolved'))
    await flushPromises()
    w.vm.load()
    w.vm.load()
    await flushPromises()
    answers[2](judged('unresolved'))
    await flushPromises()
    answers[1](judged('handed_over'))
    await flushPromises()
    expect(w.find('.judgement-chip').attributes('aria-label')).toMatch(/^Resolution: Unresolved/)
  })
})
