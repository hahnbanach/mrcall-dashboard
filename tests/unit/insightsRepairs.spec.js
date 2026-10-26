import { describe, it, expect } from 'vitest'
import R from '@/utils/InsightsReports'

/**
 * U19r2 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the rules the repaired screens apply
 * to what StarChat answers (brief, "Amendment 2026-10-26", Dashboard). Pure functions of `src/utils/InsightsReports.js`,
 * each case written against the U19 finding it repairs.
 */

describe('M2: a report\'s outcome, from its own counts', () => {
  const content = { resolution: { resolved: 50, forwarded: 30, handed_over: 10, unresolved: 20, caller_left: 6, spam_wrong_number: 4 } }

  it('four lines over the calls where the caller asked, the two beside them outside the base', () => {
    const o = R.reportOutcome(content)
    expect(o.base).toBe(110)
    expect(o.lines.map((l) => [l.key, l.count, l.percent])).toEqual([
      ['resolved', 50, 45], ['forwarded', 30, 27], ['handed_over', 10, 9], ['unresolved', 20, 18],
    ])
  })

  it('none for a report without resolution counts (written before insights version 2)', () => {
    expect(R.reportOutcome({ calls: 3 })).toBeNull()
    expect(R.reportOutcome({ resolution: {} })).toBeNull()
  })
})

describe('M2: the themes, by calls, each with its outcome', () => {
  it('sorted by calls, most first, whatever order the content has; the outcome lines that have calls, in line order', () => {
    const themes = R.reportThemes({
      topics: [
        { topic: 'Parking', calls: 12, labels: ['parking'], resolution: { unresolved: 8, resolved: 4 } },
        { topic: 'Bookings', calls: 70, labels: ['booking', 'Table for four'], resolution: { resolved: 40, forwarded: 20, handed_over: 5, unresolved: 5, caller_left: 2 } },
        { topic: 'Old', labels: [] },
      ],
    })
    expect(themes.map((t) => [t.topic, t.calls])).toEqual([['Bookings', 70], ['Parking', 12], ['Old', null]])
    expect(themes[0].outcome).toEqual([{ key: 'resolved', count: 40 }, { key: 'forwarded', count: 20 }, { key: 'handed_over', count: 5 }, { key: 'unresolved', count: 5 }])
    expect(themes[1].outcome).toEqual([{ key: 'resolved', count: 4 }, { key: 'unresolved', count: 8 }])
  })

  it('m6: drops a label that only repeats the theme\'s name', () => {
    const [t] = R.reportThemes({ topics: [{ topic: 'Parking', calls: 1, labels: ['parking', ' Parking ', 'where to park'] }] })
    expect(t.labels).toEqual(['where to park'])
  })
})

describe('rule 3: no "Aggiungi la risposta" on a question about the caller\'s own medical case', () => {
  it('is offered on any other gap', () => {
    expect(R.answerable({ group: 'missing_info', summary: 'Parking?' })).toBe(true)
    expect(R.answerable({ group: 'out_of_scope', summary: 'Which pill?', category: 'clinical_advice' })).toBe(false)
    expect(R.answerable({ group: 'missing_info', summary: '  ' })).toBe(false)
  })
})
