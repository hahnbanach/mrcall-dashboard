import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CallInsights from '@/utils/CallInsights'
import SignalExplain from '@/components/analytics/SignalExplain.vue'

/**
 * Plan docs/execution-plans/2026-10-31-analytics-ux.md, step A6a (brief O5): every quality signal (each gap reason, each
 * check, skill errors and extraction problems) has a meaning and a next action in every locale, and SignalExplain draws
 * both. Seen failing, 2026-11-01, before the `signals` keys existed.
 */
// every locale file, by its name (the glob is resolved at build time, as the files are bundled)
const LOCALES = Object.fromEntries(Object.entries(import.meta.glob('@/i18n/locales/*.json', { eager: true, import: 'default' }))
  .map(([path, messages]) => [path.split('/').pop().replace('.json', ''), messages]))
const SIGNALS = [...CallInsights.GAP_KEYS, ...CallInsights.CHECK_KEYS, 'skillErrors', 'extraction']

describe('every quality signal says what it means and what to do', () => {
  it('names nine signals: four reasons, three checks, skill errors and extraction, in twelve locales', () => {
    expect(SIGNALS).toHaveLength(9)
    expect(Object.keys(LOCALES)).toHaveLength(12)
  })

  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} has a meaning and an action for each`, () => {
      const signals = messages.components.callInsights.signals
      for (const key of SIGNALS) {
        expect(signals[key] && signals[key].meaning, `${locale} signals.${key}.meaning`).toBeTruthy()
        expect(signals[key] && signals[key].action, `${locale} signals.${key}.action`).toBeTruthy()
        expect(signals[key].action, `${locale} signals.${key}: the action is not the meaning`).not.toBe(signals[key].meaning)
      }
    })
  }

  it('SignalExplain draws both, for each signal', () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': LOCALES['en-US'] } })
    for (const key of SIGNALS) {
      const text = mount(SignalExplain, { props: { signal: key }, global: { plugins: [i18n] } }).text()
      const s = LOCALES['en-US'].components.callInsights.signals[key]
      expect(text).toContain(s.meaning)
      expect(text).toContain(s.action)
    }
  })
})
