import { describe, it, expect, vi } from 'vitest'
import {
  configurableFields, visibleTo, pageFieldsOf, pageSwitchOf, isPageOn, pageSwitchWrites
} from '@/components/widgets/skills/manifestFields'
import { pageOf } from '@/components/widgets/skills/skillPages'
import agentSkills from '@/utils/AgentSkills'
import { missingFieldsOf, OVERRIDABLE } from '@/components/widgets/restaurant/format'

vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
const axios = (await import('axios')).default
const Restaurant = await import('@/utils/Restaurant')
const RestaurantApi = Restaurant.default
const { PAGE_FIELDS, PAGE_EDITS, pageOffIn, isPageOff, allergiesSettingOf, layoutToWire, layoutFromWire, bookingFromWire } = Restaurant
const { fieldRulesOf, missingRequired, closuresOf, withClosures, sameClosures, onClosedDay, changeOf, joinNotes } = await import('@/utils/RestaurantModel')

/**
 * One editor per field (brief, addendum 2026-10-12 (2)): what the restaurant page writes, what the skill form draws,
 * and the coupled page/assistant switch.
 *
 * MANIFEST is the restaurant_booking manifest's configuration as StarChat's catalogue carries it (key, and
 * `x-audience` as `audience`), in its order, read from StarChat 9.34 at cd286bfab
 * (decision-tables/decisiontables/Agents/skill_restaurant_booking.manifest.json, last changed at a5ac170a0). It is a
 * copy: when the manifest moves a field to or from the page, this list moves with it, and criterion 1 below is the
 * test that says whether the page and the form still agree.
 *
 * Seen failing first (2026-10-13), one perturbation at a time, each failing the test named: `visibleTo` letting
 * `audience: page` through (criterion 1 and the admin test); `tableMinutes2` dropped from PAGE_FIELDS (criterion 1:
 * a page field with no editor); `pageSwitchWrites(false)` writing only the page (the coupled write); `saveInstance`
 * not checking its keys (the refusal test); OVERRIDABLE with `closed` again (staff override a taken table only);
 * `layoutToWire` without `exceptions` (the room save keeping them); every closure written as an exception (one
 * list); `missingRequired` ignoring the rules; `describeDiagnostics` ignoring `say`.
 */
const AUDIENCE = [['page', null], ['SKILL_CALENDAR_AUTH', null], ['calendarId', null], ['closureKeyword', null], ['operations', null],
  ['phoneChanges', null], ['maxBookingsPerService', null], ['unverifiedCallers', null], ['lunch', 'page'], ['dinner', 'page'],
  ['arrivalEveryMinutes', 'page'], ['coversPerArrival', 'page'], ['smallPartyPolicy', null], ['relaxMinutes', null], ['assistantShare', null],
  ['tableMinutes2', 'page'], ['tableMinutes4', 'page'], ['tableMinutes6', 'page'], ['tableMinutesLarger', 'page'], ['minFreeMinutes', 'page'],
  ['maxPartySize', null], ['noticeMinutes', null], ['sameDayUntil', null], ['daysAhead', null], ['horizonDays', 'page'], ['walkInMinutes', 'page'],
  ['requiredFields', 'page'], ['specialDays', 'page'], ['layout', 'page'], ['largePartyInstruction', null], ['alternatives', null],
  ['requireConfirmation', null], ['trigger', null], ['message', null], ['promptSuccess', null], ['promptFailure', null], ['variables', 'page']]

const SKILL = {
  name: 'skill_restaurant_booking',
  configSchema: {
    fields: [{ key: 'enabled', type: 'boolean' }, { key: 'label', type: 'string' }].concat(AUDIENCE.map(([key, audience]) => Object.assign(
      { key, type: key === 'page' ? 'boolean' : 'string', widget: key === 'page' ? 'boolean' : 'text', labels: { en: { label: key } } },
      key === 'page' ? { default: 'true' } : {}, audience ? { audience } : {})))
  }
}

describe('one editor per field: the page and the skill form (criterion 1)', () => {
  it('every setting the page writes is marked for the page in the manifest, and the form draws none of them, for anybody', () => {
    const pageKeys = AUDIENCE.filter(([, a]) => a === 'page').map(([k]) => k)
    PAGE_EDITS.forEach(k => expect(pageKeys).toContain(k))
    // and every field marked for the page has its editor there, but the two retired ones nobody draws any more
    // (the `specialDays` text, kept one release for a rollback image; `variables`)
    const RETIRED = ['specialDays', 'variables']
    pageKeys.forEach(k => expect(PAGE_EDITS.concat(RETIRED)).toContain(k))
    const entry = { params: { enabled: 'true' } }
    for (const viewer of [{ admin: false }, { admin: true }]) {
      const drawn = configurableFields(SKILL, entry, 'during', viewer).map(f => f.key)
      PAGE_EDITS.forEach(k => expect(drawn).not.toContain(k))
      pageKeys.forEach(k => expect(drawn).not.toContain(k))
    }
    // what the form does draw: the assistant's policy, the calendar connection and its closure word
    const drawn = configurableFields(SKILL, entry, 'during', { admin: false }).map(f => f.key)
    ;['maxPartySize', 'daysAhead', 'phoneChanges', 'unverifiedCallers', 'closureKeyword', 'calendarId', 'trigger'].forEach(k => expect(drawn).toContain(k))
  })

  it('a field for the page is hidden from an admin too, unlike a platform field', () => {
    expect(visibleTo({ audience: 'page' }, { admin: true })).toBe(false)
    expect(visibleTo({ audience: 'platform' }, { admin: true })).toBe(true)
    expect(visibleTo({ audience: 'platform' }, { admin: false })).toBe(false)
    expect(visibleTo({}, { admin: false })).toBe(true)
  })

  it('the form names the page\'s fields with the way there, and only those the page edits', () => {
    const page = pageOf('skill_restaurant_booking')
    expect(page.section).toBe('__RESTAURANT_BOOKING__')
    const named = pageFieldsOf(SKILL).filter(f => page.edits.includes(f.key)).map(f => f.key)
    expect(named).toContain('requiredFields')
    expect(named).toContain('layout')
    // retired, drawn by nobody: not named either
    expect(named).not.toContain('specialDays')
    expect(named).not.toContain('variables')
    expect(pageOf('calendar_availability')).toBeNull()
  })

  it('the page refuses to write a setting it does not own, before anything is sent', async () => {
    axios.put.mockClear()
    const instance = { phase: 'during', skill: 'skill_restaurant_booking', instanceId: 'r1', params: {}, revision: 'rev-1' }
    await expect(RestaurantApi.saveInstance({ accessToken: 't' }, 'b1', instance, { maxPartySize: '6' })).rejects.toThrow('maxPartySize')
    await expect(RestaurantApi.saveInstance({ accessToken: 't' }, 'b1', instance, { enabled: 'false' })).rejects.toThrow('enabled')
    expect(axios.put).not.toHaveBeenCalled()
    axios.put.mockResolvedValueOnce({ data: { saved: true, diagnostics: [] } })
    await RestaurantApi.saveInstance({ accessToken: 't' }, 'b1', instance, { horizonDays: '200', requiredFields: '{"phone":"optional"}' })
    expect(axios.put.mock.calls[0][1].params).toMatchObject({ horizonDays: '200', requiredFields: '{"phone":"optional"}' })
    expect(PAGE_FIELDS).not.toContain('layout')
  })
})

describe('the page switch and the assistant switch', () => {
  it('turning the page off turns the assistant off in the same edit; on, only the page', () => {
    expect(pageSwitchWrites(false)).toEqual([{ key: 'page', value: 'false' }, { key: 'enabled', value: 'false' }])
    expect(pageSwitchWrites(true)).toEqual([{ key: 'page', value: 'true' }])
  })

  it('is the manifest\'s `page` boolean; unset is its default, on', () => {
    expect(pageSwitchOf(SKILL).key).toBe('page')
    expect(isPageOn(SKILL, { params: {} })).toBe(true)
    expect(isPageOn(SKILL, { params: { page: 'false' } })).toBe(false)
    expect(isPageOn(SKILL, { params: { page: false } })).toBe(false)
    expect(pageSwitchOf({ configSchema: { fields: [{ key: 'enabled', type: 'boolean' }] } })).toBeNull()
    expect(isPageOn({ configSchema: { fields: [] } }, { params: {} })).toBe(true)
  })

  it('the page reads its own switch from the instance, and the server\'s answer when the page is off', () => {
    expect(pageOffIn({ page: 'false' }, null)).toBe(true)
    expect(pageOffIn({}, null)).toBe(false)
    expect(pageOffIn({}, { page: { default: 'false' } })).toBe(true)
    const off = { restaurant: { status: 409, code: 'not_configured', body: { diagnostics: [{ path: '/page', code: 'not_configured' }] } } }
    const noSkill = { restaurant: { status: 409, code: 'not_configured', body: { diagnostics: [{ path: '/skill', code: 'not_configured' }] } } }
    expect(isPageOff(off)).toBe(true)
    expect(isPageOff(noSkill)).toBe(false)
  })

  it('a refusal of the skill save is said in the person\'s words when the screen knows its code', () => {
    const diagnostics = [{ severity: 'error', path: '/enabled', code: 'assistant_without_page', detail: 'server English' },
      { severity: 'error', path: '/x', code: 'other', detail: 'twice' }]
    const said = agentSkills.describeDiagnostics(diagnostics, d => (d.code === 'assistant_without_page' ? 'Switch the assistant off' : null))
    expect(said).toBe('Switch the assistant off; /x: twice')
  })
})

describe('what every booking must carry', () => {
  const MANIFEST = { requiredFields: { default: '{"name":"required","phone":"required","allergies":"optional","notes":"optional","zone":"optional"}' } }

  it('reads each field\'s rule, the stored one first, the manifest\'s default for the rest', () => {
    expect(fieldRulesOf({}, MANIFEST)).toEqual({ name: 'required', phone: 'required', allergies: 'optional', notes: 'optional', zone: 'optional' })
    expect(fieldRulesOf({ requiredFields: '{"phone":"not_asked","notes":"required"}' }, MANIFEST))
      .toEqual({ name: 'required', phone: 'not_asked', allergies: 'optional', notes: 'required', zone: 'optional' })
    expect(fieldRulesOf({ requiredFields: { zone: 'required' } }, MANIFEST).zone).toBe('required')
  })

  it('names the required fields a booking lacks, and only those', () => {
    const rules = { name: 'required', phone: 'not_asked', allergies: 'optional', notes: 'required', zone: 'optional' }
    expect(missingRequired(rules, { name: ' ', phone: '', notes: '' })).toEqual(['name', 'notes'])
    expect(missingRequired(rules, { name: 'Rossi', notes: 'window' })).toEqual([])
    expect(missingRequired(rules, { name: '' }, ['phone'])).toEqual([])
  })

  it('a missing-fields refusal names its fields from the server\'s values', () => {
    const e = { restaurant: { code: 'missing_fields', body: { diagnostics: [{ code: 'missing_fields', values: { fields: ['name', 'phone'] } }] } } }
    expect(missingFieldsOf(e)).toEqual(['name', 'phone'])
    expect(missingFieldsOf({ restaurant: { code: 'full', body: { diagnostics: [{ code: 'full' }] } } })).toEqual([])
  })

  it('staff override a taken table only: a closed day, the horizon or a closed zone are never booked anyway', () => {
    expect(OVERRIDABLE).toEqual(['full'])
  })

  it('the allergies setting is read through its one adapter; without it, required is not available', () => {
    expect(allergiesSettingOf({})).toBeNull()
    expect(allergiesSettingOf({ restaurant: { allergies: { stored: 'required', effective: 'optional', requiredAvailable: false } } }))
      .toEqual({ stored: 'required', effective: 'optional', requiredAvailable: false })
    expect(allergiesSettingOf({ restaurant: { allergies: { stored: 'optional' } } })).toBeNull()
  })
})

describe('one list of closures', () => {
  const layout = layoutFromWire({
    revision: 4,
    zones: [{ id: 'sala', name: 'Sala', closures: [{ from: '2026-12-24', to: '2026-12-26' }] }, { id: 'dehors', name: 'Dehors', closures: [] }],
    tables: [], joins: [],
    exceptions: [{ from: '2026-12-31', service: 'dinner' }, { from: '2026-08-10', service: 'dinner', windows: ['19:30-21:30'] },
      { from: '2026-11-01', zone: 'dehors', service: 'lunch' }]
  })

  it('reads a zone\'s own closures and the exceptions into one list, and writes each back where the server reads it', () => {
    const rows = closuresOf(layout)
    expect(rows.map(r => r.from)).toEqual(['2026-08-10', '2026-11-01', '2026-12-24', '2026-12-31'])
    const added = rows.concat([{ from: '2027-01-07', to: '2027-01-07', service: null, zone: 'dehors', windows: [] },
      { from: '2027-02-01', to: '2027-02-02', service: null, zone: null, windows: [] }])
    const out = withClosures(layout, added)
    expect(out.zones.find(z => z.id === 'dehors').closures).toEqual([{ from: '2027-01-07', to: '2027-01-07' }])
    expect(out.zones.find(z => z.id === 'sala').closures).toEqual([{ from: '2026-12-24', to: '2026-12-26' }])
    expect(out.exceptions).toContainEqual({ from: '2027-02-01', to: '2027-02-02', service: null, zone: null, windows: [] })
    expect(out.exceptions).toContainEqual({ from: '2026-11-01', to: '2026-11-01', service: 'lunch', zone: 'dehors', windows: [] })
    expect(sameClosures(closuresOf(out), added)).toBe(true)
    expect(sameClosures(closuresOf(out), rows)).toBe(false)
  })

  it('a save of the room keeps the exceptions: the layout on the wire carries them', () => {
    const wire = layoutToWire(layout)
    expect(wire.exceptions).toContainEqual({ from: '2026-08-10', to: '2026-08-10', service: 'dinner', windows: ['19:30-21:30'] })
    expect(wire.exceptions).toContainEqual({ from: '2026-12-31', to: '2026-12-31', service: 'dinner' })
  })

  it('tells which bookings fall under the day\'s closures, from either source', () => {
    const b = { zone: 'sala', service: 'dinner' }
    expect(onClosedDay(b, [{ service: 'dinner', zone: null, source: 'calendar' }], [])).toBe(true)
    expect(onClosedDay(b, [{ service: 'lunch', zone: null }], [])).toBe(false)
    expect(onClosedDay(b, [{ service: null, zone: 'dehors' }], [])).toBe(false)
    expect(onClosedDay(b, [], ['sala'])).toBe(true)
  })
})

// The kind is the book's (StarChat 9.34 at 7bf981c51, `change.kind`): the page reads it and pre-fills from `change`.
// Seen failing first, 2026-10-13, one fault at a time: the kind ignored and the old rule kept (a "move" at a later
// time inside the booking pre-filled as a late arrival: the move test); `eta` not read (the late test); the asked
// name dropped (the details test); `change` or `openRequest` not read from the wire (the wire test).
describe('what a call-back request asks of its booking', () => {
  const booking = { date: '2026-10-20', start: 1200, end: 1290, party: 2, zone: 'sala', name: 'Verdi', allergies: '', notes: 'Window' }

  it('a late arrival keeps the table at the time announced; the book notes it, the page adds nothing', () => {
    const c = changeOf(booking, { change: { kind: 'late_arrival', date: '2026-10-20', start: 1200, party: 2, eta: 1230 } })
    expect(c).toEqual({ kind: 'late_arrival', details: {}, move: null, late: 1230 })
  })

  // As StarChat's joinNotes: trimmed, split into segments, each added once. Seen failing on 2026-10-14 with the asked
  // notes compared as one untrimmed string ("Cake · Cake · Dog").
  it('joins notes segment by segment, trimmed, as the book does', () => {
    expect(joinNotes('Cake', ' Cake · Dog ')).toBe('Cake · Dog')
    expect(joinNotes(' Window seat ', 'Window · Window')).toBe('Window seat · Window')
    expect(joinNotes('hotdog stand', 'dog')).toBe('hotdog stand · dog')
    expect(joinNotes('', '  ')).toBe('')
    expect(joinNotes(null, 'A · B')).toBe('A · B')
  })

  // Seen failing on 2026-10-14 with the plain join: "Window · Window".
  it('adds the caller\'s notes as the book does: once, compared by whole " · " segments', () => {
    expect(changeOf(booking, { change: { kind: 'details', notes: 'Window' } }).details.notes).toBeUndefined()
    expect(changeOf({ ...booking, notes: 'Window seat · Cake' }, { change: { kind: 'details', notes: 'Window' } }).details.notes).toBe('Window seat · Cake · Window')
  })

  it('a move is what the book says is a move, whatever the page would have guessed', () => {
    const c = changeOf(booking, { change: { kind: 'move', date: '2026-10-20', start: 1245, party: 2, zone: 'dehors' } })
    expect(c.move).toEqual({ date: '2026-10-20', start: 1245, party: 2, zone: 'dehors' })
    expect(c.late).toBeNull()
  })

  it('details carry the asked name, allergies and words; a cancellation pre-fills nothing; no change, nothing', () => {
    const c = changeOf(booking, { change: { kind: 'details', name: 'Verdi Neri', allergies: 'Celiac', notes: 'Celiac, two' } })
    expect(c).toEqual({ kind: 'details', details: { name: 'Verdi Neri', allergies: 'Celiac', notes: 'Window · Celiac, two' }, move: null, late: null })
    expect(changeOf(booking, { change: { kind: 'cancellation' } })).toEqual({ kind: 'cancellation', details: {}, move: null, late: null })
    expect(changeOf(booking, {})).toEqual({ kind: null, details: {}, move: null, late: null })
  })

  it('reads StarChat\'s request row: the change, the booking it is about wherever it is, the recognised number', () => {
    const row = bookingFromWire({ id: 'r1', time: '21:30', covers: 3, status: 'requested', about: 'b1', recognised: true,
      aboutReservation: { id: 'b1', date: '2026-10-21', time: '20:00', covers: 2, name: 'Verdi' },
      change: { kind: 'move', date: '2026-10-21', time: '21:30', covers: 3, zone: 'sala', name: 'Verdi', eta: '21:45' } })
    expect(row.change).toEqual({ kind: 'move', date: '2026-10-21', start: 1290, party: 3, zone: 'sala', name: 'Verdi', eta: 1305 })
    expect(row.aboutReservation).toEqual({ id: 'b1', date: '2026-10-21', start: 1200, party: 2, name: 'Verdi' })
    expect(row.recognised).toBe(true)
    expect(bookingFromWire({ id: 'b2', time: '20:00', covers: 2 })).toMatchObject({ recognised: false, change: null, aboutReservation: null, openRequest: null })
    expect(bookingFromWire({ id: 'b3', time: '20:00', covers: 2, openRequest: { id: 'r9', version: 4, date: '2026-10-22', kind: 'move',
      at: '2026-10-13T17:55:00Z', change: { kind: 'move', date: '2026-10-22', time: '21:00', covers: 3 } } }).openRequest)
      .toEqual({ id: 'r9', version: 4, date: '2026-10-22', kind: 'move', at: '2026-10-13T17:55:00Z', change: { kind: 'move', date: '2026-10-22', start: 1260, party: 3 } })
  })
})
