// @ts-check
/**
 * StarChat's answers for the reports, jobs, requests and outcomes of StarChat's docs/briefs/2026-10-24-insights-reports-ux.md
 * and docs/briefs/2026-10-24-call-resolution-forwarded.md, shaped as its code answers them (`CallReportsPage`,
 * `CallReportRow`, `ReportsScheduleView`, `CallReportView`, `InsightsJobs.jobJson`, `CallRequestsPage`,
 * `RequestCategoryView`, `AssistantsResponse`, `OutcomesResponse` with plan step F3's `outcome`), and `mockInsights`,
 * which answers them on a page and records what was asked. No credit, euro or token field anywhere, as StarChat
 * withholds them (`InsightsVisibility`).
 *
 * Days are the business's (Europe/Rome): 2026-10-01T00:00 in Rome is `rome(2026, 10, 1)`.
 */
const { expect } = require('@playwright/test')
const { mockBusiness, mockUser } = require('./mock-data')

const BUSINESS_ID = mockBusiness.businessId
const DAY = 24 * 3600 * 1000

// Midnight of y-m-d in Rome: +02:00 until 25 October 2026, +01:00 from then on.
function rome (y, m, d) {
  const summer = Date.UTC(y, m - 1, d) < Date.UTC(2026, 9, 25) && Date.UTC(y, m - 1, d) >= Date.UTC(2026, 2, 29)
  return Date.UTC(y, m - 1, d) - (summer ? 2 : 1) * 3600 * 1000
}

// 25 weekly automatic periods ending on 21 October 2026, newest first, with a requested one among them and the states
// a history shows: written off, retried, postponed, in preparation.
function historyRows () {
  const rows = []
  for (let i = 0; i < 25; i++) {
    const end = rome(2026, 10, 21) - i * 7 * DAY
    const start = end - 7 * DAY
    rows.push({
      periodStart: start, periodEnd: end, status: 'done', type: 'automatic', revision: 0, days: 7,
      calls: 40 + i, callsManaged: 45 + i, failures: 0, createdAt: end + 3 * 3600 * 1000, requesterRole: 'system',
    })
  }
  rows[0].status = 'claimed'
  delete rows[0].calls
  rows[2].status = 'failed'
  rows[2].failures = 1
  delete rows[2].calls
  rows[3].status = 'budget_exhausted'
  delete rows[3].calls
  rows[4].status = 'written_off'
  rows[4].failures = 3
  delete rows[4].calls
  // a requested report: 1-7 October, asked by the owner, version 2 (one regeneration)
  rows[1] = {
    periodStart: rome(2026, 10, 1), periodEnd: rome(2026, 10, 8), status: 'done', type: 'requested', revision: 1, days: 7,
    calls: 120, callsManaged: 130, requestId: 'job-req-1', requestedBy: mockUser.uid, requesterRole: 'owner', failures: 0, createdAt: rome(2026, 10, 9) + 10 * 3600 * 1000,
  }
  // a report the reseller asked for
  Object.assign(rows[5], { type: 'requested', requestId: 'job-req-5', requestedBy: 'reseller-uid-12345', requesterRole: 'reseller' })
  // a report of before 10 October without its managed calls
  delete rows[6].callsManaged
  return rows
}

// The schedule's `next` (`nextAutomatic`) with the amendment's rules 6 and 7: `anticipable` (the cycle in progress holds a
// finished day) and `arrivesAt`, the nightly run (05:00 UTC) that will write the period.
const SCHEDULE = { cadenceDays: 7, nextAutomatic: { from: rome(2026, 10, 21), to: rome(2026, 10, 28), retry: false, anticipable: true, arrivesAt: Date.UTC(2026, 9, 28, 5) } }

function reportsPage (url, { rows = historyRows(), schedule = SCHEDULE } = {}) {
  const q = new URL(url).searchParams
  const offset = Number(q.get('offset') || 0)
  const size = Number(q.get('size') || 10)
  let list = rows
  if (q.get('status')) list = list.filter((r) => r.status === q.get('status'))
  if (q.get('type')) list = list.filter((r) => r.type === q.get('type'))
  if (q.get('sort') === 'calls') {
    list = [...list].sort((a, b) => (a.calls || 0) - (b.calls || 0))
    if (q.get('direction') !== 'asc') list.reverse()
  }
  return { items: list.slice(offset, offset + size), total: list.length, asOf: 1761300000000, schedule }
}

// A version-5 report: themes, questions without an answer by reason with example calls, suggestions.
const REPORT = {
  businessId: BUSINESS_ID,
  periodStart: rome(2026, 10, 1),
  periodEnd: rome(2026, 10, 8),
  requestId: 'job-req-1',
  revision: 1,
  requestedBy: mockUser.uid,
  requesterRole: 'owner',
  content: {
    // content version 5: `flagged_calls` are the calls whose outcome line is not solved (the amendment of 2026-10-30,
    // rule 2); a version 4 or lower is captioned as the calls to review
    version: 5,
    period: { from: '2026-09-30T22:00:00Z', to: '2026-10-07T22:00:00Z' },
    calls: 120,
    callsManaged: 130,
    // the calls' own counts, as `CallInsightsReportBuilder.content` writes them: resolution by value (the four lines
    // where the caller asked, and the two beside them), booked and transferred as counts of calls
    resolution: { resolved: 50, forwarded: 30, handed_over: 10, unresolved: 20, caller_left: 6, spam_wrong_number: 4 },
    message: { complete: 60, incomplete: 10, none: 50 },
    booked: 31,
    transferred: 1,
    // each theme with its calls and their resolution; written here in the order the screen must not rely on
    topics: [
      { topic: 'Parking', calls: 12, labels: ['parking'], resolution: { resolved: 4, unresolved: 8 }, with_unanswered: 8, new: true },
      { topic: 'Bookings', calls: 70, labels: ['booking', 'table for four'], resolution: { resolved: 40, forwarded: 20, handed_over: 5, unresolved: 5 }, with_unanswered: 2, new: false },
    ],
    // gaps carry their examples resolved from their cites (amendment rule 2) and, classified, their category (rule 3)
    gaps: [
      { group: 'missing_info', summary: 'Is there parking near the restaurant?', examples: ['CON-1', 'CON-2'] },
      { group: 'needs_integration', summary: 'Can I book online?', examples: ['CON-3'] },
      { group: 'out_of_scope', summary: 'Which pill should I take for my blood pressure?', examples: ['CON-4'], category: 'clinical_advice' },
    ],
    // unresolved, and forwarded with a message not complete: the calls to call back
    flagged_calls: ['CON-1', 'CON-5'],
    suggestions: {
      business_info: ['Add where to park and how much it costs.'],
      integration: ['Online booking from the website.'],
      mrcall_config: ['Shorten the greeting.'],
    },
  },
  exampleCalls: {
    'CON-1': { startTimestamp: rome(2026, 10, 2) + 10 * 3600 * 1000, caller: 'Giulia Verdi' },
    'CON-2': { startTimestamp: rome(2026, 10, 3) + 11 * 3600 * 1000 },
  },
}

// The analytics of the report's days, the base of its exclusions and of the newer calls.
const REPORT_OUTCOMES = {
  granularity: 'daily', period: { from: 0, to: 0 }, totalCalls: 140,
  resolution: { callsWithValue: 125, totals: {}, previousTotals: {}, buckets: [] },
  message: { callsWithValue: 125, totals: {}, previousTotals: {}, buckets: [] },
  callsWithBooked: 0, booked: 0, transferred: 0, noConversation: { caller_silent: 4, no_credit: 1 }, callsAnswered: 134,
  callsManaged: 130, recomputable: 0, callsWithRequest: 0, outcome: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
}

const REPORT_QUALITY = {
  period: { from: 0, to: 0 }, extractions: {}, callsWithChecks: 0, checks: {},
  callsWithUnansweredRecorded: 120, callsWithUnanswered: 9, gaps: { missing_info: 6, needs_integration: 3 },
  previousGaps: { missing_info: 9, needs_integration: 1 }, callsWithSkillErrors: 0,
}

// Outcomes with plan step F3's fields: four lines over callsWithRequest, the request passed on split by its message.
const OUTCOMES = {
  granularity: 'daily', period: { from: 0, to: 0 }, totalCalls: 140,
  resolution: { callsWithValue: 130, totals: { resolved: 50, forwarded: 25, handed_over: 10, unresolved: 15, caller_left: 7, spam_wrong_number: 2 }, previousTotals: {}, buckets: [] },
  message: { callsWithValue: 130, totals: { complete: 60, incomplete: 10, none: 60 }, previousTotals: {}, buckets: [] },
  callsWithRequest: 100,
  outcome: {
    callsWithValue: 100,
    totals: { resolved: 50, forwarded_complete: 20, forwarded_incomplete: 5, handed_over: 10, unresolved: 15 },
    previousTotals: { resolved: 40, forwarded_complete: 10, forwarded_incomplete: 10, handed_over: 10, unresolved: 30 },
    buckets: [{ timestamp: rome(2026, 10, 20), counts: { resolved: 50, forwarded_complete: 20, forwarded_incomplete: 5, handed_over: 10, unresolved: 15 } }],
  },
  callsWithBooked: 100, booked: 30, transferred: 10, noConversation: { caller_silent: 12, no_credit: 1, talk_and_hangup: 0, not_answered: 0 },
  callsAnswered: 142, callsManaged: 130, recomputable: 20,
}

function job (over = {}) {
  return {
    jobId: 'job-1', businessId: BUSINESS_ID, kind: 'report', status: 'queued', from: rome(2026, 9, 24), to: rome(2026, 10, 24),
    counts: {}, createdAt: rome(2026, 10, 24) + 9 * 3600 * 1000, requestedBy: mockUser.uid, requesterRole: 'owner', phase: 'queued', ...over,
  }
}

/**
 * An estimate job as StarChat answers it, by what it estimates (`of`). A report analyses no call: it reads the calls
 * already analysed, so its `calls` is always 0 and its `requests` 1 (StarChat's `InsightsJobEstimator`, seen on test
 * 9.34.123, U19c B1); the brief's amendment of 2026-10-30, rule 1, adds the period's `finalised` calls and, of those, the
 * `analysed` ones the report reads. A recompute's `calls` are the calls it will analyse.
 */
const REPORT_ESTIMATE = { fits: true, kind: 'report', left: 0, calls: 0, toSend: 0, skipped: 0, reasoned: 0, requests: 1, notFinalised: 0, finalised: 130, analysed: 120, topUpEffective: true }
const RECOMPUTE_ESTIMATE = { fits: true, kind: 'recompute', left: 0, calls: 120, toSend: 120, skipped: 0, reasoned: 0, requests: 120, notFinalised: 0, topUpEffective: true }

function estimateJob (over = {}) {
  const of = over.of || 'report'
  return job({ jobId: 'est-1', kind: 'estimate', of, status: 'done', phase: 'finished',
    estimate: of === 'recompute' ? RECOMPUTE_ESTIMATE : REPORT_ESTIMATE, ...over })
}

// Who asked, in every role StarChat records (`requesterRole`), and one it does not know (null).
const JOBS = {
  total: 6,
  items: [
    job({ jobId: 'job-run', kind: 'recompute', status: 'running', phase: 'working', estimate: { calls: 40 }, counts: { written: 10, reasoned: 2 } }),
    job({ jobId: 'job-done', status: 'done', phase: 'finished', counts: { requests: 1 }, result: { reports: [{ periodStart: rome(2026, 10, 1), periodEnd: rome(2026, 10, 8), requestId: 'job-req-1' }] } }),
    job({ jobId: 'job-refused', status: 'refused', phase: 'finished', error: 'reserve', requestedBy: 'admin-uid-12345', requesterRole: 'admin', mode: 'automatic_now' }),
    job({ jobId: 'job-reseller', status: 'refused', phase: 'finished', error: 'over_ceiling', requestedBy: 'reseller-uid-12345', requesterRole: 'reseller', from: rome(2026, 9, 1), to: rome(2026, 9, 8) }),
    job({ jobId: 'job-owner-other', status: 'cancelled', phase: 'finished', requestedBy: 'owner-uid-other', requesterRole: 'owner', from: rome(2026, 8, 1), to: rome(2026, 8, 8) }),
    job({ jobId: 'job-unknown', status: 'done', phase: 'finished', counts: { requests: 0 }, requestedBy: 'gone-uid', requesterRole: null, from: rome(2026, 7, 1), to: rome(2026, 7, 8) }),
  ],
}

/**
 * A page of jobs filtered by `kind` and `status` as the dashboard asks them (U19r2: Elaborazioni's filters; StarChat's
 * `GET insights/jobs` takes `offset` and `size`, and these two filters are the dashboard's request of it).
 */
function jobsPage (url, items) {
  const q = new URL(url).searchParams
  let list = items
  if (q.get('kind')) list = list.filter((j) => j.kind === q.get('kind'))
  if (q.get('status')) list = list.filter((j) => j.status === q.get('status'))
  const offset = Number(q.get('offset') || 0)
  const size = Number(q.get('size') || 10)
  return { total: list.length, items: list.slice(offset, offset + size) }
}

// The jobs of the U19 attack: OVERLAND's recompute (4 written, 10 not finalised), one stopped at its ceiling, a
// regeneration of two reports, and an admin's facts job (StarChat answers it to an admin only).
const JOBS_U19 = [
  job({ jobId: 'job-overland', kind: 'recompute', status: 'done', phase: 'finished', estimate: { calls: 14 }, counts: { written: 4, not_finalised: 10 } }),
  job({ jobId: 'job-ceiling', kind: 'recompute', status: 'ceiling_reached', phase: 'finished', estimate: { calls: 200 }, counts: { written: 120, ceiling: 80 } }),
  job({ jobId: 'job-regen', kind: 'report', mode: 'regenerate', status: 'done', phase: 'finished', from: rome(2026, 10, 1), to: rome(2026, 10, 15), counts: { requests: 2 },
    result: { reports: [{ periodStart: rome(2026, 10, 1), periodEnd: rome(2026, 10, 8) }, { periodStart: rome(2026, 10, 8), periodEnd: rome(2026, 10, 15) }] } }),
  job({ jobId: 'job-facts', kind: 'facts', status: 'done', phase: 'finished', requestedBy: 'admin-uid-12345', requesterRole: 'admin', counts: { written: 30, unchanged: 70 } }),
]

function category (key, over = {}) {
  return {
    // `nextActionKind` as StarChat answers it (`RequestCategoryView`): business_info and integration with their
    // `nextAction`; delegate, handled, and from the amendment of 2026-10-30 (rule 4) withdrawn and unrated, without one
    category: key, label: key, nextAction: 'Next', nextActionKind: 'integration', kind: 'integration', businesses: 3, previousBusinesses: 1, trend: 2,
    share: 0.25, histogram: [{ start: '2026-09-28', businesses: 0 }, { start: '2026-10-05', businesses: 1 }, { start: '2026-10-12', businesses: 3 }, { start: '2026-10-19', businesses: 2 }],
    bucket: 'week', lastSeen: '2026-10-21', recentShare: 0.67, status: 'rising', score: 2.6, reportDated: 0,
    examples: [{ text: 'Can I book on the website?', businessId: BUSINESS_ID, name: 'Test Restaurant', reportPeriodStart: rome(2026, 10, 14) }],
    ...over,
  }
}

const CATEGORIES = {
  total: 3, asOf: 1761300000000, from: rome(2026, 9, 24), to: rome(2026, 10, 24),
  items: [
    category('online_booking', { label: 'Online booking', nextAction: 'Consider an integration with a booking system' }),
    category('prices', { label: 'Prices and rates', nextAction: 'Ask the businesses to add their prices', nextActionKind: 'business_info', kind: 'business_info', businesses: 2, previousBusinesses: 2, trend: 0, status: 'steady', reportDated: 1,
      histogram: [{ start: '2026-09-28', businesses: 1 }, { start: '2026-10-05', businesses: 1 }, { start: '2026-10-12', businesses: 0 }, { start: '2026-10-19', businesses: 1 }],
      examples: [{ text: 'How much is a visit?', businessId: 'biz-2', name: 'Studio Bianchi', reportPeriodStart: rome(2026, 10, 7) }] }),
    category('opening_hours', { label: 'Opening hours and closures', nextAction: 'Ask the businesses to update their hours', businesses: 1, previousBusinesses: 4, trend: -3, status: 'stale', share: 0.08, lastSeen: '2026-09-29',
      histogram: [{ start: '2026-09-28', businesses: 1 }, { start: '2026-10-05', businesses: 0 }, { start: '2026-10-12', businesses: 0 }, { start: '2026-10-19', businesses: 0 }],
      dismissal: { reason: 'done', at: rome(2026, 10, 10), by: 'admin-uid-12345', reopened: { newBusinesses: 3, since: rome(2026, 10, 10) } } }),
  ],
}

function assistantRow (i) {
  return {
    businessId: `biz-${i}`, businessName: i === 3 ? undefined : `Studio ${i}`, totalCalls: 100 - i, callsWithResolution: 80, resolution: {},
    callsWithChecks: 80, checks: { caller_repeated: 2 }, callsWithUnansweredRecorded: 80, callsWithUnanswered: 8, gaps: {}, callsWithSkillErrors: 1,
    extractionsNotOk: 0, extractionsRun: 80, callsManaged: 80, noConversation: { caller_silent: 4 }, callsAnswered: 84, callsOffered: 90,
    callsWithRequest: 60, notSolved: 30 - i, callsWithAnyCheck: 2,
    // the period before (StarChat U13c): row 1 at 20 of 50, row 2 with no request then, row 5 on 8 calls (U19 M13)
    previousCallsWithRequest: i === 2 ? 0 : i === 5 ? 8 : 50, previousNotSolved: i === 2 ? 0 : i === 5 ? 3 : 20,
    // the business's top three request categories with their requests (StarChat counts them as `questions`), and its
    // latest report (the amendment of 2026-10-26, rule 8; shown from the amendment of 2026-10-30, rule 3)
    requestCategories: [
      { category: 'online_booking', label: 'Online booking', questions: 30 - i },
      { category: 'prices', label: 'Prices and rates', questions: 12 },
      { category: 'opening_hours', label: 'Opening hours', questions: 5 },
    ],
    ...(i === 4 ? {} : { latestReport: { periodStart: rome(2026, 10, 14) } }),
    accountHealth: i === 1 ? { subscriptionStatus: 'ACTIVE', creditLow: true, inDebt: false } : i === 2 ? { subscriptionStatus: 'UNPAID', creditLow: false, inDebt: true } : { subscriptionStatus: 'ACTIVE', creditLow: false, inDebt: false },
  }
}

function assistantsPage (url, forAdmin = false) {
  const q = new URL(url).searchParams
  const from = Number(q.get('from') || 0)
  const size = Number(q.get('size') || 10)
  let all = Array.from({ length: 23 }, (_, i) => assistantRow(i + 1))
  const search = q.get('search')
  if (search) all = all.filter((r) => (r.businessName || '').toLowerCase().includes(search.toLowerCase()))
  // MrCall's configuration suggestions of each row's latest automatic report, for an admin only; none without a report
  if (forAdmin) all = all.map((r, i) => (i === 2 ? r : { ...r, configSuggestions: i + 1 }))
  return { period: { from: 0, to: 0 }, sort: q.get('sort') || 'not_solved', businesses: all.slice(from, from + size), total: all.length, from, size, direction: q.get('direction') || 'desc' }
}

/**
 * Orders a server-paged table by the column `label`, as a person does at the page's width: its header on a wide
 * screen; on a phone, where the rows are cards and the header row is hidden, the "Sort by" control above them (and,
 * for the column already in force, its direction button).
 */
async function sortBy (page, table, label) {
  if (page.viewportSize().width > 640) {
    await table.getByRole('button', { name: new RegExp('^' + label) }).click()
    return
  }
  const select = page.getByLabel('Sort by')
  const options = await select.locator('option').allInnerTexts()
  const option = options.find((o) => o.startsWith(label))
  if ((await select.inputValue()) === (await select.locator('option', { hasText: option }).getAttribute('value'))) {
    await page.getByRole('button', { name: /^(Descending|Ascending)$/ }).click()
  } else {
    await select.selectOption({ label: option })
  }
}

// The arguments an estimate and its job must share (`InsightsJobArguments`): the interval, the report mode and its
// options. `kind` on an estimate names what it estimates, on a job only "Anticipa"; the keys differ by design.
const ARGUMENTS = ['from', 'to', 'conversationId', 'recompute', 'regenerates', 'rerunAutomatic', 'platformPays', 'acknowledgeOverlap']
function sameArguments (estimate, job) {
  const norm = (o) => JSON.stringify(ARGUMENTS.map((k) => (o[k] === undefined || o[k] === false ? null : o[k])))
  const anticipate = (o) => o.kind === 'automatic_now'
  return norm(estimate) === norm(job) && anticipate(estimate) === anticipate(job)
}

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

/**
 * Answers the insights routes on `page` and records each request in `asked` (`{method, url, body}`), keyed by
 * route. Options replace an answer: `reports`, `report`, `jobs`, `job` (by id), `estimate` (the job the estimate
 * route creates), `createJob` (a function of the body answering `{status, body}`), `categories`, `businesses`,
 * `outcomes`, `quality`, and `role` (admin answers carry admin-only fields).
 */
async function mockInsights (page, options = {}) {
  const asked = { reports: [], report: [], overlap: [], estimate: [], create: [], job: [], jobs: [], cancel: [], delete: [],
    categories: [], businesses: [], dismiss: [], restore: [], assistants: [], outcomes: [], quality: [], search: [] }
  const record = (key, route) => {
    const r = route.request()
    let body = null
    try { body = r.postDataJSON() } catch { body = null }
    asked[key].push({ method: r.method(), url: r.url(), body })
  }
  await page.route('**/customer/analytics/outcomes*', (route) => {
    record('outcomes', route)
    const body = route.request().postDataJSON() || {}
    const forReport = body.timestampGte === REPORT.periodStart
    route.fulfill(json(forReport ? (options.reportOutcomes || REPORT_OUTCOMES) : (options.outcomes || OUTCOMES)))
  })
  await page.route('**/customer/analytics/quality*', (route) => { record('quality', route); route.fulfill(json(options.quality || REPORT_QUALITY)) })
  await page.route('**/customer/analytics/assistants*', (route) => { record('assistants', route); route.fulfill(json(assistantsPage(route.request().url(), options.role === 'admin'))) })
  await page.route('**/customer/insights/reports*', (route) => {
    record('reports', route)
    route.fulfill(json(options.reports ? options.reports(route.request().url()) : reportsPage(route.request().url())))
  })
  await page.route('**/customer/insights/reports/*', (route) => {
    if (route.request().method() === 'DELETE') { record('delete', route); route.fulfill(json({ deleted: 2 })); return }
    record('report', route)
    route.fulfill(json(options.report === undefined ? REPORT : options.report))
  })
  await page.route('**/customer/insights/reports/overlap*', (route) => { record('overlap', route); route.fulfill(json(options.overlap || { past: [] })) })
  // StarChat's contract for an estimate (InsightsJobs.requested): a recompute takes no report mode; a requested report
  // over days of the cycle in progress or of a past report is refused unless acknowledged, the estimate included.
  await page.route('**/customer/insights/estimate', (route) => {
    record('estimate', route)
    const body = route.request().postDataJSON() || {}
    if (body.kind === 'recompute' && body.acknowledgeOverlap) {
      route.fulfill(json('a recompute takes no report mode', 400)); return
    }
    const overlap = options.overlap || { past: [] }
    const needsAck = !!overlap.cycle || (overlap.past || []).length > 0
    if (body.kind === 'report' && !body.regenerates && !body.rerunAutomatic && needsAck && !body.acknowledgeOverlap) {
      route.fulfill(json({ code: 'overlap_unacknowledged', message: 'acknowledgeOverlap' }, 400)); return
    }
    const answer = options.estimate ? options.estimate(asked.estimate.length) : estimateJob({ status: 'queued', phase: 'queued' })
    route.fulfill(json(answer, 202))
  })
  await page.route('**/customer/insights/jobs*', (route) => {
    record('jobs', route)
    route.fulfill(json(typeof options.jobs === 'function' ? options.jobs(route.request().url()) : (options.jobs || JOBS)))
  })
  await page.route(/\/customer\/insights\/jobs\/(report|recompute)$/, (route) => {
    record('create', route)
    // StarChat's cap (InsightsJobs.cap): the estimate named must be over exactly the job's arguments, platformPays and
    // acknowledgeOverlap included; otherwise 409 estimate_mismatch
    const body = route.request().postDataJSON() || {}
    const estimate = asked.estimate.length ? asked.estimate[asked.estimate.length - 1].body : null
    if (!estimate || !sameArguments(estimate, body)) {
      route.fulfill(json({ code: 'estimate_mismatch', message: 'estimateJobId does not name a finished estimate over these arguments' }, 409)); return
    }
    const answer = options.createJob ? options.createJob(body, asked.create.length) : { status: 202, body: job({ jobId: 'job-new' }) }
    route.fulfill(json(answer.body, answer.status))
  })
  await page.route(/\/customer\/insights\/jobs\/[^/]+$/, (route) => {
    const url = route.request().url()
    if (/\/jobs\/(report|recompute)$/.test(url)) { route.fallback(); return }
    record('job', route)
    const id = decodeURIComponent(url.split('/').pop())
    // by default the estimate of what was last asked: a report's or a recompute's
    const last = asked.estimate.length ? asked.estimate[asked.estimate.length - 1].body : null
    const of = last && last.kind === 'recompute' ? 'recompute' : 'report'
    const answer = options.job ? options.job(id, asked.job.filter((j) => j.url.endsWith('/' + encodeURIComponent(id))).length) : estimateJob({ jobId: id, of })
    route.fulfill(json(answer))
  })
  await page.route(/\/customer\/insights\/jobs\/[^/]+\/cancel$/, (route) => {
    record('cancel', route)
    route.fulfill(json(job({ jobId: 'job-new', status: 'cancelled', phase: 'finished' })))
  })
  // with includeDismissed, an admin's rows carry the examples hidden from them (StarChat U13c)
  await page.route('**/customer/insights/integrations*', (route) => {
    record('categories', route)
    const answer = options.categories || CATEGORIES
    const dismissed = new URL(route.request().url()).searchParams.get('includeDismissed') === 'true'
    route.fulfill(json(dismissed && !options.categories
      ? { ...answer, items: answer.items.map((r) => (r.category === 'online_booking' ? { ...r, dismissedExamples: [{ text: 'Can I pay online?', reason: 'not_relevant', at: rome(2026, 10, 12), by: 'admin-uid-12345' }] } : r)) }
      : answer))
  })
  await page.route('**/customer/insights/integrations/*/businesses*', (route) => {
    record('businesses', route)
    route.fulfill(json(options.businesses || { total: 12, asOf: 1761300000000, items: Array.from({ length: 10 }, (_, i) => ({ businessId: `biz-${i}`, name: `Studio ${i}`, lastSeen: '2026-10-2' + (i % 2), reportPeriodStart: rome(2026, 10, 14), examples: ['Can I book online?'] })) }))
  })
  await page.route('**/customer/insights/integrations/*/dismiss', (route) => { record('dismiss', route); route.fulfill(json({ category: 'x', reason: 'done', at: 1, by: 'a' })) })
  await page.route('**/customer/insights/integrations/*/examples/dismiss', (route) => { record('dismiss', route); route.fulfill(json({ category: 'x', reason: 'done', at: 1, by: 'a' })) })
  await page.route('**/customer/insights/integrations/*/restore', (route) => { record('restore', route); route.fulfill(json({ restored: 1 })) })
  await page.route('**/customer/insights/integrations/*/examples/restore', (route) => { record('restore', route); route.fulfill(json({ restored: 1 })) })
  return asked
}

/**
 * Brings the filter bar to where a reader undoes a filter, after the page scrolled down to a section, as the layout at
 * the page's width promises. Wider than 640px the bar sticks to the top of the screen, so it is still on screen.
 * On a phone it does not: since U19 m19 (StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md, U19r2)
 * its chips wrap so that every one and its clear control is on screen, and a bar two or three lines tall stays at
 * the top of the page instead of sticking over the heading a link scrolled to. What a phone promises is that the bar
 * is reachable where it shows the filters, so the reader scrolls back to it, and that is what is asserted there.
 */
async function reachFilterBar (page, bar) {
  if (page.viewportSize().width > 640) {
    await expect(bar).toBeInViewport()
    return
  }
  await bar.scrollIntoViewIfNeeded()
  await expect(bar).toBeInViewport()
}

module.exports = {
  BUSINESS_ID, DAY, rome, historyRows, reportsPage, SCHEDULE, REPORT, REPORT_OUTCOMES, REPORT_QUALITY, OUTCOMES,
  job, estimateJob, REPORT_ESTIMATE, RECOMPUTE_ESTIMATE, JOBS, JOBS_U19, jobsPage, CATEGORIES, category, assistantRow, assistantsPage, mockInsights, sortBy,
  reachFilterBar,
}
