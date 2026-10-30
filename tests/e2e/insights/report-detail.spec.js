// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, REPORT } = require('../fixtures/insights')

/**
 * U19r2 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md, the report's own page as the
 * amendment of 2026-10-26 repairs it (brief, "Amendment 2026-10-26", Dashboard): the four outcome lines, booked and
 * transferred (U19 M2), each theme with its calls and their outcome, by calls; the calls to call back and the calls
 * behind a gap (M3); no "Add the answer" on a question about the caller's own medical case (rule 3); a theme's
 * labels without its own name (m6); no "Left out" line of zeros (m7). StarChat answered as tests/e2e/fixtures/insights.js.
 */
const detail = `/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`

test.describe('the report\'s own page, as the U19 attack repaired it', () => {
  test('M2: the four outcome lines over the calls where the caller asked, with booked and transferred', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(detail)
    const outcome = page.getByRole('region', { name: 'Outcome of the calls where the caller asked something' })
    await expect(outcome.getByText('Shares over the 110 calls in which the caller asked for something.')).toBeVisible({ timeout: 15000 })
    const lines = outcome.getByRole('list', { name: 'Outcome of the calls where the caller asked something' }).getByRole('listitem')
    await expect(lines).toHaveText([/^Resolved in the call\s*50\s*45% of 110/, /^Request passed to the business\s*30\s*27% of 110/, /^Passed to a person\s*10\s*9% of 110/, /^Not resolved\s*20\s*18% of 110/])
    await expect(outcome.getByText('31 calls with a booking taken')).toBeVisible()
    await expect(outcome.getByText('1 call transferred to a person')).toBeVisible()
  })

  test('M2: each theme with its calls and their outcome, the most called first; m6: no label repeating its name', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(detail)
    const themes = page.getByRole('region', { name: 'Topics' })
    const items = themes.getByRole('listitem').filter({ has: page.locator('.report-topic-name') })
    await expect(items).toHaveCount(2, { timeout: 15000 })
    await expect(items.nth(0).locator('.report-topic-name')).toHaveText('Bookings')
    await expect(items.nth(0)).toContainText('70 calls')
    await expect(items.nth(0).getByRole('list', { name: 'Outcome of the calls of Bookings' }).getByRole('listitem'))
      .toHaveText(['Resolved in the call 40', 'Request passed to the business 20', 'Passed to a person 5', 'Not resolved 5'])
    await expect(items.nth(1).locator('.report-topic-name')).toHaveText('Parking')
    await expect(items.nth(1)).toContainText('12 calls')
    await expect(items.nth(1).getByRole('list', { name: 'Outcome of the calls of Parking' }).getByRole('listitem'))
      .toHaveText(['Resolved in the call 4', 'Not resolved 8'])
    await expect(themes.getByText('Includes: booking, table for four')).toBeVisible()
    await expect(themes.getByText(/Includes: parking/)).toHaveCount(0)
  })

  test('M3: the calls to call back and the calls behind a gap open their conversation, for the owner', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(detail)
    const back = page.getByRole('region', { name: 'Calls to call back' })
    await expect(back.getByRole('link')).toHaveCount(2, { timeout: 15000 })
    await expect(back.getByRole('link', { name: /Giulia Verdi/ })).toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-1`)
    // a call StarChat did not name is said by its place in the list, never by its id
    await expect(back.getByRole('link', { name: 'Call 3' })).toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-5`)
    await expect(back.getByText('CON-5')).toHaveCount(0)
    const gaps = page.getByRole('region', { name: 'Questions left unanswered' })
    await expect(gaps.getByRole('link', { name: 'Call 1' })).toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-3`)
    // numbered across the report, so two different calls never share a name
    await expect(gaps.getByRole('link', { name: 'Call 2' })).toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-4`)
  })

  test('rule 3: a question about the caller\'s own medical case keeps its summary and offers no "Add the answer"', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(detail)
    const clinical = page.locator('.report-gap').filter({ hasText: 'Which pill should I take for my blood pressure?' })
    await expect(clinical).toBeVisible({ timeout: 15000 })
    await expect(clinical.getByRole('button', { name: 'Add the answer' })).toHaveCount(0)
    await expect(page.locator('.report-gap').filter({ hasText: 'Is there parking near the restaurant?' }).getByRole('button', { name: 'Add the answer' })).toBeVisible()
  })

  test('m7: no "Left out" line when no call was left out', async ({ authenticatedPage: page }) => {
    const { REPORT_OUTCOMES } = require('../fixtures/insights')
    await mockInsights(page, { reportOutcomes: { ...REPORT_OUTCOMES, noConversation: { caller_silent: 0, no_credit: 0 } } })
    await page.goto(detail)
    await expect(page.getByText('Based on 120 of the 130 calls the assistant managed in the period.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/^Left out:/)).toHaveCount(0)
  })
})
