/**
 * What the restaurant page computes from what StarChat answers, and nothing StarChat decides.
 *
 * WHAT LIVES HERE. Clock arithmetic, the service windows read from the skill's hours, the shape a
 * booking takes on the page, which table is free at a time for the minimum free time, the layout
 * editor's draft (names, the generator, the summary of pending changes, the form checks) and the
 * first-run wizard's room. Everything is pure: no request, no store, no clock unless one is passed.
 *
 * WHAT DOES NOT. Whether a party fits (pacing, notice, the assistant's share, re-seating) is the
 * server's one decision function: the period strip, the finder ("Cerca posto") and every write ask it.
 * The page never computes a different answer to show instead. When a table is free for the minimum free
 * time is the server's too: the day read carries each table's free windows (`freeTables`), and the page
 * only reads a time against them. One thing is computed here because the page draws it while a booking is
 * being dragged: which tables are physically free for its interval. The server still judges the move.
 */

export const SERVICES = ['lunch', 'dinner']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// ---------------------------------------------------------------- clock and calendar

const pad = n => String(n).padStart(2, '0')

/** "20:30" to 1230; null for anything that is not a time. */
export function toMin (hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** 1230 to "20:30"; past midnight it keeps counting hours (24:30), as a service's end does. */
export function fmt (min) {
  return pad(Math.floor(min / 60)) + ':' + pad(min % 60)
}

export function keyOf (d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export function dateOf (key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays (key, n) {
  const d = dateOf(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}

export function weekdayOf (key) {
  return WEEKDAYS[dateOf(key).getDay()]
}

/** Minutes since midnight of a Date. */
export function minuteOfDay (d) {
  return d.getHours() * 60 + d.getMinutes()
}

// ---------------------------------------------------------------- the skill's rules, as the page needs them

function number (v, fallback) {
  if (v === undefined || v === null || String(v).trim() === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function weekly (v) {
  if (v && typeof v === 'object') return v
  try { return JSON.parse(v || '{}') || {} } catch { return {} }
}

/**
 * The parts of the restaurant_booking instance the page draws with: the arrival windows, the step,
 * the table times, the minimum free time and the horizon. Defaults are the manifest's. The values come
 * as the variables store them, strings and JSON strings, or already parsed.
 */
export function rulesOf (params) {
  const p = params || {}
  const t2 = number(p.tableMinutes2, 90)
  const t4 = number(p.tableMinutes4, 105)
  const t6 = number(p.tableMinutes6, 120)
  const larger = number(p.tableMinutesLarger, 150)
  return {
    lunch: weekly(p.lunch),
    dinner: weekly(p.dinner),
    step: number(p.arrivalEveryMinutes, 15),
    tableMinutes: { upTo2: t2, upTo4: t4, upTo6: t6, larger },
    // The brief's default: the shortest table time, which no larger party's time undercuts.
    minFreeMinutes: number(p.minFreeMinutes, t2),
    daysAhead: number(p.daysAhead, 60),
    maxPartySize: number(p.maxPartySize, 8)
  }
}

/** Whether the instance has any arrival window: without one the server cannot read its rules, and
 *  the first layout cannot be saved, so the page asks for the hours first. */
export function hasHours (rules) {
  return SERVICES.some(s => Object.values(rules[s] || {}).some(ws => Array.isArray(ws) && ws.some(w => /\d{1,2}:\d{2}-\d{1,2}:\d{2}/.test(w))))
}

/** How long a party keeps its table: the server's TableMinutes.forCovers. */
export function tableMinutesFor (rules, covers) {
  const t = rules.tableMinutes
  return covers <= 2 ? t.upTo2 : covers <= 4 ? t.upTo4 : covers <= 6 ? t.upTo6 : t.larger
}

/** The minimum free time's limits: 1 to the longest table time, as the skill's own check enforces. */
export function minFreeLimits (rules) {
  return { min: 1, max: rules.tableMinutes.larger }
}

/**
 * A service of a day as the page draws it: the first arrival, the last arrival, and the end, which is
 * the last arrival plus the longest table time (the span the server gives a block of the service).
 * Null when the weekly hours have no window for it. Special days (a closure, special hours) are the
 * server's: the period strip says whether a service is open.
 */
export function serviceWindow (rules, key, service) {
  const windows = (rules[service] || {})[weekdayOf(key)] || []
  const spans = windows.map(w => /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(String(w).trim())).filter(Boolean)
    .map(m => [toMin(m[1]), toMin(m[2])]).filter(([a, b]) => a !== null && b !== null && b >= a)
  if (!spans.length) return null
  const open = Math.min(...spans.map(s => s[0]))
  const last = Math.max(...spans.map(s => s[1]))
  return { open, last, close: last + rules.tableMinutes.larger, step: rules.step }
}

/** The arrival times of a service, every step from the first to the last arrival. */
export function arrivalTimes (win) {
  const out = []
  if (!win) return out
  for (let t = win.open; t <= win.last; t += win.step) out.push(t)
  return out
}

/** Which service a time of day belongs to, the next one when between services, for a day. */
export function serviceAt (rules, key, minute) {
  const lunch = serviceWindow(rules, key, 'lunch')
  const dinner = serviceWindow(rules, key, 'dinner')
  if (lunch && minute < Math.min(lunch.close, dinner ? dinner.open : Infinity)) return 'lunch'
  if (dinner) return 'dinner'
  return lunch ? 'lunch' : 'dinner'
}

/** The time the page opens a service on: now on today's service in progress (rounded down to the
 *  step), an hour after the first arrival otherwise, never past the last arrival. */
export function defaultTime (win, isToday, nowMinute) {
  if (!win) return 0
  if (isToday && nowMinute >= win.open && nowMinute < win.close) {
    return Math.min(win.close - win.step, win.open + Math.floor((nowMinute - win.open) / win.step) * win.step)
  }
  return Math.min(win.last, win.open + 60)
}

// ---------------------------------------------------------------- bookings

/**
 * The state a row is in on the page. The server keeps the lifecycle (`status`) apart from the evening
 * (`serviceState`): an arrived party is still `confirmed` to every count. The page shows one.
 */
export function stateOf (row) {
  if (row.source === 'block') return 'block'
  if (row.status === 'cancelled') return 'cancelled'
  if (row.status === 'no_show') return 'noshow'
  if (row.status === 'requested') return 'requested'
  if (row.status === 'held') return 'held'
  return row.serviceState || 'booked'
}

/** States that take a table. */
export const TAKES_ROOM = new Set(['booked', 'arrived', 'seated', 'left', 'block'])

/** The tables a row occupies: a block closes the tables it names, or every active table of its zone. */
export function occupiedTables (b) {
  if (b.state === 'block') return (b.blockTableIds && b.blockTableIds.length ? b.blockTableIds : b.tables) || []
  return b.tables || []
}

/** The rows that take room in a service. */
export function live (list, service) {
  return list.filter(b => b.service === service && TAKES_ROOM.has(b.state))
}

/** The bookings of a service the list shows: not the blocks, which are drawn on the tables. */
export function guests (list, service) {
  return list.filter(b => b.service === service && b.state !== 'block' && b.state !== 'held')
}

/** The calls a booking carries, newest first: the ones that touched it, then the one that made it. */
export function callsOf (b) {
  const ids = (b.callIds || []).slice().reverse()
  if (b.conversationId && !ids.includes(b.conversationId)) ids.push(b.conversationId)
  return ids.filter(Boolean)
}

/** The current, the next and a recently left booking of a table at minute `t`. */
export function tableAt (list, service, tableId, t) {
  const bs = live(list, service).filter(b => occupiedTables(b).includes(tableId)).sort((a, b) => a.start - b.start)
  return {
    cur: bs.find(b => b.start <= t && b.end > t),
    next: bs.find(b => b.start > t),
    left: bs.find(b => b.state === 'left' && b.end <= t && b.end > t - 60)
  }
}

/**
 * The earliest time from `t` on at which a table stays free for at least `minFree` minutes, read from the
 * server's free windows of that table (the day read's `freeTables`: free from `from` until `to`, each
 * window at least `minFree` long, the service's end included): `t` itself when it is free now, null when
 * no window is left. A time `t` is free when `from <= t <= to - minFree`, as the server states it.
 */
export function freeFrom (windows, t, minFree) {
  let best = null
  ;(windows || []).forEach(w => {
    const s = Math.max(t, w.from)
    if (s <= w.to - minFree && (best === null || s < best)) best = s
  })
  return best
}

export function isFreeAt (windows, t, minFree) {
  return freeFrom(windows, t, minFree) === t
}

// ---------------------------------------------------------------- the layout

export const zoneOpen = (z, key) => !(z.closures || []).some(c => key >= c.from && key <= c.to)

export function tableById (layout, id) {
  return layout.tables.find(t => t.id === id)
}

export function zoneById (layout, id) {
  return layout.zones.find(z => z.id === id)
}

/** The zones in the owner's order, as the server orders them (order, then id). */
export function orderedZones (layout) {
  return layout.zones.slice().sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** The active tables of the zones open on a day. */
export function usableTables (layout, key) {
  const open = new Set(layout.zones.filter(z => zoneOpen(z, key)).map(z => z.id))
  return layout.tables.filter(t => t.active && open.has(t.zone))
}

/**
 * What a party may be given on a day: every active table alone and every declared join whose tables
 * are all active and in one open zone, ranked as the server ranks them (a single table first, then the
 * fewest seats, then the fewest other joins, then the ids). Used to draw, never to decide: it picks the
 * seating a dragged booking is offered on and the range a free table opens a booking with.
 */
export function seatings (layout, key) {
  const zones = new Map(layout.zones.map(z => [z.id, z]))
  const usable = t => t && t.active && zones.has(t.zone) && zoneOpen(zones.get(t.zone), key)
  const valid = []
  const seen = new Set()
  layout.joins.forEach(j => {
    const ts = j.tables.map(id => tableById(layout, id))
    const sig = j.tables.slice().sort((a, b) => a - b).join(',')
    if (ts.length >= 2 && ts.every(usable) && new Set(ts.map(t => t.zone)).size === 1 && !seen.has(sig)) {
      seen.add(sig)
      valid.push(j)
    }
  })
  const otherJoins = (ids, self) => valid.filter(j => j !== self && j.tables.some(i => ids.includes(i))).length
  const out = []
  layout.tables.filter(usable).forEach(t => out.push({ ids: [t.id], min: t.min, max: t.max, zone: t.zone, joined: false, other: otherJoins([t.id], null) }))
  valid.forEach(j => {
    const ids = j.tables.slice().sort((a, b) => a - b)
    out.push({ ids, min: j.min, max: j.max, zone: tableById(layout, ids[0]).zone, joined: true, other: otherJoins(ids, j) })
  })
  return out.sort((a, b) => (a.joined - b.joined) || (a.max - b.max) || (a.other - b.other) || (a.ids.join(',') < b.ids.join(',') ? -1 : 1))
}

export function seatLabel (layout, ids) {
  return (ids || []).map(id => { const t = tableById(layout, id); return t ? t.name : '?' }).join('+')
}

/** Whether `ids` are free for a booking over [start, end), not counting the booking itself. */
export function tablesFree (list, service, ids, start, end, excludeId) {
  return !live(list, service).some(b => b.id !== excludeId && occupiedTables(b).some(t => ids.includes(t)) && b.start < end && b.end > start)
}

/** Where a dragged booking may go when dropped on `tableId`: the seatings containing it that hold the
 *  party and are physically free over the booking's interval, best first. */
export function dropTargets (layout, key, list, booking, tableId) {
  return seatings(layout, key).filter(s => s.ids.includes(tableId) && booking.party >= s.min && booking.party <= s.max &&
    tablesFree(list, booking.service, s.ids, booking.start, booking.end, booking.id))
}

// ---------------------------------------------------------------- the period strip

/** How many times a list of ranges ("19:00-21:30", "22:00") holds at a step. */
export function countInRanges (ranges, step) {
  return (ranges || []).reduce((n, r) => {
    const [a, b] = String(r).split('-')
    const from = toMin(a)
    const to = b ? toMin(b) : from
    return from === null || to === null ? n : n + Math.floor((to - from) / step) + 1
  }, 0)
}

/**
 * The colour of a service in the strip, from the server's period read: closed, past, full (no party
 * fits), limited (only a couple fits, or a pair fits at fewer than four arrival times in ten), free.
 */
export function stripStatus (summary, { past, arrivals, step }) {
  if (!summary || !summary.open) return 'closed'
  if (past) return 'past'
  if (!summary.largestParty) return 'full'
  const pairs = countInRanges((summary.bookable || {})['2'], step)
  if (summary.largestParty <= 2 || (arrivals > 0 && pairs < arrivals * 0.4)) return 'limited'
  return 'free'
}

// ---------------------------------------------------------------- "Da sapere"

/** The guests the service should know about before it starts. The prototype also names guests with past
 *  no-shows; StarChat's day read carries no such count, so that chip is not offered. */
export const KNOW = {
  allergies: b => !!b.allergies,
  groups: b => b.party >= 6
}

export function knowCounts (list, service) {
  const gs = live(list, service).filter(b => b.state !== 'block')
  return Object.fromEntries(Object.keys(KNOW).map(k => [k, gs.filter(KNOW[k]).sort((a, b) => a.start - b.start)]))
}

// ---------------------------------------------------------------- search

const digits = s => String(s || '').replace(/\D/g, '')

export function matches (b, query) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 2) return false
  if ((b.name || '').toLowerCase().includes(q)) return true
  const d = digits(q)
  return d.length >= 2 && digits(b.phone).includes(d)
}

// ---------------------------------------------------------------- the layout editor's draft

export const clone = o => JSON.parse(JSON.stringify(o))

/** A short zone id from its name: letters, digits and hyphens, unique among `taken`. Ids are stable
 *  once saved; a new zone gets one from the name it was created with. */
export function zoneIdFor (name, taken) {
  const base = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'zona'
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`
}

/**
 * The names `n` new tables of a zone take: on from the zone's highest number with the zone's prefix,
 * or a prefix from the zone's name (Sala gives T) that no other zone uses. The approved prototype's
 * rule, which StarChat's generator follows too.
 */
export function genNames (layout, zoneId, n) {
  const zt = layout.tables.filter(t => t.zone === zoneId)
  const counts = {}
  zt.forEach(t => { const m = /^([A-Za-z]+)(\d+)$/.exec(t.name.trim()); if (m) counts[m[1]] = Math.max(counts[m[1]] || 0, +m[2]) })
  let prefix = Object.keys(counts)[0]
  if (!prefix) {
    const zone = zoneById(layout, zoneId)
    const zname = ((zone && zone.name) || '').replace(/[^A-Za-z]/g, '') || 'T'
    const usedElsewhere = p => layout.tables.some(t => t.zone !== zoneId && new RegExp('^' + p + '\\d+$', 'i').test(t.name))
    prefix = /^sala$/i.test(zname) ? 'T' : zname[0].toUpperCase()
    if (usedElsewhere(prefix)) prefix = zname.slice(0, 2)
    if (usedElsewhere(prefix)) prefix = zname
  }
  const taken = new Set(layout.tables.map(t => t.name.toLowerCase()))
  const out = []
  let k = (counts[prefix] || 0) + 1
  while (out.length < n) { const name = prefix + k; if (!taken.has(name.toLowerCase())) out.push(name); k++ }
  return out
}

/** The smallest party a new table of `size` takes: one for a two-top, half its seats above. */
export const minFor = size => size <= 2 ? 1 : Math.ceil(size / 2)

/** A table the server has not numbered yet carries a negative id in the draft. */
export function newTableId (layout) {
  return Math.min(0, ...layout.tables.map(t => t.id)) - 1
}

/** Adds `n` tables of `size` to a zone of the draft, named on from the zone's highest number. */
export function addTables (layout, zoneId, n, size) {
  const names = genNames(layout, zoneId, n)
  names.forEach(name => layout.tables.push({ id: newTableId(layout), zone: zoneId, name, min: minFor(size), max: size, active: true }))
  return names
}

/**
 * The checks a draft fails before it is sent, each naming the field (`ref`) it is about. The server
 * judges the layout again on save and on preview, and only it knows the bookings a change would
 * strand; these are the ones a form can say while it is typed.
 */
export function draftProblems (layout) {
  const errors = []
  const zn = new Set()
  layout.zones.forEach((z, i) => {
    const n = (z.name || '').trim().toLowerCase()
    if (!n) errors.push({ ref: `z-${z.id}-name`, code: 'zoneNameMissing', args: { n: i + 1 } })
    else if (zn.has(n)) errors.push({ ref: `z-${z.id}-name`, code: 'zoneNameDuplicate', args: { name: z.name } })
    zn.add(n)
    ;(z.closures || []).forEach(c => { if (c.to < c.from) errors.push({ ref: `z-${z.id}-name`, code: 'closureBackwards', args: { name: z.name } }) })
  })
  const tn = new Map()
  layout.tables.forEach(t => {
    const n = (t.name || '').trim()
    const zone = zoneById(layout, t.zone)
    if (!n) errors.push({ ref: `t-${t.id}-name`, code: 'tableNameMissing', args: { zone: zone ? zone.name : '' } })
    else if (tn.has(n.toLowerCase())) errors.push({ ref: `t-${t.id}-name`, code: 'tableNameDuplicate', args: { name: n } })
    if (n) tn.set(n.toLowerCase(), true)
    if (!zone) errors.push({ ref: `t-${t.id}-zone`, code: 'tableZoneMissing', args: { name: n } })
    if (!(Number.isInteger(t.min) && t.min >= 1)) errors.push({ ref: `t-${t.id}-min`, code: 'tableMin', args: { name: n } })
    if (!(Number.isInteger(t.max) && t.max >= t.min)) errors.push({ ref: `t-${t.id}-max`, code: 'tableMax', args: { name: n, min: t.min } })
  })
  const seen = new Set()
  layout.joins.forEach((j, i) => {
    const ts = j.tables.map(id => tableById(layout, id)).filter(Boolean)
    const label = ts.map(t => t.name).join('+')
    const ref = `j-${i}`
    if (ts.length < 2) { errors.push({ ref, code: 'joinTooFew', args: { label } }); return }
    if (new Set(ts.map(t => t.zone)).size > 1) errors.push({ ref, code: 'joinZones', args: { label } })
    if (!(Number.isInteger(j.min) && j.min >= 1)) errors.push({ ref, code: 'joinMin', args: { label } })
    if (!(Number.isInteger(j.max) && j.max >= j.min)) errors.push({ ref, code: 'joinMax', args: { label, min: j.min } })
    const sig = j.tables.slice().sort((a, b) => a - b).join(',')
    if (seen.has(sig)) errors.push({ ref, code: 'joinDuplicate', args: { label } })
    seen.add(sig)
  })
  return errors
}

/** Whether two layouts declare the same room (order of tables and joins aside). */
export function sameLayout (a, b) {
  return diffLayout(a, b).length === 0
}

/**
 * The pending changes of a draft against the saved layout, one entry per change the owner made, as
 * {code, args}: what the summary above the save bar lists before anything is saved.
 */
export function diffLayout (A, B) {
  const out = []
  const za = new Map(A.zones.map(z => [z.id, z]))
  const zb = new Map(B.zones.map(z => [z.id, z]))
  const zName = (L, id) => { const z = zoneById(L, id); return z ? z.name : '?' }
  B.zones.forEach(z => { if (!za.has(z.id)) out.push({ code: 'zoneAdded', args: { name: z.name } }) })
  A.zones.forEach(z => {
    const n = zb.get(z.id)
    if (!n) { out.push({ code: 'zoneRemoved', args: { name: z.name } }); return }
    if (n.name !== z.name) out.push({ code: 'zoneRenamed', args: { from: z.name, to: n.name } })
    if ((n.note || '') !== (z.note || '')) out.push({ code: 'zoneNote', args: { name: n.name } })
    if (JSON.stringify(n.closures || []) !== JSON.stringify(z.closures || [])) out.push({ code: 'zoneClosures', args: { name: n.name } })
  })
  const orderA = orderedZones(A).map(z => z.id).filter(id => zb.has(id))
  const orderB = orderedZones(B).map(z => z.id).filter(id => za.has(id))
  if (orderA.join() !== orderB.join()) out.push({ code: 'zoneOrder', args: {} })
  const ta = new Map(A.tables.map(t => [t.id, t]))
  const tb = new Map(B.tables.map(t => [t.id, t]))
  const added = B.tables.filter(t => !ta.has(t.id)).map(t => t.name)
  if (added.length) out.push({ code: 'tablesAdded', args: { names: added.join(', ') } })
  A.tables.forEach(t => {
    const n = tb.get(t.id)
    if (!n) { out.push({ code: 'tableRemoved', args: { name: t.name } }); return }
    if (n.name !== t.name) out.push({ code: 'tableRenamed', args: { from: t.name, to: n.name } })
    if (n.min !== t.min || n.max !== t.max) out.push({ code: 'tableSeats', args: { name: n.name, from: `${t.min}-${t.max}`, to: `${n.min}-${n.max}` } })
    if (n.zone !== t.zone) out.push({ code: 'tableZone', args: { name: n.name, from: zName(A, t.zone), to: zName(B, n.zone) } })
    if (n.active !== t.active) out.push({ code: n.active ? 'tableOn' : 'tableOff', args: { name: n.name } })
  })
  const sig = j => j.tables.slice().sort((a, b) => a - b).join(',')
  const ja = new Map(A.joins.map(j => [sig(j), j]))
  const jb = new Map(B.joins.map(j => [sig(j), j]))
  B.joins.forEach(j => { if (!ja.has(sig(j))) out.push({ code: 'joinAdded', args: { label: seatLabel(B, j.tables), min: j.min, max: j.max } }) })
  A.joins.forEach(j => {
    const n = jb.get(sig(j))
    if (!n) { out.push({ code: 'joinRemoved', args: { label: seatLabel(A, j.tables) } }); return }
    if (n.min !== j.min || n.max !== j.max) out.push({ code: 'joinRange', args: { label: seatLabel(B, n.tables), from: `${j.min}-${j.max}`, to: `${n.min}-${n.max}` } })
  })
  return out
}

/** The default range of a new join: from one more than its largest table to all its seats. */
export function joinRange (tables) {
  return { min: Math.max(...tables.map(t => t.max)) + 1, max: tables.reduce((a, t) => a + t.max, 0) }
}

// ---------------------------------------------------------------- the first-run wizard

/**
 * The room the wizard's answers describe: one zone per chosen name in that order, the tables of each
 * row ("6 tables of 2") named by the generator, and, where asked, the tables of one size paired two by
 * two. Tables carry draft ids; the server numbers them on save.
 */
export function wizardLayout (W) {
  const L = { zones: [], tables: [], joins: [] }
  const ids = []
  W.zones.forEach((name, i) => {
    const id = zoneIdFor(name, ids)
    ids.push(id)
    L.zones.push({ id, name, order: i, note: '', closures: [] })
    ;(W.rows[name] || []).forEach(r => {
      const n = Math.max(0, Math.min(40, r.n | 0))
      const size = Math.max(1, Math.min(20, r.size | 0))
      if (n) addTables(L, id, n, size)
    })
  })
  W.zones.forEach((name, i) => {
    if (!(W.pairs || {})[name]) return
    const bySize = {}
    L.tables.filter(t => t.zone === ids[i]).forEach(t => { (bySize[t.max] = bySize[t.max] || []).push(t) })
    Object.values(bySize).forEach(ts => {
      for (let k = 0; k + 1 < ts.length; k += 2) L.joins.push({ tables: [ts[k].id, ts[k + 1].id], min: ts[k].max + 1, max: ts[k].max * 2 })
    })
  })
  return L
}
