// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * Call insights on the analytics page (brief `docs/briefs/2026-10-20-call-insights.md`, plan
 * `docs/execution-plans/2026-10-20-call-insights.md`, D4): "What calls said", "Quality" and "Call
 * reports" on the owner's business page (`/analytics?id=<business>`), and the reseller's scope page
 * (`/analytics` with no business). Mocked at the real StarChat paths
 * (`docs/analytics-api-guide.md` §7-10 of the StarChat repository); `setupApiMocks` in
 * `tests/e2e/fixtures/auth.js` already answers the four routes with a shape-correct, empty
 * default, so a test only overrides what it reads.
 */
const BUSINESS_ID = mockBusiness.businessId

function section (page, title) {
  return page.locator('.call-insights-section').filter({ hasText: title })
}

test.describe('Analytics: what calls said (owner, business page)', () => {
  test('empty coverage: no call has a recorded outcome yet', async ({ authenticatedPage: page }) => {
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(section(page, 'What calls said').getByText('0 of 0 calls have a recorded outcome.'))
      .toBeVisible({ timeout: 15000 })
  })

  test('partial coverage, and the assessed marking in the chart legend', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/outcomes*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalCalls: 20,
        callsWithOutcome: 12,
        totals: { booked: 5, unresolved: 7 },
        previousTotals: { booked: 4, unresolved: 6 },
        buckets: [{ timestamp: 1700000000000, counts: { booked: 5, unresolved: 7 } }],
      }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const outcomes = section(page, 'What calls said')
    await expect(outcomes.getByText('12 of 20 calls have a recorded outcome.')).toBeVisible({ timeout: 15000 })
    const booked = outcomes.locator('li').filter({ hasText: 'Booked' })
    const unresolved = outcomes.locator('li').filter({ hasText: 'Unresolved' })
    await expect(booked.getByText('Assessed by the assistant')).toHaveCount(0)
    await expect(unresolved.getByText('Assessed by the assistant')).toBeVisible()
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
      outcomes: { booked: 3, unresolved: 2 },
      topics: [{
        topic: 'Opening hours', calls: 6, labels: ['hours'],
        outcomes: { booked: 3, unresolved: 2 }, with_unanswered: 1, new: false,
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
    await expect(topicRow.getByText('Assessed by the assistant')).toBeVisible()

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
        body: JSON.stringify({ totalCalls: 0, callsWithOutcome: 0, totals: {}, previousTotals: {}, buckets: [] }),
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
          businessId: BUSINESS_ID, totalCalls: 10, callsWithOutcome: 8, outcomes: { unresolved: 3 },
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
