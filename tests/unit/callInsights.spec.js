import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `src/utils/CallInsights.js`: the value table of a call's four dimensions (insights version 2), and the clients for StarChat's call-insights
 * routes (its own conversation-analytics API reference, §7-10, and its customer conversation API
 * guide, read 2026-10-20). Each client is checked for the path and body it sends,
 * and for the three answers every route can give beyond 200: 404 (no access, or out of scope) as
 * an absent section, 503 (reports, migration not run) as "not available yet", and a session-ended
 * error passed through untouched for the axios interceptor's own navigation.
 */
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const axios = (await import('axios')).default
const CallInsights = (await import('@/utils/CallInsights')).default

const user = { accessToken: 'token' }
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })
const sessionEndedError = () => Object.assign(new Error('session ended'), { sessionEnded: true })

beforeEach(() => {
  axios.get.mockReset()
  axios.post.mockReset()
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
    expect(CallInsights.RESOLUTION_KEYS).toEqual(['resolved', 'unresolved', 'handed_over', 'caller_left', 'spam_wrong_number'])
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

describe('assistants', () => {
  it('sends sort and limit on the query string', async () => {
    axios.post.mockResolvedValue({ data: { businesses: [] } })
    await CallInsights.assistants(user, { timestampGte: 1 }, 'not_solved', 25)
    const [url] = axios.post.mock.calls[0]
    expect(url).toContain('/customer/analytics/assistants')
    expect(url).toContain('sort=not_solved')
    expect(url).toContain('limit=25')
  })
})

describe('reports: paging', () => {
  it('reads the first page with businessId and limit only', async () => {
    axios.get.mockResolvedValue({ data: [] })
    await CallInsights.reports(user, 'b-1', null, 20)
    const [url] = axios.get.mock.calls[0]
    expect(url).toContain('businessId=b-1')
    expect(url).toContain('limit=20')
    expect(url).not.toContain('before=')
  })

  it('carries `before` as the previous page\'s last periodEnd', async () => {
    axios.get.mockResolvedValue({ data: [] })
    await CallInsights.reports(user, 'b-1', 1700000000000, 20)
    const [url] = axios.get.mock.calls[0]
    expect(url).toContain('before=1700000000000')
  })
})

describe('report: one period', () => {
  it('reads the report at its periodStart, scoped to the business', async () => {
    axios.get.mockResolvedValue({ data: { version: 1 } })
    await CallInsights.report(user, 'b-1', '2026-10-13T00:00:00Z')
    const [url] = axios.get.mock.calls[0]
    expect(url).toContain('/customer/insights/reports/2026-10-13T00%3A00%3A00Z')
    expect(url).toContain('businessId=b-1')
  })
})

describe('integrations and config-suggestions: the caller\'s whole scope, since a start, one page at a time', () => {
  // The base URL comes from the build's environment, absent here: the path and the query are what is checked.
  const parsed = (url) => new URL(url.replace(/^[^/]*\/mrcall/, 'http://starchat/mrcall'))
  // StarChat's analytics guide §10 (M16): both answer one page, `from` (default 0) and `size`
  // (default 20, at most 100) as query parameters, `{total, items}` in the body.
  it('integrations carries timestampGte when given, nothing when not, and the page in the query', async () => {
    axios.post.mockResolvedValue({ data: { total: 0, items: [] } })
    await CallInsights.integrations(user, 1700000000000, 40, 20)
    expect(axios.post.mock.calls[0][1]).toEqual({ timestampGte: 1700000000000 })
    const first = parsed(axios.post.mock.calls[0][0])
    expect(first.pathname).toMatch(/\/customer\/insights\/integrations$/)
    expect(first.searchParams.get('from')).toBe('40')
    expect(first.searchParams.get('size')).toBe('20')
    await CallInsights.integrations(user)
    expect(axios.post.mock.calls[1][1]).toEqual({})
    const second = parsed(axios.post.mock.calls[1][0])
    expect(second.searchParams.get('from')).toBe('0')
    expect(second.searchParams.get('size')).toBe(String(CallInsights.INSIGHTS_PAGE_SIZE))
  })

  it('configSuggestions posts to its own route, with the page in the query', async () => {
    axios.post.mockResolvedValue({ data: { total: 0, items: [] } })
    await CallInsights.configSuggestions(user, 1700000000000, 20, 20)
    const url = parsed(axios.post.mock.calls[0][0])
    expect(url.pathname).toMatch(/\/customer\/insights\/config-suggestions$/)
    expect(url.searchParams.get('from')).toBe('20')
    expect(url.searchParams.get('size')).toBe('20')
    expect(axios.post.mock.calls[0][1]).toEqual({ timestampGte: 1700000000000 })
  })

  it('both send asOf in the query only when given: a first page goes without it', async () => {
    axios.post.mockResolvedValue({ data: { total: 0, items: [] } })
    await CallInsights.integrations(user, undefined, 0, 20)
    expect(parsed(axios.post.mock.calls[0][0]).searchParams.has('asOf')).toBe(false)
    await CallInsights.integrations(user, undefined, 20, 20, 1761004800000)
    expect(parsed(axios.post.mock.calls[1][0]).searchParams.get('asOf')).toBe('1761004800000')
    await CallInsights.configSuggestions(user, undefined, 20, 20, 1761004800000)
    expect(parsed(axios.post.mock.calls[2][0]).searchParams.get('asOf')).toBe('1761004800000')
  })

  it('the page size is StarChat\'s default, inside its 1-100 bound', () => {
    expect(CallInsights.INSIGHTS_PAGE_SIZE).toBe(20)
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

describe('saidBy: the businesses StarChat names for an item, and how many it does not', () => {
  it('lists `said` and counts the businesses beyond it', () => {
    const said = [{ businessId: 'a', name: 'A', reportPeriodStart: 2 }, { businessId: 'b', reportPeriodStart: 1 }]
    expect(CallInsights.saidBy({ businesses: 7, said })).toEqual({ said, more: 5 })
  })

  it('counts none beyond when every business is named, and survives a missing or malformed `said`', () => {
    expect(CallInsights.saidBy({ businesses: 1, said: [{ businessId: 'a' }] }).more).toBe(0)
    expect(CallInsights.saidBy({ businesses: 3 })).toEqual({ said: [], more: 3 })
    expect(CallInsights.saidBy({ businesses: 3, said: 'x' })).toEqual({ said: [], more: 3 })
  })
})

describe('pagedList: a scope-wide list loaded a page at a time, on demand', () => {
  const page = (from, n, total) => ({ total, items: Array.from({ length: n }, (_, i) => ({ id: from + i })) })

  it('asks for the first page only, and the next one only when asked, from where the list ends', async () => {
    const fetchPage = vi.fn((from, size) => Promise.resolve(page(from, Math.min(size, 45 - from), 45)))
    const list = CallInsights.pagedList(fetchPage, { size: 20, keyOf: (item) => item.id })
    expect(list.status).toBe('loading')
    await list.first()
    expect(fetchPage.mock.calls).toEqual([[0, 20, undefined]])
    expect(list.status).toBe('ok')
    expect(list.items.length).toBe(20)
    expect(list.total).toBe(45)
    expect(list.hasMore).toBe(true)
    await list.more()
    expect(fetchPage.mock.calls[1]).toEqual([20, 20, undefined])
    await list.more()
    expect(fetchPage.mock.calls[2]).toEqual([40, 20, undefined])
    expect(list.items.length).toBe(45)
    expect(list.hasMore).toBe(false)
    await list.more()
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('sends page 1\'s asOf back on every later page of the same list, and a new first page drops it', async () => {
    let snapshot = 1000
    const fetchPage = vi.fn((from, size) => Promise.resolve({ ...page(from, size, 6), asOf: from === 0 ? snapshot : 9999 }))
    const list = CallInsights.pagedList(fetchPage, { size: 2 })
    await list.first()
    expect(fetchPage.mock.calls[0][2]).toBeUndefined()
    await list.more()
    expect(fetchPage.mock.calls[1]).toEqual([2, 2, 1000])
    await list.more()
    // a later page's own asOf never replaces the first page's
    expect(fetchPage.mock.calls[2]).toEqual([4, 2, 1000])
    snapshot = 2000
    await list.first()
    expect(fetchPage.mock.calls[3]).toEqual([0, 2, undefined])
    await list.more()
    expect(fetchPage.mock.calls[4]).toEqual([2, 2, 2000])
  })

  it('reads a 404 as absent and a 503 as not available yet', async () => {
    const absent = CallInsights.pagedList(() => Promise.resolve(null))
    await absent.first()
    expect(absent.status).toBe('absent')
    const unavailable = CallInsights.pagedList(() => Promise.resolve({ unavailable: true }))
    await unavailable.first()
    expect(unavailable.status).toBe('unavailable')
  })

  it('does not repeat an item a shifted page brings again, and stops on a page past the end', async () => {
    const answers = [page(0, 2, 5), { total: 5, items: [{ id: 1 }, { id: 2 }] }, { total: 5, items: [] }]
    const list = CallInsights.pagedList(() => Promise.resolve(answers.shift()), { size: 2, keyOf: (item) => item.id })
    await list.first()
    await list.more()
    expect(list.items.map((i) => i.id)).toEqual([0, 1, 2])
    await list.more()
    expect(list.hasMore).toBe(false)
  })

  it('a failed later page keeps what is shown and says so in the list, not in a toast; a failed first page hides the list and reports', async () => {
    const onError = vi.fn()
    const error = httpError(500)
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page(0, 2, 4))
      .mockRejectedValueOnce(error)
    const list = CallInsights.pagedList(fetchPage, { size: 2, onError })
    await list.first()
    await list.more()
    expect(list.items.length).toBe(2)
    expect(list.status).toBe('ok')
    expect(list.loadingMore).toBe(false)
    expect(list.moreFailed).toBe(true)
    expect(onError).not.toHaveBeenCalled()

    const failing = CallInsights.pagedList(() => Promise.reject(error), { onError })
    await failing.first()
    expect(failing.status).toBe('absent')
    expect(onError).toHaveBeenCalledWith(error)
  })

  // A later page that fails (404, 503, any error) is not the end of the list: what is shown stays,
  // the list says the page failed, and asking again sends the same page with the same snapshot.
  for (const [label, failure] of [
    ['a 404 (null)', () => Promise.resolve(null)],
    ['a 503 ({unavailable})', () => Promise.resolve({ unavailable: true })],
    ['an error', () => Promise.reject(httpError(500))],
  ]) {
    it(`${label} on a later page keeps the list, marks the page failed, and a retry resends it with the same asOf`, async () => {
      const onError = vi.fn()
      const fetchPage = vi.fn()
        .mockResolvedValueOnce({ ...page(0, 2, 4), asOf: 77 })
        .mockImplementationOnce(failure)
        .mockResolvedValueOnce({ ...page(2, 2, 4), asOf: 99 })
      const list = CallInsights.pagedList(fetchPage, { size: 2, onError })
      await list.first()
      await list.more()
      expect(list.items.length).toBe(2)
      expect(list.moreFailed).toBe(true)
      expect(list.hasMore).toBe(true)
      expect(list.loadingMore).toBe(false)
      await list.more()
      expect(fetchPage.mock.calls[1]).toEqual([2, 2, 77])
      expect(fetchPage.mock.calls[2]).toEqual([2, 2, 77])
      expect(list.items.length).toBe(4)
      expect(list.moreFailed).toBe(false)
      expect(list.hasMore).toBe(false)
    })
  }

  it('a session-ended error is left to the interceptor: no error reported', async () => {
    const onError = vi.fn()
    const list = CallInsights.pagedList(() => Promise.reject(sessionEndedError()), { onError })
    await list.first()
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('what every route answers beyond 200', () => {
  it('a 404 resolves to null: the section is simply absent', async () => {
    axios.post.mockRejectedValue(httpError(404))
    await expect(CallInsights.quality(user, {})).resolves.toBeNull()
  })

  it('a 503 resolves to {unavailable: true}: not a failure, not yet', async () => {
    axios.get.mockRejectedValue(httpError(503))
    await expect(CallInsights.reports(user, 'b-1')).resolves.toEqual({ unavailable: true })
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

/**
 * Brief outcome 9 (StarChat intent 12): the assistant measured only on calls it could serve. The
 * numbers below are StarChat's analytics guide's own examples (§7-§9), so each base is checked
 * against the contract's arithmetic, not against this file's.
 */
describe('resolutionShare: the share is over the calls where the caller asked something', () => {
  const totals = { resolved: 60, unresolved: 14, handed_over: 9, caller_left: 8, spam_wrong_number: 5 }

  it('counts resolved, unresolved and handed_over in the base, and caller_left and spam_wrong_number beside it', () => {
    expect(CallInsights.RESOLUTION_REQUEST_KEYS).toEqual(['resolved', 'unresolved', 'handed_over'])
    expect(CallInsights.RESOLUTION_OUTSIDE_KEYS).toEqual(['caller_left', 'spam_wrong_number'])
    const share = CallInsights.resolutionShare(totals)
    expect(share.base).toBe(83)
    expect(share.rows).toEqual([
      { key: 'resolved', count: 60, base: 83, percent: 72 },
      { key: 'unresolved', count: 14, base: 83, percent: 17 },
      { key: 'handed_over', count: 9, base: 83, percent: 11 },
    ])
    expect(share.outside).toEqual([
      { key: 'caller_left', count: 8 },
      { key: 'spam_wrong_number', count: 5 },
    ])
  })

  it('has a zero base, and no share, when no caller asked anything', () => {
    const share = CallInsights.resolutionShare({ caller_left: 3 })
    expect(share.base).toBe(0)
    expect(share.rows.map(r => r.percent)).toEqual([0, 0, 0])
    expect(share.outside[0]).toEqual({ key: 'caller_left', count: 3 })
  })
})

describe('assistantShare: each column and sort of the assistants table over StarChat\'s own base', () => {
  // StarChat's analytics guide §9, its example row
  const row = {
    businessId: 'biz-abc', totalCalls: 40, callsWithResolution: 36,
    resolution: { resolved: 20, unresolved: 10, caller_left: 6 },
    callsWithChecks: 36, checks: { caller_repeated: 5, caller_unsatisfied: 4, promise_not_kept_in_call: 0 },
    callsWithUnansweredRecorded: 36, callsWithUnanswered: 9, gaps: { missing_info: 9 },
    callsWithSkillErrors: 0, extractionsNotOk: 1,
    callsManaged: 36, noConversation: { caller_silent: 12, no_credit: 1 },
    callsAnswered: 48, callsOffered: 48, callsWithRequest: 30,
  }

  it('"Non risolte" is unresolved over callsWithRequest: caller_left is neither in the count nor in the base', () => {
    expect(CallInsights.assistantShare(row, 'not_solved')).toEqual({ count: 10, base: 30, percent: 33 })
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
    expect(CallInsights.assistantShare(row, 'extraction_failures')).toEqual({ count: 1, base: 40, percent: 3 })
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
