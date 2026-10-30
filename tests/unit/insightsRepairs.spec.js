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

describe('M1: an analysed count is never printed above its managed base', () => {
  it('says "of managed" only when the base holds the count', () => {
    expect(R.reportBase({ calls: 120, callsManaged: 130 })).toEqual({ kind: 'managed', analysed: 120, managed: 130 })
    expect(R.reportBase({ calls: 38, callsManaged: 38 })).toEqual({ kind: 'managed', analysed: 38, managed: 38 })
  })

  it('a base smaller than the count (the copies of managedCall missing, U19: "168 di 38 gestite") is "analysed" alone', () => {
    expect(R.reportBase({ calls: 168, callsManaged: 38 })).toEqual({ kind: 'analysed', analysed: 168 })
    expect(R.reportBase({ calls: 96, callsManaged: 0 })).toEqual({ kind: 'analysed', analysed: 96 })
  })

  it('a missing base (a report of before 10 October) is the old wording, with its note', () => {
    expect(R.reportBase({ calls: 120 })).toEqual({ kind: 'old', analysed: 120 })
  })
})

describe('M10: a recompute\'s progress and result, told honestly', () => {
  it('progress counts the calls processed; the calls stopped at the ceiling are named apart, never counted as done', () => {
    const job = { kind: 'recompute', status: 'ceiling_reached', estimate: { calls: 200 }, counts: { written: 120, ceiling: 80 } }
    // U19: "200 di 200" beside "Analizzate 120 chiamate su 200"
    expect(R.jobProgress(job)).toEqual({ processed: 120, total: 200, written: 120, notFinalised: 0, ceiling: 80 })
  })

  // the amendment of 2026-10-30, m9: the sessions not finalised are no calls, as Panoramica counts them; they leave the
  // progress and are said apart ("14 di 14 chiamate" read beside Panoramica's 4)
  it('names the calls not finalised; OVERLAND\'s recompute: 4 written, 10 not finalised', () => {
    const job = { kind: 'recompute', status: 'done', estimate: { calls: 14 }, counts: { written: 4, not_finalised: 10 } }
    expect(R.jobProgress(job)).toEqual({ processed: 4, total: 4, written: 4, notFinalised: 10, ceiling: 0 })
    expect(R.jobResult(job)).toEqual([{ key: 'written', count: 4 }, { key: 'not_finalised', count: 10, apart: true }])
  })

  it('a facts job (no estimate) has its calls examined and its result, by StarChat\'s own outcomes', () => {
    const job = { kind: 'facts', status: 'done', counts: { written: 30, unchanged: 70, not_finalised: 2 } }
    expect(R.jobProgress(job)).toEqual({ processed: 100, total: null, written: 30, notFinalised: 2, ceiling: 0 })
    expect(R.jobResult(job)).toEqual([{ key: 'written', count: 30 }, { key: 'unchanged', count: 70 }, { key: 'not_finalised', count: 2, apart: true }])
  })

  it('no result for a report job, nor for a job without counts', () => {
    expect(R.jobResult({ kind: 'report', status: 'done', counts: { requests: 1 } })).toEqual([])
    expect(R.jobResult({ kind: 'recompute', status: 'running' })).toEqual([])
  })
})

describe('m4: who asked, when StarChat did not record the role', () => {
  const business = { owner: 'owner-1', ownerName: 'Anna Bianchi' }
  it('the reader or the business\'s owner, read from requestedBy; anyone else a dash', () => {
    expect(R.requester('me', null, { me: 'me', business })).toEqual({ kind: 'you' })
    expect(R.requester('owner-1', null, { me: 'me', business })).toEqual({ kind: 'owner', name: 'Anna Bianchi' })
    expect(R.requester('admin-uid', null, { me: 'me', business })).toBeNull()
  })
})

describe('M13: a change is said only over a previous base of at least 20 calls', () => {
  it('a smaller base is "not available", never a percentage on 8 calls', () => {
    expect(R.change(1986, 8, 8)).toEqual({ available: false, reason: 'base' })
    expect(R.change(30, 10, 19)).toEqual({ available: false, reason: 'base' })
  })
  it('a base of 20 or more gives the relative change; nothing to compare gives none', () => {
    expect(R.change(30, 20, 20)).toEqual({ available: true, value: 0.5 })
    expect(R.change(30, 0, 40)).toBeNull()
    expect(R.change(30, null, null)).toBeNull()
  })
})

describe('m9, m10: the examples and the order of the categories', () => {
  it('folds near-duplicate examples (case, apostrophes, punctuation), keeping the first', () => {
    const list = [{ text: 'Posso prenotare sul sito?' }, { text: 'posso prenotare sul sito' }, { text: 'Avete l’orario?' }, { text: "Avete l'orario ?" }]
    expect(R.distinctExamples(list).map((e) => e.text)).toEqual(['Posso prenotare sul sito?', 'Avete l’orario?'])
  })
  it('puts "other" after the categories it ties with, and nowhere else changes the server\'s order', () => {
    const rows = [
      { category: 'other', score: 2, businesses: 3 }, { category: 'prices', score: 2, businesses: 1 },
      { category: 'online_booking', score: 1, businesses: 9 },
    ]
    expect(R.otherLast(rows, 'score').map((r) => r.category)).toEqual(['prices', 'other', 'online_booking'])
    expect(R.otherLast(rows, 'businesses').map((r) => r.category)).toEqual(['other', 'prices', 'online_booking'])
  })
})
