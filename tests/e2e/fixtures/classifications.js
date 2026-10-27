// @ts-check
/**
 * StarChat's answers for a call's judgements, their signals and undo, the queues, the caller rules, a category's
 * requests, the access record and the audio link (StarChat's brief docs/briefs/2026-10-26-classification-feedback.md,
 * decisions 6, 12, 13, 14), shaped as its code answers them: `InsightsFeedback.classifications`, `.signal`, `.bulk`,
 * `.revertGesture`, `.decide`, `.queue`, `.rules`, `.createRule`, `.deleteRule`; `CallInsightsReportService
 * .categoryRequests`; `ConversationAccess.accessLog`, `.audioLink`. The category list (`GET insights/categories`) is the
 * read the dashboard's brief PROPOSES to StarChat; `categories: null` answers it 404, as StarChat does today.
 *
 * `mockClassifications(page, options)` keeps one state per call: a signal changes it as StarChat would (a person's
 * resolution, message and outcome applied; a category applied by an admin, proposed by anyone else; "wrong" proposed;
 * `valueFrom` checked, 409 `stale_value` with `current` otherwise), a message or outcome correction re-derives nothing
 * here (the fixture keeps derivation out). Every gesture's answer carries the touched calls' state (`call`, `calls`), as
 * StarChat a012b6926 answers it. `sent` records every request, so a spec asserts what was sent and what was not.
 */
const { mockBusiness, mockUser } = require('./mock-data')

const BUSINESS_ID = mockBusiness.businessId
const CALL_ID = 'CON-judged-1'
const START = Date.UTC(2026, 9, 20, 9, 30)

const CATEGORIES = [
  { key: 'online_booking', label: 'Book an appointment', active: true },
  { key: 'prices', label: 'Prices and quotes', active: true },
  { key: 'opening_hours', label: 'Opening hours', active: true },
  { key: 'staff_availability', label: 'Speak to a person or be called back', active: true },
  { key: 'retired_key', label: 'Retired', active: false },
]

function judged (over = {}) {
  return {
    conversationId: CALL_ID,
    businessId: BUSINESS_ID,
    callStart: START,
    version: 7,
    resolution: { model: 'resolved', value: 'resolved', corrected: false },
    message: { model: 'none', value: 'none', corrected: false },
    requests: [
      {
        requestId: 101, ordinal: 1, text: 'Wants to book a cleaning next week',
        outcome: { model: 'met', value: 'met', corrected: false },
        category: { model: 'online_booking', value: 'online_booking', corrected: false },
        excluded: false,
      },
      {
        requestId: 102, ordinal: 2, text: 'Asks how much a whitening costs',
        outcome: { model: 'neither', value: 'neither', corrected: false },
        category: { model: 'prices', value: 'prices', corrected: false },
        gap: 'missing_info', excluded: false,
      },
    ],
    history: [],
    // the call's facts as the summary holds them (StarChat a012b6926): a string, or null when unset
    facts: { booked: 'true', transferred: null, no_conversation: null, managed_call: 'true', skill_errors: null, unkept: null },
    ...over,
  }
}

// A call's state as a gesture's answer carries it (StarChat a012b6926): the judgements read without the history.
function stateOf (call) {
  const strip = (j) => (j ? { model: j.model, value: j.value, corrected: !!j.corrected } : j)
  return {
    conversationId: call.conversationId, businessId: call.businessId, callStart: call.callStart, version: call.version,
    resolution: strip(call.resolution), message: strip(call.message),
    requests: call.requests.map((r) => ({ requestId: r.requestId, ordinal: r.ordinal, text: r.text, outcome: strip(r.outcome), category: strip(r.category), gap: r.gap, excluded: r.excluded })),
    facts: call.facts,
  }
}

// The conversation as the owner's search answers it, with its details (StarChat `CallDetailsView`).
function conversation (over = {}) {
  return {
    id: CALL_ID,
    businessId: BUSINESS_ID,
    owner: mockUser.uid,
    startTimestamp: START,
    contactNumber: '+39 333 000 0001',
    contactName: 'Caller One',
    properties: [],
    data: { conversation_transcription: [{ alias: 'Caller', speaker_type: 'user', content: 'Hello' }] },
    details: {
      callerName: 'Caller One', callerNumber: '+39 333 000 0001', summary: 'Wants a cleaning and a price.',
      topics: ['cleaning'], resolution: 'resolved', message: 'none', booked: true,
      requests: [{ request: 'Wants to book a cleaning next week', outcome: 'met' }, { request: 'Asks how much a whitening costs', outcome: 'neither' }],
      unanswered: [], checks: {},
    },
    ...over,
  }
}

function searchAnswer (docs) {
  return { totalHits: docs.length, hitsCount: docs.length, maxScore: 1, hits: docs.map((document) => ({ score: 1, document })) }
}

/**
 * Answers every route of a call's judgements on `page`. Options:
 * - `role`: the reader's role as StarChat resolves it (owner, reseller, admin), deciding apply or propose;
 * - `calls`: `{[conversationId]: judged(...)}`; `categories`: the proposed list, or null for 404;
 * - `classificationsStatus`: answer the judgements read with this status instead (404, 503);
 * - `staleOnce`: the next signal answers 409 `stale_value`, after the state moved to `staleValue`;
 * - `rules`, `ruleCall`: the caller rules and what a rule on a call's number would be;
 * - `queue`, `categoryRequests`, `accessLog`: page answers for those routes.
 */
async function mockClassifications (page, options = {}) {
  const role = options.role || 'owner'
  const state = { calls: options.calls || { [CALL_ID]: judged() }, gestures: {}, nextId: 500 }
  const sent = []
  let staleOnce = options.staleOnce || null

  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const actorName = role === 'owner' ? 'Mario Rossi' : role === 'reseller' ? 'Partner Srl' : 'MrCall'

  function judgementOf (call, a) {
    if (a.subject === 'call') return call[a.field]
    const r = call.requests.find((x) => x.requestId === a.requestId)
    return r ? r[a.field] : null
  }

  function write (a, gestureId) {
    let call = state.calls[a.conversationId] || Object.values(state.calls).find((c) => c.requests.some((r) => r.requestId === a.requestId))
    // a call of a list the spec did not describe: its judgements are what the list showed
    if (!call && a.subject === 'call' && a.conversationId) {
      call = state.calls[a.conversationId] = judged({ conversationId: a.conversationId, resolution: { model: a.valueFrom, value: a.valueFrom, corrected: false }, requests: [] })
    }
    // a request of a list the spec did not describe (a category's requests): its values are what the list showed
    if (!call && a.subject === 'request' && a.conversationId) {
      call = state.calls[a.conversationId] = state.calls[a.conversationId] || judged({ conversationId: a.conversationId, requests: [] })
    }
    if (call && a.subject === 'request' && !call.requests.some((r) => r.requestId === a.requestId)) {
      const v = (field) => (a.field === field ? a.valueFrom : null)
      call.requests.push({ requestId: a.requestId, ordinal: call.requests.length + 1, text: '', outcome: { model: v('outcome'), value: v('outcome'), corrected: false }, category: { model: v('category'), value: v('category'), corrected: false }, excluded: false })
    }
    if (!call) return { status: 404 }
    if (a.signal === 'fact_wrong') {
      if ((call.facts || {})[a.field] !== a.valueFrom) return { status: 409, current: { conversationId: call.conversationId, field: a.field, value: (call.facts || {})[a.field] } }
      const id = state.nextId++
      call.history.push({ feedbackId: id, subject: 'call', field: a.field, signal: 'fact_wrong', valueFrom: a.valueFrom, valueTo: null, source: 'person', status: 'proposed', actorRole: role, actorName, byMe: true, createdAt: Date.now(), gestureId })
      return { status: 200, call, body: { feedbackId: id, conversationId: call.conversationId, field: a.field, status: 'proposed', value: a.valueFrom, replayed: false } }
    }
    const j = judgementOf(call, a)
    if (!j) return { status: 404 }
    if (a.valueFrom !== j.value) return { status: 409, current: { conversationId: call.conversationId, requestId: a.requestId, field: a.field, value: j.value } }
    // StarChat `InsightsFeedback.status` as of 6d13718c6: a confirmation is recorded as one, a fact report is proposed
    const status = (a.signal === 'wrong' || a.signal === 'fact_wrong') ? 'proposed' : a.signal === 'right' ? 'confirmed'
      : (a.field === 'category' && role !== 'admin') ? 'proposed' : 'applied'
    const id = state.nextId++
    const to = a.signal === 'right' ? j.value : a.valueTo || null
    if (status === 'applied') {
      for (const h of call.history) {
        if (h.status === 'applied' && h.field === a.field && (a.subject === 'call' ? h.subject === 'call' : h.requestId === a.requestId)) h.status = 'reverted'
      }
      j.previous = j.previous || []
      j.previous.push(j.value)
      j.value = to
      j.corrected = true
    }
    call.history.push({
      feedbackId: id, businessId: call.businessId, conversationId: call.conversationId, callStart: call.callStart,
      subject: a.subject, requestId: a.requestId, field: a.field, signal: a.signal, valueFrom: a.valueFrom, valueTo: to,
      source: 'person', status, actorRole: role, actorName, byMe: true, createdAt: Date.now(), gestureId,
    })
    return { status: 200, call, body: { feedbackId: id, conversationId: call.conversationId, requestId: a.requestId, field: a.field, status, value: j.value, replayed: false } }
  }

  function revertEntry (call, h) {
    const j = h.subject === 'call' ? call[h.field] : call.requests.find((r) => r.requestId === h.requestId)[h.field]
    h.status = 'reverted'
    const previous = (j.previous || []).pop()
    j.value = previous !== undefined ? previous : j.model
    j.corrected = call.history.some((x) => x.status === 'applied' && x.field === h.field && x.requestId === h.requestId && x.subject === h.subject)
  }

  await page.route('**/customer/insights/calls/*/classifications*', (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/calls/')[1].split('/')[0])
    sent.push({ method: 'GET', path: 'classifications', id })
    if (options.classificationsStatus) return json(route, options.classificationsStatus, 'Not found')
    const call = state.calls[id]
    if (!call) return json(route, 404, 'Not found')
    json(route, 200, call)
  })
  await page.route('**/customer/insights/feedback*', (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'GET') {
      sent.push({ method: 'GET', path: 'feedback', query: Object.fromEntries(url.searchParams) })
      return json(route, 200, typeof options.queue === 'function' ? options.queue(url) : (options.queue || { total: 0, asOf: 1, items: [] }))
    }
    const body = req.postDataJSON() || {}
    sent.push({ method: 'POST', path: 'feedback', body })
    if (staleOnce) {
      const s = staleOnce
      staleOnce = null
      const call = state.calls[body.conversationId]
      call[s.field].value = s.value
      return json(route, 409, { code: 'stale_value', message: 'a value changed since it was read', current: [{ conversationId: body.conversationId, field: s.field, value: s.value }] })
    }
    const out = write(body, body.gestureId)
    state.gestures[body.gestureId] = (state.gestures[body.gestureId] || []).concat(out.body ? [out.body.feedbackId] : [])
    if (out.status !== 200) return json(route, out.status, out.status === 409 ? { code: 'stale_value', current: [out.current] } : 'Not found')
    json(route, 200, { ...out.body, call: stateOf(out.call) })
  })
  await page.route('**/customer/insights/feedback/bulk', (route) => {
    const body = route.request().postDataJSON() || {}
    sent.push({ method: 'POST', path: 'bulk', body })
    const results = body.items.map((a) => write(a, body.gestureId))
    if (results.some((r) => r.status !== 200)) return json(route, 409, { code: 'stale_value', current: results.filter((r) => r.current).map((r) => r.current) })
    state.gestures[body.gestureId] = results.map((r) => r.body.feedbackId)
    const touched = [...new Set(results.map((r) => r.call))]
    json(route, 200, { gestureId: body.gestureId, applied: results.filter((r) => r.body.status === 'applied').length, proposed: results.filter((r) => r.body.status === 'proposed').length, items: results.map((r) => r.body), calls: touched.map(stateOf) })
  })
  await page.route('**/customer/insights/feedback/gestures/*/revert', (route) => {
    const g = decodeURIComponent(new URL(route.request().url()).pathname.split('/gestures/')[1].split('/')[0])
    sent.push({ method: 'POST', path: 'gesture-revert', gestureId: g })
    const reverted = []
    const touched = new Set()
    for (const call of Object.values(state.calls)) {
      for (const h of [...call.history].reverse()) {
        // StarChat reverts a gesture's corrections and confirmations (6d13718c6); a confirmation undone changes no value
        if (h.gestureId === g && h.status === 'applied') { revertEntry(call, h); reverted.push(h.feedbackId); touched.add(call) }
        else if (h.gestureId === g && h.status === 'confirmed') { h.status = 'reverted'; reverted.push(h.feedbackId); touched.add(call) }
      }
    }
    json(route, 200, { gestureId: g, reverted, calls: [...touched].map(stateOf) })
  })
  await page.route(/\/customer\/insights\/feedback\/\d+\/(revert|apply|reject)$/, (route) => {
    const [, id, move] = new URL(route.request().url()).pathname.match(/feedback\/(\d+)\/(\w+)$/)
    const body = route.request().postDataJSON() || {}
    sent.push({ method: 'POST', path: 'decide', id: Number(id), move, body })
    for (const call of Object.values(state.calls)) {
      const h = call.history.find((x) => x.feedbackId === Number(id))
      if (!h) continue
      if (move === 'revert') revertEntry(call, h)
      else h.status = move === 'apply' ? 'applied' : 'rejected'
      h.decidedAt = Date.now()
      return json(route, 200, { ...h, call: stateOf(call) })
    }
    json(route, 200, { feedbackId: Number(id), status: move === 'apply' ? 'applied' : move === 'reject' ? 'rejected' : 'reverted' })
  })
  await page.route('**/customer/insights/caller-rules*', (route) => {
    const req = route.request()
    const url = new URL(req.url())
    sent.push({ method: req.method(), path: 'caller-rules', query: Object.fromEntries(url.searchParams), body: req.method() === 'POST' ? req.postDataJSON() : undefined })
    if (req.method() === 'GET') {
      const answer = { businessId: url.searchParams.get('businessId'), rules: options.rules || [] }
      if (url.searchParams.get('conversationId')) answer.call = options.ruleCall || { conversationId: url.searchParams.get('conversationId'), eligible: true, caller: '+393330000001', ruleExists: false, earlierCalls: 3, earlierMore: false }
      return json(route, 200, answer)
    }
    if (req.method() === 'POST') return json(route, 201, { businessId: url.searchParams.get('businessId'), caller: '+393330000001', created: true, createdAt: Date.now(), earlierCorrected: req.postDataJSON().applyToEarlier ? 3 : 0 })
    return json(route, 200, { businessId: url.searchParams.get('businessId'), caller: url.searchParams.get('caller'), reverted: 1 })
  })
  await page.route(/\/customer\/insights\/categories(\?|$)/, (route) => {
    sent.push({ method: 'GET', path: 'categories', query: Object.fromEntries(new URL(route.request().url()).searchParams) })
    if (options.categories === null) return json(route, 404, 'Not found')
    json(route, 200, { items: options.categories || CATEGORIES })
  })
  await page.route('**/customer/insights/categories/*/requests*', (route) => {
    const url = new URL(route.request().url())
    sent.push({ method: 'POST', path: 'category-requests', category: decodeURIComponent(url.pathname.split('/categories/')[1].split('/')[0]), query: Object.fromEntries(url.searchParams), body: route.request().postDataJSON() })
    json(route, 200, typeof options.categoryRequests === 'function' ? options.categoryRequests(url) : (options.categoryRequests || { total: 0, calls: 0, asOf: 1, items: [] }))
  })
  await page.route('**/customer/conversation/access-log*', (route) => {
    sent.push({ method: 'GET', path: 'access-log', query: Object.fromEntries(new URL(route.request().url()).searchParams) })
    json(route, 200, options.accessLog || { total: 0, asOf: 1, items: [] })
  })
  await page.route('**/customer/conversation/audio*', (route) => {
    sent.push({ method: 'POST', path: 'audio', query: Object.fromEntries(new URL(route.request().url()).searchParams) })
    json(route, 200, { url: 'https://test.example/session/audio/x/y/DASHBOARD-AUDIO-LINK/1.mp3', expiresAt: Date.now() + 86400000 })
  })
  return { sent, state }
}

/** The conversation search, answering `docs` for a list and the doc with the asked id for a read by id. */
async function mockConversations (page, docs, { byId, leftOut } = {}) {
  const searches = []
  await page.route('**/customer/conversation/search*', (route) => {
    const body = route.request().postDataJSON() || {}
    // the query's `leftOut=true` (a report count's link, StarChat dc4d7f7f6) recorded beside the body
    const asksLeftOut = new URL(route.request().url()).searchParams.get('leftOut') === 'true'
    searches.push(asksLeftOut ? { ...body, __leftOut: true } : body)
    if (asksLeftOut && !body.id && leftOut !== undefined) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...searchAnswer(docs), leftOut }) })
    }
    if (body.id) {
      const found = (byId || docs).find((d) => d.id === body.id)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchAnswer(found ? [found] : [])) })
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchAnswer(docs)) })
  })
  return searches
}

module.exports = { mockClassifications, mockConversations, judged, stateOf, conversation, searchAnswer, CATEGORIES, CALL_ID, BUSINESS_ID, START }
