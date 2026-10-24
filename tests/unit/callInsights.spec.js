import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `src/utils/CallInsights.js`: the value table of a call's four dimensions (insights version 2), and the clients for StarChat's call-insights
 * routes (its own conversation-analytics API reference, §7-10, and its customer conversation API
 * guide, read 2026-10-20). Each client is checked for the path and body it sends,
 * and for the three answers every route can give beyond 200: 404 (no access, or out of scope) as
 * an absent section, 503 (reports, migration not run) as "not available yet", and a session-ended
 * error passed through untouched for the axios interceptor's own navigation.
 */
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const axios = (await import('axios')).default
const CallInsights = (await import('@/utils/CallInsights')).default

const user = { accessToken: 'token' }
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })
const sessionEndedError = () => Object.assign(new Error('session ended'), { sessionEnded: true })

beforeEach(() => {
  axios.get.mockReset()
  axios.post.mockReset()
  axios.delete.mockReset()
})

describe('insightRows: the one value table for a call\'s four dimensions', () => {
  // A call of insights version 2 is one that carries `booked`: StarChat writes it whenever the
  // extraction answered, so `transferred` absent on such a call means "not known", never "no".
  const row = (dimension, value, assessed) => ({ dimension, value, assessed })

  it('shows a judged resolution and message by their codes, marked as the assistant\'s own assessment', () => {
    expect(CallInsights.insightRows({ resolution: 'handed_over', message: 'incomplete', booked: true, transferred: true })).toEqual([
      row('resolution', 'handed_over', true),
      row('message', 'incomplete', true),
      row('booked', 'true', false),
      row('transferred', 'true', false),
    ])
  })

  it('knows every code StarChat writes for resolution and message, and drops one it does not know', () => {
    expect(CallInsights.RESOLUTION_KEYS).toEqual(['resolved', 'forwarded', 'handed_over', 'unresolved', 'caller_left', 'spam_wrong_number'])
    expect(CallInsights.MESSAGE_KEYS).toEqual(['complete', 'incomplete', 'unintelligible', 'none'])
    for (const code of CallInsights.RESOLUTION_KEYS) {
      expect(CallInsights.insightRows({ resolution: code })).toEqual([row('resolution', code, true)])
    }
    for (const code of CallInsights.MESSAGE_KEYS) {
      expect(CallInsights.insightRows({ message: code })).toEqual([row('message', code, true)])
    }
    expect(CallInsights.insightRows({ resolution: 'something_new', message: 'something_new' })).toEqual([])
    expect(CallInsights.insightRows({ resolution: 'booked' })).toEqual([])
  })

  it('shows nothing for a resolution or a message that is absent', () => {
    expect(CallInsights.insightRows({ booked: true, transferred: true }).map(r => r.dimension)).toEqual(['booked', 'transferred'])
  })

  it('shows booked true and false as a recorded fact, with no marking', () => {
    expect(CallInsights.insightRows({ booked: true, transferred: true })[0]).toEqual(row('booked', 'true', false))
    expect(CallInsights.insightRows({ booked: false, transferred: true })[0]).toEqual(row('booked', 'false', false))
  })

  it('shows nothing for a booked that is absent', () => {
    expect(CallInsights.insightRows({ resolution: 'resolved' }).map(r => r.dimension)).toEqual(['resolution'])
    expect(CallInsights.insightRows({ resolution: 'resolved', transferred: true }).map(r => r.dimension)).toEqual(['resolution', 'transferred'])
  })

  it('shows transferred true as a recorded fact, with no marking', () => {
    expect(CallInsights.insightRows({ booked: false, transferred: true }).at(-1)).toEqual(row('transferred', 'true', false))
  })

  it('shows transferred absent on a version-2 call as "unknown", never as "no", even when the server wrote a false', () => {
    expect(CallInsights.insightRows({ booked: true }).at(-1)).toEqual(row('transferred', 'unknown', false))
    expect(CallInsights.insightRows({ booked: false }).at(-1)).toEqual(row('transferred', 'unknown', false))
    expect(CallInsights.insightRows({ booked: false, transferred: false }).at(-1)).toEqual(row('transferred', 'unknown', false))
  })

  it('shows none of the four for a call without version-2 insights', () => {
    expect(CallInsights.insightRows({})).toEqual([])
    expect(CallInsights.insightRows({ outcome: 'resolved', topics: ['x'] })).toEqual([])
    expect(CallInsights.insightRows(undefined)).toEqual([])
    expect(CallInsights.insightRows(null)).toEqual([])
  })

  it('reads a call the transfer leg answered after it ended: the same call, one more fact', () => {
    const ended = { booked: false, resolution: 'unresolved' }
    expect(CallInsights.insightRows(ended).at(-1)).toEqual(row('transferred', 'unknown', false))
    expect(CallInsights.insightRows({ ...ended, transferred: true }).at(-1)).toEqual(row('transferred', 'true', false))
  })

  it('says which dimensions are the assistant\'s own judgement', () => {
    expect(CallInsights.isAssessed('resolution')).toBe(true)
    expect(CallInsights.isAssessed('message')).toBe(true)
    expect(CallInsights.isAssessed('booked')).toBe(false)
    expect(CallInsights.isAssessed('transferred')).toBe(false)
  })

  it('exports the gap and check keys the quality signals and the panel share', () => {
    expect(CallInsights.GAP_KEYS).toEqual(['missing_info', 'needs_integration', 'out_of_scope', 'assistant_error'])
    expect(CallInsights.CHECK_KEYS).toEqual(['caller_repeated', 'caller_unsatisfied', 'promise_not_kept_in_call'])
  })
})

describe('unkeptRows and firedChecks: what the caller was told and the record does not show done', () => {
  it('reads each {action, said} entry of `unkept`, in order, naming a known action by its key', () => {
    expect(CallInsights.UNKEPT_ACTIONS).toEqual(['book', 'move', 'cancel', 'transfer'])
    expect(CallInsights.unkeptRows({ unkept: [
      { action: 'book', said: 'I have booked you for Monday at 10.' },
      { action: 'transfer', said: 'I am putting you through now.' },
    ] })).toEqual([
      { action: 'book', said: 'I have booked you for Monday at 10.' },
      { action: 'transfer', said: 'I am putting you through now.' },
    ])
  })

  it('keeps an action it does not know with no key, so the panel shows the neutral label and never the raw key', () => {
    expect(CallInsights.unkeptRows({ unkept: [{ action: 'refund', said: 'Refunded.' }] })).toEqual([{ action: null, said: 'Refunded.' }])
  })

  it('shows nothing for an empty, malformed or absent list, and drops an entry with no words', () => {
    expect(CallInsights.unkeptRows({ unkept: [] })).toEqual([])
    expect(CallInsights.unkeptRows({})).toEqual([])
    expect(CallInsights.unkeptRows(undefined)).toEqual([])
    expect(CallInsights.unkeptRows(null)).toEqual([])
    expect(CallInsights.unkeptRows({ unkept: 'book' })).toEqual([])
    expect(CallInsights.unkeptRows({ unkept: { action: 'book', said: 'x' } })).toEqual([])
    expect(CallInsights.unkeptRows({ unkept: [null, 3, 'x', { action: 'book' }, { action: 'book', said: '   ' }, { action: 'book', said: 7 }] })).toEqual([])
    expect(CallInsights.unkeptRows({ unkept: [null, { action: 'move', said: 'Moved.' }] })).toEqual([{ action: 'move', said: 'Moved.' }])
  })

  it('does not translate or alter the words', () => {
    expect(CallInsights.unkeptRows({ unkept: [{ action: 'cancel', said: 'Ho <b>cancellato</b> tutto.' }] })[0].said).toBe('Ho <b>cancellato</b> tutto.')
  })

  it('fires the checks that are true, and hides promise_not_kept_in_call only while unkept entries show the same fact', () => {
    const checks = { caller_repeated: true, caller_unsatisfied: false, promise_not_kept_in_call: true }
    expect(CallInsights.firedChecks({ checks })).toEqual(['caller_repeated', 'promise_not_kept_in_call'])
    expect(CallInsights.firedChecks({ checks, unkept: [] })).toEqual(['caller_repeated', 'promise_not_kept_in_call'])
    expect(CallInsights.firedChecks({ checks, unkept: 'garbage' })).toEqual(['caller_repeated', 'promise_not_kept_in_call'])
    expect(CallInsights.firedChecks({ checks, unkept: [{ action: 'book', said: 'Booked.' }] })).toEqual(['caller_repeated'])
    expect(CallInsights.firedChecks({})).toEqual([])
    expect(CallInsights.firedChecks(undefined)).toEqual([])
  })
})

describe('outcomes: refuses a call with no time zone', () => {
  it('rejects before sending anything, as Analytics.js does for the time series', async () => {
    await expect(CallInsights.outcomes(user, {}, 'daily')).rejects.toThrow(/timezone/)
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('sends granularity and timezone on the query string, and the body untouched', async () => {
    axios.post.mockResolvedValue({ data: { resolution: { totals: {} } } })
    const body = { businessId: 'b-1', timestampGte: 1 }
    await CallInsights.outcomes(user, body, 'daily', 'Europe/Rome')
    const [url, sentBody, config] = axios.post.mock.calls[0]
    expect(url).toContain('/customer/analytics/outcomes')
    expect(url).toContain('granularity=daily')
    expect(url).toContain('timezone=Europe%2FRome')
    expect(sentBody).toBe(body)
    expect(config.headers.auth).toBe('token')
  })
})

describe('quality', () => {
  it('posts the body to the quality route', async () => {
    axios.post.mockResolvedValue({ data: { checks: {} } })
    const body = { businessId: 'b-1' }
    await CallInsights.quality(user, body)
    const [url, sentBody] = axios.post.mock.calls[0]
    expect(url).toContain('/customer/analytics/quality')
    expect(sentBody).toBe(body)
  })
})

describe('report: one report', () => {
  it('reads the automatic report at its periodStart, scoped to the business', async () => {
    axios.get.mockResolvedValue({ data: { version: 1 } })
    await CallInsights.report(user, 'b-1', '2026-10-13T00:00:00Z')
    const [url] = axios.get.mock.calls[0]
    expect(url).toContain('/customer/insights/reports/2026-10-13T00%3A00%3A00Z')
    expect(url).toContain('businessId=b-1')
    expect(url).not.toContain('requestId=')
  })

  it('reads a report on request by its requestId', async () => {
    axios.get.mockResolvedValue({ data: { version: 2 } })
    await CallInsights.report(user, 'b-1', 1700000000000, 'job 1')
    const [url] = axios.get.mock.calls[0]
    expect(url).toContain('/customer/insights/reports/1700000000000')
    expect(url).toContain('requestId=job%201')
  })
})

describe('a report\'s identity: automatic or on request', () => {
  it('tells an on-request report by its requestId, an automatic one by its absence', () => {
    expect(CallInsights.isOnRequest({ periodStart: 1, requestId: 'job-1' })).toBe(true)
    expect(CallInsights.isOnRequest({ periodStart: 1, cadence: 7 })).toBe(false)
    expect(CallInsights.isOnRequest({ periodStart: 1, requestId: '' })).toBe(false)
  })

  it('keys an automatic and an on-request report of the same start apart', () => {
    const automatic = CallInsights.reportKey({ periodStart: 1, periodEnd: 2, cadence: 7 })
    const asked = CallInsights.reportKey({ periodStart: 1, periodEnd: 2, requestId: 'job-1' })
    expect(automatic).not.toBe(asked)
    expect(CallInsights.reportKey({ periodStart: 1, requestId: 'job-1' })).toBe(asked)
  })
})

// StarChat names a report's example calls when it answers (`exampleCalls`, analytics guide §10): by conversation
// id, the call's start and its caller, the contact's name as the conversation list shows it, else its number.
describe('exampleCallName: an example call by its caller and when it started', () => {
  const START = Date.UTC(2026, 9, 14, 9, 30)
  const when = (locale) => new Date(START).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const report = { exampleCalls: { 'CON-1': { startTimestamp: START, caller: 'Maria Rossi' }, 'CON-2': { startTimestamp: START } } }

  it('says the caller and the start in the reader\'s locale', () => {
    expect(CallInsights.exampleCallName(report, 'CON-1', 'it-IT')).toBe(`Maria Rossi, ${when('it-IT')}`)
    expect(CallInsights.exampleCallName(report, 'CON-1', 'en-US')).toBe(`Maria Rossi, ${when('en-US')}`)
  })

  it('says the start alone for a call without a caller on record', () => {
    expect(CallInsights.exampleCallName(report, 'CON-2', 'en-US')).toBe(when('en-US'))
  })

  it('has no name for a call StarChat did not name, or a label without its start', () => {
    expect(CallInsights.exampleCallName(report, 'CON-3', 'en-US')).toBeNull()
    expect(CallInsights.exampleCallName({}, 'CON-1', 'en-US')).toBeNull()
    expect(CallInsights.exampleCallName({ exampleCalls: { 'CON-1': { caller: 'Maria Rossi' } } }, 'CON-1', 'en-US')).toBeNull()
  })
})

describe('businessName: a business\'s company name, for a page that names it', () => {
  it('reads crm/business?id= and returns its companyName, never touching the store\'s role', async () => {
    axios.get.mockResolvedValue({ data: [{ businessId: 'b-1', companyName: ' Studio Demo ' }] })
    expect(await CallInsights.businessName(user, 'b 1')).toBe('Studio Demo')
    expect(axios.get.mock.calls[0][0]).toMatch(/\/crm\/business\?id=b%201$/)
    expect(axios.get.mock.calls[0][1].headers.auth).toBe('token')
  })

  it('has no name for a business without one, an empty answer, or a 404', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ businessId: 'b-1' }] })
    expect(await CallInsights.businessName(user, 'b-1')).toBeNull()
    axios.get.mockResolvedValueOnce({ data: [] })
    expect(await CallInsights.businessName(user, 'b-1')).toBeNull()
    axios.get.mockRejectedValueOnce(httpError(404))
    expect(await CallInsights.businessName(user, 'b-1')).toBeNull()
  })
})

describe('ownerName: an owner by the contact on its own business', () => {
  // StarChat's admin user record carries only the role (`FirebaseUserRegistryItem`): the owner's name
  // is the one its business was registered with.
  it('searches the owner\'s businesses and names it by the contact\'s name, else its e-mail', async () => {
    axios.post.mockResolvedValueOnce({ data: [{ businessId: 'b-1', name: ' Demo ', surname: 'Owner', emailAddress: 'o@example.com' }] })
    expect(await CallInsights.ownerName(user, 'owner-9')).toBe('Demo Owner')
    expect(axios.post.mock.calls[0][0]).toMatch(/\/crm\/business\/search$/)
    expect(axios.post.mock.calls[0][1]).toEqual({ owner: 'owner-9', offset: 0, limit: 1 })
    axios.post.mockResolvedValueOnce({ data: [{ businessId: 'b-1', emailAddress: 'o@example.com' }] })
    expect(await CallInsights.ownerName(user, 'owner-9')).toBe('o@example.com')
  })

  it('has no name for an owner without businesses, or a 404', async () => {
    axios.post.mockResolvedValueOnce({ data: [] })
    expect(await CallInsights.ownerName(user, 'owner-9')).toBeNull()
    axios.post.mockRejectedValueOnce(httpError(404))
    expect(await CallInsights.ownerName(user, 'owner-9')).toBeNull()
  })
})

describe('pageOf: one page of a scope-wide list', () => {
  it('reads total and items', () => {
    expect(CallInsights.pageOf({ total: 42, items: [{ text: 'a' }] })).toEqual({ total: 42, items: [{ text: 'a' }], asOf: undefined })
    expect(CallInsights.pageOf({ total: 1, items: [], asOf: 5 }).asOf).toBe(5)
  })

  it('reads a malformed answer (the list before M16, a placeholder) as an empty page, never as items', () => {
    expect(CallInsights.pageOf([{ text: 'a' }])).toEqual({ total: 0, items: [], asOf: undefined })
    expect(CallInsights.pageOf({ items: 'x' })).toEqual({ total: 0, items: [], asOf: undefined })
    expect(CallInsights.pageOf(null)).toEqual({ total: 0, items: [], asOf: undefined })
  })

  it('never reports fewer in all than it carries', () => {
    expect(CallInsights.pageOf({ items: [{ text: 'a' }, { text: 'b' }] })).toEqual({ total: 2, items: [{ text: 'a' }, { text: 'b' }], asOf: undefined })
  })
})

describe('businessLabel: a business by its name, its id only when it has none', () => {
  it('prefers the name, trimmed', () => {
    expect(CallInsights.businessLabel(' Studio Rossi ', 'biz-abc')).toBe('Studio Rossi')
  })

  it('falls back to the id when the name is absent or blank (StarChat omits it when unreadable)', () => {
    expect(CallInsights.businessLabel(undefined, 'biz-def')).toBe('biz-def')
    expect(CallInsights.businessLabel('  ', 'biz-def')).toBe('biz-def')
  })
})

describe('what every route answers beyond 200', () => {
  it('a 404 resolves to null: the section is simply absent', async () => {
    axios.post.mockRejectedValue(httpError(404))
    await expect(CallInsights.quality(user, {})).resolves.toBeNull()
  })

  it('a 503 resolves to {unavailable: true}: not a failure, not yet', async () => {
    axios.get.mockRejectedValue(httpError(503))
    await expect(CallInsights.reportsPage(user, 'b-1')).resolves.toEqual({ unavailable: true })
  })

  it('a session-ended error is rethrown untouched, read by isSessionEnded', async () => {
    const error = sessionEndedError()
    axios.post.mockRejectedValue(error)
    await expect(CallInsights.quality(user, {})).rejects.toBe(error)
  })

  it('any other failure is rethrown for the page\'s own toast', async () => {
    const error = httpError(500)
    axios.post.mockRejectedValue(error)
    await expect(CallInsights.quality(user, {})).rejects.toBe(error)
  })
})

describe('CallInsights.latestOnly', () => {
  it('keeps only the latest request of a section current, and sections apart', () => {
    const outcomes = CallInsights.latestOnly()
    const quality = CallInsights.latestOnly()
    const first = outcomes.begin()
    expect(first()).toBe(true)
    const second = outcomes.begin()
    const other = quality.begin()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
    expect(other()).toBe(true)
  })
})

describe('assistantShare: each column and sort of the assistants table over StarChat\'s own base', () => {
  // StarChat's analytics guide §9, its example row
  const row = {
    businessId: 'biz-abc', totalCalls: 40, callsWithResolution: 36,
    resolution: { resolved: 20, unresolved: 10, caller_left: 6 },
    callsWithChecks: 36, checks: { caller_repeated: 5, caller_unsatisfied: 4, promise_not_kept_in_call: 0 },
    callsWithUnansweredRecorded: 36, callsWithUnanswered: 9, gaps: { missing_info: 9 },
    callsWithSkillErrors: 0, extractionsNotOk: 1, extractionsRun: 36,
    callsManaged: 36, noConversation: { caller_silent: 12, no_credit: 1 },
    callsAnswered: 48, callsOffered: 48, callsWithRequest: 30,
  }

  // StarChat plan F3 (docs/execution-plans/2026-10-24-call-resolution-forwarded.md): `notSolved` is the server's own
  // count (unresolved, and forwarded with an incomplete message); the dashboard never adds resolution keys up.
  it('"Non risolte" is StarChat\'s notSolved over callsWithRequest, never a sum of resolution keys', () => {
    expect(CallInsights.assistantShare({ ...row, notSolved: 12 }, 'not_solved')).toEqual({ count: 12, base: 30, percent: 40 })
    expect(CallInsights.assistantShare(row, 'not_solved')).toEqual({ count: 0, base: 30, percent: 0 })
  })

  it('caller_silent over callsAnswered, not_answered over callsOffered, caller_left over callsWithResolution', () => {
    expect(CallInsights.assistantShare(row, 'caller_silent')).toEqual({ count: 12, base: 48, percent: 25 })
    expect(CallInsights.assistantShare(row, 'not_answered')).toEqual({ count: 0, base: 48, percent: 0 })
    expect(CallInsights.assistantShare(row, 'caller_left')).toEqual({ count: 6, base: 36, percent: 17 })
  })

  it('keeps the other signals on the bases StarChat sorts them by', () => {
    expect(CallInsights.assistantShare(row, 'unanswered')).toEqual({ count: 9, base: 36, percent: 25 })
    expect(CallInsights.assistantShare(row, 'checks')).toEqual({ count: 9, base: 36, percent: 25 })
    expect(CallInsights.assistantShare(row, 'skill_errors')).toEqual({ count: 0, base: 40, percent: 0 })
    expect(CallInsights.assistantShare(row, 'extraction_failures')).toEqual({ count: 1, base: 36, percent: 3 })
  })

  // The final review of D12: one signal on one base across the page. The quality section counts the
  // extraction problems over the calls whose extraction ran, and so does this column (StarChat 9.34,
  // `extractionsRun`), never over totalCalls, which also counts calls never put to the model.
  it('extraction_failures is over extractionsRun, not totalCalls', () => {
    const r = { totalCalls: 100, extractionsRun: 10, extractionsNotOk: 2, callsWithSkillErrors: 5 }
    expect(CallInsights.assistantShare(r, 'extraction_failures')).toEqual({ count: 2, base: 10, percent: 20 })
    expect(CallInsights.assistantShare(r, 'skill_errors')).toEqual({ count: 5, base: 100, percent: 5 })
  })

  it('a row without extractionsRun has no base for extraction_failures: no fallback to totalCalls', () => {
    expect(CallInsights.assistantShare({ totalCalls: 100, extractionsNotOk: 2 }, 'extraction_failures'))
      .toEqual({ count: 2, base: 0, percent: 0 })
  })

  it('names every sort key StarChat accepts, and refuses one it does not', () => {
    expect(CallInsights.ASSISTANT_SORT_KEYS).toEqual([
      'calls', 'not_solved', 'caller_silent', 'not_answered', 'caller_left',
      'unanswered', 'checks', 'skill_errors', 'extraction_failures',
    ])
    expect(() => CallInsights.assistantShare(row, 'calls')).toThrow(/not a share/)
    expect(() => CallInsights.assistantShare(row, 'something_new')).toThrow(/not a share/)
  })
})

describe('noConversationRows: the calls the assistant had no conversation in, one row per reason', () => {
  it('lists the four reasons in a fixed order, a missing one as zero', () => {
    expect(CallInsights.noConversationRows({ caller_silent: 31, no_credit: 4, talk_and_hangup: 2, not_answered: 1 })).toEqual([
      { key: 'caller_silent', count: 31 },
      { key: 'no_credit', count: 4 },
      { key: 'talk_and_hangup', count: 2 },
      { key: 'not_answered', count: 1 },
    ])
    expect(CallInsights.noConversationRows({ not_answered: 2 }).map(r => r.count)).toEqual([0, 0, 0, 2])
  })
})

describe('extractionProblems: only http_error and failed, over the calls whose extraction ran', () => {
  it('leaves not_managed out of the problems and out of the base', () => {
    // StarChat's analytics guide §8: ok 110, http_error 2, failed 1, not_managed 7
    expect(CallInsights.extractionProblems({ ok: 110, http_error: 2, failed: 1, not_managed: 7 }))
      .toEqual({ count: 3, base: 113 })
    expect(CallInsights.extractionProblems({ not_managed: 7 })).toEqual({ count: 0, base: 0 })
    expect(CallInsights.extractionProblems(undefined)).toEqual({ count: 0, base: 0 })
  })
})

describe('topics: one business\'s topics', () => {
  it('posts the body to the topics route', async () => {
    axios.post.mockResolvedValue({ data: { topics: [] } })
    const body = { businessId: 'b-1', timestampGte: 1 }
    await CallInsights.topics(user, body)
    const [url, sentBody, config] = axios.post.mock.calls[0]
    expect(url).toContain('/customer/analytics/topics')
    expect(sentBody).toBe(body)
    expect(config.headers.auth).toBe('token')
  })

  it('refuses a body without a business before sending anything, since StarChat answers it 400', async () => {
    await expect(CallInsights.topics(user, { timestampGte: 1 })).rejects.toThrow(/businessId/)
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('reads a 404 as absent and a 503 as not available yet, as every other section', async () => {
    axios.post.mockRejectedValueOnce(httpError(404))
    expect(await CallInsights.topics(user, { businessId: 'b-1' })).toBeNull()
    axios.post.mockRejectedValueOnce(httpError(503))
    expect(await CallInsights.topics(user, { businessId: 'b-1' })).toEqual({ unavailable: true })
  })
})

/*
 * The outcome of the calls where the caller asked something, as StarChat answers it from plan step F3: `outcome`
 * keyed resolved, forwarded_complete, forwarded_incomplete, handed_over, unresolved, over `callsWithRequest`.
 */
describe('outcomeShare: four lines over callsWithRequest, the request passed on split by its message', () => {
  const answer = {
    callsWithRequest: 100,
    outcome: {
      callsWithValue: 100,
      totals: { resolved: 50, forwarded_complete: 20, forwarded_incomplete: 5, handed_over: 10, unresolved: 15 },
      previousTotals: { resolved: 40, forwarded_complete: 10, forwarded_incomplete: 10, handed_over: 10, unresolved: 30 },
      buckets: [],
    },
    resolution: { totals: { caller_left: 7, spam_wrong_number: 2 } },
  }

  it('lists resolved, forwarded, handed_over and unresolved, adding up to the base', () => {
    expect(CallInsights.RESOLUTION_REQUEST_KEYS).toEqual(['resolved', 'forwarded', 'handed_over', 'unresolved'])
    const share = CallInsights.outcomeShare(answer)
    expect(share.base).toBe(100)
    expect(share.lines.map((l) => [l.key, l.count, l.percent, l.previous])).toEqual([
      ['resolved', 50, 50, 40], ['forwarded', 25, 25, 20], ['handed_over', 10, 10, 10], ['unresolved', 15, 15, 30],
    ])
    expect(share.lines.reduce((sum, l) => sum + l.count, 0)).toBe(answer.callsWithRequest)
    expect(share.lines[1].parts).toEqual([
      { key: 'forwarded_complete', count: 20, base: 100, percent: 20 },
      { key: 'forwarded_incomplete', count: 5, base: 100, percent: 5 },
    ])
  })

  it('has no lines for an answer without outcome (a server before F3): never rebuilt from resolution', () => {
    expect(CallInsights.outcomeShare({ resolution: { totals: { resolved: 3 } } })).toBeNull()
    expect(CallInsights.outcomeShare({ outcome: { totals: {} } })).toBeNull()
    expect(CallInsights.outcomeShare(null)).toBeNull()
  })

  it('counts caller_left and spam_wrong_number beside it', () => {
    expect(CallInsights.outsideRows(answer.resolution.totals)).toEqual([
      { key: 'caller_left', count: 7 }, { key: 'spam_wrong_number', count: 2 },
    ])
  })
})

describe('the reports and jobs clients (insights-reports-ux)', () => {
  it('reportsPage asks a page by size, with its filters and order, and never the cursor of v2.2.32', async () => {
    axios.get.mockResolvedValue({ data: { items: [], total: 0, asOf: 5 } })
    await CallInsights.reportsPage(user, 'b 1', { offset: 10, size: 10, asOf: 5, status: 'done', type: 'requested', sort: 'calls', direction: 'asc' })
    const [url] = axios.get.mock.calls[0]
    expect(url).toContain('/customer/insights/reports?')
    for (const part of ['businessId=b%201', 'size=10', 'offset=10', 'asOf=5', 'status=done', 'type=requested', 'sort=calls', 'direction=asc']) {
      expect(url).toContain(part)
    }
    expect(url).not.toMatch(/before|limit=/)
  })

  it('overlap, estimate, createJob, job, jobs and cancel reach their routes', async () => {
    axios.get.mockResolvedValue({ data: {} })
    axios.post.mockResolvedValue({ data: { jobId: 'j' } })
    await CallInsights.overlap(user, 'b', 1, 2)
    expect(axios.get.mock.calls[0][0]).toMatch(/\/reports\/overlap\?businessId=b&from=1&to=2$/)
    await CallInsights.estimate(user, { businessId: 'b', kind: 'report' })
    expect(axios.post.mock.calls[0][0]).toMatch(/\/insights\/estimate$/)
    await CallInsights.createJob(user, 'report', { estimateJobId: 'e' })
    expect(axios.post.mock.calls[1][0]).toMatch(/\/insights\/jobs\/report$/)
    expect(axios.post.mock.calls[1][1]).toEqual({ estimateJobId: 'e' })
    await CallInsights.jobs(user, 'b', { offset: 0, size: 10 })
    expect(axios.get.mock.calls[1][0]).toMatch(/\/insights\/jobs\?businessId=b&offset=0&size=10$/)
    await CallInsights.cancelJob(user, 'j 1')
    expect(axios.post.mock.calls[2][0]).toMatch(/\/insights\/jobs\/j%201\/cancel$/)
    await expect(CallInsights.createJob(user, 'estimate', {})).rejects.toThrow(/report or recompute/)
  })

  it('deleteReport names one report by business, start, end and request id, with the reason', async () => {
    axios.delete.mockResolvedValue({ data: { deleted: 2 } })
    await CallInsights.deleteReport(user, { businessId: 'b', periodStart: 1, periodEnd: 2, requestId: 'r', reason: 'test data' })
    expect(axios.delete.mock.calls[0][0]).toMatch(/\/reports\/1\?businessId=b&periodEnd=2&requestId=r&reason=test%20data$/)
  })

  it('refusalOf reads StarChat\'s closed code and the job it names, and nothing from any other failure', () => {
    const refused = Object.assign(new Error('409'), { response: { status: 409, data: { code: 'job_open', message: 'x', jobId: 'j' } } })
    expect(CallInsights.refusalOf(refused)).toEqual({ code: 'job_open', status: 409, jobId: 'j' })
    expect(CallInsights.refusalOf(httpError(500))).toBeNull()
    expect(CallInsights.refusalOf(new Error('network'))).toBeNull()
  })

  it('requestCategories asks the categories view with its options; the businesses of one are paged', async () => {
    axios.post.mockResolvedValue({ data: { items: [] } })
    await CallInsights.requestCategories(user, { timestampGte: 1 }, { includeDismissed: true, sort: 'businesses', language: 'it-IT' })
    expect(axios.post.mock.calls[0][0]).toMatch(/\/integrations\?view=categories&includeDismissed=true&sort=businesses&language=it-IT$/)
    await CallInsights.requestBusinesses(user, 'online_booking', {}, { from: 10, size: 10, asOf: 7 })
    expect(axios.post.mock.calls[1][0]).toMatch(/\/integrations\/online_booking\/businesses\?from=10&size=10&asOf=7$/)
  })

  it('assistants pages, orders and searches on the query string', async () => {
    axios.post.mockResolvedValue({ data: { businesses: [] } })
    await CallInsights.assistants(user, { timestampGte: 1 }, { sort: 'not_solved', direction: 'asc', from: 20, size: 10, search: 'Studio' })
    const [url] = axios.post.mock.calls[0]
    expect(url).toMatch(/\/assistants\?sort=not_solved&direction=asc&from=20&size=10&search=Studio$/)
  })

  it('business reads the name, zone, owner and plan of one business', async () => {
    axios.get.mockResolvedValue({ data: [{ businessId: 'b', companyName: 'Studio', timezoneStr: 'Europe/Rome', owner: 'u1', name: 'Anna', surname: 'Bianchi', subscriptionStatus: 'FREE', template: 't' }] })
    expect(await CallInsights.business(user, 'b')).toEqual({
      businessId: 'b', name: 'Studio', timeZone: 'Europe/Rome', owner: 'u1', ownerName: 'Anna Bianchi', subscriptionStatus: 'FREE', template: 't',
    })
  })
})

describe('serverPage: the one mechanism of a server-paged list', () => {
  it('reads the first page without asOf, a later page with the first page\'s, and a new sort from the first page again', async () => {
    const calls = []
    const fetch = (args) => { calls.push(args); return Promise.resolve({ items: [args.offset], total: 25, asOf: 99 }) }
    const page = CallInsights.serverPage(fetch, { size: 10, sort: 'periodEnd' })
    await page.refresh()
    expect(page.status).toBe('ok')
    expect(calls[0]).toEqual({ offset: 0, size: 10, asOf: undefined, sort: 'periodEnd', direction: 'desc' })
    await page.goTo(20)
    expect(calls[1]).toMatchObject({ offset: 20, asOf: 99 })
    expect(page.offset).toBe(20)
    await page.setSort('periodEnd')
    expect(calls[2]).toMatchObject({ offset: 0, asOf: undefined, direction: 'asc' })
    await page.setSort('calls')
    expect(calls[3]).toMatchObject({ sort: 'calls', direction: 'desc' })
  })

  it('reads a 404 as absent, a 503 as unavailable, any other failure as error with a retry, a session end as nothing', async () => {
    const onError = vi.fn()
    let answer = Promise.resolve(null)
    const page = CallInsights.serverPage(() => answer, { onError })
    await page.refresh()
    expect(page.status).toBe('absent')
    answer = Promise.resolve({ unavailable: true })
    await page.refresh()
    expect(page.status).toBe('unavailable')
    answer = Promise.reject(httpError(500))
    await page.refresh()
    expect(page.status).toBe('error')
    expect(onError).toHaveBeenCalledTimes(1)
    answer = Promise.reject(sessionEndedError())
    await page.retry()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('drops an earlier answer arriving after a later one', async () => {
    let first
    const answers = [new Promise((resolve) => { first = resolve }), Promise.resolve({ items: ['new'], total: 1 })]
    const page = CallInsights.serverPage(() => answers.shift())
    const a = page.refresh()
    await page.refresh()
    first({ items: ['old'], total: 1 })
    await a
    expect(page.items).toEqual(['new'])
  })
})
