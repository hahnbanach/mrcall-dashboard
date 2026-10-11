// @ts-check
const { mockBusiness } = require('./mock-data')

/**
 * A StarChat restaurant book in memory, for the restaurant page's browser tests: the routes the page calls,
 * answering in the shapes StarChat answers (ApiDomainRestaurantResource) and, where milestone R4 is still
 * being built, in the shapes its brief states: tables without an id get one from the server, a join may name
 * a table by name, bookings carry `callIds`, the skill read carries the store-backed `layout` section and
 * `minFreeMinutes`, and the finder is GET /seatings.
 *
 * It is stateful on purpose: a write changes what the next read returns, so a test sees the page redraw
 * from the server's answer and not from what it sent. Every write is recorded in `calls`.
 *
 * The finder here is NOT the server's decision function: it seats a party at the first free declared
 * seating, which is all a test of the page needs (the page shows whatever the server answers).
 */

const pad = n => String(n).padStart(2, '0')
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() + n); return keyOf(x) }
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmt = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

const TODAY = keyOf(new Date())
const TOMORROW = addDays(TODAY, 1)
const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const annotations = [{ collection: { id: '__BUSINESS_DATA__', humanName: 'Business data', description: '' }, variables: [] }]

/** The trattoria of the brief: a dining room of six tables, a terrace of two, T1 and T2 joinable. */
function trattoria () {
  return {
    revision: 3,
    nextTableId: 9,
    zones: [
      { id: 'sala', name: 'Dining room', order: 0, note: 'Inside, the quiet one', closures: [] },
      { id: 'dehors', name: 'Terrace', order: 1, note: 'Outdoors, heated', closures: [] }
    ],
    tables: [
      { id: 1, name: 'T1', zone: 'sala', min: 1, max: 2, active: true },
      { id: 2, name: 'T2', zone: 'sala', min: 1, max: 2, active: true },
      { id: 3, name: 'T3', zone: 'sala', min: 1, max: 2, active: true },
      { id: 4, name: 'T4', zone: 'sala', min: 2, max: 4, active: true },
      { id: 5, name: 'T5', zone: 'sala', min: 2, max: 4, active: true },
      { id: 6, name: 'T6', zone: 'sala', min: 4, max: 6, active: true },
      { id: 7, name: 'D1', zone: 'dehors', min: 1, max: 2, active: true },
      { id: 8, name: 'D2', zone: 'dehors', min: 1, max: 2, active: true }
    ],
    joins: [{ tables: [1, 2], min: 3, max: 4 }]
  }
}

/** Tomorrow's dinner: what each test starts from. The minimum free time is 90 minutes, so T3, free from
 *  20:00 until a booking at 20:30, is NOT free at 20:00 (the brief's case, shifted to the page's 20:00). */
function tomorrowsDinner () {
  const r = (id, time, covers, name, tables, extra = {}) => Object.assign({
    id, version: 1, date: TOMORROW, time, minutes: covers <= 2 ? 90 : covers <= 4 ? 105 : 120, covers, zone: tables.length && tables[0] >= 7 ? 'dehors' : 'sala',
    service: 'dinner', status: 'confirmed', source: 'assistant', name, phone: '393331112233', overbooked: false,
    tableIds: tables, pinned: false, conversationId: null, callIds: []
  }, extra)
  return [
    r('b-rossi', '20:00', 4, 'Rossi', [4], { conversationId: 'CON-made', callIds: ['CON-made', 'CON-moved'], allergies: 'Celiac (1 person)' }),
    r('b-verdi', '20:30', 2, 'Verdi', [3], { source: 'staff', phone: '' }),
    r('b-bianchi', '19:30', 6, 'Bianchi', [6], { notes: 'Birthday cake at 22:00' }),
    r('b-gallo', '21:00', 2, 'Gallo', [7], { source: 'walk_in', name: null, phone: null }),
    r('b-req', '21:30', 9, 'Galli', [], { status: 'requested', requestReason: 'large_party', conversationId: 'CON-req', callIds: ['CON-req'] }),
    // three weeks ahead, on a day no test opens: the page does not know of it, the server does
    r('b-far', '20:00', 3, 'Moretti', [5], { date: addDays(TODAY, 20) })
  ]
}

const conversations = {
  'CON-made': { id: 'CON-made', businessId: mockBusiness.businessId, startTimestamp: Date.now() - 86400000, contactNumber: '+393331112233',
    data: { conversation_transcription: [{ alias: 'Assistant', speaker_type: 'agent', content: 'Good evening, how can I help?' },
      { alias: 'Caller', speaker_type: 'user', content: 'A table for four tomorrow at eight.' }] },
    details: { callerName: 'Rossi', summary: 'Booked a table for 4 tomorrow at 20:00.', fields: [] } },
  'CON-moved': { id: 'CON-moved', businessId: mockBusiness.businessId, startTimestamp: Date.now() - 3600000, contactNumber: '+393331112233',
    data: { conversation_transcription: [{ alias: 'Caller', speaker_type: 'user', content: 'Can we come a bit later?' }] },
    details: { callerName: 'Rossi', summary: 'Asked to move the booking: kept at 20:00.', fields: [] } },
  'CON-req': { id: 'CON-req', businessId: mockBusiness.businessId, startTimestamp: Date.now() - 7200000, contactNumber: '+393330000000',
    data: { conversation_transcription: [] }, details: { callerName: 'Galli', summary: 'A party of nine.', fields: [] } }
}

const hours = JSON.stringify(Object.fromEntries(WEEK.map(d => [d, ['19:00-22:00']])))
const lunch = JSON.stringify(Object.fromEntries(WEEK.map(d => [d, ['12:00-14:00']])))

/**
 * Installs the book on `page`. Options:
 *   layout: false for a restaurant without tables (the wizard); hours: false for an instance with no hours;
 *   seatings: false for a server without the finder route; restaurant: false for a server without the routes;
 *   refuseBook: the code the first POST /reservations is refused with; refuseLayout: answer layout saves 422.
 */
async function mockRestaurant (page, opts = {}) {
  const calls = []
  const state = {
    layout: opts.layout === false ? null : trattoria(),
    rows: tomorrowsDinner(),
    revision: 'rev-1',
    params: { enabled: 'true', dinner: opts.hours === false ? '{}' : hours, lunch: opts.hours === false ? '{}' : lunch,
      arrivalEveryMinutes: '15', tableMinutes2: '90', tableMinutes4: '105', tableMinutes6: '120', tableMinutesLarger: '150',
      minFreeMinutes: '90', daysAhead: '60' },
    refuseBook: opts.refuseBook || null,
    nextId: 1
  }
  const entry = () => ({ skill: 'skill_restaurant_booking', instanceId: 'restaurant_booking_1',
    params: Object.assign({}, state.params, state.layout ? { layout: Object.assign({ revision: state.layout.revision }, layoutDoc()) } : {}) })
  const layoutDoc = () => ({ zones: state.layout.zones, tables: state.layout.tables, joins: state.layout.joins })
  const business = { ...mockBusiness, variables: { ...mockBusiness.variables, SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify([{ skill: 'skill_restaurant_booking', instanceId: 'restaurant_booking_1', params: {} }]) } }
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const diag = (route, status, code, extra = {}) => json(route, status, Object.assign({ diagnostics: [{ path: '/', code, detail: `server English for ${code}` }] }, extra))

  const tableNames = ids => (ids || []).map(id => (state.layout.tables.find(t => t.id === id) || {}).name).filter(Boolean)
  const wire = r => Object.assign({}, r, { tableNames: tableNames(r.tableIds) })
  const end = r => toMin(r.time) + r.minutes
  const takes = r => r.status === 'confirmed'
  const freeFor = (date, ids, from, to, except) => !state.rows.some(r => r.date === date && takes(r) && r.id !== except &&
    r.tableIds.some(t => ids.includes(t)) && toMin(r.time) < to && end(r) > from)
  const seatingsOf = () => {
    const singles = state.layout.tables.filter(t => t.active).map(t => ({ ids: [t.id], min: t.min, max: t.max, zone: t.zone, joined: false }))
    const joins = state.layout.joins.map(j => ({ ids: j.tables.slice(), min: j.min, max: j.max, zone: 'sala', joined: true }))
    return singles.sort((a, b) => a.max - b.max).concat(joins)
  }
  const fitsAt = (date, time, covers) => {
    const from = toMin(time)
    const minutes = covers <= 2 ? 90 : covers <= 4 ? 105 : 120
    return seatingsOf().filter(s => covers >= s.min && covers <= s.max && freeFor(date, s.ids, from, from + minutes, null))
  }

  await page.route('**/crm/variables*', route => json(route, 200, annotations))
  await page.route('**/crm/business*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([business]),
    headers: { 'x-mrcall-role': 'owner', 'access-control-expose-headers': 'x-mrcall-role' } }))

  await page.route('**/apidomain/agent/skills/configuration/**', route => {
    const request = route.request()
    if (request.method() === 'PUT') {
      const body = request.postDataJSON()
      calls.push({ method: 'PUT', path: new URL(request.url()).pathname, body })
      if (body.expectedRevision !== state.revision) return diag(route, 409, 'stale')
      state.params = Object.assign({}, body.params)
      delete state.params.layout
      state.revision = `rev-${Number(state.revision.split('-')[1]) + 1}`
      return json(route, 200, { saved: true, revision: state.revision, diagnostics: [] })
    }
    return json(route, 200, { prefetch: [], during: [entry()], final: [], revisions: { prefetch: 'p', during: state.revision, final: 'f' } })
  })

  await page.route('**/customer/conversation/search*', route => {
    const body = route.request().postDataJSON() || {}
    calls.push({ method: 'POST', path: '/conversation/search', body })
    const doc = conversations[body.id]
    return json(route, 200, { hits: doc ? [{ document: doc }] : [], totalHits: doc ? 1 : 0 })
  })

  await page.route('**/apidomain/restaurant/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const path = url.pathname.replace(/^.*\/apidomain\/restaurant\/[^/]+/, '')
    const body = request.postData() ? request.postDataJSON() : null
    if (opts.restaurant === false) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'The requested resource could not be found.' })
    if (method !== 'GET') calls.push({ method, path, search: url.search, body })
    else calls.push({ method, path, search: url.search })

    if (method === 'GET' && path === '/reservations') {
      const date = url.searchParams.get('date')
      return json(route, 200, {
        date, configured: !!state.layout, held: 0, heldTables: [], covers: {}, zonesClosed: [],
        layout: state.layout ? Object.assign({ revision: state.layout.revision, nextTableId: state.layout.nextTableId }, layoutDoc()) : null,
        reservations: state.rows.filter(r => r.date === date).map(wire)
      })
    }
    if (method === 'GET' && path === '/calendar') {
      const days = []
      for (let d = url.searchParams.get('from'); d <= url.searchParams.get('to'); d = addDays(d, 1)) {
        const closed = d === addDays(TODAY, 5)
        days.push({ date: d, services: ['lunch', 'dinner'].map(service => ({ service, open: !closed, coversTaken: d === TOMORROW && service === 'dinner' ? 12 : 0,
          largestParty: d === addDays(TODAY, 3) && service === 'dinner' ? 0 : 6, bookable: { 2: ['19:00-22:00'], 4: ['19:00-21:00'], 6: ['21:30'] } })) })
      }
      return json(route, 200, { from: url.searchParams.get('from'), to: url.searchParams.get('to'), by: 'staff', days })
    }
    if (method === 'GET' && path === '/seatings') {
      if (opts.seatings === false) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'The requested resource could not be found.' })
      const date = url.searchParams.get('date')
      const covers = Number(url.searchParams.get('covers'))
      const fits = fitsAt(date, url.searchParams.get('time'), covers)
      const later = []
      for (let m = toMin(url.searchParams.get('time')) + 15; m <= toMin('22:00'); m += 15) if (fitsAt(date, fmt(m), covers).length) later.push(fmt(m))
      return json(route, 200, { fits: fits.map(f => ({ tableIds: f.ids, zone: f.zone, joined: f.joined })), later })
    }
    if (method === 'POST' && path === '/reservations') {
      if (state.refuseBook && !body.overbook) {
        const code = state.refuseBook
        return diag(route, 409, code, { alternatives: [{ date: body.date, time: '21:15', zone: 'sala', why: 'full' }] })
      }
      const ids = body.tableIds || (fitsAt(body.date, body.time, body.covers)[0] || { ids: [] }).ids
      const row = { id: `n${state.nextId++}`, version: 1, date: body.date, time: body.time, minutes: body.covers <= 2 ? 90 : 105, covers: body.covers,
        zone: 'sala', service: toMin(body.time) < toMin('17:00') ? 'lunch' : 'dinner', status: 'confirmed', source: body.walkIn ? 'walk_in' : 'staff',
        name: body.name || null, phone: body.phone || null, notes: body.notes || null, allergies: body.allergies || null, overbooked: !!body.overbook,
        tableIds: ids, pinned: false, serviceState: body.walkIn ? 'seated' : null, conversationId: null, callIds: [] }
      state.rows.push(row)
      return json(route, 201, wire(row))
    }
    const one = /^\/reservations\/([^/]+)(\/[a-z-]+)?$/.exec(path)
    if (one) {
      const row = state.rows.find(r => r.id === one[1])
      if (!row) return diag(route, 404, 'not_found')
      const version = body && body.expectedVersion !== undefined ? body.expectedVersion : Number(url.searchParams.get('expectedVersion'))
      if (version !== row.version) return diag(route, 409, 'stale', { currentVersion: row.version })
      const action = one[2] || ''
      if (method === 'DELETE') row.status = row.status === 'requested' ? 'handled' : 'cancelled'
      else if (action === '/state') row.serviceState = body.state
      else if (action === '/pin') row.pinned = body.pinned
      else if (action === '/no-show') row.status = 'no_show'
      else if (action === '/accept') { row.status = 'confirmed'; row.tableIds = [6] }
      else if (method === 'PATCH') {
        if (body.tableIds) row.tableIds = body.tableIds
        if (body.time) row.time = body.time
      }
      row.version++
      return json(route, 200, wire(row))
    }
    if (method === 'GET' && path === '/layout') {
      return json(route, 200, { layout: state.layout ? Object.assign({ revision: state.layout.revision, nextTableId: state.layout.nextTableId }, layoutDoc()) : null })
    }
    if (method === 'PUT' && path === '/layout') {
      const current = state.layout ? state.layout.revision : null
      if (body.expectedRevision !== current) return diag(route, 409, 'stale', { currentRevision: current })
      if (opts.hours === false && state.params.dinner === '{}') return diag(route, 409, 'not_configured')
      const sent = body.layout
      const kept = (sent.tables || []).filter(t => t.id).map(t => t.id)
      const heldGone = state.layout ? state.layout.tables.filter(t => !kept.includes(t.id) && state.rows.some(r => takes(r) && r.date >= TODAY && r.tableIds.includes(t.id))) : []
      if (heldGone.length) {
        return json(route, 422, { diagnostics: heldGone.map(t => ({ path: '/layout/tables', code: 'table_has_holds',
          detail: `table '${t.name}' (${t.id}) has future bookings; move them before removing it` })) })
      }
      let next = state.layout ? state.layout.nextTableId : 1
      const tables = sent.tables.map(t => Object.assign({}, t, { id: t.id || next++, active: t.active !== false }))
      const byName = new Map(tables.map(t => [t.name, t.id]))
      const joins = (sent.joins || []).map(j => ({ tables: j.tables.map(x => (typeof x === 'number' ? x : byName.get(x))), min: j.min, max: j.max }))
      state.layout = { revision: (current || 0) + 1, nextTableId: next, zones: sent.zones, tables, joins }
      return json(route, 200, { layout: Object.assign({ revision: state.layout.revision, nextTableId: next }, layoutDoc()), warnings: [] })
    }
    if (method === 'POST' && path === '/layout/preview') {
      return json(route, 200, { date: body.date, problems: [],
        warnings: [{ path: '/tables', code: 'size_never_bookable', detail: 'the assistant can never book a party of 5: no seating takes it' }],
        services: [{ service: 'lunch', open: true, coversTaken: 0, largestParty: 6, bookable: { 2: ['12:00-14:00'], 4: ['12:00-14:00'], 6: ['12:00-14:00'] } },
          { service: 'dinner', open: true, coversTaken: 0, largestParty: 6, bookable: { 2: ['19:00-22:00'], 4: ['19:00-22:00'], 6: ['19:00-21:30'] } }] })
    }
    if (method === 'GET' && path === '/export') {
      return route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'content-disposition': 'attachment; filename="bookings.csv"' },
        body: 'id,date,time\r\nb-rossi,' + TOMORROW + ',20:00\r\n' })
    }
    return diag(route, 404, 'not_found')
  })
  return { calls, state }
}

/** Opens the page, on the evening tab, and waits for the room. */
async function openRestaurant (page, query = '') {
  await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__RESTAURANT_BOOKING__${query}`)
}

/** Goes to tomorrow's dinner, the day every test's book is written for. */
async function tomorrowDinner (page) {
  await page.getByRole('button', { name: 'Next day' }).click()
  await page.locator('.svc-tab', { hasText: 'Dinner' }).click()
}

module.exports = { mockRestaurant, openRestaurant, tomorrowDinner, TODAY, TOMORROW }
