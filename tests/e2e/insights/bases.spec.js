// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, REPORT, historyRows, reportsPage } = require('../fixtures/insights')

/**
 * U19r2 (StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md), U19 M1: a base of managed calls
 * smaller than the calls a report read (the copies of `managedCall` missing on calls before 22 October on test) is
 * never printed as "168 of 38 managed": the line says the calls analysed alone (brief, "Amendment 2026-10-26", Bases).
 */
test.describe('M1: no analysed count above its managed base', () => {
  test('the history says "168 analysed", never "168 of 38 managed"', async ({ authenticatedPage: page }) => {
    const rows = historyRows()
    Object.assign(rows[7], { calls: 168, callsManaged: 38 })
    Object.assign(rows[8], { calls: 96, callsManaged: 0 })
    await mockInsights(page, { reports: (url) => reportsPage(url, { rows }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const table = page.getByRole('table', { name: 'All reports' })
    await expect(table.getByText('168 analysed', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(table.getByText('96 analysed', { exact: true })).toBeVisible()
    await expect(table.getByText(/of (38|0) managed/)).toHaveCount(0)
  })

  test('the report\'s page says "Based on 168 analysed calls", with no note about calls before 10 October', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { report: { ...REPORT, content: { ...REPORT.content, calls: 168, callsManaged: 38 } } })
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    await expect(page.getByText('Based on 168 analysed calls.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/168 of the 38/)).toHaveCount(0)
    await expect(page.getByText(/before 10 October/)).toHaveCount(0)
  })
})
