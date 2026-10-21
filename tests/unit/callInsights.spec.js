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
