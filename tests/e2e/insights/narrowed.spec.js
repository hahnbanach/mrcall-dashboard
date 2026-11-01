// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O3 (plan step A5a, the part that needs no StarChat change): a page
 * narrowed to one business draws that business's card, not a ranking or a breakdown of one row; "Callers' requests"
 * says it still counts every business (StarChat does not narrow it until the brief's S1) and offers no archive, which
 * acts on every business. Narrowed to an owner, the rankings stay (they rank several businesses) and the requests say
 * the same.
 *
 * Seen failing, 2026-11-01, before the change: the one-row table "Assistants to review" and "Business Breakdown" drawn,
 * and "Archive" offered on a page narrowed to one business.
 */
const section = (page, name) => page.getByRole('region', { name })

test.describe('a narrowed admin or scope page', () => {
  test('admin, one business: its card instead of a ranking or breakdown of one row; requests say they are wide, no archive', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin?businessId=biz-2')
    const card = section(page, 'Assistant: Studio 2')
    await expect(card).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('table', { name: 'Assistants to review' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Business Breakdown' })).toHaveCount(0)
    // the row's facts, each under its column's name, and the way to the business's own page
    await expect(card.getByText('Calls', { exact: true })).toBeVisible()
    await expect(card).toContainText('98')
    await expect(card.getByRole('button', { name: 'How this column is counted: Calls' })).toBeVisible()
    await expect(card.getByRole('link', { name: 'Open this business\'s analytics' })).toHaveAttribute('href', '/analytics?id=biz-2')
    // "Show all businesses" widens the page again
    await expect(card.getByRole('button', { name: 'Show all businesses' })).toBeVisible()

    const requests = section(page, 'Callers\' requests')
    await expect(requests.getByText('These requests are counted across every business, not only the one chosen.')).toBeVisible()
    await expect(requests.getByText('Archiving acts on every business: clear the business and owner filters to archive or restore.')).toBeVisible()
    await expect(requests.getByRole('button', { name: /^Archive / })).toHaveCount(0)
    await expect(requests.getByRole('button', { name: /^Hide the example/ })).toHaveCount(0)
  })

  test('admin, whole platform: the ranking, the breakdown and archive as before, and no "wide" note', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    await expect(page.getByRole('table', { name: 'Assistants to review' })).toBeVisible({ timeout: 15000 })
    const requests = section(page, 'Callers\' requests')
    await expect(requests.getByRole('button', { name: /^Archive / }).first()).toBeVisible({ timeout: 15000 })
    await expect(requests.locator('.requests-wide')).toHaveCount(0)
  })

  test('admin, one owner: the rankings stay; requests say they count every owner, and offer no archive', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin?ownerId=owner-9')
    await expect(page.getByRole('table', { name: 'Assistants to review' })).toBeVisible({ timeout: 15000 })
    const requests = section(page, 'Callers\' requests')
    await expect(requests.getByText('These requests are counted across every owner\'s businesses, not only the chosen owner\'s.')).toBeVisible({ timeout: 15000 })
    await expect(requests.getByRole('button', { name: /^Archive / })).toHaveCount(0)
  })

  test('reseller, one owner chosen: requests say they count every owner', async ({ resellerPage: page }) => {
    await page.route('**/reseller/managed-owners*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ ownerId: 'owner-9', ownerDisplayName: 'Demo Owner', ownerEmail: 'demo-owner@example.com' }]),
    }))
    await mockInsights(page, { role: 'reseller' })
    await mockClassifications(page, { role: 'reseller' })
    await page.goto('/analytics')
    const requests = section(page, 'Callers\' requests')
    await expect(requests).toBeVisible({ timeout: 15000 })
    await expect(requests.locator('.requests-wide')).toHaveCount(0)
    await page.locator('.owner-selector').getByRole('combobox').click()
    await page.getByRole('option', { name: /Demo Owner/ }).click()
    await expect(requests.getByText('These requests are counted across every owner\'s businesses, not only the chosen owner\'s.')).toBeVisible()
  })
})
