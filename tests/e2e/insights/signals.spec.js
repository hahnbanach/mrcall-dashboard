// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, REPORT, BUSINESS_ID } = require('../fixtures/insights')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O5 and O6 (plan step A6a): every quality signal says what it means and
 * what to do about it, in the section itself, on a business's page, on the admin page and on the report page (its
 * quality table and its gap groups). The texts follow StarChat's own definitions of the reasons and checks.
 *
 * Seen failing, 2026-11-01, before SignalExplain: none of the texts on any page.
 */
const QUALITY = {
  period: { from: 0, to: 0 }, extractions: { ok: 100, too_long: 2 }, callsWithChecks: 100, checks: { caller_repeated: 7 },
  callsWithUnansweredRecorded: 100, callsWithUnanswered: 9, gaps: { missing_info: 6, out_of_scope: 2, assistant_error: 1 }, callsWithSkillErrors: 1,
}
const MEANINGS = [
  'The business never told the assistant what the caller asked.',
  'The answer is in a system the assistant is not connected to.',
  'Not something this business answers by phone.',
  'The assistant had the information and still failed to answer.',
  'The caller had to repeat something because the assistant did not understand.',
  'The caller sounded dissatisfied or annoyed.',
  'A function the assistant called (a booking, a lookup) failed.',
]
const ACTIONS = [
  'Tell the assistant where to send these callers, or to transfer the call or take a message.',
  'Open the calls to see what went wrong, and correct the assistant\'s instructions on that topic.',
]

test.describe('every quality signal says what it means and what to do', () => {
  test('a business\'s Overview', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { quality: QUALITY })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const quality = page.locator('.call-insights-section').filter({ has: page.getByRole('heading', { name: 'Quality', exact: true }) })
    await expect(quality.getByText(MEANINGS[0])).toBeVisible({ timeout: 15000 })
    for (const text of [...MEANINGS, ...ACTIONS]) await expect(quality.getByText(text)).toBeVisible()
    // extraction counts too_long as StarChat does
    await expect(quality.locator('.quality-group').filter({ hasText: 'Extraction issues' }).locator('.quality-row')).toHaveText('2 of 102 calls')
  })

  test('the admin page', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin', quality: QUALITY })
    await page.goto('/analytics-admin')
    const quality = page.locator('.call-insights-section').filter({ has: page.getByRole('heading', { name: 'Quality', exact: true }) })
    await expect(quality.getByText(MEANINGS[2])).toBeVisible({ timeout: 15000 })
    await expect(quality.getByText(ACTIONS[1])).toBeVisible()
  })

  test('a reseller\'s scope page', async ({ resellerPage: page }) => {
    await mockInsights(page, { role: 'reseller', quality: QUALITY })
    await page.goto('/analytics')
    const quality = page.locator('.call-insights-section').filter({ has: page.getByRole('heading', { name: 'Quality', exact: true }) })
    await expect(quality.getByText(MEANINGS[3])).toBeVisible({ timeout: 15000 })
    await expect(quality.getByText(ACTIONS[0])).toBeVisible()
  })

  test('the report page: its quality table and its gap groups', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    const table = page.getByRole('table', { name: 'Questions without an answer, compared with the period before' })
    await expect(table.getByRole('columnheader', { name: 'What it means and what to do' })).toBeVisible({ timeout: 15000 })
    await expect(table.getByText(MEANINGS[0])).toBeVisible()
    const gaps = page.getByRole('region', { name: 'Questions left unanswered' })
    await expect(gaps.locator('.report-gap-group').filter({ hasText: 'Missing information' }).getByText(MEANINGS[0])).toBeVisible()
  })
})
