// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID } = require('../fixtures/insights')

/**
 * U17 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md, at a phone's width (375 pixels): the
 * history, the jobs, the assistants and the callers' requests are stacked cards, each value under its column's name,
 * nothing wider than the screen, and the request dialog fits it.
 */
test.use({ viewport: { width: 375, height: 812 } })

const pageWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth)

test.describe('on a phone', () => {
  test('the history is a list of cards, each value under its column\'s name, and the page no wider than the screen', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const table = page.getByRole('table', { name: 'All reports' })
    const row = table.getByRole('row').filter({ hasText: 'Oct 1, 2026 – Oct 7, 2026' })
    await expect(row).toBeVisible({ timeout: 15000 })
    // the header row is out of view; each cell carries its column's name
    await expect(table.locator('thead')).not.toBeInViewport()
    const label = await row.locator('td').nth(3).evaluate((el) => getComputedStyle(el, '::before').content)
    expect(label).toBe('"Status"')
    const box = await row.boundingBox()
    expect(box.width).toBeLessThanOrEqual(375)
    expect(await pageWidth(page)).toBeLessThanOrEqual(375)
    await expect(page.getByText('1–10 of 25')).toBeVisible()
  })

  test('the request dialog fits the screen, from the period to the confirmation', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Request a report' })
    let box = await dialog.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeInViewport({ timeout: 15000 })
    box = await dialog.boundingBox()
    expect(box.x + box.width).toBeLessThanOrEqual(375)
  })

  test('the jobs, the assistants and the requests are cards too', async ({ adminPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    await expect(page.getByRole('table', { name: 'Processing' }).getByRole('row').filter({ hasText: 'Ready' })).toBeVisible({ timeout: 15000 })
    expect(await pageWidth(page)).toBeLessThanOrEqual(375)

    await page.goto('/analytics-admin')
    const assistants = page.getByRole('table', { name: 'Assistants to review' })
    await expect(assistants.getByRole('button', { name: 'Studio 1', exact: true })).toBeVisible({ timeout: 15000 })
    await expect(assistants.locator('thead')).not.toBeInViewport()
    const requests = page.getByRole('table', { name: 'Callers\' requests' })
    const booking = requests.getByRole('row').filter({ hasText: 'Online booking' })
    await booking.scrollIntoViewIfNeeded()
    const card = await booking.boundingBox()
    expect(card.width).toBeLessThanOrEqual(375)
    await expect(booking.getByRole('img', { name: /^Businesses per week/ })).toBeInViewport()
    expect(await pageWidth(page)).toBeLessThanOrEqual(375)
  })
})
