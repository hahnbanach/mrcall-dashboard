import { describe, it, expect } from 'vitest'
import {
  rulesOf, hasHours, tableMinutesFor, serviceWindow, defaultTime, stateOf, freeFrom, isFreeAt, seatings, dropTargets,
  stripStatus, countInRanges, knowCounts, matches, genNames, addTables, draftProblems, diffLayout, wizardLayout, zoneIdFor,
  joinRange, callsOf, minFreeLimits, toMin, fmt
} from '@/utils/RestaurantModel'
import { layoutToWire, bookingFromWire, layoutFromWire } from '@/utils/Restaurant'

/** The page's arithmetic: what it draws from the server's answers. What the server decides is not here. */

const DAY = '2026-10-16' // a Friday
const rules = rulesOf({
  dinner: JSON.stringify({ friday: ['19:00-22:00'] }), lunch: '{}', arrivalEveryMinutes: '15',
  tableMinutes2: '90', tableMinutes4: '105', tableMinutes6: '120', tableMinutesLarger: '150', minFreeMinutes: '90'
})
const win = serviceWindow(rules, DAY, 'dinner')

const layout = () => ({
  zones: [{ id: 'sala', name: 'Sala', order: 0, note: '', closures: [] }, { id: 'dehors', name: 'Dehors', order: 1, note: '', closures: [{ from: '2026-11-01', to: '2027-03-31' }] }],
  tables: [
    { id: 1, name: 'T1', zone: 'sala', min: 1, max: 2, active: true },
    { id: 2, name: 'T2', zone: 'sala', min: 1, max: 2, active: true },
    { id: 3, name: 'T3', zone: 'sala', min: 2, max: 4, active: true },
    { id: 4, name: 'D1', zone: 'dehors', min: 1, max: 2, active: true }
  ],
  joins: [{ tables: [1, 2], min: 3, max: 4 }]
})

const booking = (id, time, minutes, tables, extra = {}) => ({
  id, service: 'dinner', start: toMin(time), end: toMin(time) + minutes, party: 2, tables, state: 'booked', ...extra
})

describe('the rules the page draws with', () => {
  it('reads the skill\'s strings and JSON strings, with the manifest\'s defaults', () => {
    expect(rules.step).toBe(15)
    expect(rules.minFreeMinutes).toBe(90)
    expect(rulesOf({}).minFreeMinutes).toBe(90) // the default is the shortest table time
    expect(rulesOf({ tableMinutes2: '75' }).minFreeMinutes).toBe(75)
  })

  it('knows whether the instance has any arrival window: without one the first room cannot be saved', () => {
    expect(hasHours(rules)).toBe(true)
    expect(hasHours(rulesOf({ lunch: '{}', dinner: '{}' }))).toBe(false)
    expect(hasHours(rulesOf({ dinner: '{"monday": []}' }))).toBe(false)
  })

  it('gives a party the table time the server gives it', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 12].map(n => tableMinutesFor(rules, n))).toEqual([90, 90, 105, 105, 120, 120, 150, 150])
  })

  it('draws a service from its first arrival to the last plus the longest table time', () => {
    expect(win).toEqual({ open: toMin('19:00'), last: toMin('22:00'), close: toMin('22:00') + 150, step: 15 })
    expect(serviceWindow(rules, '2026-10-17', 'dinner')).toBeNull()
  })

  it('opens today\'s service on now, rounded to the step, and any other on an hour after the first arrival', () => {
    expect(fmt(defaultTime(win, true, toMin('20:37')))).toBe('20:30')
    expect(fmt(defaultTime(win, false, toMin('20:37')))).toBe('20:00')
    expect(fmt(defaultTime(win, true, toMin('11:00')))).toBe('20:00')
  })

  it('bounds the minimum free time from 1 to the longest table time, as the skill checks it', () => {
    expect(minFreeLimits(rules)).toEqual({ min: 1, max: 150 })
  })
})

describe('a booking on the page', () => {
  it('shows one state, keeping the evening apart from the lifecycle as the server does', () => {
    expect(stateOf({ status: 'confirmed', serviceState: null })).toBe('booked')
    expect(stateOf({ status: 'confirmed', serviceState: 'seated' })).toBe('seated')
    expect(stateOf({ status: 'no_show' })).toBe('noshow')
    expect(stateOf({ status: 'cancelled', serviceState: 'arrived' })).toBe('cancelled')
    expect(stateOf({ status: 'confirmed', source: 'block' })).toBe('block')
    expect(stateOf({ status: 'requested' })).toBe('requested')
  })

  it('lists the calls that touched it newest first, ending with the one that made it', () => {
    expect(callsOf({ conversationId: 'A', callIds: ['A', 'B', 'C'] })).toEqual(['C', 'B', 'A'])
    expect(callsOf({ conversationId: 'A', callIds: [] })).toEqual(['A'])
    expect(callsOf({ conversationId: null, callIds: [] })).toEqual([])
  })

  it('reads a row of the day read, with call_ids as R4 may spell it', () => {
    const b = bookingFromWire({ id: 'r', version: 2, time: '20:15', minutes: 105, covers: 4, status: 'confirmed', serviceState: 'arrived',
      source: 'assistant', tableIds: [3], conversationId: 'A', call_ids: ['A', 'B'] })
    expect(b).toMatchObject({ start: toMin('20:15'), end: toMin('22:00'), party: 4, tables: [3], state: 'arrived', callIds: ['A', 'B'] })
  })
})

// Seen failing on 2026-10-11: with the minimum ignored (a booking blocks only if it starts within a minute)
// the first and the third case fail; without the cut at the end of the service, the fourth.
describe('a free table, for the minimum free time', () => {
  // The brief's case: minFreeMinutes 90 and a table free 19:45-20:00 before a booking is not free at 19:45.
  it('is not free at a time from which it stays free for less than the minimum', () => {
    const list = [booking('a', '20:00', 90, [1])]
    expect(isFreeAt(list, 'dinner', 1, toMin('19:45'), 90, win)).toBe(false)
    expect(fmt(freeFrom(list, 'dinner', 1, toMin('19:45'), 90, win))).toBe('21:30')
    expect(isFreeAt(list, 'dinner', 2, toMin('19:45'), 90, win)).toBe(true)
  })

  it('counts a shorter minimum: 15 minutes free before a booking is enough for 15', () => {
    const list = [booking('a', '20:00', 90, [1])]
    expect(isFreeAt(list, 'dinner', 1, toMin('19:45'), 15, win)).toBe(true)
  })

  it('is never free again when it frees after the last arrival', () => {
    const list = [booking('a', '20:30', 150, [1])]
    expect(freeFrom(list, 'dinner', 1, toMin('20:15'), 90, win)).toBeNull()
  })

  it('ends a free window at the end of the service too', () => {
    expect(isFreeAt([], 'dinner', 1, win.close - 30, 90, win)).toBe(false)
  })

  it('frees a table at the minute a party left, and holds the tables a block closes', () => {
    const left = [booking('a', '19:00', 50, [1], { state: 'left' })]
    expect(isFreeAt(left, 'dinner', 1, toMin('19:50'), 90, win)).toBe(true)
    const block = [booking('b', '19:00', 180, [], { state: 'block', blockTableIds: [2] })]
    expect(isFreeAt(block, 'dinner', 2, toMin('20:00'), 90, win)).toBe(false)
    const cancelled = [booking('c', '20:00', 90, [3], { state: 'cancelled' })]
    expect(isFreeAt(cancelled, 'dinner', 3, toMin('20:00'), 90, win)).toBe(true)
  })
})

describe('the seatings the page draws with', () => {
  it('ranks as the server: a single table first, the fewest seats, the fewest other joins, the ids', () => {
    expect(seatings(layout(), DAY).map(s => s.ids.join('+'))).toEqual(['4', '1', '2', '3', '1+2'])
  })

  it('leaves out a zone closed on the day and a join with a table switched off', () => {
    const L = layout()
    L.tables[1].active = false
    expect(seatings(L, '2026-12-01').map(s => s.ids.join('+'))).toEqual(['1', '3'])
  })

  it('offers a dragged party the seatings with the dropped table that hold it and are free over its interval', () => {
    const list = [booking('move', '20:00', 105, [3], { party: 4 }), booking('other', '20:30', 90, [2])]
    const b = list[0]
    expect(dropTargets(layout(), DAY, list, b, 1)).toEqual([]) // T1+T2 holds 4, but T2 is taken at 20:30
    expect(dropTargets(layout(), DAY, [b], b, 1).map(s => s.ids)).toEqual([[1, 2]])
  })
})

describe('the period strip', () => {
  it('colours a service from the server\'s period read', () => {
    const sum = (largestParty, two) => ({ open: true, largestParty, bookable: { 2: two } })
    expect(stripStatus({ open: false }, { arrivals: 13, step: 15 })).toBe('closed')
    expect(stripStatus(sum(6, ['19:00-22:00']), { past: true, arrivals: 13, step: 15 })).toBe('past')
    expect(stripStatus(sum(0, []), { arrivals: 13, step: 15 })).toBe('full')
    expect(stripStatus(sum(2, ['19:00-22:00']), { arrivals: 13, step: 15 })).toBe('limited')
    expect(stripStatus(sum(6, ['19:00', '21:30-21:45']), { arrivals: 13, step: 15 })).toBe('limited')
    expect(stripStatus(sum(6, ['19:00-22:00']), { arrivals: 13, step: 15 })).toBe('free')
  })

  it('counts the times in the server\'s ranges', () => {
    expect(countInRanges(['19:00-20:00', '21:30'], 15)).toBe(6)
  })
})

describe('"Da sapere" and the search', () => {
  it('names the guests with allergies, the large parties and the past no-shows, by time', () => {
    const list = [booking('b', '21:00', 90, [1], { allergies: 'nuts' }), booking('a', '20:00', 120, [3], { party: 7 }),
      booking('c', '19:00', 90, [2], { pastNoShows: 1 }), booking('x', '19:00', 90, [2], { allergies: 'x', state: 'cancelled' })]
    const k = knowCounts(list, 'dinner')
    expect(k.allergies.map(b => b.id)).toEqual(['b'])
    expect(k.groups.map(b => b.id)).toEqual(['a'])
    expect(k.noshows.map(b => b.id)).toEqual(['c'])
  })

  it('matches a name, or the digits of a phone however it is spaced', () => {
    expect(matches({ name: 'De Luca', phone: '' }, 'luc')).toBe(true)
    expect(matches({ name: 'X', phone: '393331112233' }, '333 111')).toBe(true)
    expect(matches({ name: 'X', phone: '393331112233' }, 'x')).toBe(false)
  })
})

describe('the layout editor\'s draft', () => {
  it('names new tables on from the zone\'s highest number, and a new zone from its name', () => {
    const L = layout()
    expect(genNames(L, 'sala', 2)).toEqual(['T4', 'T5'])
    expect(genNames(L, 'dehors', 1)).toEqual(['D2'])
    L.zones.push({ id: 'saletta', name: 'Saletta', order: 2, note: '', closures: [] })
    expect(genNames(L, 'saletta', 2)).toEqual(['S1', 'S2'])
  })

  it('gives a generated table a draft id the server replaces, and a party range from its size', () => {
    const L = layout()
    addTables(L, 'sala', 2, 4)
    expect(L.tables.slice(-2)).toEqual([
      { id: -1, zone: 'sala', name: 'T4', min: 2, max: 4, active: true },
      { id: -2, zone: 'sala', name: 'T5', min: 2, max: 4, active: true }])
  })

  it('sends new tables without an id and names them in joins (R4), keeping the ids the server gave', () => {
    const L = layout()
    addTables(L, 'sala', 2, 4)
    L.joins.push({ tables: [-1, -2], min: 5, max: 8 })
    L.joins.push({ tables: [3, -1], min: 5, max: 8 })
    const w = layoutToWire(L)
    expect(w.tables.slice(-2)).toEqual([{ name: 'T4', zone: 'sala', min: 2, max: 4, active: true }, { name: 'T5', zone: 'sala', min: 2, max: 4, active: true }])
    expect(w.tables[0]).toEqual({ id: 1, name: 'T1', zone: 'sala', min: 1, max: 2, active: true })
    expect(w.joins.slice(-2)).toEqual([{ tables: ['T4', 'T5'], min: 5, max: 8 }, { tables: [3, 'T4'], min: 5, max: 8 }])
    expect(w.zones.map(z => z.order)).toEqual([0, 1])
    expect(w.nextTableId).toBeUndefined()
  })

  it('reads a layout and its revision back', () => {
    const L = layoutFromWire({ revision: 4, nextTableId: 9, ...layout() })
    expect(L.revision).toBe(4)
    expect(L.tables).toHaveLength(4)
  })

  it('says each problem a form can see, on the field it is about', () => {
    const L = layout()
    L.tables[1].name = 't1'
    L.tables[2].max = 1
    L.joins.push({ tables: [1, 4], min: 3, max: 4 })
    L.joins.push({ tables: [2, 1], min: 3, max: 4 })
    const codes = draftProblems(L).map(p => `${p.ref}:${p.code}`)
    expect(codes).toEqual(['t-2-name:tableNameDuplicate', 't-3-max:tableMax', 'j-1:joinZones', 'j-2:joinDuplicate'])
    expect(draftProblems(layout())).toEqual([])
  })

  it('lists every pending change, and none for the same room', () => {
    const A = layout()
    const B = layout()
    B.zones[0].name = 'Sala grande'
    B.tables[2].max = 6
    B.tables.splice(3, 1)
    addTables(B, 'sala', 1, 2)
    B.joins = []
    expect(diffLayout(A, B).map(c => c.code)).toEqual(['zoneRenamed', 'tablesAdded', 'tableSeats', 'tableRemoved', 'joinRemoved'])
    expect(diffLayout(A, layout())).toEqual([])
  })

  it('gives a new join one more than its largest table, up to all its seats', () => {
    expect(joinRange([{ max: 2 }, { max: 4 }])).toEqual({ min: 5, max: 6 })
  })

  it('makes a zone id the server accepts, unique, from any name', () => {
    expect(zoneIdFor('Sala Grande', [])).toBe('sala-grande')
    expect(zoneIdFor('Dehors', ['dehors'])).toBe('dehors-2')
    expect(zoneIdFor('Città!', [])).toBe('citta')
    expect(zoneIdFor('', [])).toBe('zona')
  })
})

describe('the first-run wizard', () => {
  it('builds the room of its answers: zones in order, tables named per zone, pairs of one size joined', () => {
    const L = wizardLayout({ zones: ['Sala', 'Dehors'], rows: { Sala: [{ n: 3, size: 2 }, { n: 2, size: 4 }], Dehors: [{ n: 2, size: 2 }] }, pairs: { Sala: true } })
    expect(L.zones.map(z => [z.id, z.order])).toEqual([['sala', 0], ['dehors', 1]])
    expect(L.tables.map(t => t.name)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'D1', 'D2'])
    expect(L.tables.every(t => t.id < 0)).toBe(true)
    expect(layoutToWire(L).joins).toEqual([{ tables: ['T1', 'T2'], min: 3, max: 4 }, { tables: ['T4', 'T5'], min: 5, max: 8 }])
  })
})
