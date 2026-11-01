import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Plan docs/execution-plans/2026-10-31-analytics-ux.md, steps A6c and A7 (brief O5, StarChat S2 and S4): every quality
 * count of a page over several businesses has the assistants sort that ranks where it happened, and the row's count and
 * base for it as StarChat's analytics guide §9 tabulates them; an unknown one throws, so that no count opens a list that
 * is not its own. The unanswered questions' client sends the gap, the page and `asOf`, and refuses an unknown gap
 * before any request. Seen failing, 2026-11-01, before qualitySignal, signalShare and unanswered existed.
 */
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const axios = (await import('axios')).default
const CallInsights = (await import('@/utils/CallInsights')).default

const ROW = {
  totalCalls: 40, callsWithUnansweredRecorded: 36, callsWithUnanswered: 9, gaps: { out_of_scope: 3 },
  callsWithChecks: 30, checks: { caller_repeated: 6 }, callsWithSkillErrors: 2, extractionsNotOk: 1, extractionsRun: 20,
}

beforeEach(() => { axios.post.mockReset() })

describe('qualitySignal', () => {
  it('maps every quality count to its sort, count and base', () => {
    const cases = [
      ['unanswered', true, 'unanswered', 9, 36],
      ['gap', 'out_of_scope', 'gap:out_of_scope', 3, 36],
      ['gap', 'assistant_error', 'gap:assistant_error', 0, 36],
      ['check', 'caller_repeated', 'check:caller_repeated', 6, 30],
      ['skillErrors', true, 'skill_errors', 2, 40],
      ['extractionFailed', true, 'extraction_failures', 1, 20],
    ]
    for (const [kind, key, sort, count, base] of cases) {
      const signal = CallInsights.qualitySignal(kind, key)
      expect(signal.sort, kind + ' ' + key).toBe(sort)
      expect(CallInsights.signalShare(ROW, signal)).toEqual({ count, base, percent: base ? Math.round(count / base * 100) : 0 })
    }
  })

  it('every gap reason and check the quality section draws has one', () => {
    for (const k of CallInsights.GAP_KEYS) expect(CallInsights.qualitySignal('gap', k).sort).toBe('gap:' + k)
    for (const k of CallInsights.CHECK_KEYS) expect(CallInsights.qualitySignal('check', k).sort).toBe('check:' + k)
  })

  it('throws on a kind or key with no sort', () => {
    expect(() => CallInsights.qualitySignal('gap', 'nope')).toThrow()
    expect(() => CallInsights.qualitySignal('topic', 'x')).toThrow()
    expect(() => CallInsights.qualitySignal('skillErrors', false)).toThrow()
  })
})

describe('the assistants and unanswered clients', () => {
  it('asks the assistants for the businesses where a signal happened', async () => {
    axios.post.mockResolvedValue({ data: { businesses: [], total: 0 } })
    await CallInsights.assistants({ accessToken: 't' }, { timestampGte: 1 }, { sort: 'gap:out_of_scope', present: true, from: 10, size: 10 })
    const url = new URL(axios.post.mock.calls[0][0], "http://x")
    expect(url.pathname).toMatch(/\/customer\/analytics\/assistants$/)
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ sort: 'gap:out_of_scope', present: 'true', from: '10', size: '10' })
  })

  it('asks for the unanswered questions of one reason, with the page and asOf', async () => {
    axios.post.mockResolvedValue({ data: { items: [], total: 0, calls: 0 } })
    const body = { timestampGte: 1, timestampLte: 2, businessId: 'biz-1' }
    await CallInsights.unanswered({ accessToken: 't' }, body, { gap: 'out_of_scope', from: 20, size: 10, asOf: 99 })
    const [u, sent] = axios.post.mock.calls[0]
    const url = new URL(u, "http://x")
    expect(url.pathname).toMatch(/\/customer\/analytics\/unanswered$/)
    expect(Object.fromEntries(url.searchParams)).toEqual({ gap: 'out_of_scope', from: '20', size: '10', asOf: '99' })
    expect(sent).toEqual(body)
  })

  it('refuses an unknown gap before any request', async () => {
    await expect(CallInsights.unanswered({ accessToken: 't' }, {}, { gap: 'nope' })).rejects.toThrow()
    expect(axios.post).not.toHaveBeenCalled()
  })
})
