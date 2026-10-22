// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * Call insights on the admin's analytics pages (brief `docs/briefs/2026-10-20-call-insights.md`,
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
    callsWithSkillErrors: 0, extractionsNotOk: 1,
    callsManaged: 36, noConversation: { caller_silent: 12, no_credit: 1 },
    callsAnswered: 48, callsOffered: 48, callsWithRequest: 30,
  }],
  ...overrides,
})

test.describe('AnalyticsAdmin: assistants to review, across the whole platform', () => {
  test('the "not solved" column and its sort option are marked assessed, and a row sets this page\'s own business filter', async ({ adminPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(assistantsResponse()),
    }))
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByText(BUSINESS_ID)).toBeVisible({ timeout: 15000 })

    const notSolvedHeader = assistants.locator('th').filter({ hasText: /^\s*Unresolved/ })
    await expect(notSolvedHeader.getByText('Assessed by the assistant')).toBeVisible()
    await assistants.getByRole('combobox', { name: 'Sort by' }).click()
    await expect(page.getByRole('option', { name: 'Unresolved (assessed by the assistant)', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')

    await assistants.getByRole('row', { name: new RegExp(BUSINESS_ID) }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]businessId=${BUSINESS_ID}(&|$)`))
    await expect(page.getByRole('textbox', { name: 'Business ID' })).toHaveValue(BUSINESS_ID)
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
})

/** The cell under `header`, in the business's row: the header's index picks the cell. */
async function cellUnder (assistants, header) {
  const headers = await assistants.locator('thead th').allInnerTexts()
  const index = headers.findIndex((text) => text.trim().startsWith(header))
  expect(index, `a column headed "${header}"`).toBeGreaterThanOrEqual(0)
  return assistants.getByRole('row', { name: new RegExp(BUSINESS_ID) }).locator('td').nth(index)
}

test.describe('AnalyticsAdmin: assistants to review, outcome 9', () => {
  test('"Unresolved" is unresolved over the calls with a request, and the caller_silent, not_answered and caller_left shares show each with its base', async ({ adminPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(assistantsResponse()),
    }))
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByText(BUSINESS_ID)).toBeVisible({ timeout: 15000 })

    // caller_left is neither in the count nor in the base of "Unresolved"
    await expect(await cellUnder(assistants, 'Unresolved')).toHaveText('33% (10 of 30)')
    await expect(await cellUnder(assistants, 'Hung up without speaking')).toHaveText('25% (12 of 48)')
    await expect(await cellUnder(assistants, 'Not answered by the assistant')).toHaveText('0% (0 of 48)')
    await expect(await cellUnder(assistants, 'Spoke but never said what they wanted')).toHaveText('17% (6 of 36)')
    // caller_left is the assistant's own judgement, as unresolved is
    await expect(assistants.locator('th').filter({ hasText: 'Spoke but never said what they wanted' }).getByText('Assessed by the assistant')).toBeVisible()
  })

  test('the three new shares are sort options, and choosing one asks StarChat for that sort', async ({ adminPage: page }) => {
    const sorts = []
    await page.route('**/customer/analytics/assistants*', (route) => {
      sorts.push(new URL(route.request().url()).searchParams.get('sort'))
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(assistantsResponse()) })
    })
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByText(BUSINESS_ID)).toBeVisible({ timeout: 15000 })

    const options = [
      ['Hung up without speaking', 'caller_silent'],
      ['Not answered by the assistant', 'not_answered'],
      ['Spoke but never said what they wanted (assessed by the assistant)', 'caller_left'],
    ]
    for (const [label, sort] of options) {
      await assistants.getByRole('combobox', { name: 'Sort by' }).click()
      await page.getByRole('option', { name: label, exact: true }).click()
      await expect.poll(() => sorts[sorts.length - 1]).toBe(sort)
      await expect(assistants.getByText(BUSINESS_ID)).toBeVisible()
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
    await page.goto('/analytics-admin')
    const topics = section(page, 'What the calls were about')
    await expect(topics.getByText('Choose one business to see what its calls were about.')).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'How the calls went')).toBeVisible()
    await page.waitForTimeout(500)
    expect(bodies).toEqual([])

    await page.getByRole('textbox', { name: 'Business ID' }).fill(BUSINESS_ID)
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(topics.getByText('12 calls with a topic, 9 in the previous period.')).toBeVisible()
    await expect(topics.getByRole('row', { name: /Parcheggio/ })).toBeVisible()
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) expect(body.businessId).toBe(BUSINESS_ID)
    await expect(topics.getByText('Choose one business to see what its calls were about.')).toHaveCount(0)
  })
})

// StarChat's analytics guide §10 (M16): one page of `{total, items, asOf}`. Fictional businesses only.
const said = (n) => Array.from({ length: n }, (_, i) => ({
  businessId: `biz-${i}`, name: `Studio Demo ${i}`, reportPeriodStart: 1761004800000 - i * 86400000,
}))
const integrationItem = (i, extra = {}) => ({
  template: 'restaurant', kind: 'integration', text: `Integration request ${i}`, businesses: 1, reports: 1,
  said: [{ businessId: `biz-${i}`, name: `Studio Demo ${i}`, reportPeriodStart: 1761004800000 }], ...extra,
})
const configItem = (i, extra = {}) => ({
  businessId: `biz-${i}`, name: `Studio Demo ${i}`, periodEnd: 1761091200000, suggestions: [`Suggestion ${i}`], ...extra,
})

/** Answers `count` items in pages as StarChat does, recording each request's query. */
function pagedRoute (page, glob, makeItem, count, requests) {
  return page.route(glob, (route) => {
    const url = new URL(route.request().url())
    const from = Number(url.searchParams.get('from') || 0)
    const size = Number(url.searchParams.get('size') || 20)
    requests.push({ from, size, asOf: url.searchParams.get('asOf') })
    const items = []
    for (let i = from; i < Math.min(from + size, count); i++) items.push(makeItem(i))
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: count, asOf: 1761100000000, items }) })
  })
}

test.describe('AnalyticsAdmin: integrations and MrCall\'s own configuration suggestions', () => {
  test('both show, labelled as the whole scope, and neither reacts to a changed business filter', async ({ adminPage: page }) => {
    let integrationsCalls = 0
    let configCalls = 0
    await page.route('**/customer/insights/integrations*', (route) => {
      integrationsCalls += 1
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ total: 1, items: [{ template: 'restaurant', kind: 'integration', text: 'A booking calendar', businesses: 3, reports: 5, said: said(3) }] }),
      })
    })
    await page.route('**/customer/insights/config-suggestions*', (route) => {
      configCalls += 1
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ total: 1, items: [{ businessId: BUSINESS_ID, name: 'Studio Demo', periodEnd: 1700000000000, suggestions: ['Enable multilingual.'] }] }),
      })
    })
    await page.goto('/analytics-admin')
    const scope = section(page, 'Integrations and information asked')
    await expect(scope.getByText('A booking calendar')).toBeVisible({ timeout: 15000 })
    await expect(scope.getByText('Across every business you can see, over the last 30 days.')).toBeVisible()
    await expect(scope.getByText('Enable multilingual.')).toBeVisible()
    expect(integrationsCalls).toBe(1)
    expect(configCalls).toBe(1)

    await page.getByRole('textbox', { name: 'Business ID' }).fill(BUSINESS_ID)
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]businessId=${BUSINESS_ID}(&|$)`))
    // the other, filtered sections did refetch; these two did not
    expect(integrationsCalls).toBe(1)
    expect(configCalls).toBe(1)
  })

  test('an integration names the businesses that asked by name, each opening its analytics at the report that said it, and how many more there are', async ({ adminPage: page }) => {
    await page.route('**/customer/insights/integrations*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        asOf: 1761100000000,
        items: [{
          template: 'restaurant', kind: 'needs_integration_gap', text: 'A booking calendar', businesses: 7, reports: 9,
          said: [
            { businessId: 'biz-named', name: 'Studio Demo', reportPeriodStart: 1761004800000 },
            { businessId: 'biz-unnamed', reportPeriodStart: 1760918400000 },
          ],
        }],
      }),
    }))
    await page.goto('/analytics-admin')
    const scope = section(page, 'Integrations and information asked')
    const item = scope.getByRole('listitem').filter({ hasText: 'A booking calendar' })
    await expect(item).toBeVisible({ timeout: 15000 })
    await expect(item.getByText('7 businesses, 9 reports')).toBeVisible()
    await expect(item.getByText('Unanswered: needs an integration')).toBeVisible()
    await expect(item.getByRole('link', { name: 'Studio Demo' })).toHaveAttribute('href', '/analytics?id=biz-named&report=1761004800000')
    // no name: the id is all there is
    await expect(item.getByRole('link', { name: 'biz-unnamed' })).toHaveAttribute('href', '/analytics?id=biz-unnamed&report=1760918400000')
    await expect(item.getByText('and 5 more')).toBeVisible()
  })

  test('MrCall\'s configuration suggestions name each business, the id only beside it', async ({ adminPage: page }) => {
    await page.route('**/customer/insights/config-suggestions*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 2, items: [configItem(1), { businessId: 'biz-unnamed', periodEnd: 1761091200000, suggestions: ['Turn on the restaurant skill.'] }] }),
    }))
    await page.goto('/analytics-admin')
    const scope = section(page, 'Integrations and information asked')
    await expect(scope.getByRole('link', { name: 'Studio Demo 1' })).toHaveAttribute('href', '/analytics?id=biz-1')
    await expect(scope.getByText('Suggestion 1')).toBeVisible()
    await expect(scope.getByRole('link', { name: 'biz-unnamed' })).toBeVisible()
  })

  test('integrations load one page, and the next only on demand, carrying the first page\'s asOf', async ({ adminPage: page }) => {
    const requests = []
    await pagedRoute(page, '**/customer/insights/integrations*', integrationItem, 25, requests)
    await page.goto('/analytics-admin')
    const scope = section(page, 'Integrations and information asked')
    await expect(scope.getByText('Integration request 19')).toBeVisible({ timeout: 15000 })
    await expect(scope.getByText('Integration request 20')).toHaveCount(0)
    await expect(scope.getByText('20 of 25')).toBeVisible()
    await page.waitForTimeout(300)
    expect(requests).toEqual([{ from: 0, size: 20, asOf: null }])

    await scope.getByRole('button', { name: 'Load more integrations' }).click()
    await expect(scope.getByText('Integration request 24')).toBeVisible()
    expect(requests[1]).toEqual({ from: 20, size: 20, asOf: '1761100000000' })
    await expect(scope.getByRole('button', { name: 'Load more integrations' })).toHaveCount(0)
    await expect(scope.getByText('25 of 25')).toBeVisible()
  })

  test('configuration suggestions load one page, and the next only on demand, carrying the first page\'s asOf', async ({ adminPage: page }) => {
    const requests = []
    await pagedRoute(page, '**/customer/insights/config-suggestions*', configItem, 21, requests)
    await page.goto('/analytics-admin')
    const scope = section(page, 'Integrations and information asked')
    await expect(scope.getByText('Suggestion 19')).toBeVisible({ timeout: 15000 })
    await expect(scope.getByText('Suggestion 20')).toHaveCount(0)
    await page.waitForTimeout(300)
    expect(requests).toEqual([{ from: 0, size: 20, asOf: null }])

    await scope.getByRole('button', { name: 'Load more suggestions' }).click()
    await expect(scope.getByText('Suggestion 20')).toBeVisible()
    expect(requests[1]).toEqual({ from: 20, size: 20, asOf: '1761100000000' })
  })
})

test.describe('AnalyticsAdmin: assistants by name, and the business filter undone where it was set', () => {
  test('a row shows the business\'s name with its id beside it, or the id alone without a name', async ({ adminPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(assistantsResponse({
        businesses: [
          { ...assistantsResponse().businesses[0], businessName: 'Studio Demo' },
          { ...assistantsResponse().businesses[0], businessId: 'biz-unnamed' },
        ],
      })),
    }))
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    const named = assistants.getByRole('row', { name: /Studio Demo/ })
    await expect(named).toBeVisible({ timeout: 15000 })
    await expect(named.getByText(BUSINESS_ID)).toBeVisible()
    await expect(assistants.getByRole('row', { name: /biz-unnamed/ })).toBeVisible()
  })

  test('the business chosen from the table is marked in it, and a control on the table clears it', async ({ adminPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(assistantsResponse({ businesses: [{ ...assistantsResponse().businesses[0], businessName: 'Studio Demo' }] })),
    }))
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: 'Show all businesses' })).toHaveCount(0, { timeout: 15000 })
    await assistants.getByRole('row', { name: /Studio Demo/ }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]businessId=${BUSINESS_ID}(&|$)`))
    await expect(assistants.getByRole('row', { name: /Studio Demo/ })).toHaveAttribute('aria-selected', 'true')

    await assistants.getByRole('button', { name: 'Show all businesses' }).click()
    await expect(page).not.toHaveURL(/businessId=/)
    await expect(assistants.getByRole('button', { name: 'Show all businesses' })).toHaveCount(0)
  })
})

test.describe('AnalyticsAdmin: a row chosen on a phone', () => {
  test('the table stays while it reloads, and the control that widens the page again is on screen', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    let calls = 0
    await page.route('**/customer/analytics/assistants*', async (route) => {
      calls += 1
      if (calls > 1) await new Promise((resolve) => setTimeout(resolve, 4000))
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(assistantsResponse({ businesses: [{ ...assistantsResponse().businesses[0], businessName: 'Studio Demo' }] })),
      })
    })
    await page.goto('/analytics-admin')
    const assistants = section(page, 'Assistants to review')
    const row = assistants.getByRole('row', { name: /Studio Demo/ })
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.click()
    // while the new answer is held back (4 s): the assertions must not wait it out
    await expect(assistants).toHaveAttribute('aria-busy', 'true')
    await expect(row).toBeVisible({ timeout: 1000 })
    await expect(assistants.getByRole('button', { name: 'Show all businesses' })).toBeInViewport({ timeout: 1000 })
    await expect(assistants).toHaveAttribute('aria-busy', 'true')
  })
})

test.describe('AnalyticsAdmin: the filter bar', () => {
  test('stays visible while the page scrolls, and clears each filter from where it shows it', async ({ adminPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(assistantsResponse({ businesses: [{ ...assistantsResponse().businesses[0], businessName: 'Studio Demo' }] })),
    }))
    await page.goto(`/analytics-admin?businessId=${BUSINESS_ID}&ownerId=owner-9&plan=restaurant`)
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByText('Studio Demo')).toBeVisible({ timeout: 15000 })
    await expect(bar.getByText('owner-9')).toBeVisible()
    await expect(bar.getByText('restaurant')).toBeVisible()
    await expect(bar.getByText('Last 30 days')).toBeVisible()

    await section(page, 'Integrations and information asked').scrollIntoViewIfNeeded()
    await expect(bar).toBeInViewport()

    await bar.getByRole('button', { name: 'Clear the owner filter' }).click()
    await expect(page).not.toHaveURL(/ownerId=/)
    await expect(page).toHaveURL(new RegExp(`[?&]businessId=${BUSINESS_ID}(&|$)`))
    await expect(bar).toBeInViewport()

    await bar.getByRole('button', { name: 'Clear the plan filter' }).click()
    await expect(page).not.toHaveURL(/plan=/)
    await bar.getByRole('button', { name: 'Clear the business filter' }).click()
    await expect(page).not.toHaveURL(/businessId=/)
    await expect(bar.getByRole('button', { name: /^Clear the/ })).toHaveCount(0)
  })

  test('on a phone the bar stays one line, so a heading scrolled to is not hidden under it', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/analytics-admin?businessId=${BUSINESS_ID}&ownerId=owner-9&plan=restaurant`)
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByRole('button', { name: 'Clear the plan filter' })).toBeAttached({ timeout: 15000 })
    const box = await bar.boundingBox()
    // one line of chips: 24px controls in a padded bar; two lines measured 95px on the first review
    expect(box.height).toBeLessThanOrEqual(56)
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
  test('MrCall\'s own configuration suggestions show, and an example call does not link (out of scope: reading an owner\'s call as an admin)', async ({ adminPage: page }) => {
    await page.route('**/customer/insights/reports*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        businessId: BUSINESS_ID, periodStart: 1700000000000, periodEnd: 1700086400000, cadence: 'weekly',
        content: {
          version: 1,
          period: { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', cadence: 'weekly' },
          calls: 5, resolution: { resolved: 4, unresolved: 1 }, message: { complete: 3, none: 2 }, booked: 2, transferred: 1, topics: [],
          gap_calls: {}, gaps: [{ group: 'missing_info', summary: 'Ask about parking.', examples: ['CON-9'] }],
          suggestions: { business_info: [], integration: [], mrcall_config: ['Turn on the restaurant skill.'] },
          flagged_calls: [], extractor_audit: { sampled_resolved: 0, disagreements: 0 },
          model: 'gpt-x', usage: { input_tokens: 10, output_tokens: 5 },
        },
      }]),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const reports = section(page, 'Call reports')
    await expect(reports.getByText('Turn on the restaurant skill.')).toBeVisible({ timeout: 15000 })
    await expect(reports.getByText('Ask about parking.')).toBeVisible()
    await expect(reports.getByRole('link', { name: 'CON-9' })).toHaveCount(0)
    await expect(reports.getByText('CON-9')).toBeVisible()
  })
})

test.describe('AnalyticsAdmin: a changed scope', () => {
  test('admin: the section says it is updating while the new answer is pending, then shows only the new numbers', async ({ adminPage: page }) => {
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
    await page.goto('/analytics-admin')
    const what = section(page, 'How the calls went')
    const resolved = what.locator('.insight-dimension').filter({ hasText: 'Resolution' }).locator('li').filter({ hasText: /^\s*Resolved/ }).locator('.legend-count')
    await expect(resolved).toHaveText('5', { timeout: 15000 })
    await expect(what).not.toHaveAttribute('aria-busy', 'true')

    changed = true
    await page.getByRole('textbox', { name: 'Business ID' }).fill(BUSINESS_ID)
    await page.getByRole('button', { name: 'Apply' }).click()
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
})
