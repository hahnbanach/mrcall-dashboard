// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O3 (plan steps A5a and A5b): a page narrowed to one business draws that
 * business's card, not a ranking or a breakdown of one row; "Callers' requests" are that business's (StarChat 9.34, S1:
 * the request routes honour the body's business and owner, out of scope 404), with no column about several businesses
 * and no archive, which acts on every business. Narrowed to an owner, the rankings stay (they rank several businesses),
 * the requests are that owner's, and archive is not offered either.
 *
 * Seen failing, 2026-11-01, before A5a: the one-row table "Assistants to review" and "Business Breakdown" drawn, and
 * "Archive" offered on a page narrowed to one business; before A5b, the "Businesses" column and "Who asked" drawn
 * there.
 */
const section = (page, name) => page.getByRole('region', { name })

test.describe('a narrowed admin or scope page', () => {
  test('admin, one business: its card instead of a ranking or breakdown of one row; the business\'s requests, no column about several businesses, no archive', async ({ adminPage: page }) => {
    const asked = await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin?businessId=biz-2')
    const card = section(page, 'Assistants to review')
    await expect(card.getByRole('heading', { name: 'Studio 2' })).toBeVisible({ timeout: 15000 })
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
    await expect(requests.getByText('Archiving acts on every business: clear the business and owner filters to archive or restore.')).toBeVisible()
    await expect(requests.locator('.requests-wide')).toHaveCount(0)
    expect(asked.categories.pop().body).toMatchObject({ businessId: 'biz-2' })
    const table = requests.locator('table.requests-table')
    await expect(table.getByRole('columnheader', { name: 'Businesses' })).toHaveCount(0)
    await expect(table.getByRole('columnheader', { name: 'Trend' })).toHaveCount(0)
    await expect(requests.getByText('What callers ask and how much of it the assistant handles, by category, for the business chosen.')).toBeVisible()
    await expect(requests.locator('.requests-score-help')).toHaveCount(0)
    await expect(table.locator('.requests-histogram')).toHaveCount(0)
    await expect(requests.getByRole('button', { name: /^Who asked/ })).toHaveCount(0)
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

  test('admin, one owner: the rankings stay; the owner\'s requests, with their businesses, and no archive', async ({ adminPage: page }) => {
    const asked = await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin?ownerId=owner-9')
    await expect(page.getByRole('table', { name: 'Assistants to review' })).toBeVisible({ timeout: 15000 })
    const requests = section(page, 'Callers\' requests')
    await expect(requests.locator('table.requests-table').getByRole('columnheader', { name: 'Businesses' })).toBeVisible({ timeout: 15000 })
    await expect(requests.getByRole('button', { name: /^Archive / })).toHaveCount(0)
    expect(asked.categories.pop().body).toMatchObject({ ownerId: 'owner-9' })
  })

  test('reseller, one owner chosen: the requests are read for that owner', async ({ resellerPage: page }) => {
    await page.route('**/reseller/managed-owners*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ ownerId: 'owner-9', ownerDisplayName: 'Demo Owner', ownerEmail: 'demo-owner@example.com' }]),
    }))
    const asked = await mockInsights(page, { role: 'reseller' })
    await mockClassifications(page, { role: 'reseller' })
    await page.goto('/analytics')
    const requests = section(page, 'Callers\' requests')
    await expect(requests).toBeVisible({ timeout: 15000 })
    await expect(requests.locator('.requests-wide')).toHaveCount(0)
    await page.locator('.owner-selector').getByRole('combobox').click()
    await page.getByRole('option', { name: /Demo Owner/ }).click()
    await expect.poll(() => asked.categories.length && asked.categories[asked.categories.length - 1].body.ownerId).toBe('owner-9')
    await expect(requests.locator('.requests-wide')).toHaveCount(0)
  })

  test('admin, a business out of the scope: StarChat answers 404 and the section is absent, with no error said', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.route('**/customer/insights/integrations?*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'not found' }) }))
    await page.goto('/analytics-admin?businessId=biz-2')
    await expect(section(page, 'Assistants to review').getByRole('heading', { name: 'Studio 2' })).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'Callers\' requests')).toHaveCount(0)
    await expect(page.locator('.p-toast-message')).toHaveCount(0)
  })
})
