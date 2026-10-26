// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, rome, job, estimateJob, historyRows, reportsPage, SCHEDULE } = require('../fixtures/insights')

/**
 * U19r2 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the request dialog and the schedule
 * panel as the amendment of 2026-10-26 repairs them (brief, "Amendment 2026-10-26", rules 5-7 and Dashboard): a period
 * with no call or no analysis refused for that reason first (U19 M7), "Prepare now" only on a cycle with a finished
 * day (M8), the day the next report arrives and the days it covers (M9, m2), one sentence for the reports a period
 * overlaps (M11), counts in the singular (m1), "started by you" (m3), and a period's days counted from the dates shown
 * (m5). StarChat's new fields (`lastCallAt`, `recomputable`, `anticipable`, `arrivesAt`) are shaped as the brief states
 * them, on `nextAutomatic`, the schedule's `next`.
 */
async function openRequest (page) {
  await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
  await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
  const dialog = page.getByRole('dialog', { name: 'Request a report' })
  await expect(dialog).toBeVisible()
  return dialog
}

const refusedEstimate = (estimate) => (id) => estimateJob({ jobId: id, estimate: { fits: false, kind: 'report', calls: 0, requests: 0, ...estimate } })

test.describe('M7: a period with nothing to read is refused for that, never for credit', () => {
  test('no call in the period: says so, with the day of the last call, and offers no top-up', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { job: refusedEstimate({ reason: 'no_calls', lastCallAt: rome(2026, 3, 21) + 10 * 3600 * 1000 }) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Last 7 days' }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('alert')).toContainText('No calls in this period.', { timeout: 15000 })
    await expect(dialog.getByRole('alert')).toContainText('The last call was on Mar 21, 2026.')
    await expect(dialog.getByRole('link', { name: 'Top up' })).toHaveCount(0)
    await expect(dialog.getByText(/level we keep for calls/)).toHaveCount(0)
  })

  test('no call ever: says the business has had none yet', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { job: refusedEstimate({ reason: 'no_calls', lastCallAt: null }) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('alert')).toContainText('The business has not received any call yet.', { timeout: 15000 })
  })

  test('calls but none analysed: says how many, and offers their analysis, which asks for the same days', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, {
      job: (id, n) => (asked.estimate.length > 1 ? estimateJob({ jobId: id }) : refusedEstimate({ reason: 'no_analysis', recomputable: 14 })(id, n)),
    })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Last 7 days' }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('alert')).toContainText('There are 14 calls in this period, but none is analysed yet.', { timeout: 15000 })
    const first = asked.estimate[0].body
    await dialog.getByRole('button', { name: 'Analyse the calls of the period' }).click()
    const analysis = page.getByRole('dialog', { name: 'Analyse the calls of the period' })
    await expect(analysis.getByRole('button', { name: 'Confirm' })).toBeVisible({ timeout: 15000 })
    const second = asked.estimate[1].body
    expect(second).toMatchObject({ kind: 'recompute', from: first.from, to: first.to })
  })

  test('calls but none analysed nor analysable: no analysis offered', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { job: refusedEstimate({ reason: 'no_analysis', recomputable: 0 }) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('alert')).toContainText('No call of this period is analysed, and none can be analysed.', { timeout: 15000 })
    await expect(dialog.getByRole('button', { name: 'Analyse the calls of the period' })).toHaveCount(0)
  })
})

test.describe('M8: "Prepare now" only when the cycle in progress has a finished day', () => {
  test('not offered while StarChat says the cycle is not anticipable', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { reports: (url) => reportsPage(url, { schedule: { cadenceDays: 1, nextAutomatic: { from: rome(2026, 10, 26), to: rome(2026, 10, 27), retry: false, anticipable: false, arrivesAt: rome(2026, 10, 27) + 6 * 3600 * 1000 } } }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByRole('button', { name: 'Request a report' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Prepare now' })).toHaveCount(0)
  })

  test('a refusal cycle_empty has its own words', async ({ authenticatedPage: page }) => {
    await mockInsights(page, {
      reports: (url) => reportsPage(url, { schedule: { ...SCHEDULE, nextAutomatic: { ...SCHEDULE.nextAutomatic, anticipable: true } } }),
      createJob: () => ({ status: 409, body: { code: 'cycle_empty', message: 'the cycle in progress holds no finished day yet' } }),
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: 'Prepare now' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Prepare the automatic report now' })
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    await expect(dialog.getByRole('alert')).toHaveText(/The automatic report in progress has no finished day yet: there is nothing to prepare now\./, { timeout: 15000 })
    await expect(dialog.getByText('The request could not be completed. Please try again later.')).toHaveCount(0)
  })
})

test.describe('M9: the schedule says when the next report arrives and what it covers', () => {
  test('the day it arrives is StarChat\'s, not the end of its period', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { reports: (url) => reportsPage(url, { schedule: { cadenceDays: 7, nextAutomatic: { from: rome(2026, 10, 19), to: rome(2026, 10, 26), retry: false, anticipable: true, arrivesAt: rome(2026, 10, 27) + 6 * 3600 * 1000 } } }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText('The next one will arrive on Oct 27, 2026 and will cover Oct 19, 2026 to Oct 25, 2026.')).toBeVisible({ timeout: 15000 })
  })

  test('m1, m2: a daily cadence in the singular, and one day said once', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { reports: (url) => reportsPage(url, { schedule: { cadenceDays: 1, nextAutomatic: { from: rome(2026, 10, 26), to: rome(2026, 10, 27), retry: false, anticipable: false, arrivesAt: rome(2026, 10, 27) + 6 * 3600 * 1000 } } }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText('Every day MrCall prepares a report on your business\'s calls. Each report uses the business\'s credit.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('The next one will arrive on Oct 27, 2026 and will cover Oct 26, 2026.')).toBeVisible()
  })
})

test.describe('the history and the dialog: counts and words', () => {
  test('m1: a one-day report says "1 day"; m5: a period not at midnight counts the days its dates show', async ({ authenticatedPage: page }) => {
    const rows = historyRows()
    Object.assign(rows[7], { periodStart: rome(2026, 9, 2), periodEnd: rome(2026, 9, 3), days: 1 })
    // an interval asked over the API at 01:00 local, as OVERLAND's (U19 m5): StarChat says 2 days, the dates show 3
    Object.assign(rows[8], { periodStart: rome(2026, 3, 19) + 3600 * 1000, periodEnd: rome(2026, 3, 21) + 3600 * 1000, days: 2 })
    await mockInsights(page, { reports: (url) => reportsPage(url, { rows }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const table = page.getByRole('table', { name: 'All reports' })
    await expect(table.getByRole('row').filter({ hasText: 'Sep 2, 2026' }).getByText('1 day', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(table.getByRole('row').filter({ hasText: 'Mar 19, 2026 – Mar 21, 2026' }).getByText('3 days', { exact: true })).toBeVisible()
  })

  test('M11: the reports a period overlaps are one sentence, with the days they cover', async ({ authenticatedPage: page }) => {
    await mockInsights(page, {
      overlap: { past: [
        { periodStart: rome(2026, 10, 18), periodEnd: rome(2026, 10, 19), type: 'automatic' },
        { periodStart: rome(2026, 10, 20), periodEnd: rome(2026, 10, 21), type: 'automatic' },
        { periodStart: rome(2026, 10, 22), periodEnd: rome(2026, 10, 24), type: 'requested', requestId: 'r1' },
      ] },
    })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Last 7 days' }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    const status = dialog.getByRole('status')
    await expect(status.getByText('3 reports already cover part of these days, from Oct 18, 2026 to Oct 23, 2026. A new report reads them again and uses the credit again.')).toBeVisible({ timeout: 15000 })
    await expect(status.getByText(/already partly in the/)).toHaveCount(0)
  })

  test('m3: another processing open, started by the reader, says "started by you"', async ({ authenticatedPage: page }) => {
    const { mockUser } = require('../fixtures/mock-data')
    await mockInsights(page, {
      createJob: () => ({ status: 409, body: { code: 'job_open', message: 'job_open', jobId: 'job-open' } }),
      job: (id) => (id === 'job-open' ? job({ jobId: 'job-open', status: 'running', requestedBy: mockUser.uid, requesterRole: 'owner' }) : estimateJob({ jobId: id })),
    })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    await expect(dialog.getByRole('alert')).toContainText(/started by you on /, { timeout: 15000 })
    await expect(dialog.getByRole('alert')).not.toContainText('started by You')
  })
})
