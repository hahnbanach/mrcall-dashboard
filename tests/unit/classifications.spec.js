import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `src/utils/Classifications.js`: the rules and the clients of a call's judgements as a person checks and corrects
 * them (docs/briefs/2026-10-27-classification-feedback.md; StarChat's brief docs/briefs/2026-10-26-classification-feedback.md,
 * decisions 6, 9, 12, 13, 14). The contract is StarChat's code: `InsightsFeedbackResource`, `InsightsFeedback`,
 * `CustomerConversationSearch` and `SessionTimescaleService.filterConditions`, `ConversationAccess`.
 *
 * Seen failing, 2026-10-27: the whole file on the missing module, before it was written; then each rule by
 * perturbing `Classifications.js` alone: the category rule of `statusFor` removed (2 failed), `counted` dropped from
 * `countLink` (2), an admin's restore removed (1), an unknown address value applied (1, once the body was compared
 * strictly), the `valueFrom` refusal removed (1), the reader's proposal state removed (2). The three cases the R1 review
 * added (a rejection older than a later-applied correction, "right" on an unset value, ownership not yet known) and
 * `unanswered=false` failed on the reviewed module before its repair; the waiting proposal behind an older rejection, its
 * second round, failed on 6bb4c92. The confirmation and fact cases (StarChat 6d13718c6) failed on a77364f.
 */
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const axios = (await import('axios')).default
const Classifications = (await import('@/utils/Classifications')).default

const user = { accessToken: 'token' }
const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })

beforeEach(() => {
  axios.get.mockReset()
  axios.post.mockReset()
  axios.delete.mockReset()
})

const entry = (over) => ({
  feedbackId: 1, field: 'resolution', subject: 'call', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved',
  source: 'person', status: 'applied', actorRole: 'owner', actorName: 'Mario Rossi', byMe: true, createdAt: 1000, ...over,
})

describe('the closed sets a chip offers', () => {
  it('a request\'s outcome is one of StarChat\'s five', () => {
    expect(Classifications.REQUEST_OUTCOME_KEYS).toEqual(['met', 'taken', 'handed_over', 'neither', 'withdrawn'])
  })

  it('each field offers its own values, a category the configured ones', () => {
    expect(Classifications.valuesOf('resolution')).toEqual(['resolved', 'forwarded', 'handed_over', 'unresolved', 'caller_left', 'spam_wrong_number'])
    expect(Classifications.valuesOf('message')).toEqual(['complete', 'incomplete', 'unintelligible', 'none'])
    expect(Classifications.valuesOf('outcome')).toEqual(['met', 'taken', 'handed_over', 'neither', 'withdrawn'])
    expect(Classifications.valuesOf('category', [{ key: 'prices', label: 'Prezzi', active: true }, { key: 'old', label: 'Old', active: false }])).toEqual(['prices'])
    expect(Classifications.valuesOf('category', null)).toEqual([])
    expect(() => Classifications.valuesOf('booked')).toThrow()
  })
})

describe('who applies and who proposes (StarChat decision 6, InsightsFeedback.status)', () => {
  it('a person applies a call\'s judgements and a request\'s outcome, in every role', () => {
    for (const role of ['owner', 'reseller', 'admin']) {
      expect(Classifications.statusFor('resolution', 'wrong_value', role)).toBe('applied')
      // a confirmation is recorded as one, never as the correction in force (StarChat 6d13718c6)
      expect(Classifications.statusFor('message', 'right', role)).toBe('confirmed')
      expect(Classifications.statusFor('outcome', 'wrong_value', role)).toBe('applied')
    }
  })

  it('a category is applied by an admin and proposed by anyone else; "wrong" is always proposed', () => {
    expect(Classifications.statusFor('category', 'wrong_value', 'admin')).toBe('applied')
    expect(Classifications.statusFor('category', 'wrong_value', 'owner')).toBe('proposed')
    expect(Classifications.statusFor('category', 'right', 'reseller')).toBe('confirmed')
    expect(Classifications.statusFor('resolution', 'wrong', 'admin')).toBe('proposed')
    // a fact is reported, never corrected: a proposal for an admin to close
    expect(Classifications.statusFor('booked', 'fact_wrong', 'admin')).toBe('proposed')
  })
})

describe('a chip\'s state, from the judgement and the call\'s history', () => {
  const judgement = { model: 'resolved', value: 'unresolved', corrected: true }

  it('the model\'s value, untouched', () => {
    const s = Classifications.chipState({ model: 'resolved', value: 'resolved', corrected: false }, [], { field: 'resolution' }, 'owner')
    expect(s).toMatchObject({ value: 'resolved', model: 'resolved', kind: 'model', correction: null })
  })

  it('a correction in force: from, to, who, when, and whether the reader may restore it', () => {
    const s = Classifications.chipState(judgement, [entry({ byMe: false, actorName: 'MrCall', actorRole: 'admin' })], { field: 'resolution' }, 'owner')
    expect(s.kind).toBe('corrected')
    expect(s.correction).toMatchObject({ from: 'resolved', to: 'unresolved', who: 'MrCall', when: 1000, feedbackId: 1 })
    expect(s.canRestore).toBe(false)
    expect(Classifications.chipState(judgement, [entry({ byMe: true })], { field: 'resolution' }, 'owner').canRestore).toBe(true)
    // an admin restores any correction (StarChat `mayDecide`)
    expect(Classifications.chipState(judgement, [entry({ byMe: false })], { field: 'resolution' }, 'admin').canRestore).toBe(true)
  })

  it('a confirmation says "confirmed"; it is never the correction in force, which stays (StarChat 6d13718c6)', () => {
    const confirmation = entry({ feedbackId: 5, signal: 'right', valueFrom: 'resolved', valueTo: 'resolved', status: 'confirmed', createdAt: 3000, decidedAt: 3000 })
    const s = Classifications.chipState({ model: 'resolved', value: 'resolved', corrected: false }, [confirmation], { field: 'resolution' }, 'owner')
    expect(s.kind).toBe('confirmed')
    expect(s.canRestore).toBe(false)
    const correction = entry({ feedbackId: 4, createdAt: 1000, decidedAt: 1000 })
    const both = Classifications.chipState({ model: 'resolved', value: 'unresolved', corrected: true }, [correction, { ...confirmation, valueFrom: 'unresolved', valueTo: 'unresolved' }], { field: 'resolution' }, 'owner')
    expect(both.kind).toBe('corrected')
    expect(both.correction.feedbackId).toBe(4)
    expect(Classifications.chipState({ model: 'resolved', value: 'resolved', corrected: false }, [{ ...confirmation, status: 'reverted' }], { field: 'resolution' }, 'owner').kind).toBe('model')
    // a confirmation of another value than the current one (the correction it confirmed was restored) says nothing
    expect(Classifications.chipState({ model: 'resolved', value: 'resolved', corrected: false }, [{ ...confirmation, valueFrom: 'unresolved', valueTo: 'unresolved' }], { field: 'resolution' }, 'owner').kind).toBe('model')
  })

  it('the reader\'s own proposal: sent, then applied or rejected, on the same chip', () => {
    const where = { field: 'category', requestId: 7 }
    const proposal = entry({ field: 'category', subject: 'request', requestId: 7, valueFrom: 'prices', valueTo: 'online_booking', status: 'proposed' })
    expect(Classifications.chipState({ model: 'prices', value: 'prices', corrected: false }, [proposal], where, 'owner').kind).toBe('proposed')
    expect(Classifications.chipState({ model: 'prices', value: 'prices', corrected: false }, [{ ...proposal, status: 'rejected', decidedAt: 2000 }], where, 'owner').kind).toBe('rejected')
    expect(Classifications.chipState({ model: 'prices', value: 'online_booking', corrected: true }, [{ ...proposal, status: 'applied', decidedAt: 2000 }], where, 'owner').kind).toBe('applied')
    // the same applied row read by an admin, who applies categories directly, is a correction
    expect(Classifications.chipState({ model: 'prices', value: 'online_booking', corrected: true }, [{ ...proposal, status: 'applied', decidedAt: 2000 }], where, 'admin').kind).toBe('corrected')
  })

  it('a correction applied after the reader\'s rejection wins: an applied row is dated by its decision (R1, finding 1)', () => {
    const where = { field: 'category', requestId: 7 }
    const mineRejected = entry({ field: 'category', subject: 'request', requestId: 7, status: 'rejected', createdAt: 100, decidedAt: 300 })
    const othersApplied = entry({ feedbackId: 2, field: 'category', subject: 'request', requestId: 7, byMe: false, status: 'applied', createdAt: 50, decidedAt: 400, valueTo: 'hours' })
    expect(Classifications.chipState({ model: 'prices', value: 'hours', corrected: true }, [mineRejected, othersApplied], where, 'owner').kind).toBe('corrected')
    // and the rejection stays said while it is the newer decision
    expect(Classifications.chipState({ model: 'prices', value: 'hours', corrected: true }, [{ ...mineRejected, decidedAt: 500 }, othersApplied], where, 'owner').kind).toBe('rejected')
  })

  it('a proposal of the reader still waiting is said, whatever was decided on its older ones (R1, second round)', () => {
    const where = { field: 'category', requestId: 7 }
    const older = entry({ field: 'category', subject: 'request', requestId: 7, status: 'rejected', createdAt: 100, decidedAt: 300 })
    const waiting = entry({ feedbackId: 3, field: 'category', subject: 'request', requestId: 7, status: 'proposed', createdAt: 200 })
    expect(Classifications.chipState({ model: 'prices', value: 'prices', corrected: false }, [older, waiting], where, 'owner').kind).toBe('proposed')
  })

  it('reads only the history of its own field and subject', () => {
    const other = entry({ field: 'category', subject: 'request', requestId: 8, status: 'proposed' })
    expect(Classifications.chipState({ model: 'prices', value: 'prices', corrected: false }, [other], { field: 'category', requestId: 7 }, 'owner').kind).toBe('model')
    expect(Classifications.historyOf([entry({}), other], { field: 'category', requestId: 8 })).toEqual([other])
  })

  it('"wrong" without a value is a proposal "to review", whatever the role', () => {
    const s = Classifications.chipState({ model: 'resolved', value: 'resolved', corrected: false }, [entry({ signal: 'wrong', valueTo: null, status: 'proposed' })], { field: 'resolution' }, 'admin')
    expect(s.kind).toBe('proposed')
  })
})

describe('the entries of a chip\'s menu', () => {
  it('every value with the current one marked, then right, wrong, restore when allowed, history', () => {
    const state = { value: 'resolved', kind: 'corrected', canRestore: true, correction: { feedbackId: 9 } }
    const entries = Classifications.menuEntries('resolution', state)
    expect(entries.filter((e) => e.kind === 'value').map((e) => [e.value, e.current])).toEqual([
      ['resolved', true], ['forwarded', false], ['handed_over', false], ['unresolved', false], ['caller_left', false], ['spam_wrong_number', false],
    ])
    expect(entries.filter((e) => e.kind !== 'value').map((e) => e.kind)).toEqual(['right', 'wrong', 'restore', 'history'])
    expect(entries.find((e) => e.kind === 'restore').feedbackId).toBe(9)
  })

  it('no "right" on a value that is not set: StarChat has nothing to confirm (R1, finding 2)', () => {
    const categories = [{ key: 'prices', label: 'Prezzi', active: true }]
    expect(Classifications.menuEntries('category', { value: null, kind: 'model' }, categories).map((e) => e.kind)).toEqual(['value', 'wrong', 'history'])
  })

  it('no restore when nothing is in force or the reader may not restore it', () => {
    expect(Classifications.menuEntries('message', { value: 'none', kind: 'model', canRestore: false }).map((e) => e.kind)).not.toContain('restore')
  })

  it('a category offers the active categories, and nothing when their list is unknown', () => {
    const categories = [{ key: 'prices', label: 'Prezzi', active: true }, { key: 'hours', label: 'Orari', active: true }]
    expect(Classifications.menuEntries('category', { value: 'hours', kind: 'model' }, categories).filter((e) => e.kind === 'value').map((e) => e.value)).toEqual(['prices', 'hours'])
    expect(Classifications.menuEntries('category', { value: 'hours', kind: 'model' }, null)).toEqual([])
  })
})

describe('the asks a gesture sends', () => {
  it('a call\'s judgement names its conversation; a request\'s names its request; valueFrom is always there', () => {
    expect(Classifications.ask({ conversationId: 'CON-1', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved' }))
      .toEqual({ subject: 'call', conversationId: 'CON-1', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved' })
    expect(Classifications.ask({ conversationId: 'CON-1', requestId: 7, field: 'category', signal: 'wrong', valueFrom: null }))
      .toEqual({ subject: 'request', conversationId: 'CON-1', requestId: 7, field: 'category', signal: 'wrong', valueFrom: null })
    expect(() => Classifications.ask({ conversationId: 'CON-1', field: 'resolution', signal: 'right' })).toThrow(/valueFrom/)
  })

  it('a fact is reported wrong with the value read, and names no value of its own', () => {
    expect(Classifications.FACT_FIELDS).toEqual(['booked', 'transferred', 'no_conversation', 'managed_call', 'skill_errors', 'unkept'])
    expect(Classifications.ask({ conversationId: 'CON-1', field: 'booked', signal: 'fact_wrong', valueFrom: 'true' }))
      .toEqual({ subject: 'call', conversationId: 'CON-1', field: 'booked', signal: 'fact_wrong', valueFrom: 'true' })
    expect(() => Classifications.ask({ conversationId: 'CON-1', field: 'booked', signal: 'wrong_value', valueFrom: 'true', valueTo: 'false' })).toThrow(/fact/)
  })

  it('a gesture id is new each time', () => {
    const a = Classifications.newGestureId()
    expect(a).toMatch(/^[0-9a-f-]{20,}$/)
    expect(Classifications.newGestureId()).not.toBe(a)
  })
})

describe('the one filter table: a count, its link, and the list it opens (StarChat SessionTimescaleService.filterConditions)', () => {
  const window = { from: 1000, to: 2000 }
  const link = (kind, key) => Classifications.countLink('biz-1', window, kind, key)
  const base = { id: 'biz-1', from: '1000', to: '2000', counted: 'true' }

  it('every count kind of the brief\'s scope 6 maps to its own search filter, in the same window, counted as the analytics count', () => {
    expect(link('outcomeLine', 'resolved').query).toEqual({ ...base, outcomeLine: 'resolved' })
    expect(link('outcomeLine', 'forwarded_complete').query).toEqual({ ...base, outcomeLine: 'forwarded_complete' })
    expect(link('outcomeLine', 'forwarded_incomplete').query).toEqual({ ...base, outcomeLine: 'forwarded_incomplete' })
    expect(link('outcomeLine', 'handed_over').query).toEqual({ ...base, outcomeLine: 'handed_over' })
    expect(link('outcomeLine', 'unresolved').query).toEqual({ ...base, outcomeLine: 'unresolved' })
    expect(link('resolution', 'caller_left').query).toEqual({ ...base, resolution: 'caller_left' })
    expect(link('resolution', 'spam_wrong_number').query).toEqual({ ...base, resolution: 'spam_wrong_number' })
    expect(link('message', 'incomplete').query).toEqual({ ...base, message: 'incomplete' })
    expect(link('booked', true).query).toEqual({ ...base, booked: 'true' })
    expect(link('transferred', true).query).toEqual({ ...base, transferred: 'true' })
    expect(link('noConversation', 'caller_silent').query).toEqual({ ...base, noConversation: 'caller_silent' })
    expect(link('topic', 'Bookings').query).toEqual({ ...base, topic: 'Bookings' })
    expect(link('topicLabels', ['booking', 'table for four']).query).toEqual({ ...base, topicLabel: ['booking', 'table for four'] })
    expect(link('gap', 'missing_info').query).toEqual({ ...base, gap: 'missing_info' })
    expect(link('check', 'caller_repeated').query).toEqual({ ...base, check: 'caller_repeated' })
    expect(link('unanswered', true).query).toEqual({ ...base, unanswered: 'true' })
    expect(link('requestCategory', { category: 'prices' }).query).toEqual({ ...base, category: 'prices' })
    expect(link('requestCategory', { category: 'prices', outcomes: ['taken', 'neither'] }).query).toEqual({ ...base, category: 'prices', requestOutcome: ['taken', 'neither'] })
    expect(link('requestCategory', { category: null }).query).toEqual({ ...base, category: 'unclassified' })
    expect(link('outcomeLine', 'resolved').path).toBe('/conversations')
  })

  it('a count frozen into a report asks its list how many calls it leaves out for the reader (StarChat dc4d7f7f6)', () => {
    expect(Classifications.countLink('biz-1', window, 'gap', 'missing_info', { report: true }).query).toEqual({ ...base, gap: 'missing_info', leftOut: 'true' })
    expect(Classifications.countLink('biz-1', window, 'gap', 'missing_info').query.leftOut).toBeUndefined()
  })

  it('refuses a value outside its closed set, and a kind it does not know', () => {
    expect(() => link('outcomeLine', 'forwarded')).toThrow()
    expect(() => link('gap', 'nope')).toThrow()
    expect(() => link('skillErrors', 1)).toThrow()
  })

  it('the address read back is the search body of exactly that count', () => {
    const q = link('requestCategory', { category: 'prices', outcomes: ['taken'] }).query
    expect(Classifications.searchFromQuery(q)).toEqual({
      body: { timestampGte: 1000, timestampLte: 2000, counted: true, requestCategory: 'prices', requestOutcomes: ['taken'] },
      filters: [{ key: 'category', value: 'prices' }, { key: 'requestOutcome', value: ['taken'] }],
      unknown: [],
    })
    expect(Classifications.searchFromQuery({ id: 'biz-1', topicLabel: 'parking', gap: 'missing_info', check: 'caller_repeated', corrected: 'true', booked: 'false' }).body)
      .toEqual({ topicLabels: ['parking'], gap: 'missing_info', check: 'caller_repeated', corrected: true, booked: false })
    expect(Classifications.searchFromQuery({ unanswered: 'false' }).body).toEqual({ hasUnanswered: false })
    expect(Classifications.searchFromQuery({ resolution: 'resolved', message: 'none', transferred: 'true', unanswered: 'true', noConversation: 'not_answered', outcomeLine: 'unresolved', topic: 'Parking' }).body)
      .toEqual({ resolution: 'resolved', message: 'none', transferred: true, hasUnanswered: true, noConversation: 'not_answered', outcomeLine: 'unresolved', topic: 'Parking' })
  })

  it('an address value outside its closed set is not applied, and is named', () => {
    const read = Classifications.searchFromQuery({ gap: 'nope', resolution: 'resolved', from: 'x' })
    // strict: a key present with an undefined value would still reach the request body
    expect(read.body).toStrictEqual({ resolution: 'resolved' })
    expect(read.filters).toStrictEqual([{ key: 'resolution', value: 'resolved' }])
    expect(read.unknown).toEqual(['gap', 'from'])
  })

  it('a filter removed from the address leaves the others', () => {
    const q = { id: 'biz-1', gap: 'missing_info', check: 'caller_repeated', from: '1', to: '2', counted: 'true' }
    expect(Classifications.withoutFilter(q, 'gap')).toEqual({ id: 'biz-1', check: 'caller_repeated', from: '1', to: '2', counted: 'true' })
  })
})

describe('the clients', () => {
  it('reads a call\'s judgements; 404 is absent, 503 not yet', async () => {
    axios.get.mockResolvedValueOnce({ data: { conversationId: 'CON-1' } })
    await expect(Classifications.classifications(user, 'biz 1', 'CON/1')).resolves.toEqual({ conversationId: 'CON-1' })
    expect(axios.get.mock.calls[0][0]).toMatch(/\/customer\/insights\/calls\/CON%2F1\/classifications\?businessId=biz%201$/)
    expect(axios.get.mock.calls[0][1].headers.auth).toBe('token')
    axios.get.mockRejectedValueOnce(httpError(404))
    await expect(Classifications.classifications(user, 'b', 'c')).resolves.toBeNull()
    axios.get.mockRejectedValueOnce(httpError(503))
    await expect(Classifications.classifications(user, 'b', 'c')).resolves.toEqual({ unavailable: true })
  })

  it('sends one signal and one bulk gesture under their gesture id, and a stale value as its refusal', async () => {
    axios.post.mockResolvedValueOnce({ data: { feedbackId: 3, status: 'applied', value: 'unresolved' } })
    const a = Classifications.ask({ conversationId: 'CON-1', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved' })
    await expect(Classifications.signal(user, a, 'g-1')).resolves.toMatchObject({ status: 'applied' })
    expect(axios.post.mock.calls[0][0]).toMatch(/\/customer\/insights\/feedback$/)
    expect(axios.post.mock.calls[0][1]).toEqual({ ...a, gestureId: 'g-1' })
    axios.post.mockResolvedValueOnce({ data: { applied: 2, proposed: 0, items: [] } })
    await Classifications.bulk(user, [a, a], 'g-2')
    expect(axios.post.mock.calls[1][0]).toMatch(/\/feedback\/bulk$/)
    expect(axios.post.mock.calls[1][1]).toEqual({ items: [a, a], gestureId: 'g-2' })
    axios.post.mockRejectedValueOnce(httpError(409, { code: 'stale_value', current: [] }))
    await expect(Classifications.signal(user, a, 'g-3')).rejects.toMatchObject({ response: { status: 409 } })
  })

  it('undoes a gesture, and reverts, applies or rejects one signal', async () => {
    axios.post.mockResolvedValue({ data: {} })
    await Classifications.revertGesture(user, 'g/1')
    await Classifications.revert(user, 5)
    await Classifications.apply(user, 6, 70)
    await Classifications.reject(user, 7)
    expect(axios.post.mock.calls.map((c) => c[0].replace(/^.*\/customer\/insights/, ''))).toEqual([
      '/feedback/gestures/g%2F1/revert', '/feedback/5/revert', '/feedback/6/apply', '/feedback/7/reject',
    ])
    expect(axios.post.mock.calls[2][1]).toEqual({ requestId: 70 })
  })

  it('reads the queues, the caller rules, a category\'s requests, the category list, the access record; asks the audio link', async () => {
    axios.get.mockResolvedValue({ data: {} })
    axios.post.mockResolvedValue({ data: {} })
    axios.delete.mockResolvedValue({ data: {} })
    await Classifications.queue(user, { mine: true, businessId: 'b', from: 10, size: 10, asOf: 5 })
    await Classifications.callerRules(user, 'b', 'CON-1')
    await Classifications.createRule(user, 'b', 'CON-1', true)
    await Classifications.deleteRule(user, 'b', '+39 333')
    await Classifications.categoryRequests(user, 'prices', { timestampGte: 1, timestampLte: 2 }, { businessId: 'b', outcome: 'taken', from: 0, size: 10 })
    await Classifications.categories(user, 'it-IT')
    await Classifications.accessLog(user, { businessId: 'b', from: 0, size: 10 })
    await Classifications.audioLink(user, 'CON-1')
    const gets = axios.get.mock.calls.map((c) => c[0].replace(/^.*\/mrcall0/, ''))
    expect(gets).toEqual([
      '/customer/insights/feedback?mine=true&businessId=b&from=10&size=10&asOf=5',
      '/customer/insights/caller-rules?businessId=b&conversationId=CON-1',
      '/customer/insights/categories?language=it-IT',
      '/customer/conversation/access-log?businessId=b&from=0&size=10',
    ])
    const posts = axios.post.mock.calls.map((c) => [c[0].replace(/^.*\/mrcall0/, ''), c[1]])
    expect(posts).toEqual([
      ['/customer/insights/caller-rules?businessId=b', { conversationId: 'CON-1', applyToEarlier: true }],
      ['/customer/insights/categories/prices/requests?businessId=b&outcome=taken&from=0&size=10', { timestampGte: 1, timestampLte: 2 }],
      ['/customer/conversation/audio?id=CON-1', {}],
    ])
    expect(axios.delete.mock.calls[0][0].replace(/^.*\/mrcall0/, '')).toBe('/customer/insights/caller-rules?businessId=b&caller=%2B39%20333')
  })
})

/**
 * A gesture's answer carries the touched call's state (StarChat a012b6926), so a call's judgements are never read again
 * after a gesture: the state replaces the judgements, and the history (which the state does not carry) is kept and
 * updated from what the gesture wrote. Seen failing on 2d39e13, where none of these existed.
 */
describe('a call\'s judgements from a gesture\'s answer, with no re-read', () => {
  const read = judgedRead()
  function judgedRead () {
    return {
      conversationId: 'CON-1', businessId: 'b', callStart: 1, version: 7,
      resolution: { model: 'resolved', value: 'resolved', corrected: false }, message: { model: 'none', value: 'none', corrected: false },
      requests: [{ requestId: 7, ordinal: 1, text: 't', outcome: { model: 'met', value: 'met', corrected: false }, category: { model: 'prices', value: 'prices', corrected: false } }],
      facts: { booked: 'true' },
      history: [entry({ feedbackId: 1, status: 'reverted' })],
    }
  }
  const state = { ...read, resolution: { model: 'resolved', value: 'unresolved', corrected: true }, history: undefined }

  it('takes the answer\'s state and keeps the history it does not carry', () => {
    const next = Classifications.withCallState(read, state)
    expect(next.resolution.value).toBe('unresolved')
    expect(next.history).toEqual(read.history)
    expect(next.facts).toEqual({ booked: 'true' })
  })

  it('records what the gesture wrote in the history, so the chip says it at once', () => {
    const a = Classifications.ask({ conversationId: 'CON-1', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved' })
    const h = Classifications.withSignal(read.history, { feedbackId: 9, status: 'applied' }, a, 'g-1', 'owner', 5000)
    expect(h).toHaveLength(2)
    expect(h[1]).toMatchObject({ feedbackId: 9, subject: 'call', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved', status: 'applied', byMe: true, actorRole: 'owner', createdAt: 5000, decidedAt: 5000, gestureId: 'g-1' })
    const s = Classifications.chipState(state.resolution, h, { field: 'resolution' }, 'owner')
    expect(s.kind).toBe('corrected')
    expect(s.correction).toMatchObject({ from: 'resolved', to: 'unresolved', byMe: true })
    // a proposal is said as one
    const p = Classifications.withSignal(read.history, { feedbackId: 10, status: 'proposed' }, Classifications.ask({ conversationId: 'CON-1', requestId: 7, field: 'category', signal: 'wrong_value', valueFrom: 'prices', valueTo: 'hours' }), 'g-2', 'owner', 6000)
    expect(Classifications.chipState(read.requests[0].category, p, { field: 'category', requestId: 7 }, 'owner').kind).toBe('proposed')
    // a replay of a gesture already in the history adds nothing
    expect(Classifications.withSignal(h, { feedbackId: 9, status: 'applied', replayed: true }, a, 'g-1', 'owner', 7000)).toHaveLength(2)
  })

  it('marks an undone gesture\'s signals reverted, and a decision in place', () => {
    const h = [entry({ feedbackId: 9, gestureId: 'g-1' }), entry({ feedbackId: 10, gestureId: 'g-2' })]
    expect(Classifications.withReverted(h, [9], 8000).map((x) => x.status)).toEqual(['reverted', 'applied'])
    expect(Classifications.withDecision(h, { feedbackId: 10, status: 'rejected', decidedAt: 9000, call: {} })[1]).toMatchObject({ feedbackId: 10, status: 'rejected', decidedAt: 9000 })
    expect(Classifications.withDecision(h, { feedbackId: 10, status: 'rejected', call: {} })[1].call).toBeUndefined()
  })

  it('a value corrected by a gesture made elsewhere says so, though this reader has not read its history', () => {
    expect(Classifications.chipState({ model: 'resolved', value: 'spam_wrong_number', corrected: true }, [], { field: 'resolution' }, 'owner').kind).toBe('corrected')
    expect(Classifications.chipState({ model: 'resolved', value: 'resolved', corrected: true }, [], { field: 'resolution' }, 'owner').kind).toBe('model')
  })

  it('a correction replacing another marks it reverted, as StarChat does, and the undo of the second leaves neither (C10, second round)', () => {
    const A = entry({ feedbackId: 1, valueFrom: 'resolved', valueTo: 'unresolved', status: 'applied', createdAt: 9000, decidedAt: 9000 })
    const askB = Classifications.ask({ conversationId: 'CON-1', field: 'resolution', signal: 'wrong_value', valueFrom: 'unresolved', valueTo: 'handed_over' })
    // a browser clock behind the server's still dates the new row after the rows it has
    const h = Classifications.withSignal([A], { feedbackId: 2, status: 'applied' }, askB, 'g-B', 'owner', 1000)
    expect(h.map((x) => [x.feedbackId, x.status])).toEqual([[1, 'reverted'], [2, 'applied']])
    expect(h[1].createdAt).toBeGreaterThan(9000)
    const afterUndo = Classifications.withReverted(h, [2], 1500)
    const settled = { model: 'resolved', value: 'resolved', corrected: false }
    expect(Classifications.chipState(settled, afterUndo, { field: 'resolution' }, 'owner')).toMatchObject({ kind: 'model', canRestore: false, correction: null })
  })

  it('a gesture made in another panel brings its signals, so this panel\'s chip says the same (C10, second round)', () => {
    const A = entry({ feedbackId: 1, valueFrom: 'resolved', valueTo: 'unresolved', status: 'applied', createdAt: 9000, decidedAt: 9000 })
    const data = { ...read, resolution: { model: 'resolved', value: 'unresolved', corrected: true }, history: [A] }
    const askB = Classifications.ask({ conversationId: 'CON-1', field: 'resolution', signal: 'wrong_value', valueFrom: 'unresolved', valueTo: 'handed_over' })
    const gesture = { gestureId: 'g-B', role: 'owner', calls: [{ ...state, resolution: { model: 'resolved', value: 'handed_over', corrected: true } }], entries: [{ ask: askB, answer: { feedbackId: 2, status: 'applied' } }] }
    const next = Classifications.withGesture(data, gesture, 2000)
    const s = Classifications.chipState(next.resolution, next.history, { field: 'resolution' }, 'owner')
    expect(s).toMatchObject({ value: 'handed_over', kind: 'corrected' })
    expect(s.correction).toMatchObject({ from: 'unresolved', to: 'handed_over', feedbackId: 2 })
    // a gesture on another call changes nothing here
    expect(Classifications.withGesture(data, { ...gesture, calls: [{ ...state, conversationId: 'CON-9' }], entries: [{ ask: { ...askB, conversationId: 'CON-9' }, answer: { feedbackId: 3, status: 'applied' } }] }, 2000)).toBe(data)
  })

  it('a bulk answer\'s items pair with their asks by call, field and request, whatever order StarChat answers them in (C10, second round)', () => {
    const asks = [
      Classifications.ask({ conversationId: 'CON-1', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'spam_wrong_number' }),
      Classifications.ask({ conversationId: 'CON-2', field: 'resolution', signal: 'wrong_value', valueFrom: 'unresolved', valueTo: 'spam_wrong_number' }),
      Classifications.ask({ conversationId: 'CON-2', requestId: 7, field: 'category', signal: 'wrong_value', valueFrom: 'hours', valueTo: 'prices' }),
    ]
    const items = [
      { feedbackId: 12, conversationId: 'CON-2', requestId: 7, field: 'category', status: 'applied' },
      { feedbackId: 11, conversationId: 'CON-2', field: 'resolution', status: 'applied' },
      { feedbackId: 10, conversationId: 'CON-1', field: 'resolution', status: 'proposed' },
    ]
    expect(Classifications.bulkEntries(asks, items).map((e) => [e.ask.conversationId, e.ask.field, e.answer.feedbackId])).toEqual([['CON-1', 'resolution', 10], ['CON-2', 'resolution', 11], ['CON-2', 'category', 12]])
    expect(Classifications.bulkEntries(asks, undefined)).toEqual([])
  })

  it('a stale value (409) takes the current values the refusal carries', () => {
    const next = Classifications.withCurrent(read, [{ conversationId: 'CON-1', field: 'resolution', value: 'handed_over' }, { conversationId: 'CON-1', requestId: 7, field: 'category', value: 'hours' }, { conversationId: 'CON-1', field: 'booked', value: 'false' }])
    expect(next.resolution.value).toBe('handed_over')
    expect(next.requests[0].category.value).toBe('hours')
    expect(next.facts.booked).toBe('false')
    expect(read.resolution.value).toBe('resolved')
  })
})

describe('who reads a call as its owner (StarChat ConversationAccess: no answer says it)', () => {
  it('the reader owns the business\'s calls when it is the business\'s owner', () => {
    expect(Classifications.isOwnerOf({ owner: 'u1' }, { uid: 'u1' })).toBe(true)
    expect(Classifications.isOwnerOf({ owner: 'u2' }, { uid: 'u1' })).toBe(false)
    // not known until the business is read: a caller waits, since a non-owner's read is recorded and never refused
    // (R1, finding 3)
    expect(Classifications.isOwnerOf(null, { uid: 'u1' })).toBeNull()
    expect(Classifications.isOwnerOf({ owner: null }, { uid: 'u1' })).toBeNull()
    expect(Classifications.isOwnerOf({ owner: 'u1' }, null)).toBeNull()
  })
})
