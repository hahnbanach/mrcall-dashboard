// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, estimateJob } = require('../fixtures/insights')

/**
 * U19r2 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the minor defects of the U19 attack
 * outside the report and request screens (brief, "Amendment 2026-10-26", Dashboard, minor defects): the platform page
 * closed to anyone but an admin (m12), a business out of the reader's scope said as such (m13), the date picker in the
 * reader's language (m16), the request dialog's title where a title goes (m20), no empty account selector over a
 * business (m23), the filter chips and the history cards on a phone (m19), and a request's wait state (m21).
 */
test.describe('the platform page', () => {
  test('m12: an owner is taken to the statistics of their business, never to an empty platform page', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto('/analytics-admin')
    await expect(page).toHaveURL(/\/analytics(\?|$)/, { timeout: 15000 })
    await expect(page.getByText('Platform Analytics (all businesses)')).toHaveCount(0)
  })

  test('m12: a reseller is taken to its own page, not to one titled for all businesses', async ({ resellerPage: page }) => {
    await mockInsights(page)
    await page.goto('/analytics-admin')
    await expect(page).toHaveURL(/\/analytics(\?|$)/, { timeout: 15000 })
    await expect(page.getByText('Platform Analytics (all businesses)')).toHaveCount(0)
  })
})

test.describe('a business page', () => {
  test('m13: a business out of the reader\'s scope says so, with no empty sections and no raw id', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.route('**/crm/business?id=foreign-biz*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.goto('/analytics?id=foreign-biz')
    await expect(page.getByText('This business does not exist or is not among those you can see.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('foreign-biz')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Statistics sections' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'How the calls went' })).toHaveCount(0)
  })

  test('m23: a reseller reading one business has no empty "Select account" above it', async ({ resellerPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByRole('navigation', { name: 'Statistics sections' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Select account')).toHaveCount(0)
  })

  test('m16: the date picker speaks the reader\'s language and writes dates as it does', async ({ authenticatedPage: page }) => {
    await page.addInitScript(() => localStorage.setItem('mrcall-user-locale', 'it-IT'))
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByRole('button', { name: 'Scegli la data' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Choose Date' })).toHaveCount(0)
    const value = await page.locator('.date-controls input').inputValue()
    expect(value).toMatch(/^\d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}$/)
    // day first: the first number of a date is a day of the month, the second a month
    const [d, m] = value.split(' - ')[1].split('/').map(Number)
    const now = new Date()
    expect(d).toBe(now.getDate())
    expect(m).toBe(now.getMonth() + 1)
  })
})

test.describe('the request dialog', () => {
  test('m20: its title starts the header and its close button ends it', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Request a report' })
    const title = await dialog.locator('.p-dialog-title').boundingBox()
    const close = await dialog.locator('.p-dialog-header').getByRole('button').last().boundingBox()
    expect(title.x).toBeLessThan(close.x)
  })

  test('m21: a regeneration says it is being prepared while the estimate runs, never a silent wait', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { job: (id) => estimateJob({ jobId: id, status: 'running', phase: 'estimating', estimate: undefined }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: /^Regenerate the report/ }).first().click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Regenerate the report' })
    await expect(dialog.getByRole('status')).toContainText('We are preparing the request', { timeout: 2000 })
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('m19: every filter chip is on the screen, none cut at its edge', async ({ resellerPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const chips = page.getByRole('region', { name: 'Active filters' }).locator('.filter-chip')
    await expect(chips.first()).toBeVisible({ timeout: 15000 })
    for (let i = 0; i < await chips.count(); i++) {
      const box = await chips.nth(i).boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(375)
    }
  })

  test('m19: a history card holds its values in two columns, not eight rows', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const row = page.getByRole('table', { name: 'All reports' }).getByRole('row').filter({ hasText: 'Oct 1, 2026 – Oct 7, 2026' })
    await expect(row).toBeVisible({ timeout: 15000 })
    const tops = await row.locator('td').evaluateAll((cells) => [...new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top)))])
    expect(tops.length).toBeLessThanOrEqual(5)
  })
})
