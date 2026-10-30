import { describe, it, expect } from 'vitest'
import R from '@/utils/InsightsReports'
import C from '@/utils/Classifications'
import CallInsights from '@/utils/CallInsights'
import itIT from '@/i18n/locales/it-IT.json'

/**
 * The pure rules of the brief's amendment of 2026-10-30 (StarChat docs/briefs/2026-10-24-insights-reports-ux.md, "what
 * the U19c attack found"), each pinned where it is decided: what a report estimate says it reads (rule 1), the caption
 * of a report's list by content version (rule 2), every category row's next action (rule 4), what an undo did by its
 * answer and the reader's withdrawable proposals (rule 5), a change against a partial window (rule 10), a period not
 * at the zone's midnights (m8), Processing's counts (m9), the web caller (m15), and the queue's fact sentence agreeing
 * with the fact's gender in Italian (m16).
 *
 * Seen failing on c0a4e35 (the attacked head): every case, on functions and keys that did not exist or answered the
 * old rule (`jobProgress` counting 14 of 14 with 10 sessions not finalised; `periodLabel` naming 21 March).
 */
const ROME = 'Europe/Rome'

describe('rule 1: a report estimate says what the report reads', () => {
  it('the analysed calls, and the finalised calls not analysed yet', () => {
    expect(R.reportReach({ calls: 0, requests: 1, finalised: 260, analysed: 253 })).toEqual({ analysed: 253, notAnalysed: 7 })
  })
  it('nothing said when StarChat does not carry them', () => {
    expect(R.reportReach({ calls: 0, requests: 1 })).toBeNull()
  })
})

describe('rule 2: the caption of a report\'s list', () => {
  it('version 5 and later lists the calls to call back; 4 and lower the calls to review', () => {
    expect(R.flaggedCaption({ version: 5 })).toBe('callBack')
    expect(R.flaggedCaption({ version: 6 })).toBe('callBack')
    expect(R.flaggedCaption({ version: 4 })).toBe('review')
    expect(R.flaggedCaption({})).toBe('review')
  })
})

describe('rule 4: every category row has a next action', () => {
  it('StarChat\'s words for business_info and integration, ours for the other kinds, the unrated and unclassified rows opening', () => {
    expect(R.nextAction({ category: 'prices', nextActionKind: 'business_info', nextAction: 'Add prices' })).toEqual({ text: 'Add prices' })
    expect(R.nextAction({ category: 'x', nextActionKind: 'integration', nextAction: 'Connect' })).toEqual({ text: 'Connect' })
    for (const kind of ['delegate', 'handled', 'withdrawn']) expect(R.nextAction({ category: 'x', nextActionKind: kind })).toEqual({ key: kind, opens: false })
    expect(R.nextAction({ category: 'x', nextActionKind: 'unrated' })).toEqual({ key: 'unrated', opens: true })
    expect(R.nextAction({ category: null, unclassified: true, nextActionKind: 'none' })).toEqual({ key: 'classify', opens: true })
  })
  it('no row is blank: a kind without its words, or one not known, opens the requests', () => {
    expect(R.nextAction({ category: 'x', nextActionKind: 'integration' })).toEqual({ key: 'open', opens: true })
    expect(R.nextAction({ category: 'x', nextActionKind: 'none' })).toEqual({ key: 'open', opens: true })
  })
})

describe('rule 5: what an undo did, by its answer only', () => {
  it('each item by its status: reverted, withdrawn', () => {
    const answer = { reverted: [1], items: [{ feedbackId: 1, status: 'reverted' }, { feedbackId: 2, status: 'withdrawn' }] }
    expect(C.undoOutcome(answer)).toEqual({ reverted: [1], withdrawn: [2] })
  })
  it('an answer of before the rule, items without status: the listed ids reverted', () => {
    expect(C.undoOutcome({ reverted: [5], items: [{ feedbackId: 5, value: 'x' }] })).toEqual({ reverted: [5], withdrawn: [] })
  })
  it('nothing listed, nothing done', () => {
    expect(C.undoOutcome({ reverted: [], items: [] })).toEqual({ reverted: [], withdrawn: [] })
  })
  it('the history marks each as the answer says', () => {
    const h = [{ feedbackId: 1, status: 'applied' }, { feedbackId: 2, status: 'proposed' }, { feedbackId: 3, status: 'proposed' }]
    const next = C.withReverted(h, { reverted: [1], withdrawn: [2] }, 9)
    expect(next.map((x) => x.status)).toEqual(['reverted', 'withdrawn', 'proposed'])
  })
})

describe('rule 5: a proposal still waiting is its author\'s to withdraw', () => {
  const where = { field: 'category', requestId: 7 }
  const mine = (over) => ({ feedbackId: 10, subject: 'request', requestId: 7, field: 'category', signal: 'wrong_value', valueFrom: 'a', valueTo: 'b', status: 'proposed', byMe: true, createdAt: 1, ...over })

  it('the chip offers "withdraw" for the reader\'s own waiting proposal, and says it proposed', () => {
    const s = C.chipState({ value: 'a', model: 'a' }, [mine()], where, 'owner')
    expect(s.kind).toBe('proposed')
    expect(s.ownProposal).toBe(10)
    expect(C.menuEntries('category', s, [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]).map((e) => e.kind)).toContain('withdraw')
  })
  it('a withdrawn proposal says nothing on the chip and offers nothing to withdraw', () => {
    const s = C.chipState({ value: 'a', model: 'a' }, [mine({ status: 'withdrawn', decidedAt: 2 })], where, 'owner')
    expect(s.kind).toBe('model')
    expect(s.ownProposal).toBeNull()
  })
  it('another reader\'s proposal is not this reader\'s to withdraw', () => {
    const s = C.chipState({ value: 'a', model: 'a' }, [mine({ byMe: false })], where, 'admin')
    expect(s.ownProposal).toBeNull()
  })
  it('the reader\'s fact reports still waiting, the newest per fact', () => {
    const h = [
      { feedbackId: 1, field: 'booked', signal: 'fact_wrong', status: 'withdrawn', byMe: true, createdAt: 1, decidedAt: 2 },
      { feedbackId: 2, field: 'booked', signal: 'fact_wrong', status: 'proposed', byMe: true, createdAt: 3 },
      { feedbackId: 3, field: 'transferred', signal: 'fact_wrong', status: 'proposed', byMe: false, createdAt: 3 },
      { feedbackId: 4, field: 'unkept', signal: 'fact_wrong', status: 'closed', byMe: true, createdAt: 3, decidedAt: 4 },
    ]
    expect(C.ownFactReports(h).map((x) => x.feedbackId)).toEqual([2])
  })
})

describe('rule 10: a change against a partial previous window', () => {
  it('is "n.d." with its own reason, whatever the base', () => {
    expect(R.change(90, 2, 500, { partial: true })).toEqual({ available: false, reason: 'partial' })
    expect(R.change(90, 2, 5)).toEqual({ available: false, reason: 'base' })
    expect(R.change(90, 60, 500)).toEqual({ available: true, value: 0.5 })
  })
  it('read from StarChat\'s `previousPartial` only', () => {
    expect(R.previousPartial({ previousPartial: true })).toBe(true)
    expect(R.previousPartial({})).toBe(false)
  })
})

describe('m8: a period not at the zone\'s midnights', () => {
  it('is said by its start and end instants, its length its days', () => {
    // stored 2026-03-19 00:00 UTC to 2026-03-21 00:00 UTC: 01:00 to 01:00 in Rome
    const d = R.inclusiveDays(Date.UTC(2026, 2, 19), Date.UTC(2026, 2, 21), ROME, 'en-US')
    expect(d.exact).toBe(true)
    expect(d.days).toBe(2)
    expect(R.periodLabel(Date.UTC(2026, 2, 19), Date.UTC(2026, 2, 21), ROME, 'en-US')).toMatch(/^Mar 19, 2026(,| at) 1:00 AM – Mar 21, 2026(,| at) 1:00 AM$/)
  })
  it('a period of whole days keeps its dates', () => {
    expect(R.periodLabel(Date.UTC(2026, 8, 30, 22), Date.UTC(2026, 9, 7, 22), ROME, 'en-US')).toBe('Oct 1, 2026 – Oct 7, 2026')
  })
})

describe('rule 9: a next period longer than the cadence', () => {
  it('says its days, or nothing when it is no longer', () => {
    const from = Date.UTC(2026, 9, 27, 23)
    expect(R.longerThanCadence({ from, to: from + 3 * 86400000 }, 1, ROME, 'en-US')).toBe(3)
    expect(R.longerThanCadence({ from, to: from + 86400000 }, 1, ROME, 'en-US')).toBeNull()
  })
  it('a cycle with no calls has its own state', () => {
    expect(R.reportStatusKey({ status: 'no_calls' })).toBe('noCallsCycle')
  })
})

describe('m9: Processing counts calls as Panoramica does', () => {
  it('the sessions not finalised are outside the progress and said apart', () => {
    const job = { kind: 'recompute', status: 'done', estimate: { calls: 14 }, counts: { written: 4, not_finalised: 10 } }
    expect(R.jobProgress(job)).toMatchObject({ processed: 4, total: 4 })
    expect(R.jobResult(job)).toEqual([{ key: 'written', count: 4 }, { key: 'not_finalised', count: 10, apart: true }])
  })
})

describe('m3, m15: a count\'s list and a web caller', () => {
  it('an outcome line fixes its resolution', () => {
    expect(CallInsights.resolutionOfLine('forwarded_incomplete')).toBe('forwarded')
    expect(CallInsights.resolutionOfLine('resolved')).toBe('resolved')
    expect(CallInsights.resolutionOfLine('nope')).toBeNull()
  })
  it('a caller identity string is a web call', () => {
    expect(CallInsights.isWebCaller({ contactNumber: 'uid:abc:me@x.it:Me' })).toBe(true)
    expect(CallInsights.isWebCaller({ contactNumber: '+39 333 000 0001' })).toBe(false)
  })
})

describe('m16: the queue\'s fact sentence, one per fact', () => {
  it('Italian agrees each with its fact', () => {
    const f = itIT.components.callInsights.feedback.queue.factOf
    expect(Object.keys(f).sort()).toEqual([...C.FACT_FIELDS].sort())
    expect(f.booked).toBe('Prenotazione segnalata come sbagliata')
    expect(f.unkept).toBe('Promesse non mantenute segnalate come sbagliate')
  })
})
