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

test.describe('AnalyticsAdmin: integrations and MrCall\'s own configuration suggestions', () => {
  test('both show, labelled as the whole scope, and neither reacts to a changed business filter', async ({ adminPage: page }) => {
    let integrationsCalls = 0
    let configCalls = 0
    await page.route('**/customer/insights/integrations*', (route) => {
      integrationsCalls += 1
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ template: 'restaurant', kind: 'integration', text: 'A booking calendar', businesses: 3, reports: 5 }]),
      })
    })
    await page.route('**/customer/insights/config-suggestions*', (route) => {
      configCalls += 1
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ businessId: BUSINESS_ID, periodEnd: 1700000000000, suggestions: ['Enable multilingual.'] }]),
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
