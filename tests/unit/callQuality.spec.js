import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CallQuality from '@/components/analytics/CallQuality.vue'

// Only the numbers matter here: every key stands for itself.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function quality(data, totalCalls) {
  return mount(CallQuality, { props: { status: 'ok', data, totalCalls }, global: { plugins: [i18n] } })
}

/** The extraction row's count and the calls it is counted on, from their columns. */
function extraction(wrapper) {
  const row = wrapper.find('tr[data-signal="extraction"]')
  return `${row.find('.quality-count').text()} of ${row.find('.quality-base').text()}`
}

const base = { callsWithUnanswered: 0, callsWithUnansweredRecorded: 0, gaps: {}, checks: {}, callsWithChecks: 0, callsWithSkillErrors: 0 }

/** Extraction issues are `http_error`, `failed` and `too_long` over the calls whose extraction ran, as StarChat's
  * `extractions` counts them: a call from before the extraction recorded an outcome is not an issue,
  * and `not_managed` (a call the assistant did not manage, never asked of the model) is neither an
  * issue nor in the base (brief outcome 9). */
describe('CallQuality extraction issues', () => {
  it('counts the failures over the calls whose extraction ran, not over every call', () => {
    // the analytics guide's example: 113 extractions ran, 3 failed, 7 calls not managed; 200 calls in the period
    expect(extraction(quality({ ...base, extractions: { ok: 110, http_error: 2, failed: 1, not_managed: 7 } }, 200))).toBe('3 of 113')
  })

  it('counts too_long, refused for size, as StarChat does (brief 2026-10-31-analytics-ux, O5)', () => {
    expect(extraction(quality({ ...base, extractions: { ok: 110, http_error: 2, failed: 1, too_long: 4, not_managed: 7 } }, 200))).toBe('7 of 117')
  })

  it('shows no issue when no call in the period carries an extraction outcome', () => {
    const wrapper = quality({ ...base, extractions: {} }, 50)
    expect(extraction(wrapper)).toBe('0 of 0')
    // no base, no share: never 0% of nothing
    expect(wrapper.find('tr[data-signal="extraction"] .quality-share-value').text()).toBe('-')
  })
})
