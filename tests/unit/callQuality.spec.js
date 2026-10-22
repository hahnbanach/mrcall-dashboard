import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CallQuality from '@/components/analytics/CallQuality.vue'

// Only the counting text matters here: every other key stands for itself.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { components: { callInsights: { quality: { countOfTotal: '{count} of {total} calls' } } } } },
  missingWarn: false,
  fallbackWarn: false
})

function quality(data, totalCalls) {
  return mount(CallQuality, { props: { status: 'ok', data, totalCalls }, global: { plugins: [i18n] } })
}

const base = { callsWithUnanswered: 0, callsWithUnansweredRecorded: 0, gaps: {}, checks: {}, callsWithChecks: 0, callsWithSkillErrors: 0 }

/** Extraction issues are `http_error` and `failed` over the calls whose extraction ran, as StarChat's
  * `extractions` counts them: a call from before the extraction recorded an outcome is not an issue,
  * and `not_managed` (a call the assistant did not manage, never asked of the model) is neither an
  * issue nor in the base (brief outcome 9). */
describe('CallQuality extraction issues', () => {
  it('counts http_error and failed over the calls whose extraction ran, not over every call', () => {
    // the analytics guide's example: 113 extractions ran, 3 failed, 7 calls not managed; 200 calls in the period
    const text = quality({ ...base, extractions: { ok: 110, http_error: 2, failed: 1, not_managed: 7 } }, 200).text()
    expect(text).toContain('3 of 113 calls')
    expect(text).not.toContain('10 of 120 calls')
    expect(text).not.toContain('90 of 200 calls')
  })

  it('shows no issue when no call in the period carries an extraction outcome', () => {
    const text = quality({ ...base, extractions: {} }, 50).text()
    expect(text).toContain('0 of 0 calls')
    expect(text).not.toContain('50 of 50 calls')
  })
})
