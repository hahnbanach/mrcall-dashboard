import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `src/utils/CallInsights.js`: the outcome rule, and the clients for StarChat's call-insights
 * routes (`docs/analytics-api-guide.md` §7-10 and `docs/customer-conversation-api-guide.md` of the
 * StarChat repository, read 2026-10-20). Each client is checked for the path and body it sends,
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

describe('outcomeKind: the one rule for every outcome', () => {
  it('reads booked and transferred as recorded facts', () => {
    expect(CallInsights.outcomeKind('booked')).toBe('fact')
    expect(CallInsights.outcomeKind('transferred')).toBe('fact')
  })

  it('reads every other outcome, known or not, as the assistant\'s own assessment', () => {
    for (const key of ['resolved', 'message_taken', 'unresolved', 'caller_left', 'spam_wrong_number', 'something_new']) {
      expect(CallInsights.outcomeKind(key)).toBe('assessed')
    }
  })

  it('exports the gap and check keys the quality signals and the panel share', () => {
    expect(CallInsights.GAP_KEYS).toEqual(['missing_info', 'needs_integration', 'out_of_scope', 'assistant_error'])
    expect(CallInsights.CHECK_KEYS).toEqual(['caller_repeated', 'caller_unsatisfied', 'promise_not_kept_in_call'])
  })
})

describe('outcomes: refuses a call with no time zone', () => {
  it('rejects before sending anything, as Analytics.js does for the time series', async () => {
    await expect(CallInsights.outcomes(user, {}, 'daily')).rejects.toThrow(/timezone/)
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('sends granularity and timezone on the query string, and the body untouched', async () => {
    axios.post.mockResolvedValue({ data: { totals: {} } })
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

describe('integrations and config-suggestions: the caller\'s whole scope, since a start', () => {
  it('integrations carries timestampGte when given, and nothing when not', async () => {
    axios.post.mockResolvedValue({ data: [] })
    await CallInsights.integrations(user, 1700000000000)
    expect(axios.post.mock.calls[0][1]).toEqual({ timestampGte: 1700000000000 })
    await CallInsights.integrations(user)
    expect(axios.post.mock.calls[1][1]).toEqual({})
    expect(axios.post.mock.calls[1][0]).toContain('/customer/insights/integrations')
  })

  it('configSuggestions posts to its own route', async () => {
    axios.post.mockResolvedValue({ data: [] })
    await CallInsights.configSuggestions(user, 1700000000000)
    expect(axios.post.mock.calls[0][0]).toContain('/customer/insights/config-suggestions')
    expect(axios.post.mock.calls[0][1]).toEqual({ timestampGte: 1700000000000 })
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
