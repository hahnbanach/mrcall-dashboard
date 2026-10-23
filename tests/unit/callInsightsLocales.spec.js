import { describe, it, expect } from 'vitest'
import enUS from '@/i18n/locales/en-US.json'
import itIT from '@/i18n/locales/it-IT.json'
import esES from '@/i18n/locales/es-ES.json'
import frFR from '@/i18n/locales/fr-FR.json'
import deDE from '@/i18n/locales/de-DE.json'
import nlNL from '@/i18n/locales/nl-NL.json'
import svSE from '@/i18n/locales/sv-SE.json'
import daDK from '@/i18n/locales/da-DK.json'
import nbNO from '@/i18n/locales/nb-NO.json'
import fiFI from '@/i18n/locales/fi-FI.json'
import etEE from '@/i18n/locales/et-EE.json'
import elGR from '@/i18n/locales/el-GR.json'

/**
 * This work (call insights, `docs/briefs/2026-10-20-call-insights.md`) added every new
 * user-facing string under `components.callInsights.*`. A whole-file parity test would fail
 * today on keys the 12 locales already disagree on elsewhere; this one is narrow to the keys this
 * work added, and fails the moment one of them is missing from a locale, rather than silently
 * falling back to the raw key or to English (`tests/unit/callDetailsPanel.spec.js` already shows
 * what a missing key looks like: the raw dotted key, in place of a label).
 */
const LOCALES = {
  'en-US': enUS, 'it-IT': itIT, 'es-ES': esES, 'fr-FR': frFR, 'de-DE': deDE, 'nl-NL': nlNL,
  'sv-SE': svSE, 'da-DK': daDK, 'nb-NO': nbNO, 'fi-FI': fiFI, 'et-EE': etEE, 'el-GR': elGR,
}

function flattenKeys (obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return (value && typeof value === 'object' && !Array.isArray(value))
      ? flattenKeys(value, path)
      : [path]
  })
}

const referenceKeys = flattenKeys(enUS.components.callInsights).sort()

describe('callInsights: every new key in all 12 locales', () => {
  it('en-US names at least one key (the reference is not accidentally empty)', () => {
    expect(referenceKeys.length).toBeGreaterThan(0)
  })

  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} carries every components.callInsights key en-US does, and none it does not`, () => {
      const ci = messages.components && messages.components.callInsights
      expect(ci, `${locale} is missing components.callInsights entirely`).toBeTruthy()
      const keys = flattenKeys(ci).sort()
      const missing = referenceKeys.filter(k => !keys.includes(k))
      const extra = keys.filter(k => !referenceKeys.includes(k))
      expect(missing, `${locale} is missing these keys`).toEqual([])
      expect(extra, `${locale} carries these keys en-US does not`).toEqual([])
    })
  }
})

/**
 * Insights version 2 (brief amended 2026-10-20): `resolution`, `message`, `booked` and `transferred`
 * are labelled in the viewer's language. A translation that is the English text copied into
 * another file passes the parity test above, so the labels of the value table are compared with
 * en-US one by one: a locale may keep an English word only where the exception list says so.
 */
const VALUE_TABLE_PREFIXES = ['resolution.', 'message.', 'booked.', 'transferred.', 'dimensions.', 'unkept.']
// The same spelling in the other language, checked: French "Message", Danish and Norwegian "Booking".
const ENGLISH_ALLOWED = {
  'fr-FR': ['dimensions.message'],
  'da-DK': ['dimensions.booked'],
  'nb-NO': ['dimensions.booked'],
}

describe('callInsights: the value table is translated, not copied from English', () => {
  const valueKeys = referenceKeys.filter(k => VALUE_TABLE_PREFIXES.some(p => k.startsWith(p)) || k === 'assessedMarking')

  it('names the four dimensions and their values, and no version-1 outcomes', () => {
    expect(valueKeys).toEqual(expect.arrayContaining([
      'resolution.resolved', 'resolution.unresolved', 'resolution.handed_over', 'resolution.caller_left',
      'resolution.spam_wrong_number', 'message.complete', 'message.incomplete', 'message.unintelligible',
      'message.none', 'booked.true', 'booked.false', 'transferred.true', 'transferred.unknown',
      'dimensions.resolution', 'dimensions.message', 'dimensions.booked', 'dimensions.transferred',
      'unkept.title', 'unkept.actions.book', 'unkept.actions.move', 'unkept.actions.cancel',
      'unkept.actions.transfer', 'unkept.actions.other',
    ]))
    expect(referenceKeys.filter(k => k.startsWith('outcomes.'))).toEqual([])
  })

  const get = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj)

  for (const [locale, messages] of Object.entries(LOCALES)) {
    if (locale === 'en-US') continue
    it(`${locale} words the value table in its own language`, () => {
      const ci = messages.components.callInsights
      const copied = valueKeys.filter(k => get(ci, k) === get(enUS.components.callInsights, k) &&
        !(ENGLISH_ALLOWED[locale] || []).includes(k))
      expect(copied, `${locale} carries English text for these keys`).toEqual([])
    })
  }
})

/**
 * Brief outcome 9 (amendment of 2026-10-21): the outcomes section is retitled for what it shows, the
 * calls without a conversation and the topics get their own strings, and the assistants table three
 * more columns and sorts. The parity test above already covers every key under
 * `components.callInsights`; this pins that the new ones are there to be covered, and that
 * `caller_left` is labelled for its meaning.
 */
describe('callInsights: the keys of outcome 9', () => {
  it('en-US names the retitled outcomes section, the calls without a conversation, the topics and the new assistants columns', () => {
    expect(referenceKeys).toEqual(expect.arrayContaining([
      'howCallsWent.title', 'howCallsWent.shareBase', 'howCallsWent.shareOfBase', 'howCallsWent.outsideTitle',
      'noConversation.title', 'noConversation.note',
      'noConversation.reasons.caller_silent', 'noConversation.reasons.no_credit',
      'noConversation.reasons.talk_and_hangup', 'noConversation.reasons.not_answered',
      'topics.title', 'topics.base', 'topics.topic', 'topics.calls', 'topics.previousCalls', 'topics.none',
      'topics.chooseBusiness',
      'assistants.callerSilent', 'assistants.notAnswered', 'assistants.callerLeft',
      'assistants.sortOptions.callerSilent', 'assistants.sortOptions.notAnswered', 'assistants.sortOptions.callerLeft',
    ]))
    expect(referenceKeys.filter(k => k.startsWith('whatCallsSaid.'))).toEqual([])
  })

  it('labels caller_left for what it means, never as the caller having left', () => {
    expect(enUS.components.callInsights.resolution.caller_left).not.toBe('Caller left')
    expect(itIT.components.callInsights.resolution.caller_left).not.toBe('Chiamante uscito')
  })
})

/**
 * Brief outcome 10 (amendment of 2026-10-22): the scope-wide lists say who and load a page at a time,
 * the assistants table widens the page again from itself, and a filter bar undoes each filter where
 * it shows. The parity test above covers every key; this pins that the new ones are there to be
 * covered, and that the bar's controls are worded in each language rather than copied from English.
 */
describe('callInsights: the keys of outcome 10', () => {
  const OUTCOME_10_KEYS = [
    'scope.loading', 'scope.saidByLabel', 'scope.andMore', 'scope.shownIntegrations', 'scope.shownSuggestions',
    'scope.businessesCount', 'scope.reportsCount', 'assistants.noName', 'scope.loadMoreIntegrations',
    'scope.loadMoreSuggestions', 'scope.template', 'scope.reportEnding',
    'scope.kinds.integration', 'scope.kinds.business_info', 'scope.kinds.needs_integration_gap',
    'assistants.showAll',
    'filterBar.title', 'filterBar.business', 'filterBar.owner', 'filterBar.plan', 'filterBar.period',
    'filterBar.lastDays', 'filterBar.clearBusiness', 'filterBar.clearOwner', 'filterBar.clearPlan', 'filterBar.clearPeriod',
  ]

  it('en-US names every string of outcome 10', () => {
    expect(referenceKeys).toEqual(expect.arrayContaining(OUTCOME_10_KEYS))
  })

  // "1 businesses" was the first review's finding: the counts are plural messages in every locale.
  it('counts businesses and reports with a singular and a plural form in every locale', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const sc = messages.components.callInsights.scope
      for (const key of ['businessesCount', 'reportsCount']) {
        expect(sc[key].split('|').length, `${locale} scope.${key}`).toBe(2)
      }
    }
  })

  const get = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj)
  const WORDED = ['assistants.showAll', 'filterBar.title', 'filterBar.clearBusiness', 'filterBar.clearOwner',
    'filterBar.clearPlan', 'filterBar.clearPeriod', 'scope.loadMoreIntegrations', 'scope.loadMoreSuggestions', 'scope.andMore', 'scope.shownSuggestions', 'assistants.noName']
  for (const [locale, messages] of Object.entries(LOCALES)) {
    if (locale === 'en-US') continue
    it(`${locale} words the filter bar and the paging in its own language`, () => {
      const ci = messages.components.callInsights
      const copied = WORDED.filter(k => get(ci, k) === get(enUS.components.callInsights, k))
      expect(copied, `${locale} carries English text for these keys`).toEqual([])
    })
  }
})

/**
 * The milestone review of D12: short assistants headers with their full wording and base in a legend,
 * a failed later page with a retry, the bar saying what the scope-wide lists cover, and a report's
 * period total as the base of its counts.
 */
/**
 * The final review of D12: the extraction column is over the calls whose extraction ran
 * (`extractionsRun`), as the quality section counts it, while skill errors stay over all calls. Each
 * legend names its base after the last comma: the two must differ in every locale, and en-US says
 * which base the extraction column has.
 */
describe('callInsights: the extraction legend names the calls whose extraction ran', () => {
  const baseOf = (text) => text.slice(text.lastIndexOf(',') + 1).trim()

  it('en-US words both bases', () => {
    const legend = enUS.components.callInsights.assistants.legend
    expect(legend.extractionIssues).toBe('calls whose data extraction failed, over the calls whose extraction ran')
    expect(legend.skillErrors).toBe('calls with a skill error, over all calls')
  })

  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} does not give the extraction column the skill errors' base (all calls)`, () => {
      const legend = messages.components.callInsights.assistants.legend
      expect(baseOf(legend.extractionIssues)).not.toBe(baseOf(legend.skillErrors))
    })
  }
})

describe('callInsights: the keys of the D12 review', () => {
  const SHORT = ['calls', 'notSolved', 'callerSilent', 'notAnswered', 'callerLeft', 'unanswered', 'checks', 'skillErrors', 'extractionIssues']
  const KEYS = [
    ...SHORT.map(k => `assistants.short.${k}`),
    ...SHORT.filter(k => k !== 'calls').map(k => `assistants.legend.${k}`),
    'assistants.legendTitle', 'assistants.assessedShort',
    'scope.moreFailed', 'scope.retry',
    'filterBar.scopeNote', 'filterBar.notApplied',
    'reports.callsInPeriod',
  ]

  it('en-US names every one of them', () => {
    expect(referenceKeys).toEqual(expect.arrayContaining(KEYS))
  })

  const get = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj)
  const WORDED = ['assistants.legendTitle', 'scope.moreFailed', 'scope.retry', 'filterBar.scopeNote', 'filterBar.notApplied',
    'reports.callsInPeriod', 'assistants.short.callerSilent', 'assistants.legend.notSolved']
  for (const [locale, messages] of Object.entries(LOCALES)) {
    if (locale === 'en-US') continue
    it(`${locale} words them in its own language`, () => {
      const ci = messages.components.callInsights
      const copied = WORDED.filter(k => get(ci, k) === get(enUS.components.callInsights, k))
      expect(copied, `${locale} carries English text for these keys`).toEqual([])
    })
  }

  // Booked is over the report's `calls` (the calls with insights); transferred is a bare count: StarChat
  // writes it only where a carrier reports the transfer leg, so no base holds it (the D12 re-review).
  it('says booked over the calls with insights, and transferred as a count with no base, in every locale', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const r = messages.components.callInsights.reports
      expect(r.booked, `${locale} reports.booked`).toContain('{total}')
      expect(r.transferred, `${locale} reports.transferred`).not.toContain('{total}')
      expect(r.callsInPeriod, `${locale} reports.callsInPeriod`).toContain('{calls}')
      expect(r.callsBaseNote, `${locale} reports.callsBaseNote`).toBeTruthy()
      expect(messages.components.callInsights.filterBar.ownerNameSource, `${locale} filterBar.ownerNameSource`).toBeTruthy()
    }
  })

  // "N calls in this period" read as every call; the report's `calls` counts the calls with insights only
  it('names the report\'s base as the calls with insights, not every call', () => {
    expect(enUS.components.callInsights.reports.callsInPeriod).toMatch(/insights/)
    expect(itIT.components.callInsights.reports.callsInPeriod).not.toBe('{calls} chiamate in questo periodo')
  })
})
