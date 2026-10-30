// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, rome, historyRows, reportsPage, REPORT, REPORT_QUALITY, SCHEDULE } = require('../fixtures/insights')

/**
 * U19r6, aligned with what StarChat 9.34 at b6c43ca49 answers (the amendment of 2026-10-30): the cycles with no call
 * are the history's top-level `emptyCycles`, shown as rows among the page's reports and counted in neither the total nor
 * the paging, and the next report says from when it covers (`nextAutomatic.extendedFrom`) (rule 9); a report row whose
 * role is not recorded names its requester by `requestedByName` (m7); `previousPartial` on the KPIs, topics and quality
 * as on the outcomes (rule 10).
 *
 * Seen failing on a37a133 (U19r6 as first written against assumed fields), each case, before its alignment.
 */
const table = (page) => page.getByRole('table', { name: 'All reports' })
const EMPTY = [{ from: rome(2026, 10, 21), to: rome(2026, 10, 22) }, { from: rome(2026, 10, 22), to: rome(2026, 10, 23) }]
const SCHEDULE_EXTENDED = { cadenceDays: 1, nextAutomatic: { from: rome(2026, 10, 21), to: rome(2026, 10, 24), retry: false, anticipable: true, arrivesAt: Date.UTC(2026, 9, 24, 5), extendedFrom: rome(2026, 10, 21) } }

test.describe('rule 9: the cycles with no call', () => {
  test('are rows by date among the first page\'s reports, outside the total and the paging', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { reports: (url) => reportsPage(url, { emptyCycles: EMPTY, schedule: SCHEDULE_EXTENDED }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const rows = table(page).locator('tbody tr')
    await expect(rows.nth(0)).toContainText('No calls on Oct 22, 2026', { timeout: 15000 })
    await expect(rows.nth(1)).toContainText('No calls on Oct 21, 2026')
    await expect(rows.nth(2)).toContainText('Oct 14, 2026 – Oct 20, 2026')
    await expect(rows).toHaveCount(12)
    await expect(page.getByText('1–10 of 25')).toBeVisible()
    await page.getByRole('navigation', { name: 'Pages of All reports' }).getByRole('button', { name: 'Page 2' }).click()
    await expect(page.getByText('11–20 of 25')).toBeVisible()
    await expect(table(page).getByText(/^No calls on/)).toHaveCount(0)
  })

  test('the next report says from when it covers, as StarChat\'s extendedFrom says', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { reports: (url) => reportsPage(url, { emptyCycles: EMPTY, schedule: SCHEDULE_EXTENDED }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText('It covers from Oct 21, 2026: the days since then had no calls.')).toBeVisible({ timeout: 15000 })
  })
})

test.describe('rule 9 at 2affa35f2: a written report longer than its cadence', () => {
  test('its row says from when it covers the days with no call, and the page\'s cycles are drawn once each', async ({ authenticatedPage: page }) => {
    const rows = historyRows()
    // the newest row covers 21-27 October after a quiet stretch from the 21st (StarChat's `extendedFrom`)
    Object.assign(rows[0], { status: 'done', calls: 12, callsManaged: 12, periodStart: rome(2026, 10, 21), periodEnd: rome(2026, 10, 28), extendedFrom: rome(2026, 10, 21) })
    const recorded = { from: rome(2026, 10, 21), to: rome(2026, 10, 22) }
    await mockInsights(page, { reports: (url) => reportsPage(url, { rows, schedule: SCHEDULE, emptyCycles: [recorded, { ...recorded }] }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const written = table(page).getByRole('row').filter({ hasText: 'Oct 21, 2026 – Oct 27, 2026' })
    await expect(written).toContainText('It also covers the days with no calls from Oct 21, 2026.', { timeout: 15000 })
    await expect(table(page).getByText('No calls on Oct 21, 2026', { exact: true })).toHaveCount(1)
  })

  test('the report\'s own page says it too, from its content\'s emptyCycles', async ({ authenticatedPage: page }) => {
    const report = { ...REPORT, content: { ...REPORT.content, emptyCycles: [{ from: rome(2026, 10, 1), to: rome(2026, 10, 2) }, { from: rome(2026, 10, 2), to: rome(2026, 10, 3) }] } }
    await mockInsights(page, { report })
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${report.periodStart}&requestId=${report.requestId}`)
    await expect(page.getByText('It also covers the days with no calls from Oct 1, 2026 to Oct 2, 2026.')).toBeVisible({ timeout: 15000 })
  })
})

test.describe('m7: a report row\'s requester', () => {
  test('without a recorded role, is named by StarChat\'s requestedByName', async ({ authenticatedPage: page }) => {
    const rows = historyRows()
    Object.assign(rows[5], { requesterRole: null, requestedBy: 'someone-uid', requestedByName: 'Partner Srl' })
    await mockInsights(page, { reports: (url) => reportsPage(url, { rows }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const row = table(page).getByRole('row').filter({ hasText: 'Partner Srl' })
    await expect(row).toHaveCount(1, { timeout: 15000 })
  })
})

test.describe('rule 10: a partial previous window, beyond the outcomes', () => {
  const kpis = (page, previousPartial) => page.route('**/customer/analytics/dashboard*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ totalCalls: 900, avgCallDurationMs: 60000, totalCallDurationMs: 54000000, uniqueCallers: 400, previousPeriod: { totalCalls: 300, avgCallDurationMs: 50000, totalCallDurationMs: 15000000, uniqueCallers: 200 }, previousPartial }) }))
  const help = 'The period before has calls for only part of its days: the change is not meaningful.'

  test('a business\'s KPIs are "n/a" with the reason', async ({ authenticatedPage: page }) => {
    await kpis(page, true)
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const total = page.locator('.kpi-card').filter({ hasText: 'Total Calls' })
    await expect(total.locator('.kpi-delta abbr')).toHaveText('n/a', { timeout: 15000 })
    await expect(total.locator('.kpi-delta abbr')).toHaveAccessibleDescription(help)
  })

  test('the admin page\'s KPIs too', async ({ adminPage: page }) => {
    await kpis(page, true)
    await mockInsights(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const total = page.locator('.kpi-card').filter({ hasText: 'Total Calls' })
    await expect(total.locator('.kpi-delta abbr')).toHaveText('n/a', { timeout: 15000 })
    await expect(total.locator('.kpi-delta abbr')).toHaveAccessibleDescription(help)
  })

  test('the topics\' previous counts and the report\'s quality comparison say the window is partial', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/topics*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ period: { from: 0, to: 0 }, previousPeriod: { from: 0, to: 0 }, callsWithTopics: 50, previousCallsWithTopics: 4, topics: [{ topic: 'parking', calls: 12, previousCalls: 1 }], previousPartial: true }) }))
    await mockInsights(page, { quality: { ...REPORT_QUALITY, previousPartial: true } })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.locator('.call-insights-section').filter({ hasText: 'parking' }).getByText(help)).toBeVisible({ timeout: 15000 })
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=${REPORT.requestId}`)
    await expect(page.getByRole('region', { name: 'Questions without an answer, compared with the period before' }).getByText(help)).toBeVisible({ timeout: 15000 })
  })
})
