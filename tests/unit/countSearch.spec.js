import { describe, it, expect } from 'vitest'
import Classifications from '@/utils/Classifications'

/**
 * Plan docs/execution-plans/2026-10-31-analytics-ux.md, step A1: a count's address read once (`readCountAddress`) and
 * the search body composed from it (`composeSearch`), shared by the conversations page (which composes from its live
 * state) and the counted-calls panel (which composes from the link). The page's own bodies are pinned at the network
 * edge by tests/e2e/insights/count-list-body.spec.js; these pin the two functions and that the panel's body for a link
 * equals the page's first-load body for the same address.
 *
 * Seen failing, 2026-11-01, before the functions existed (readCountAddress, composeSearch and searchQuery undefined).
 */
const BIZ = 'biz-1'
const WINDOW = { from: 1790812800000, to: 1793404799999 }

describe('readCountAddress', () => {
  it('splits a count address into the controls, the window, the other filters and their chips', () => {
    const link = Classifications.countLink(BIZ, WINDOW, 'gap', 'out_of_scope')
    const read = Classifications.readCountAddress({ ...link.query, message: 'incomplete' })
    expect(read.controls).toEqual({ message: 'incomplete' })
    expect(read.window).toEqual({ timestampGte: WINDOW.from, timestampLte: WINDOW.to })
    expect(read.extra).toEqual({ gap: 'out_of_scope' })
    expect(read.counted).toBe(true)
    expect(read.filters.map((f) => f.key)).toEqual(['gap'])
    expect(read.unknown).toEqual([])
  })

  it('reads the unanswered control in body form and names a value outside its closed set', () => {
    const read = Classifications.readCountAddress({ id: BIZ, unanswered: 'true', gap: 'nonsense' })
    expect(read.controls).toEqual({ hasUnanswered: true })
    expect(read.extra).toEqual({})
    expect(read.unknown).toEqual(['gap'])
  })
})

describe('composeSearch', () => {
  it('a counted list keeps archived calls: no view filter, `counted` set, the window, controls and filters', () => {
    expect(Classifications.composeSearch({
      businessId: BIZ, counted: true, viewFilters: { archived: false, deleted: false },
      window: { timestampGte: 1, timestampLte: 2 }, controls: { message: 'incomplete', booked: false }, extra: { gap: 'out_of_scope' },
    })).toEqual({ businessId: BIZ, counted: true, timestampGte: 1, timestampLte: 2, message: 'incomplete', booked: false, gap: 'out_of_scope' })
  })

  it('an inbox list applies its view and sends no `counted`; an absent window bound is not sent', () => {
    expect(Classifications.composeSearch({
      businessId: BIZ, counted: false, viewFilters: { archived: false, deleted: false }, window: { timestampGte: 5 }, controls: {}, extra: {},
    })).toEqual({ businessId: BIZ, archived: false, deleted: false, timestampGte: 5 })
  })

  it('the panel\'s body for each count link equals the page\'s first-load body for the same address', () => {
    const kinds = [
      ['outcomeLine', 'forwarded_complete'], ['resolution', 'caller_left'], ['message', 'incomplete'], ['booked', true],
      ['transferred', true], ['unanswered', true], ['noConversation', 'caller_silent'], ['topic', 'Bookings'],
      ['topicLabels', ['Prices', 'Hours']], ['gap', 'out_of_scope'], ['check', 'caller_repeated'],
      ['requestCategory', { category: 'prices', outcomes: ['taken', 'neither'] }],
    ]
    for (const [kind, key] of kinds) {
      const link = Classifications.countLink(BIZ, WINDOW, kind, key)
      const read = Classifications.readCountAddress(link.query)
      const body = Classifications.composeSearch({ businessId: BIZ, ...read })
      expect(body.businessId, kind).toBe(BIZ)
      expect(body.counted, kind).toBe(true)
      expect(body.timestampGte, kind).toBe(WINDOW.from)
      expect(body.timestampLte, kind).toBe(WINDOW.to)
      expect(body, kind).toEqual({ businessId: BIZ, counted: true, ...Classifications.searchFromQuery(link.query).body })
    }
  })
})

describe('searchQuery', () => {
  it('a report count asks how many calls it leaves out, in the query and never in the body', () => {
    const link = Classifications.countLink(BIZ, WINDOW, 'gap', 'missing_info', { report: true })
    expect(Classifications.searchQuery(link.query)).toBe('&leftOut=true')
    expect(Classifications.searchQuery(Classifications.countLink(BIZ, WINDOW, 'gap', 'missing_info').query)).toBe('')
    expect(Classifications.composeSearch({ businessId: BIZ, ...Classifications.readCountAddress(link.query) })).not.toHaveProperty('leftOut')
  })
})
