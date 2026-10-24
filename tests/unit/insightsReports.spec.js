import { describe, it, expect } from 'vitest'
import R from '@/utils/InsightsReports'
import { addDraftQuestion, cleanQuestion, pairsVariable } from '@/utils/KnowledgeBase'

/**
 * `src/utils/InsightsReports.js` and `src/utils/KnowledgeBase.js` (StarChat's docs/briefs/2026-10-24-insights-reports-ux.md):
 * the days of a period in the business's zone, the periods a request offers, the label of each state, who asked, and
 * the pair "Aggiungi la risposta" adds. The instants below are written out, so each case is read against the calendar,
 * not against this code.
 */
const ROME = 'Europe/Rome'
const NY = 'America/New_York'

describe('the days of a period, in the business\'s zone, the last day included', () => {
  // 2026-10-01T00:00 to 2026-10-08T00:00 in Rome: 1-7 October, seven days (CEST, +02:00)
  const start = Date.UTC(2026, 8, 30, 22)
  const end = Date.UTC(2026, 9, 7, 22)

  // Seen failing (2026-10-24) with `inclusiveDays` reading `periodEnd` itself as the last day, the defect of
  // v2.2.32's CallReports.vue: this case and the summer-time one below failed, 2 of 19.
  it('ends on the day before the exclusive midnight, never on it', () => {
    const d = R.inclusiveDays(start, end, ROME, 'en-GB')
    expect(d.first).toBe('1 Oct 2026')
    expect(d.last).toBe('7 Oct 2026')
    expect(d.days).toBe(7)
    expect(R.periodLabel(start, end, ROME, 'en-GB')).toBe('1 Oct 2026 – 7 Oct 2026')
  })

  it('reads the days in the business\'s zone, not in the viewer\'s: the same instants are other days in New York', () => {
    expect(R.inclusiveDays(start, end, NY, 'en-GB').first).toBe('30 Sept 2026')
  })

  it('counts a period across the end of summer time by calendar days (25 October 2026 has 25 hours in Rome)', () => {
    const a = Date.UTC(2026, 9, 24, 22) // 25 Oct 00:00 CEST
    const b = Date.UTC(2026, 9, 26, 23) // 27 Oct 00:00 CET
    expect(R.inclusiveDays(a, b, ROME, 'en-GB').days).toBe(2)
  })

  it('falls back to Rome for a zone it cannot read', () => {
    expect(R.inclusiveDays(start, end, 'Not/AZone', 'en-GB').first).toBe('1 Oct 2026')
  })
})

describe('the periods a request offers end at the last midnight in the business\'s zone', () => {
  it('the midnight of a day in Rome, in summer and in winter', () => {
    expect(R.zonedMidnight(2026, 10, 1, ROME)).toBe(Date.UTC(2026, 8, 30, 22))
    expect(R.zonedMidnight(2026, 12, 1, ROME)).toBe(Date.UTC(2026, 10, 30, 23))
  })

  it('the last 7 days end at today\'s midnight and start seven days before', () => {
    const now = Date.UTC(2026, 9, 24, 15) // 24 Oct 17:00 in Rome
    expect(R.presetInterval(7, now, ROME)).toEqual({ from: Date.UTC(2026, 9, 16, 22), to: Date.UTC(2026, 9, 23, 22) })
    expect(R.lastMidnight(now, ROME)).toBe(Date.UTC(2026, 9, 23, 22))
  })

  it('just after midnight in Rome it is already the next day there, whatever UTC says', () => {
    const now = Date.UTC(2026, 9, 23, 22, 30) // 24 Oct 00:30 in Rome, still 23 Oct in UTC
    expect(R.lastMidnight(now, ROME)).toBe(Date.UTC(2026, 9, 23, 22))
  })

  it('days picked on a calendar are those calendar days, both included', () => {
    const i = R.daysInterval(new Date(2026, 9, 1), new Date(2026, 9, 7), ROME)
    expect(i).toEqual({ from: Date.UTC(2026, 8, 30, 22), to: Date.UTC(2026, 9, 7, 22) })
  })
})

describe('the label of each state', () => {
  it('a history row: every status StarChat pages, and no other', () => {
    expect(['done', 'claimed', 'failed', 'budget_exhausted', 'written_off'].map((status) => R.reportStatusKey({ status })))
      .toEqual(['ready', 'preparing', 'retryTomorrow', 'postponed', 'failed'])
    expect(() => R.reportStatusKey({ status: 'published' })).toThrow(/unknown status/)
  })

  it('a job: why it did not run, and a report of a period without calls', () => {
    expect(R.jobStatusKey({ status: 'refused', error: 'reserve' })).toBe('notRunCredit')
    expect(R.jobStatusKey({ status: 'refused', error: 'no_credit' })).toBe('notRunCredit')
    expect(R.jobStatusKey({ status: 'refused', error: 'automatic_pending' })).toBe('notRun')
    expect(R.jobStatusKey({ status: 'ceiling_reached' })).toBe('stoppedCredit')
    expect(R.jobStatusKey({ status: 'done', kind: 'report', counts: { requests: 0 } })).toBe('noCalls')
    expect(R.jobStatusKey({ status: 'done', kind: 'report', counts: { requests: 1 } })).toBe('ready')
    expect(R.jobStatusKey({ status: 'queued' })).toBe('queued')
    expect(R.jobStatusKey({ status: 'cancelled' })).toBe('cancelled')
    expect(() => R.jobStatusKey({ status: 'paused' })).toThrow(/unknown status/)
  })

  it('a recompute\'s progress counts every call it went through over the calls its estimate counted', () => {
    const job = { kind: 'recompute', estimate: { calls: 40 }, counts: { written: 10, reasoned: 2, failed: 1, ceiling: 3 } }
    expect(R.jobProgress(job)).toEqual({ done: 16, total: 40, written: 10 })
    expect(R.jobProgress({ kind: 'report', estimate: { calls: 4 } })).toBeNull()
    expect(R.jobProgress({ kind: 'recompute' })).toBeNull()
  })
})

describe('who asked, never by an id', () => {
  const business = { owner: 'owner-1', ownerName: 'Anna Bianchi' }
  it('the reader, the owner by name, anyone else as MrCall or the reseller', () => {
    expect(R.requester('me', { me: 'me', business })).toEqual({ kind: 'you' })
    expect(R.requester('owner-1', { me: 'me', business })).toEqual({ kind: 'owner', name: 'Anna Bianchi' })
    expect(R.requester('someone', { me: 'me', business })).toEqual({ kind: 'staff' })
    expect(R.requester(null, { me: 'me', business })).toBeNull()
  })
})

describe('what the screens offer', () => {
  it('a FREE business\'s owner is offered the plan, an admin or a reseller the work', () => {
    expect(R.freeOwner('owner', { subscriptionStatus: 'FREE' })).toBe(true)
    expect(R.freeOwner('admin', { subscriptionStatus: 'FREE' })).toBe(false)
    expect(R.freeOwner('owner', { subscriptionStatus: 'ACTIVE' })).toBe(false)
  })

  it('the coverage banner: at least 10 calls, and at least a tenth of the managed ones', () => {
    expect(R.recomputeBanner({ recomputable: 10, callsManaged: 100 })).toBe(10)
    expect(R.recomputeBanner({ recomputable: 9, callsManaged: 20 })).toBeNull()
    expect(R.recomputeBanner({ recomputable: 10, callsManaged: 101 })).toBeNull()
    expect(R.recomputeBanner(null)).toBeNull()
  })

  it('a report\'s base: of the managed calls, or the analysed calls alone before 10 October', () => {
    expect(R.reportBase({ calls: 120, callsManaged: 130 })).toEqual({ kind: 'managed', analysed: 120, managed: 130 })
    expect(R.reportBase({ calls: 120 })).toEqual({ kind: 'old', analysed: 120 })
    expect(R.reportBase({})).toBeNull()
  })

  it('a request key is new for every request', () => {
    expect(R.newRequestKey()).not.toBe(R.newRequestKey())
  })
})

describe('"Aggiungi la risposta": one pair added to the knowledge base, the question filled', () => {
  const annotations = [
    { collection: { id: '__CONVERSATION__' }, variables: [{ name: 'WELCOME', type: 'string' }] },
    // grouped, as StarChat answers them with nested=true
    { collection: { id: '__KNOWLEDGE_BASE__' }, variables: [[{ name: 'TITLE', type: 'meta:title' }], [{ name: 'KB_PAIRS', type: 'tuples' }]] },
  ]

  it('finds the pairs by their collection and type, not by a name', () => {
    expect(pairsVariable(annotations).name).toBe('KB_PAIRS')
    expect(pairsVariable([])).toBeNull()
  })

  it('adds [question, ""] first, once; the same question again adds nothing', () => {
    const business = { variables: { KB_PAIRS: [['Orari?', 'Dalle 9 alle 18']] } }
    expect(addDraftQuestion(business, annotations, '  Fate   parcheggio? ').outcome).toBe('added')
    expect(business.variables.KB_PAIRS).toEqual([['Fate parcheggio?', ''], ['Orari?', 'Dalle 9 alle 18']])
    expect(addDraftQuestion(business, annotations, 'fate parcheggio?').outcome).toBe('present')
    expect(business.variables.KB_PAIRS.length).toBe(2)
  })

  it('reads pairs stored as text, and adds nothing without a question or a pairs variable', () => {
    const business = { variables: { KB_PAIRS: '[["A?","B"]]' } }
    expect(addDraftQuestion(business, annotations, 'C?').outcome).toBe('added')
    expect(business.variables.KB_PAIRS).toEqual([['C?', ''], ['A?', 'B']])
    expect(addDraftQuestion(business, annotations, '   ').outcome).toBe('none')
    expect(addDraftQuestion(business, [], 'D?').outcome).toBe('none')
    expect(cleanQuestion('x'.repeat(600)).length).toBe(500)
  })
})
