// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The Playwright fixtures against what StarChat answers (StarChat brief docs/briefs/2026-10-24-insights-reports-ux.md,
 * amendment of 2026-10-30, acceptance: "a unit test comparing their shape, so a fixture cannot carry a field StarChat
 * never sends"). The answers were recorded on test from StarChat 9.34.124 (b1b863694), with the saved owner, reseller
 * and admin sessions, and scrubbed (`tests/unit/recorded/starchat-9.34.124/`: every free text a placeholder, enums kept).
 *
 * Each fixture answer is produced by the fixture's own route handler (`mockInsights`, `mockClassifications`) driven by
 * a stand-in page, so what is compared is what the Playwright specs are answered. A fixture's every field must be one
 * StarChat sends, of the same type (null being allowed where StarChat answers null, and on an optional field); a field
 * StarChat sends and the fixture leaves out is optionality, not a mismatch. Arrays are compared element by element
 * against the union of the recorded elements' fields. A field a fixture may carry that the recording happened not to
 * hold (no row of the business has it today) is listed in OPTIONAL with the StarChat source that sends it.
 */
const require = createRequire(import.meta.url)
const ins = require('../e2e/fixtures/insights')
const cls = require('../e2e/fixtures/classifications')

const DIR = fileURLToPath(new URL('./recorded/starchat-9.34.124/', import.meta.url))
const recorded = (name) => JSON.parse(readFileSync(DIR + name + '.json', 'utf8'))

// Fields StarChat 9.34.124 sends that the recording happened not to hold, by the answer's path, each with its source.
const REQUEST_GAP = ['gap'] // InsightsFeedback: a request's `gap`, dropped when null (`dropNullValues`)
const OPTIONAL = {
  'classifications.requests[]': REQUEST_GAP,
  'signal.call.requests[]': REQUEST_GAP,
  'withdraw.call.requests[]': REQUEST_GAP,
  'undo.calls[].requests[]': REQUEST_GAP,
  // InsightsJobs.jobJson: `error` on a refused or failed job (none among the recorded jobs)
  'job[]': ['error'],
  // CallReportView: `suggestions.mrcall_config` to an admin only (`InsightsVisibility`); the report was read as reseller
  'report.content.suggestions': ['mrcall_config'],
  // AssistantLatestReport: `requestId` for a requested latest report (none among the recorded rows)
  'assistants.businesses[].latestReport': ['requestId'],
  // RequestCategoryView: `dismissal` on an archived category (none archived on test)
  'categories.items[]': ['dismissal'],
}

// Objects keyed by data, not by field (counts by outcome, totals by value, a report's example calls by call id): their
// keys come and go with the period's calls, so only their values' types are compared.
const MAPS = [/\.counts$/, /\.totals$/, /\.previousTotals$/, /content\.resolution$/, /content\.message$/,
  /topics\[\]\.resolution$/, /businesses\[\]\.resolution$/, /\.noConversation$/, /\.exampleCalls$/, /\.checks$/,
  /\.gaps$/, /\.previousGaps$/, /\.extractions$/, /\.outcomes$/]
const isMap = (path) => MAPS.some((re) => re.test(path))

const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

/** Every field of `fixture` that StarChat (`answer`) never sends, or sends with another type. */
function mismatches (fixture, answer, path, out = []) {
  const fk = kind(fixture)
  const ak = kind(answer)
  if (ak === 'null' || fk === 'null') return out
  if (fk !== ak) { out.push(`${path}: fixture ${fk}, StarChat ${ak}`); return out }
  if (fk === 'array') {
    const sample = answer.filter((x) => x !== null && x !== undefined)
    if (sample.length === 0) return out
    const merged = sample.every((x) => kind(x) === 'object') ? Object.assign({}, ...sample.map((x) => x)) : sample[0]
    if (kind(merged) === 'object') {
      // the union of the recorded elements' fields, each with a recorded value of its own
      const union = {}
      for (const x of sample) for (const [k, v] of Object.entries(x)) if (!(k in union) || union[k] === null) union[k] = v
      fixture.forEach((x) => mismatches(x, union, path + '[]', out))
    } else fixture.forEach((x) => mismatches(x, merged, path + '[]', out))
    return out
  }
  if (fk === 'object' && isMap(path)) {
    const values = Object.values(answer).filter((x) => x !== null)
    if (values.length === 0) return out
    for (const [k, v] of Object.entries(fixture)) mismatches(v, values[0], path + '{' + k + '}', out)
    return out
  }
  if (fk === 'object') {
    for (const [k, v] of Object.entries(fixture)) {
      if (v === undefined) continue
      if (!(k in answer)) {
        if (!(OPTIONAL[path] || []).includes(k)) out.push(`${path}.${k}: the fixture carries a field StarChat does not send`)
        continue
      }
      mismatches(v, answer[k], path + '.' + k, out)
    }
  }
  return out
}

/** A page that collects the fixture's route handlers, and answers a request through the last one matching it. */
function standInPage () {
  const routes = []
  const glob = (g) => new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*') + '$')
  return {
    route (pattern, handler) { routes.push({ re: typeof pattern === 'string' ? glob(pattern) : pattern, handler }) },
    async ask (method, url, body) {
      for (let i = routes.length - 1; i >= 0; i--) {
        const r = routes[i]
        if (!r.re.test(url)) continue
        let answer = null
        let fellBack = false
        await r.handler({
          request: () => ({ url: () => url, method: () => method, postDataJSON: () => body || null }),
          fulfill: (x) => { answer = x },
          fallback: () => { fellBack = true },
        })
        if (fellBack) continue
        return { status: answer.status || 200, body: typeof answer.body === 'string' ? JSON.parse(answer.body) : answer.body }
      }
      throw new Error('no fixture route for ' + method + ' ' + url)
    },
  }
}

const S = 'http://localhost/mrcall/v1/mrcall0/customer'
const B = ins.BUSINESS_ID

describe('the Playwright fixtures carry only what StarChat 9.34.124 sends', () => {
  it('insights: estimates, jobs, the reports history and a report', async () => {
    const page = standInPage()
    await ins.mockInsights(page)
    const est = await page.ask('POST', S + '/insights/estimate', { kind: 'report', businessId: B, acknowledgeOverlap: true })
    const job = (await page.ask('GET', S + '/insights/jobs/est-1')).body
    const reports = (await page.ask('GET', S + '/insights/reports?businessId=' + B + '&size=10&offset=0')).body
    const report = (await page.ask('GET', S + '/insights/reports/' + ins.REPORT.periodStart + '?businessId=' + B)).body
    const jobs = (await page.ask('GET', S + '/insights/jobs?businessId=' + B + '&offset=0&size=10')).body
    const found = [
      ...mismatches(est.body, recorded('estimate-report-874').created.body, 'job'),
      ...mismatches(job, recorded('estimate-report-874').finished.body, 'job'),
      ...mismatches(ins.REPORT_ESTIMATE, recorded('estimate-report-874').finished.body.estimate, 'estimate'),
      ...mismatches(ins.RECOMPUTE_ESTIMATE, recorded('estimate-recompute-874').finished.body.estimate, 'estimate'),
      ...mismatches(reports, recorded('reports-874').body, 'reports'),
      // the fixture's report is a requested one: against a requested report's answer
      ...mismatches(report, recorded('report-874-requested').body, 'report'),
      ...mismatches(jobs.items, recorded('jobs-874').body.items, 'job'),
    ]
    expect(found).toEqual([])
  })

  it('analytics: outcomes, quality, assistants with their latest report', async () => {
    const page = standInPage()
    await ins.mockInsights(page, { role: 'admin' })
    const outcomes = (await page.ask('POST', S + '/analytics/outcomes?granularity=daily&timezone=Europe%2FRome', {})).body
    const quality = (await page.ask('POST', S + '/analytics/quality', {})).body
    const assistants = (await page.ask('POST', S + '/analytics/assistants?sort=not_solved&direction=desc&from=0&size=10', {})).body
    const found = [
      ...mismatches(outcomes, recorded('outcomes-874').body, 'outcomes'),
      ...mismatches(quality, recorded('quality-874').body, 'quality'),
      ...mismatches(assistants, recorded('assistants-admin').body, 'assistants'),
    ]
    expect(found).toEqual([])
  })

  it('the categories and a category\'s requests', async () => {
    const page = standInPage()
    await ins.mockInsights(page, { role: 'admin' })
    const categories = (await page.ask('POST', S + '/insights/integrations?view=categories&sort=score', {})).body
    expect(mismatches(categories, recorded('categories-admin').body, 'categories')).toEqual([])
  })

  it('a call\'s judgements, a proposal, its withdrawal, and an undo that withdraws one', async () => {
    const page = standInPage()
    await cls.mockClassifications(page)
    const judged = (await page.ask('GET', S + '/insights/calls/' + cls.CALL_ID + '/classifications?businessId=' + B)).body
    const ask = { subject: 'request', conversationId: cls.CALL_ID, requestId: 101, field: 'category', signal: 'wrong_value', valueFrom: 'online_booking', valueTo: 'prices' }
    const proposed = (await page.ask('POST', S + '/insights/feedback', { ...ask, gestureId: 'g1' })).body
    const withdrawn = (await page.ask('POST', S + '/insights/feedback/' + proposed.feedbackId + '/withdraw', {})).body
    await page.ask('POST', S + '/insights/feedback', { ...ask, gestureId: 'g2' })
    const undo = (await page.ask('POST', S + '/insights/feedback/gestures/g2/revert', {})).body
    const found = [
      ...mismatches(judged, recorded('classifications-owner').body, 'classifications'),
      ...mismatches(proposed, recorded('signal-proposed-owner').body, 'signal'),
      ...mismatches(withdrawn, recorded('withdraw-owner').body, 'withdraw'),
      ...mismatches(undo, recorded('undo-owner').body, 'undo'),
    ]
    expect(found).toEqual([])
  })

  it('the comparison itself finds a field StarChat does not send (a check of the check)', () => {
    expect(mismatches({ a: 1, made_up: true }, { a: 2 }, 'x')).toEqual(['x.made_up: the fixture carries a field StarChat does not send'])
    expect(mismatches({ a: '1' }, { a: 2 }, 'x')).toEqual(['x.a: fixture string, StarChat number'])
  })
})
