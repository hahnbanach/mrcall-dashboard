// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * Call insights on the analytics page (brief `docs/briefs/2026-10-20-call-insights.md`, plan
 * `docs/execution-plans/2026-10-20-call-insights.md`, D4): "What calls said", "Quality" and "Call
 * reports" on the owner's business page (`/analytics?id=<business>`), and the reseller's scope page
 * (`/analytics` with no business). Mocked at the real StarChat paths (StarChat's own
 * conversation-analytics API reference, §7-10); `setupApiMocks` in `tests/e2e/fixtures/auth.js`
 * already answers the four routes with a shape-correct, empty default, so a test only overrides
 * what it reads.
 */
const BUSINESS_ID = mockBusiness.businessId

function section (page, title) {
  return page.locator('.call-insights-section').filter({ hasText: title })
}

const dimension = (page, title) => section(page, 'What calls said').locator('.insight-dimension').filter({ hasText: title })

const emptyDimension = { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] }

test.describe('Analytics: what calls said (owner, business page)', () => {
  test('empty coverage: no call has a resolution or a message yet, nothing booked, nothing transferred', async ({ authenticatedPage: page }) => {
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(dimension(page, 'Resolution').getByText('0 of 0 calls were assessed.')).toBeVisible({ timeout: 15000 })
    await expect(dimension(page, 'Message').getByText('0 of 0 calls were assessed.')).toBeVisible()
    const what = section(page, 'What calls said')
    await expect(what.getByText('0 of 0 calls with a booking record were booked.')).toBeVisible()
    await expect(what.getByText('0 calls transferred, as reported by the carriers.')).toBeVisible()
  })

  test('partial coverage: resolution and message series and totals marked as the assistant\'s, booked beside the calls it counts on, transferred as a count', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/outcomes*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        granularity: 'daily',
        period: { from: 1699000000000, to: 1700000000000 },
        totalCalls: 20,
        resolution: {
          callsWithValue: 12,
          totals: { resolved: 5, unresolved: 7 },
          previousTotals: { resolved: 4, unresolved: 6 },
          buckets: [{ timestamp: 1700000000000, counts: { resolved: 5, unresolved: 7 } }],
        },
        message: {
          callsWithValue: 9,
          totals: { complete: 6, none: 3 },
          previousTotals: { complete: 3 },
          buckets: [{ timestamp: 1700000000000, counts: { complete: 6, none: 3 } }],
        },
        callsWithBooked: 14,
        booked: 6,
        transferred: 2,
      }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const resolution = dimension(page, 'Resolution')
    await expect(resolution.getByText('12 of 20 calls were assessed.')).toBeVisible({ timeout: 15000 })
    await expect(dimension(page, 'Message').getByText('9 of 20 calls were assessed.')).toBeVisible()

    const resolved = resolution.locator('li').filter({ hasText: 'Resolved' }).filter({ hasNotText: 'Unresolved' })
    await expect(resolved).toContainText('5')
    await expect(resolved).toContainText('25.0%')
    await expect(resolved.getByText('Assessed by the assistant')).toBeVisible()
    await expect(resolution.locator('li').filter({ hasText: 'Unresolved' }).getByText('Assessed by the assistant')).toBeVisible()

    const complete = dimension(page, 'Message').locator('li').filter({ hasText: /^\s*Complete message/ })
    await expect(complete).toContainText('6')
    await expect(complete.getByText('Assessed by the assistant')).toBeVisible()
    await expect(dimension(page, 'Message').locator('li').filter({ hasText: 'No message' }).getByText('Assessed by the assistant')).toBeVisible()
    await expect(dimension(page, 'Resolution').locator('canvas')).toHaveCount(1)
    await expect(dimension(page, 'Message').locator('canvas')).toHaveCount(1)

    const what = section(page, 'What calls said')
    await expect(what.getByText('6 of 14 calls with a booking record were booked.')).toBeVisible()
    await expect(what.getByText('2 calls transferred, as reported by the carriers.')).toBeVisible()
    // booked and transferred are recorded facts, not assessments
    await expect(what.locator('.insight-facts').getByText('Assessed by the assistant')).toHaveCount(0)
    // transferred is a count, never a share of the calls
    await expect(what.locator('.insight-transferred')).not.toContainText('%')
    await expect(what.locator('.insight-transferred')).not.toContainText('of 20')
  })

  test('owner: the section says it is updating while the new answer is pending, then shows only the new numbers', async ({ authenticatedPage: page }) => {
    const answer = (resolved) => ({
      granularity: 'daily', period: { from: 1, to: 2 }, totalCalls: 20,
      resolution: { callsWithValue: resolved, totals: { resolved }, previousTotals: {}, buckets: [] },
      message: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
      callsWithBooked: 0, booked: 0, transferred: 0,
    })
    let changed = false
    let release
    const gate = new Promise((resolve) => { release = resolve })
    await page.route('**/customer/analytics/outcomes*', async (route) => {
      if (changed) await gate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(changed ? 9 : 5)) })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const what = section(page, 'What calls said')
    const resolved = what.locator('.insight-dimension').filter({ hasText: 'Resolution' }).locator('li').filter({ hasText: /^\s*Resolved/ }).locator('.legend-count')
    await expect(resolved).toHaveText('5', { timeout: 15000 })
    await expect(what).not.toHaveAttribute('aria-busy', 'true')

    changed = true
    await page.getByRole('button', { name: '90 days' }).click()
    await expect(what).toHaveAttribute('aria-busy', 'true')
    await expect(what.getByText('Updating')).toBeVisible()
    await expect(page.getByRole('progressbar').first()).toBeVisible()
    await expect(resolved).toHaveText('5')

    release()
    await expect(resolved).toHaveText('9')
    await expect(what).not.toHaveAttribute('aria-busy', 'true')
    await expect(what.getByText('Updating')).toHaveCount(0)
    await expect(what.locator('.legend-count').filter({ hasText: /^5$/ })).toHaveCount(0)
  })

  test('owner: an earlier period\'s answer arriving after a later one does not replace it', async ({ authenticatedPage: page }) => {
    const answer = (resolved) => ({
      granularity: 'daily', period: { from: 1, to: 2 }, totalCalls: 20,
      resolution: { callsWithValue: resolved, totals: { resolved }, previousTotals: {}, buckets: [] },
      message: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
      callsWithBooked: 0, booked: 0, transferred: 0,
    })
    // phase 0: the first period; 1: the 90 days, held until released; 2: the 7 days, answered at once
    let phase = 0
    let release
    const gate = new Promise((resolve) => { release = resolve })
    await page.route('**/customer/analytics/outcomes*', async (route) => {
      const asked = phase
      if (asked === 1) await gate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(asked === 0 ? 5 : asked === 1 ? 9 : 3)) })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const what = section(page, 'What calls said')
    const resolved = what.locator('.insight-dimension').filter({ hasText: 'Resolution' }).locator('li').filter({ hasText: /^\s*Resolved/ }).locator('.legend-count')
    await expect(resolved).toHaveText('5', { timeout: 15000 })

    phase = 1
    await page.getByRole('button', { name: '90 days' }).click()
    await expect(what).toHaveAttribute('aria-busy', 'true')
    phase = 2
    await page.getByRole('button', { name: '7 days' }).click()
    await expect(resolved).toHaveText('3')
    await expect(what).not.toHaveAttribute('aria-busy', 'true')

    release()
    // the held answer has been delivered once the route handler returns; give the page a moment to (wrongly) apply it
    await page.waitForTimeout(500)
    await expect(resolved).toHaveText('3')
    await expect(what).not.toHaveAttribute('aria-busy', 'true')
  })

  test('a 404 from quality hides the section, with no toast', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/quality*', (route) => route.fulfill({
      status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'not for you' }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(section(page, 'What calls said')).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'Quality')).toHaveCount(0)
    await expect(page.locator('.p-toast-message')).toHaveCount(0)
  })

  test('a 503 from reports shows a short note, not a failure', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/insights/reports*', (route) => route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'not ready' }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(section(page, 'Call reports').getByText('Not available yet.')).toBeVisible({ timeout: 15000 })
  })
})

/** One report page's worth of items: the first carries a real `content`, the rest are filler so
  * the list answers exactly the page size (10), which is what makes "Show earlier reports" appear. */
function reportPage (n, { withContent = false } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    businessId: BUSINESS_ID,
    periodStart: 1700000000000 - i * 86400000,
    periodEnd: 1700000000000 - i * 86400000 + 86400000,
    cadence: 'weekly',
    content: (withContent && i === 0) ? {
      version: 1,
      period: { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', cadence: 'weekly' },
      calls: 10,
      resolution: { resolved: 6, unresolved: 2, handed_over: 1 },
      message: { complete: 4, none: 3 },
      booked: 3,
      transferred: 1,
      topics: [{
        topic: 'Opening hours', calls: 6, labels: ['hours'],
        resolution: { resolved: 4, unresolved: 2 }, with_unanswered: 1, new: false,
      }],
      gap_calls: { missing_info: 1 },
      gaps: [{ group: 'missing_info', summary: 'Callers ask about Sunday hours.', examples: ['CON-1'] }],
      suggestions: { business_info: ['Tell us your Sunday hours.'], integration: [], mrcall_config: ['Turn on multilingual.'] },
      flagged_calls: ['CON-2'],
      extractor_audit: { sampled_resolved: 2, disagreements: 0 },
      model: 'gpt-x',
      usage: { input_tokens: 100, output_tokens: 50 },
    } : null,
  }))
}

test.describe('Analytics: call reports (owner, business page)', () => {
  test('the latest report opens, a topic\'s outcome carries the assessed marking, an example call links for the owner, and MrCall\'s own suggestions never show', async ({ authenticatedPage: page }) => {
    // Keyed on `before`, not on call order: the page's own date-range watcher fires its own,
    // idempotent first-page request before `mounted`'s role-and-data sequence finishes (harmless
    // in a real backend, since both ask for the same first page; a counter here would not be).
    let beforeCalls = 0
    await page.route('**/customer/insights/reports*', (route) => {
      const before = new URL(route.request().url()).searchParams.get('before')
      if (before) beforeCalls += 1
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(before ? reportPage(3) : reportPage(10, { withContent: true })),
      })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const reports = section(page, 'Call reports')
    await expect(reports.getByText('Opening hours')).toBeVisible({ timeout: 15000 })

    const topicRow = reports.locator('.report-topic').filter({ hasText: 'Opening hours' })
    await expect(topicRow.locator('.report-topic-outcome').filter({ hasText: 'Unresolved' }).getByText('Assessed by the assistant')).toBeVisible()
    await expect(topicRow.locator('.report-topic-outcome').filter({ hasText: 'Unresolved' })).toContainText('2')
    await expect(topicRow.locator('.report-topic-outcome').filter({ hasText: 'Resolved' }).filter({ hasNotText: 'Unresolved' })).toContainText('4')

    const summary = reports.locator('.report-summary')
    await expect(summary.locator('.report-topic-outcome').filter({ hasText: 'Handed over' }).getByText('Assessed by the assistant')).toBeVisible()
    await expect(summary.locator('.report-topic-outcome').filter({ hasText: /^\s*Complete message/ })).toContainText('4')
    await expect(summary.getByText('Booked calls: 3')).toBeVisible()
    await expect(summary.getByText('Transferred calls, as reported by the carriers: 1')).toBeVisible()
    await expect(summary.locator('.report-fact').getByText('Assessed by the assistant')).toHaveCount(0)

    await expect(reports.getByRole('link', { name: 'CON-1' }))
      .toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-1`)
    await expect(reports.getByRole('link', { name: 'CON-2' }))
      .toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-2`)
    await expect(reports.getByText('Turn on multilingual.')).toHaveCount(0)

    // paging to the end: the second page answers fewer than the page size (10), so there is no third
    await reports.getByRole('button', { name: 'Show earlier reports' }).click()
    await expect.poll(() => beforeCalls).toBe(1)
    await expect(reports.getByRole('button', { name: 'Show earlier reports' })).toHaveCount(0)
  })
})

test.describe('Analytics: call reports, an earlier page that fails', () => {
  test('keeps the reports already shown and the button to try again', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/insights/reports*', (route) => {
      const before = new URL(route.request().url()).searchParams.get('before')
      if (before) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reportPage(10, { withContent: true })) })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const reports = section(page, 'Call reports')
    await expect(reports.getByText('Opening hours')).toBeVisible({ timeout: 15000 })
    await reports.getByRole('button', { name: 'Show earlier reports' }).click()
    await expect(reports.getByText('Opening hours')).toBeVisible()
    await expect(reports.getByRole('button', { name: 'Show earlier reports' })).toBeEnabled()
  })
})

test.describe('Analytics: a report written before insights version 2', () => {
  test('shows its topics and no resolution, message, booked or transferred', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/insights/reports*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        businessId: BUSINESS_ID, periodStart: 1700000000000, periodEnd: 1700086400000, cadence: 'weekly',
        content: {
          version: 1, period: { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', cadence: 'weekly' },
          calls: 10, outcomes: { booked: 3, unresolved: 2 },
          topics: [{ topic: 'Opening hours', calls: 6, labels: [], outcomes: { booked: 3 }, with_unanswered: 0, new: true }],
          gap_calls: {}, gaps: [], suggestions: { business_info: [], integration: [], mrcall_config: [] }, flagged_calls: [],
        },
      }]),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const reports = section(page, 'Call reports')
    await expect(reports.getByText('Opening hours')).toBeVisible({ timeout: 15000 })
    await expect(reports.locator('.report-summary')).toHaveCount(0)
    await expect(reports.locator('.report-topic-outcome')).toHaveCount(0)
  })
})

// The business page asks outcomes for the same granularity and browser time zone the existing
// sections already do (tests/e2e/auth/analytics.spec.js:43-61).
test.describe('Analytics time zone: outcomes (owner, business page)', () => {
  test.use({ timezoneId: 'Asia/Tokyo' })

  test('the outcomes request carries the browser time zone and a granularity', async ({ authenticatedPage: page }) => {
    const seen = []
    await page.route('**/customer/analytics/outcomes*', (route) => {
      const url = new URL(route.request().url())
      seen.push({ granularity: url.searchParams.get('granularity'), timezone: url.searchParams.get('timezone') })
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalCalls: 0, resolution: emptyDimension, message: emptyDimension, callsWithBooked: 0, booked: 0, transferred: 0 }),
      })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect.poll(() => seen.length).toBeGreaterThan(0)
    expect(seen[0].timezone).toBe('Asia/Tokyo')
    expect(seen[0].granularity).toBeTruthy()
  })
})

test.describe('Analytics: the reseller\'s scope page', () => {
  test('opening /analytics directly, in a fresh context, shows the scope page: the owner selector and the whole-scope sections', async ({ resellerPage: page }) => {
    await page.goto('/analytics')
    await expect(page.locator('.owner-selector')).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'What calls said')).toBeVisible()
    await expect(section(page, 'Quality')).toBeVisible()
    await expect(section(page, 'Assistants to review')).toBeVisible()
    await expect(section(page, 'Integrations and information asked')).toBeVisible()
    await expect(section(page, 'Call reports')).toHaveCount(0)
  })

  test('an assistants row opens that business: its sections appear', async ({ resellerPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sort: 'not_solved',
        businesses: [{
          businessId: BUSINESS_ID, totalCalls: 10, callsWithResolution: 8, resolution: { unresolved: 3 },
          callsWithChecks: 8, checks: {}, callsWithUnansweredRecorded: 8, callsWithUnanswered: 1,
          gaps: {}, callsWithSkillErrors: 0, extractionsNotOk: 0,
        }],
      }),
    }))
    await page.goto('/analytics')
    await expect(section(page, 'Assistants to review').getByText(BUSINESS_ID)).toBeVisible({ timeout: 15000 })
    await section(page, 'Assistants to review').getByRole('row', { name: new RegExp(BUSINESS_ID) }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]id=${BUSINESS_ID}(&|$)`))
    await expect(section(page, 'Call reports')).toBeVisible({ timeout: 15000 })
  })
})
