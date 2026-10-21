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

const assistantsResponse = (overrides = {}) => ({
  sort: 'not_solved',
  businesses: [{
    businessId: BUSINESS_ID, totalCalls: 10, callsWithResolution: 10, resolution: { unresolved: 2, caller_left: 1, handed_over: 4, resolved: 3 },
    callsWithChecks: 8, checks: { caller_repeated: 1 }, callsWithUnansweredRecorded: 8, callsWithUnanswered: 1,
    gaps: {}, callsWithSkillErrors: 0, extractionsNotOk: 0,
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

    const notSolvedHeader = assistants.locator('th').filter({ hasText: 'Not solved' })
    await expect(notSolvedHeader.getByText('Assessed by the assistant')).toBeVisible()
    // unresolved and caller_left over the calls with a resolution; handed_over is not "not solved"
    await expect(assistants.getByRole('row', { name: new RegExp(BUSINESS_ID) })).toContainText('30% (3 of 10)')

    await assistants.getByRole('combobox', { name: 'Sort by' }).click()
    await expect(page.getByRole('option', { name: 'Not solved (assessed by the assistant)' })).toBeVisible()
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
    await expect(section(page, 'What calls said')).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'Assistants to review')).toHaveCount(0)
    await expect(page.locator('.p-toast-message')).toHaveCount(0)
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
