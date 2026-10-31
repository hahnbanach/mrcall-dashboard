// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, rome, OUTCOMES } = require('../fixtures/insights')

/**
 * U19r2 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the business page's Overview as the
 * amendment of 2026-10-26 repairs it (brief, "Amendment 2026-10-26", rules 9-10 and Dashboard): one empty state when
 * the period holds no call, with the day of the last one (U19 M12); a change on a previous base under 20 calls said
 * "n/a" (M13); the period filter shown only on the tab that applies it (M14); a web call's caller row labelled, never
 * an identifier (M16).
 */
async function mockKpis (page, { dashboard, callers }) {
  await page.route('**/customer/analytics/dashboard*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) }))
  await page.route('**/customer/analytics/callers*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(callers || { topCallers: [] }) }))
}

const EMPTY_OUTCOMES = {
  ...OUTCOMES, totalCalls: 0, callsWithRequest: 0, callsManaged: 0, recomputable: 0,
  outcome: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
  resolution: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
  message: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
  noConversation: {}, booked: 0, callsWithBooked: 0, transferred: 0,
}

test.describe('Overview, as the U19 attack repaired it', () => {
  test('M12: a period with no call is one empty state with the day of the last call, not a wall of zeros', async ({ authenticatedPage: page }) => {
    await mockKpis(page, { dashboard: { totalCalls: 0, avgCallDurationMs: 0, totalCallDurationMs: 0, uniqueCallers: 0 } })
    await mockInsights(page, { outcomes: { ...EMPTY_OUTCOMES, lastCallAt: rome(2026, 3, 21) + 11 * 3600 * 1000 } })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const empty = page.getByRole('status').filter({ hasText: 'No calls in the last 30 days.' })
    await expect(empty).toBeVisible({ timeout: 15000 })
    await expect(empty).toContainText('The last call was on Mar 21, 2026.')
    await expect(page.getByText('Total Calls')).toHaveCount(0)
    await expect(page.getByText('0ms')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'How the calls went' })).toHaveCount(0)
  })

  test('M13: a change over a previous period of fewer than 20 calls is "n/a", never +24725%', async ({ authenticatedPage: page }) => {
    await mockKpis(page, { dashboard: { totalCalls: 1986, avgCallDurationMs: 60000, totalCallDurationMs: 119160000, uniqueCallers: 8, previousPeriod: { totalCalls: 8, avgCallDurationMs: 30000, totalCallDurationMs: 240000, uniqueCallers: 3 } } })
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const total = page.locator('.kpi-card').filter({ hasText: 'Total Calls' })
    await expect(total).toContainText('1,986', { timeout: 15000 })
    await expect(total.locator('.kpi-delta abbr')).toHaveText('n/a')
    await expect(total.locator('.kpi-delta abbr')).toHaveAccessibleDescription('The period before had fewer than 20 calls: the change is not meaningful.')
    await expect(page.getByText(/24725/)).toHaveCount(0)
  })

  test('M13: the outcome lines say "n/a" for their change over a period before of fewer than 20 calls', async ({ authenticatedPage: page }) => {
    await mockKpis(page, { dashboard: { totalCalls: 140, avgCallDurationMs: 60000, totalCallDurationMs: 8400000, uniqueCallers: 90 } })
    await mockInsights(page, { outcomes: { ...OUTCOMES, outcome: { ...OUTCOMES.outcome, previousTotals: { resolved: 4, forwarded_complete: 2, unresolved: 3 } } } })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const resolved = page.locator('.outcome-line').filter({ hasText: 'Resolved in the call' })
    await expect(resolved).toContainText('50', { timeout: 15000 })
    await expect(resolved.locator('.legend-delta abbr')).toHaveText('n/a')
  })

  test('M14: the period filter shows on Overview only, the tab that applies it', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByText('Period')).toBeVisible({ timeout: 15000 })
    await page.getByRole('navigation', { name: 'Statistics sections' }).getByRole('link', { name: 'Reports' }).click()
    await expect(page.getByText('1–10 of 25')).toBeVisible({ timeout: 15000 })
    await expect(bar.getByText('Period')).toHaveCount(0)
    await page.getByRole('navigation', { name: 'Statistics sections' }).getByRole('link', { name: 'Processing' }).click()
    await expect(page.getByRole('table', { name: 'Processing' })).toBeVisible({ timeout: 15000 })
    await expect(bar.getByText('Period')).toHaveCount(0)
  })

  test('M16: a web call\'s caller row says "Web call", never its identifier', async ({ authenticatedPage: page }) => {
    await mockKpis(page, {
      dashboard: { totalCalls: 10, avgCallDurationMs: 60000, totalCallDurationMs: 600000, uniqueCallers: 2 },
      callers: { topCallers: [{ contactNumber: '+390212345678', callCount: 6, totalDurationMs: 360000, lastCallTimestamp: rome(2026, 10, 20) }, { web: true, callCount: 4, totalDurationMs: 240000, lastCallTimestamp: rome(2026, 10, 21) }] },
    })
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const callers = page.locator('.table-container')
    await expect(callers.getByRole('cell', { name: 'Web call' })).toBeVisible({ timeout: 15000 })
    await expect(callers.getByRole('cell', { name: '+390212345678' })).toBeVisible()
    await expect(callers.getByRole('row').filter({ hasText: 'Web call' }).getByRole('cell').first()).toHaveText('Web call')
  })

  test('M13: "Unresolved" against a period before of fewer than 20 calls with a request is "n/a"', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const table = page.getByRole('table', { name: 'Assistants to review' })
    const row = (name) => table.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) })
    await expect(row('Studio 1').getByText('+8 points', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(row('Studio 5').getByText('n/a', { exact: true })).toBeVisible()
  })
})
