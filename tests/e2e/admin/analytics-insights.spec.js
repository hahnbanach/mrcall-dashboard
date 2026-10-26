// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')
const { sortBy, reachFilterBar } = require('../fixtures/insights')

/**
 * Call insights on the admin's analytics pages, as StarChat's docs/briefs/2026-10-24-insights-reports-ux.md left them
 * (the paged, sortable assistants table, the business filter by name, MrCall's configuration suggestions paged; the
 * callers' requests and the reports are tests/e2e/insights/). Before it:  (brief `docs/briefs/2026-10-20-call-insights.md`,
 * plan `docs/execution-plans/2026-10-20-call-insights.md`, D4): the whole-platform sections on
 * `/analytics-admin`, and an admin reading one business's report through `/analytics?id=<business>`
 * (the only place a report is read; `/analytics-admin` never shows one).
 * `tests/e2e/auth/analytics-insights.spec.js` already covers the owner and the reseller.
 */
const BUSINESS_ID = mockBusiness.businessId

function section (page, title) {
  return page.locator('.call-insights-section').filter({ hasText: title })
}

// StarChat's analytics guide §9, its example row
const assistantsResponse = (overrides = {}) => ({
  sort: 'not_solved',
  businesses: [{
    businessId: BUSINESS_ID, totalCalls: 40, callsWithResolution: 36,
    resolution: { resolved: 20, unresolved: 10, caller_left: 6 },
    callsWithChecks: 36, checks: { caller_repeated: 5, caller_unsatisfied: 4, promise_not_kept_in_call: 0 },
    callsWithUnansweredRecorded: 36, callsWithUnanswered: 9, gaps: { missing_info: 9 },
    callsWithSkillErrors: 0, extractionsNotOk: 1, extractionsRun: 36,
    callsManaged: 36, noConversation: { caller_silent: 12, no_credit: 1 },
    callsAnswered: 48, callsOffered: 48, callsWithRequest: 30, notSolved: 10,
  }],
  total: 1, from: 0, size: 10, direction: 'desc',
  ...overrides,
})

const assistantsRoute = (page, response) => page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(response),
}))
const named = (extra = {}) => assistantsResponse({ businesses: [{ ...assistantsResponse().businesses[0], businessName: 'Studio Demo', ...extra }] })

test.describe('AnalyticsAdmin: assistants to review, across the whole platform', () => {
  test('the "not solved" column is marked assessed, and a business\'s name sets this page\'s own business filter', async ({ adminPage: page }) => {
    await assistantsRoute(page, assistantsResponse())
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: BUSINESS_ID })).toBeVisible({ timeout: 15000 })
    await expect(assistants.getByRole('columnheader', { name: /^Unresolved/ })).toContainText('assessed')
    await assistants.getByRole('button', { name: BUSINESS_ID }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]businessId=${BUSINESS_ID}(&|$)`))
  })

  test('a 404 from assistants hides the section, with no toast', async ({ adminPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'not for you' }),
    }))
    await page.goto('/analytics-admin')
    await expect(section(page, 'How the calls went')).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'Assistants to review')).toHaveCount(0)
    await expect(page.locator('.p-toast-message')).toHaveCount(0)
  })

  test('a failure of assistants says so in the section, with a retry that asks again', async ({ adminPage: page }) => {
    let calls = 0
    await page.route('**/customer/analytics/assistants*', (route) => {
      calls += 1
      if (calls === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(named()) })
    })
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('alert')).toHaveText(/This section could not be loaded\./, { timeout: 15000 })
    await assistants.getByRole('button', { name: 'Try again' }).click()
    await expect(assistants.getByRole('button', { name: 'Studio Demo' })).toBeVisible()
  })
})

/** The cell under `header`, in the business's row: the header's index picks the cell. */
async function cellUnder (assistants, header) {
  const headers = await assistants.locator('thead th').allInnerTexts()
  const index = headers.findIndex((text) => text.trim().startsWith(header))
  expect(index, `a column headed "${header}"`).toBeGreaterThanOrEqual(0)
  return assistants.getByRole('row', { name: new RegExp(BUSINESS_ID) }).locator('td').nth(index)
}

test.describe('AnalyticsAdmin: assistants to review, outcome 9', () => {
  test('"Unresolved" is StarChat\'s notSolved over the calls with a request, and the caller_silent, not_answered and caller_left shares show each with its base', async ({ adminPage: page }) => {
    await assistantsRoute(page, assistantsResponse())
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: BUSINESS_ID })).toBeVisible({ timeout: 15000 })

    await expect(await cellUnder(assistants, 'Unresolved')).toHaveText('33% (10 of 30)')
    await expect(await cellUnder(assistants, 'Silent callers')).toHaveText('25% (12 of 48)')
    await expect(await cellUnder(assistants, 'Not answered')).toHaveText('0% (0 of 48)')
    await expect(await cellUnder(assistants, 'No request')).toHaveText('17% (6 of 36)')
    // extraction problems over the calls whose extraction ran, as the quality section counts them;
    // skill errors stay over all calls
    await expect(await cellUnder(assistants, 'Extraction')).toHaveText('3% (1 of 36)')
    await expect(await cellUnder(assistants, 'Skill errors')).toHaveText('0% (0 of 40)')
    await expect(assistants.getByRole('definition').filter({ hasText: 'calls whose data extraction failed, over the calls whose extraction ran' })).toBeVisible()
    // caller_left is the assistant's own judgement, as unresolved is
    await expect(assistants.getByRole('columnheader', { name: /^No request/ })).toContainText('assessed')
  })

  test('every share is a sortable header, and clicking one asks StarChat for that sort', async ({ adminPage: page }) => {
    const sorts = []
    await page.route('**/customer/analytics/assistants*', (route) => {
      const q = new URL(route.request().url()).searchParams
      sorts.push(q.get('sort') + ':' + q.get('direction'))
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(assistantsResponse()) })
    })
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: BUSINESS_ID })).toBeVisible({ timeout: 15000 })
    for (const [header, sort] of [['Silent callers', 'caller_silent'], ['Not answered', 'not_answered'], ['No request', 'caller_left']]) {
      await sortBy(page, assistants.getByRole('table'), header)
      await expect.poll(() => sorts[sorts.length - 1]).toBe(sort + ':desc')
      await expect(assistants.getByRole('columnheader', { name: new RegExp('^' + header) })).toHaveAttribute('aria-sort', 'descending')
    }
  })
})

test.describe('AnalyticsAdmin: what the calls were about (outcome 9)', () => {
  test('across several businesses it says to choose one and does not ask; with one business chosen it shows its topics', async ({ adminPage: page }) => {
    const bodies = []
    await page.route('**/customer/analytics/topics*', (route) => {
      bodies.push(route.request().postDataJSON())
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: { from: 1, to: 2 }, previousPeriod: { from: 0, to: 1 }, callsWithTopics: 12, previousCallsWithTopics: 9,
          topics: [{ topic: 'Parcheggio', calls: 5, previousCalls: 2 }],
        }),
      })
    })
    await assistantsRoute(page, named())
    await page.goto('/analytics-admin')
    const topics = section(page, 'What the calls were about')
    await expect(topics.getByText('Choose one business to see what its calls were about.')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(500)
    expect(bodies).toEqual([])

    await section(page, 'Assistants to review').getByRole('button', { name: 'Studio Demo' }).click()
    await expect(topics.getByText('12 calls with a topic, 9 in the previous period.')).toBeVisible()
    await expect(topics.getByRole('row', { name: /Parcheggio/ })).toBeVisible()
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) expect(body.businessId).toBe(BUSINESS_ID)
  })
})

test.describe('AnalyticsAdmin: MrCall\'s own configuration suggestions', () => {
  const suggestions = (from, n, total) => ({
    total, asOf: 1761100000000,
    items: Array.from({ length: n }, (_, i) => ({ businessId: `biz-${from + i}`, name: (from + i) === 1 ? undefined : `Studio Demo ${from + i}`, periodEnd: 1761004800000, suggestions: [`Suggestion ${from + i}`] })),
  })

  test('name each business, say when it has no name, and page on the server with the first page\'s asOf', async ({ adminPage: page }) => {
    const asked = []
    await page.route('**/customer/insights/config-suggestions*', (route) => {
      const q = new URL(route.request().url()).searchParams
      asked.push({ from: q.get('from'), asOf: q.get('asOf') })
      const from = Number(q.get('from'))
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(suggestions(from, from === 0 ? 10 : 3, 13)) })
    })
    await page.goto('/analytics-admin')
    const scope = section(page, 'MrCall configuration suggestions')
    await expect(scope.getByRole('link', { name: 'Studio Demo 0' })).toHaveAttribute('href', '/analytics?id=biz-0&tab=reports', { timeout: 15000 })
    await expect(scope.getByRole('row', { name: /biz-1/ }).getByText('No name on record')).toBeVisible()
    await expect(scope.getByText('1–10 of 13')).toBeVisible()
    await scope.getByRole('button', { name: 'Page 2' }).click()
    await expect(scope.getByText('Suggestion 12')).toBeVisible()
    expect(asked).toEqual([{ from: '0', asOf: null }, { from: '10', asOf: '1761100000000' }])
  })
})

test.describe('AnalyticsAdmin: assistants by name, and the business filter undone where it was set', () => {
  test('a row shows the business\'s name, or the id with a note without a name', async ({ adminPage: page }) => {
    await assistantsRoute(page, assistantsResponse({
      businesses: [
        { ...assistantsResponse().businesses[0], businessName: 'Studio Demo' },
        { ...assistantsResponse().businesses[0], businessId: 'biz-unnamed' },
      ],
      total: 2,
    }))
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: 'Studio Demo' })).toBeVisible({ timeout: 15000 })
    await expect(assistants.getByRole('row', { name: /biz-unnamed/ }).getByText('No name on record')).toBeVisible()
  })

  test('the business chosen from the table is marked in it, and a control on the table clears it', async ({ adminPage: page }) => {
    await assistantsRoute(page, named())
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: 'Show all businesses' })).toHaveCount(0, { timeout: 15000 })
    await assistants.getByRole('button', { name: 'Studio Demo' }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]businessId=${BUSINESS_ID}(&|$)`))
    await expect(assistants.getByRole('button', { name: 'Studio Demo' })).toHaveAttribute('aria-pressed', 'true')

    await assistants.getByRole('button', { name: 'Show all businesses' }).click()
    await expect(page).not.toHaveURL(/businessId=/)
    await expect(assistants.getByRole('button', { name: 'Show all businesses' })).toHaveCount(0)
  })
})

test.describe('AnalyticsAdmin: the first load asks each section once', () => {
  test('one outcomes, one dashboard, one breakdown and one assistants request, not one per watcher', async ({ adminPage: page }) => {
    const counts = { outcomes: 0, dashboard: 0, breakdown: 0, assistants: 0 }
    await page.route('**/customer/analytics/outcomes*', (route) => { counts.outcomes += 1; route.fallback() })
    await page.route('**/customer/analytics/dashboard*', (route) => { counts.dashboard += 1; route.fallback() })
    await page.route('**/customer/analytics/business-breakdown*', (route) => { counts.breakdown += 1; route.fallback() })
    await page.route('**/customer/analytics/assistants*', (route) => { counts.assistants += 1; route.fallback() })
    await page.goto('/analytics-admin')
    await expect(section(page, 'How the calls went')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)
    expect(counts).toEqual({ outcomes: 1, dashboard: 1, breakdown: 1, assistants: 1 })
  })
})

test.describe('AnalyticsAdmin: the assistants table reads on one screen', () => {
  test('short headers (the full wording in a legend), and the business column stays while the table scrolls sideways', async ({ adminPage: page }) => {
    await assistantsRoute(page, named())
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: 'Studio Demo' })).toBeVisible({ timeout: 15000 })
    await expect(assistants.getByRole('definition').filter({ hasText: 'Hung up without speaking' })).toBeVisible()

    const cell = assistants.getByRole('cell', { name: /Studio Demo/ })
    await cell.scrollIntoViewIfNeeded()
    const before = await cell.boundingBox()
    await assistants.locator('.paged-table-scroll').evaluate((el) => { el.scrollLeft = el.scrollWidth })
    await page.waitForTimeout(200)
    const after = await cell.boundingBox()
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
    await expect(cell).toBeInViewport()
  })
})

test.describe('AnalyticsAdmin: a row chosen on a phone', () => {
  test('the table stays while it reloads, and the control that widens the page again is on screen', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    let calls = 0
    await page.route('**/customer/analytics/assistants*', async (route) => {
      calls += 1
      if (calls > 1) await new Promise((resolve) => setTimeout(resolve, 4000))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(named()) })
    })
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    const choose = assistants.getByRole('button', { name: 'Studio Demo' })
    await expect(choose).toBeVisible({ timeout: 15000 })
    await choose.click()
    // while the new answer is held back (4 s): the assertions must not wait it out
    await expect(assistants.locator('.insights-state')).toHaveAttribute('aria-busy', 'true')
    await expect(choose).toBeVisible({ timeout: 1000 })
    await expect(assistants.getByRole('button', { name: 'Show all businesses' })).toBeInViewport({ timeout: 1000 })
  })
})

test.describe('AnalyticsAdmin: the filter bar', () => {
  // Sticky, and so on screen while the page scrolls, wider than a phone; on a phone it stays at the top of the page
  // (U19 m19, see `reachFilterBar`) and is reached there. On both, each filter is cleared from the chip that shows it.
  test('stays reachable while the page scrolls, and clears each filter from where it shows it', async ({ adminPage: page }) => {
    // No section of the page names the business or the owner: the bar asks for both. The owner is
    // named from the contact on its own business (`crm/business/search` by `owner`), since
    // StarChat's admin user record carries only the role.
    await page.route('**/crm/business/search*', (route) => {
      const body = route.request().postDataJSON() || {}
      if (body.owner !== 'owner-9') return route.fallback()
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ ...mockBusiness, businessId: 'biz-owned', name: 'Demo', surname: 'Owner', emailAddress: 'demo-owner@example.com' }]),
      })
    })
    await page.goto(`/analytics-admin?businessId=${BUSINESS_ID}&ownerId=owner-9&plan=restaurant`)
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByText(mockBusiness.companyName)).toBeVisible({ timeout: 15000 })
    await expect(bar.getByText('Demo Owner')).toBeVisible()
    // the name is the contact of the owner's business, and the chip says so
    await expect(bar.getByText('Demo Owner')).toHaveAttribute('title', /owner-9.*contact/)
    await expect(bar.getByText(BUSINESS_ID)).toHaveCount(0)
    await expect(bar.getByText('owner-9')).toHaveCount(0)
    await expect(bar.getByText('restaurant', { exact: true })).toBeVisible()
    await expect(bar.getByText('Last 30 days')).toBeVisible()

    await section(page, 'Callers\' requests').scrollIntoViewIfNeeded()
    await reachFilterBar(page, bar)

    const clearOwner = bar.getByRole('button', { name: 'Clear the owner filter' })
    await expect(clearOwner).toBeInViewport()
    await clearOwner.click()
    await expect(page).not.toHaveURL(/ownerId=/)
    await expect(page).toHaveURL(new RegExp(`[?&]businessId=${BUSINESS_ID}(&|$)`))
    await expect(bar.getByText('Demo Owner')).toHaveCount(0)
    await expect(bar.getByText(mockBusiness.companyName)).toBeVisible()
    await reachFilterBar(page, bar)

    await bar.getByRole('button', { name: 'Clear the plan filter' }).click()
    await expect(page).not.toHaveURL(/plan=/)
    await bar.getByRole('button', { name: 'Clear the business filter' }).click()
    await expect(page).not.toHaveURL(/businessId=/)
    await expect(bar.getByRole('button', { name: /^Clear the/ })).toHaveCount(0)
  })

  // On a phone the chips wrap, every one on the screen (U19 m19: in one line scrolling sideways they were cut), and the
  // bar, two or three lines tall, stays at the top of the page rather than sticking over a heading a link scrolled to.
  test('on a phone every chip is on the screen, and the bar does not stick over a heading scrolled to', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/analytics-admin?businessId=${BUSINESS_ID}&ownerId=owner-9&plan=restaurant`)
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByRole('button', { name: 'Clear the plan filter' })).toBeAttached({ timeout: 15000 })
    for (const chip of await bar.locator('.filter-chip').all()) {
      const box = await chip.boundingBox()
      expect(box.x + box.width).toBeLessThanOrEqual(375)
    }
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('static')
  })

  test('over MrCall\'s configuration suggestions, which follow no filter, the bar says what they cover', async ({ adminPage: page }) => {
    await page.route('**/customer/insights/config-suggestions*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 1, asOf: 1, items: [{ businessId: 'biz-1', name: 'Studio Demo 1', periodEnd: 1761004800000, suggestions: ['Suggestion 1'] }] }),
    }))
    await page.goto(`/analytics-admin?businessId=${BUSINESS_ID}`)
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByText('Last 30 days')).toBeVisible({ timeout: 15000 })
    await expect(bar.getByText('This section: every business you can see, last 30 days')).toHaveCount(0)
    await section(page, 'MrCall configuration suggestions').getByText('Suggestion 1').scrollIntoViewIfNeeded()
    await expect(bar.getByText('This section: every business you can see, last 30 days')).toBeVisible()
    await expect(bar.getByRole('list', { name: 'Filters not applied to this section' })).toBeVisible()
    await page.locator('#app-central-content').evaluate((el) => el.scrollTo(0, 0))
    await expect(bar.getByText('This section: every business you can see, last 30 days')).toHaveCount(0)
  })

  test('a changed period shows in the bar and is reset from it', async ({ adminPage: page }) => {
    await page.goto('/analytics-admin')
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByText('Last 30 days')).toBeVisible({ timeout: 15000 })
    await expect(bar.getByRole('button', { name: 'Back to the last 30 days' })).toHaveCount(0)
    await page.getByRole('radio', { name: '7 days' }).or(page.getByRole('button', { name: '7 days' })).first().click()
    await expect(bar.getByText('Last 7 days')).toBeVisible()
    await bar.getByRole('button', { name: 'Back to the last 30 days' }).click()
    await expect(bar.getByText('Last 30 days')).toBeVisible()
  })
})

test.describe('Analytics: an admin reading one business\'s report', () => {
  test('MrCall\'s own configuration suggestions show, and an example call is named but does not link (out of scope: reading an owner\'s call as an admin)', async ({ adminPage: page }) => {
    await page.route('**/customer/insights/reports/*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        businessId: BUSINESS_ID, periodStart: 1700000000000, periodEnd: 1700086400000, cadence: 7,
        content: {
          version: 1, calls: 5, topics: [],
          gaps: [{ group: 'missing_info', summary: 'Ask about parking.', examples: ['CON-9'] }],
          suggestions: { business_info: [], integration: [], mrcall_config: ['Turn on the restaurant skill.'] },
        },
        // StarChat tells who called to the business's owner alone: an admin gets when the call started
        exampleCalls: { 'CON-9': { startTimestamp: Date.UTC(2026, 9, 14, 9, 30) } },
      }),
    }))
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=1700000000000`)
    await expect(page.getByText('Turn on the restaurant skill.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Ask about parking.')).toBeVisible()
    // named by when it started, the caller being the owner's alone, and not a link
    const name = await page.evaluate((t) => new Date(t).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      Date.UTC(2026, 9, 14, 9, 30))
    await expect(page.getByRole('link', { name })).toHaveCount(0)
    await expect(page.getByText(name, { exact: true })).toBeVisible()
    await expect(page.getByText('CON-9')).toHaveCount(0)
  })
})

test.describe('AnalyticsAdmin: a changed scope', () => {
  test('admin: the section says it is updating while the new answer is pending, then shows only the new numbers', async ({ adminPage: page }) => {
    const answer = (n) => ({
      granularity: 'daily', period: { from: 1, to: 2 }, totalCalls: 20,
      resolution: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
      message: { callsWithValue: n, totals: { complete: n }, previousTotals: {}, buckets: [] },
      callsWithBooked: 0, booked: 0, transferred: 0,
    })
    let changed = false
    let release
    const gate = new Promise((resolve) => { release = resolve })
    await page.route('**/customer/analytics/outcomes*', async (route) => {
      if (changed) await gate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(changed ? 9 : 5)) })
    })
    await assistantsRoute(page, named())
    await page.goto('/analytics-admin')
    const what = section(page, 'How the calls went')
    const complete = what.locator('.insight-dimension').filter({ hasText: 'Message' }).locator('li').filter({ hasText: /^\s*Complete message/ }).locator('.legend-count')
    await expect(complete).toHaveText('5', { timeout: 15000 })
    await expect(what).not.toHaveAttribute('aria-busy', 'true')

    changed = true
    await section(page, 'Assistants to review').getByRole('button', { name: 'Studio Demo' }).click()
    await expect(what).toHaveAttribute('aria-busy', 'true')
    await expect(what.getByText('Updating')).toBeVisible()
    await expect(complete).toHaveText('5')

    release()
    await expect(complete).toHaveText('9')
    await expect(what).not.toHaveAttribute('aria-busy', 'true')
    await expect(what.getByText('Updating')).toHaveCount(0)
  })
})
