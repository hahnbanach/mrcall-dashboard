// @ts-check
const { mockBusiness } = require('./mock-data')

/**
 * A StarChat restaurant book in memory, for the restaurant page's browser tests: the routes the page calls,
 * answering in the shapes StarChat 9.34.65 answers (ApiDomainRestaurantResource, LayoutDraft,
 * RestaurantLayoutSection, NativeReservationBook in /Users/angelo/data/WORK/elegans.io/starchat at that tag): tables without an id get one from the server, a join may name a table by name,
 * bookings carry `callIds`, the day read carries `minFreeMinutes` and each table's free windows
 * (`freeTables`), the skill read carries the store-backed `layout` section, and the finder is
 * GET /suggestions.
 *
 * It is stateful on purpose: a write changes what the next read returns, so a test sees the page redraw
 * from the server's answer and not from what it sent. Every write is recorded in `calls`.
 *
 * The finder and the free windows here are NOT the server's computation: the finder seats a party at the free
 * declared seatings, the windows are the gaps between the day's bookings (DayBook.freeWindows' rule, without
 * blocks or re-seating), which is all a test of the page needs (the page shows whatever the server answers).
 */

const pad = n => String(n).padStart(2, '0')
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() + n); return keyOf(x) }
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmt = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

const TODAY = keyOf(new Date())
/** The restaurant manifest's default minimum free time (StarChat is moving it to 120). */
const MANIFEST_MIN_FREE = 120
const TOMORROW = addDays(TODAY, 1)
const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** The skills' variable as the server declares it (tests/e2e/auth/skills.spec.js): the section that holds it is where
 *  the restaurant page links for what the skill form owns. */
const skillVariable = name => ({ name, humanName: 'Agent skills', description: 'What the assistant can do during a call', class: 'variable',
  templateName: 'generic_onboarding', type: 'apidomain_agent_skills', defaultValue: '[]', visible: true, mandatory: false, modifiable: true,
  advanced: false, position: '1', dependsOn: [], valuesSelection: [] })
const annotations = [{ collection: { id: '__BUSINESS_DATA__', humanName: 'Business data', description: '' }, variables: [] },
  { collection: { id: '__SKILLS__', humanName: 'Skills', description: '' }, variables: [[skillVariable('SKILL_PREFETCH_CONFIGURATION'),
    skillVariable('SKILL_RUNNINGLOOP_CONFIGURATION'), skillVariable('SKILL_FINAL_CONFIGURATION')]] }]

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
    r('b-bianchi', '19:30', 6, 'Bianchi', [6], { notes: 'Birthday cake at 22:00', pastNoShows: 1 }),
    r('b-gallo', '21:00', 2, 'Gallo', [7], { source: 'walk_in', name: null, phone: null }),
    // today at 20:00, still expected: late whenever the page's clock is past 20:00 (the one-tap no-show)
    r('b-late', '20:00', 2, 'Lato', [2], { date: TODAY, source: 'staff' }),
    r('b-req', '21:30', 9, 'Galli', [], { status: 'requested', requestReason: 'large_party', conversationId: 'CON-req', callIds: ['CON-req'] }),
    // three weeks ahead, on a day no test opens: the page does not know of it, the server does
    r('b-far', '20:00', 3, 'Moretti', [5], { date: addDays(TODAY, 20), conversationId: 'CON-far', callIds: ['CON-far'] })
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

/** The restaurant_booking manifest's configuration as the skill catalogue carries it (StarChat 9.34 at cd286bfab,
 *  the fields the page and the form read): defaults, limits and `x-audience` as `audience`. */
const REQUIRED_DEFAULT = { name: 'required', phone: 'required', allergies: 'optional', notes: 'optional', zone: 'optional' }
function catalogueFields () {
  const page = (key, extra = {}) => Object.assign({ key, type: 'number', widget: 'number', audience: 'page', labels: { en: { label: key } } }, extra)
  return [
    { key: 'enabled', type: 'boolean' },
    { key: 'label', type: 'string', labels: { en: { label: 'Name of this instance' } } },
    { key: 'page', type: 'boolean', widget: 'boolean', default: 'true', labels: { en: { label: 'Restaurant page', hint: 'On: the restaurant\'s bookings page' } } },
    { key: 'closureKeyword', type: 'string', widget: 'text', default: 'CLOSED', labels: { en: { label: 'Closure keyword in the calendar' } } },
    { key: 'phoneChanges', type: 'enum', widget: 'select', default: 'moves_and_details', labels: { en: { label: 'Changes by phone' } },
      options: [{ value: 'moves_and_details', label: 'Moves and details' }, { value: 'details_only', label: 'Details only' },
        { value: 'nothing', label: 'Nothing: a call-back request' }, { value: 'not_offered', label: 'Not offered' }] },
    { key: 'unverifiedCallers', type: 'enum', widget: 'select', default: 'no_bookings', labels: { en: { label: 'Hidden number, anonymous web chat or unverified voice user' } },
      options: [{ value: 'no_bookings', label: 'No bookings: a call-back request' }, { value: 'bookings_allowed', label: 'Bookings allowed' }] },
    page('lunch', { type: 'json', widget: 'weekly_hours', labels: { en: { label: 'Lunch: arrival times' } } }),
    page('dinner', { type: 'json', widget: 'weekly_hours', labels: { en: { label: 'Dinner: arrival times' } } }),
    page('arrivalEveryMinutes', { default: 15, min: 5, max: 60, labels: { en: { label: 'Arrival every (minutes)' } } }),
    page('coversPerArrival', { default: 0, min: 0, max: 2000 }),
    page('tableMinutes2', { default: 90, min: 15, max: 480 }), page('tableMinutes4', { default: 105, min: 15, max: 480 }),
    page('tableMinutes6', { default: 120, min: 15, max: 480 }), page('tableMinutesLarger', { default: 150, min: 15, max: 480 }),
    page('minFreeMinutes', { default: MANIFEST_MIN_FREE, min: 1, max: 480 }),
    { key: 'maxPartySize', type: 'number', widget: 'number', default: 8, min: 1, max: 100, labels: { en: { label: 'Largest party booked by the assistant' } } },
    { key: 'daysAhead', type: 'number', widget: 'number', default: 60, min: 1, max: 365, labels: { en: { label: 'Days ahead' } } },
    page('horizonDays', { default: 365, min: 1, max: 1095, labels: { en: { label: 'Book horizon (days)' } } }),
    page('walkInMinutes', { default: 60, min: 0, max: 240 }),
    page('requiredFields', { type: 'json', widget: 'json', default: JSON.stringify(REQUIRED_DEFAULT), labels: { en: { label: 'What we ask for every booking' } } }),
    page('specialDays', { type: 'string', widget: 'textarea', labels: { en: { label: 'Closures and special days' } } }),
    page('layout', { type: 'json', widget: 'restaurant_layout', labels: { en: { label: 'Room: zones, tables and joins' } } }),
    { key: 'trigger', type: 'string', widget: 'textarea', labels: { en: { label: 'Trigger (when to call)' } } }
  ]
}

/**
 * Installs the book on `page`. Options:
 *   layout: false for a restaurant without tables (the wizard); hours: false for an instance with no hours;
 *   suggestions: false for a finder that fails (500); restaurant: false for a server without the routes;
 *   refuseBook: the code the first POST /reservations is refused with; refuseLayout: answer layout saves 422.
 */
async function mockRestaurant (page, opts = {}) {
  const calls = []
  // an uncaught error in the page is said where it happens (the dev server would otherwise cover the page)
  // Microsoft Clarity, loaded by the app from the internet, throws cross-origin errors in a test page; the dev
  // server's overlay then covered the page and a click timed out (seen once in a full run, 2026-10-12)
  await page.route('**/*clarity.ms/**', route => route.abort())
  page.on('pageerror', e => console.log(`PAGEERROR ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`))
  const state = {
    layout: opts.layout === false ? null : trattoria(),
    rows: tomorrowsDinner().concat((opts.extraRows || []).map(r => Object.assign({ version: 1, date: TOMORROW, minutes: 90, zone: 'sala',
      service: 'dinner', source: 'assistant', overbooked: false, tableIds: [], pinned: false, conversationId: null, callIds: [] }, r))),
    revision: 'rev-1',
    params: { enabled: 'true', dinner: opts.hours === false ? '{}' : hours, lunch: opts.hours === false ? '{}' : lunch,
      arrivalEveryMinutes: '15', tableMinutes2: '90', tableMinutes4: '105', tableMinutes6: '120', tableMinutesLarger: '150',
      ...(opts.minFree === false ? {} : { minFreeMinutes: '90' }), daysAhead: '60', ...(opts.params || {}) },
    refuseBook: opts.refuseBook || null,
    nextId: 1
  }
  const entry = () => ({ skill: 'skill_restaurant_booking', instanceId: 'restaurant_booking_1',
    params: Object.assign({}, state.params, state.layout ? { layout: Object.assign({ revision: state.layout.revision }, layoutDoc()) } : {}) })
  const layoutDoc = () => Object.assign({ zones: state.layout.zones, tables: state.layout.tables, joins: state.layout.joins },
    state.layout.exceptions && state.layout.exceptions.length ? { exceptions: state.layout.exceptions } : {})
  // What every reservation must carry (R8): the stored setting over the manifest's default.
  const fieldRules = () => Object.assign({}, REQUIRED_DEFAULT, state.params.requiredFields ? JSON.parse(state.params.requiredFields) : {})
  const missingOf = guest => Object.keys(fieldRules()).filter(k => fieldRules()[k] === 'required' && k !== 'zone' && !String(guest[k] || '').trim())
  const pageOff = () => String(state.params.page) === 'false'
  const business = { ...mockBusiness, variables: { ...mockBusiness.variables, SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify([{ skill: 'skill_restaurant_booking', instanceId: 'restaurant_booking_1',
    params: opts.businessPage ? { page: opts.businessPage } : opts.params && opts.params.page ? { page: opts.params.page } : {} }]) } }
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const diag = (route, status, code, extra = {}) => json(route, status, Object.assign({ diagnostics: [{ path: '/', code, detail: `server English for ${code}` }] }, extra))

  const tableNames = ids => state.layout ? (ids || []).map(id => (state.layout.tables.find(t => t.id === id) || {}).name).filter(Boolean) : []
  // A cancelled or no-show row has released its tables (the server's day read gives it none); the mock keeps
  // them aside so that a reinstatement can take them back or find them taken.
  const reinstatable = r => r.status === 'no_show' || (r.status === 'cancelled' && r.cancelledBy === 'staff')
  const wire = r => {
    const ids = r.status === 'confirmed' || r.status === 'held' ? r.tableIds : []
    return Object.assign({}, r, { tableIds: ids, tableNames: tableNames(ids), reinstatable: reinstatable(r) })
  }
  const end = r => toMin(r.time) + r.minutes
  const takes = r => r.status === 'confirmed'
  const freeFor = (date, ids, from, to, except) => !state.rows.some(r => r.date === date && takes(r) && r.id !== except &&
    r.tableIds.some(t => ids.includes(t)) && toMin(r.time) < to && end(r) > from)
  const seatingsOf = () => {
    const singles = state.layout.tables.filter(t => t.active).map(t => ({ ids: [t.id], min: t.min, max: t.max, zone: t.zone, joined: false }))
    const joins = state.layout.joins.map(j => ({ ids: j.tables.slice(), min: j.min, max: j.max, zone: 'sala', joined: true }))
    return singles.sort((a, b) => a.max - b.max).concat(joins)
  }
  // StarChat's minimum free time when unset: the manifest's default (120), capped at the longest table time
  const minFree = () => Number(state.params.minFreeMinutes || Math.min(MANIFEST_MIN_FREE, Number(state.params.tableMinutesLarger)))
  /** DayBook.freeWindows: per active table, the gaps of each service (first arrival to last arrival plus the
   *  longest table time) at least the minimum free time long, as "HH:MM", past midnight as 24:30. */
  const freeTablesOf = date => {
    const spans = [[toMin('12:00'), toMin('14:00') + 150], [toMin('19:00'), toMin('22:00') + 150]]
    const out = {}
    state.layout.tables.filter(t => t.active).forEach(t => {
      const busy = state.rows.filter(r => r.date === date && takes(r) && r.tableIds.includes(t.id)).map(r => [toMin(r.time), end(r)]).sort((a, b) => a[0] - b[0])
      out[t.id] = []
      spans.forEach(([start, stop]) => {
        let cursor = start
        busy.filter(([a, b]) => a < stop && b > start).forEach(([a, b]) => {
          if (a > cursor && a - cursor >= minFree()) out[t.id].push({ from: fmt(cursor), to: fmt(a) })
          cursor = Math.max(cursor, b)
        })
        if (stop - cursor >= minFree()) out[t.id].push({ from: fmt(cursor), to: fmt(stop) })
      })
    })
    return out
  }
  const fitsAt = (date, time, covers) => {
    const from = toMin(time)
    const minutes = covers <= 2 ? 90 : covers <= 4 ? 105 : 120
    return seatingsOf().filter(s => covers >= s.min && covers <= s.max && freeFor(date, s.ids, from, from + minutes, null))
  }

  await page.route('**/crm/variables*', route => json(route, 200, annotations))
  await page.route('**/crm/business*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([business]),
    headers: { 'x-mrcall-role': 'owner', 'access-control-expose-headers': 'x-mrcall-role' } }))

  // the skill catalogue: the restaurant manifest's configuration fields, their defaults and limits
  // `manifest: 'once'` fails the first read (a catalogue that could not be read), then answers
  let manifestReads = 0
  await page.route(url => url.pathname.endsWith('/apidomain/agent/skills'), route => {
    manifestReads++
    if (opts.manifest === 'once' && manifestReads === 1) return diag(route, 500, 'internal')
    return json(route, 200, [{
      name: 'skill_restaurant_booking',
      configSchema: { fields: catalogueFields() }
    }])
  })
  await page.route('**/apidomain/agent/skills/configuration/**', route => {
    const request = route.request()
    if (request.method() === 'PUT') {
      const body = request.postDataJSON()
      calls.push({ method: 'PUT', path: new URL(request.url()).pathname, body })
      if (body.expectedRevision !== state.revision) return diag(route, 409, 'stale')
      // StarChat's configuration checks (R8): never the assistant on with the page off; allergies newly made required
      // where the server does not offer it is refused, a stored "required" kept is not.
      const sent = body.params || {}
      if (String(sent.enabled) === 'true' && String(sent.page) === 'false') {
        return json(route, 422, { diagnostics: [{ severity: 'error', path: '/enabled', code: 'assistant_without_page', detail: 'server English' }] })
      }
      const asked = sent.requiredFields ? JSON.parse(sent.requiredFields).allergies : null
      const stored = state.params.requiredFields ? JSON.parse(state.params.requiredFields).allergies : null
      if (asked === 'required' && stored !== 'required' && (opts.allergiesRefused || !(opts.allergies && opts.allergies.requiredAvailable))) {
        return json(route, 422, { diagnostics: [{ severity: 'error', path: '/requiredFields/allergies', code: 'allergies_required_unavailable',
          detail: 'server English', values: { field: 'allergies' } }] })
      }
      state.params = Object.assign({}, body.params)
      delete state.params.layout
      state.revision = `rev-${Number(state.revision.split('-')[1]) + 1}`
      return json(route, 200, { saved: true, revision: state.revision, diagnostics: opts.configWarnings || [] })
    }
    // `restaurant.allergies`: the shape the page's adapter reads (Restaurant.allergiesSettingOf), sent only when a test
    // says what the server answers; StarChat does not send it yet.
    return json(route, 200, Object.assign({ prefetch: [], during: [entry()], final: [], revisions: { prefetch: 'p', during: state.revision, final: 'f' } },
      opts.allergies ? { restaurant: { allergies: opts.allergies } } : {}))
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
    // The page off (R8): every staff route answers not_configured on /page, but the export and the erasure.
    if (pageOff() && path !== '/export' && path !== '/erasure') {
      return json(route, 409, { diagnostics: [{ path: '/page', code: 'not_configured', detail: 'server English' }] })
    }

    if (method === 'GET' && path === '/reservations') {
      const date = url.searchParams.get('date')
      return json(route, 200, {
        date, configured: !!state.layout, held: 0, heldTables: [], covers: {}, zonesClosed: [],
        closures: (opts.closures || {})[date] || [],
        minFreeMinutes: minFree(), freeTables: state.layout ? freeTablesOf(date) : undefined,
        layout: state.layout ? Object.assign({ revision: state.layout.revision, nextTableId: state.layout.nextTableId }, layoutDoc()) : null,
        reservations: state.rows.filter(r => r.date === date).map(wire)
      })
    }
    if (method === 'GET' && path === '/calendar') {
      const days = []
      for (let d = url.searchParams.get('from'); d <= url.searchParams.get('to'); d = addDays(d, 1)) {
        // a service closed for the whole restaurant that day (the page's or the calendar's) is closed in the period too
        const closedBy = service => ((opts.closures || {})[d] || []).some(c => !c.zone && (!c.service || c.service === service))
        days.push({ date: d, services: ['lunch', 'dinner'].map(service => ({ service, open: !(d === addDays(TODAY, 5) || closedBy(service)), coversTaken: d === TOMORROW && service === 'dinner' ? 12 : 0,
          largestParty: d === addDays(TODAY, 3) && service === 'dinner' ? 0 : 6, bookable: { 2: ['19:00-22:00'], 4: ['19:00-21:00'], 6: ['21:30'] } })) })
      }
      return json(route, 200, { from: url.searchParams.get('from'), to: url.searchParams.get('to'), by: 'staff', days })
    }
    if (method === 'GET' && path === '/suggestions') {
      if (opts.suggestions === false) return diag(route, 500, 'internal')
      const date = url.searchParams.get('date')
      const time = url.searchParams.get('time')
      const covers = Number(url.searchParams.get('covers'))
      const fits = fitsAt(date, time, covers)
      const later = []
      if (!fits.length) {
        for (let m = toMin(time) + 15; m <= toMin('22:00') && later.length < 8; m += 15) if (fitsAt(date, fmt(m), covers).length) later.push(fmt(m))
      }
      return json(route, 200, { date, time, covers, later,
        suggestions: fits.map(f => ({ zone: f.zone, zoneName: f.zone === 'sala' ? 'Dining room' : 'Terrace', tableIds: f.ids,
          tableNames: tableNames(f.ids), minutes: covers <= 2 ? 90 : covers <= 4 ? 105 : 120, moves: [] })),
        refusal: fits.length ? undefined : 'full',
        // a staff booking of this party then (R8): what it is warned of, or why the book refuses it
        staff: opts.staffRefusal ? { refusal: opts.staffRefusal } : { warnings: (opts.staffWarnings || []).map(code => ({ code })) } })
    }
    if (method === 'POST' && path === '/reservations') {
      // `serverRequires`: fields the server requires beyond what the page read (the setting changed in between)
      const missing = body.walkIn ? [] : missingOf(body).concat((opts.serverRequires || []).filter(k => !String(body[k] || '').trim()))
      if (missing.length) {
        return json(route, 422, { diagnostics: [{ severity: 'error', path: '/', code: 'missing_fields', detail: 'server English', values: { fields: missing } }] })
      }
      if (state.refuseBook && !body.overbook) {
        const code = state.refuseBook
        return diag(route, 409, code, { alternatives: [{ date: body.date, time: '21:15', zone: 'sala', why: 'full' }] })
      }
      // Overbooked by staff over a taken table (R8): no table held, the tables they named kept as intended.
      const overbooked = !!(body.overbook && state.refuseBook)
      const ids = overbooked ? [] : body.tableIds || (fitsAt(body.date, body.time, body.covers)[0] || { ids: [] }).ids
      const row = { id: `n${state.nextId++}`, version: 1, date: body.date, time: body.time, minutes: body.covers <= 2 ? 90 : 105, covers: body.covers,
        zone: 'sala', service: toMin(body.time) < toMin('17:00') ? 'lunch' : 'dinner', status: 'confirmed', source: body.walkIn ? 'walk_in' : 'staff',
        name: body.name || null, phone: body.phone || null, notes: body.notes || null, allergies: body.allergies || null, overbooked: !!body.overbook,
        tableIds: ids, pinned: false, serviceState: body.walkIn ? 'seated' : null, conversationId: null, callIds: [],
        intendedTableIds: overbooked ? body.tableIds : undefined }
      state.rows.push(row)
      return json(route, 201, Object.assign(wire(row), opts.writeWarnings ? { warnings: opts.writeWarnings.map(code => ({ code })) } : {}))
    }
    if (method === 'POST' && path === '/search') {
      const q = String(body.q || '').toLowerCase()
      const digits = q.replace(/\D/g, '')
      const found = state.rows.filter(r => r.source !== 'block' && ((r.name || '').toLowerCase().includes(q) ||
        (!/[a-z]/.test(q) && digits.length >= 3 && (r.phone || '').includes(digits))))
      return json(route, 200, { from: addDays(TODAY, -7), to: addDays(TODAY, 60), reservations: found.map(wire), truncated: false })
    }
    const one = /^\/reservations\/([^/]+)(\/[a-z-]+)?$/.exec(path)
    if (one) {
      const row = state.rows.find(r => r.id === one[1])
      if (!row) return diag(route, 404, 'not_found')
      const version = body && body.expectedVersion !== undefined ? body.expectedVersion : Number(url.searchParams.get('expectedVersion'))
      if (version !== row.version) return diag(route, 409, 'stale', { currentVersion: row.version })
      const action = one[2] || ''
      // As StarChat 9.34.65's staffCancel (NativeReservationBook.scala:711-728): a live hold is not staff's (404);
      // a request already handled or a row already cancelled is answered as it is, nothing written, no new version.
      if (method === 'DELETE' && row.status === 'held') return diag(route, 404, 'not_found')
      if (method === 'DELETE' && (row.status === 'handled' || row.status === 'cancelled')) return json(route, 200, wire(row))
      if (action === '/reinstate') {
        if (!reinstatable(row)) return diag(route, 409, 'not_reversible', { reason: row.status === 'cancelled' ? 'cancelled_by_caller' : 'not_cancelled_or_no_show' })
        const conflicts = state.rows.filter(o => o.id !== row.id && o.date === row.date && takes(o) && o.tableIds.some(t => row.tableIds.includes(t)) &&
          toMin(o.time) < end(row) && end(o) > toMin(row.time))
        if (conflicts.length && url.searchParams.get('overbook') !== 'true') {
          return diag(route, 409, 'table_taken', { conflicts: conflicts.map(o => ({ tableId: o.tableIds.find(t => row.tableIds.includes(t)),
            reservation: o.id, source: o.source, name: o.name, time: o.time, covers: o.covers })), gone: [] })
        }
        if (conflicts.length) { row.tableIds = []; row.overbooked = true }
        row.status = 'confirmed'
        row.cancelledBy = undefined
      } else if (method === 'DELETE') {
        if (row.status === 'requested') row.status = 'handled'
        else { row.status = 'cancelled'; row.cancelledBy = 'staff' }
      }
      else if (action === '/state') row.serviceState = body.state
      else if (action === '/pin') row.pinned = body.pinned
      else if (action === '/no-show') row.status = 'no_show'
      else if (action === '/accept') {
        // a call-back request about a change is acted on through the booking it names (R8)
        if (row.about) return diag(route, 409, 'linked_request', { reservation: row.about })
        const guest = { name: body.name || row.name, phone: body.phone || row.phone, allergies: body.allergies || row.allergies, notes: body.notes || row.notes }
        const missing = missingOf(guest)
        if (missing.length) return json(route, 422, { diagnostics: [{ severity: 'error', path: '/', code: 'missing_fields', detail: 'server English', values: { fields: missing } }] })
        Object.assign(row, guest)
        row.status = 'confirmed'; row.tableIds = [6]
      }
      else if (method === 'PATCH') {
        // a staff edit that clears a required field is refused, naming it (R8); one that sets a field replaces it
        const cleared = ['name', 'phone', 'allergies', 'notes'].filter(k => k in body && !String(body[k] || '').trim())
        const missing = cleared.filter(k => fieldRules()[k] === 'required')
        if (missing.length) return json(route, 422, { diagnostics: [{ severity: 'error', path: '/', code: 'missing_fields', detail: 'server English', values: { fields: missing } }] })
        ;['name', 'phone', 'allergies', 'notes'].forEach(k => { if (k in body) row[k] = String(body[k] || '').trim() || null })
        if (body.tableIds) row.tableIds = body.tableIds
        if (body.time) row.time = body.time
        if (body.date) row.date = body.date
        if (body.covers) row.covers = body.covers
      }
      row.version++
      return json(route, 200, wire(row))
    }
    if (method === 'GET' && path === '/layout') {
      return json(route, 200, { layout: state.layout ? Object.assign({ revision: state.layout.revision, nextTableId: state.layout.nextTableId }, layoutDoc()) : null,
        calendar: opts.calendar || {} })
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
          detail: `table '${t.name}' (${t.id}) has future bookings; move them before removing it`,
          // StarChat 9.34 after 9.34.65 (R6): table_has_holds carries {table, id}; `values: false` is 9.34.65
          ...(opts.values === false ? {} : { values: { table: t.name, id: t.id } }) })) })
      }
      let next = state.layout ? state.layout.nextTableId : 1
      const tables = sent.tables.map(t => Object.assign({}, t, { id: t.id || next++, active: t.active !== false }))
      const byName = new Map(tables.map(t => [t.name, t.id]))
      const joins = (sent.joins || []).map(j => ({ tables: j.tables.map(x => (typeof x === 'number' ? x : byName.get(x))), min: j.min, max: j.max }))
      state.layout = { revision: (current || 0) + 1, nextTableId: next, zones: sent.zones, tables, joins, exceptions: sent.exceptions || [] }
      return json(route, 200, { layout: Object.assign({ revision: state.layout.revision, nextTableId: next }, layoutDoc()), warnings: [] })
    }
    if (method === 'POST' && path === '/layout/preview') {
      return json(route, 200, { date: body.date, problems: [],
        warnings: [{ path: '/tables', code: 'size_never_bookable', detail: 'the assistant can never book a party of 5: no seating takes it',
          ...(opts.values === false ? {} : { values: { sizes: [5] } }) },
        { path: '/maxPartySize', code: 'party_larger_than_room', detail: '10 people fit no seating (8 at most): larger parties become requests',
          ...(opts.values === false ? {} : { values: { maxPartySize: 10, largestSeating: 8 } }) }],
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

module.exports = { mockRestaurant, openRestaurant, tomorrowDinner, catalogueFields, TODAY, TOMORROW }
