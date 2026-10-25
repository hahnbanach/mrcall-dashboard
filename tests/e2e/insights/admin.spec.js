// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, sortBy } = require('../fixtures/insights')

/**
 * U16 and U16b of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md (and step U16b of
 * docs/execution-plans/2026-10-24-call-resolution-forwarded.md): Processing (the jobs, no cost column), the admin's
 * business filter by name, "Assistants to review" paged with sortable headers, account health and a search undone
 * where it is set, "Callers' requests" as a table of categories (histogram readable as numbers, status and freshness
 * as text, a row opening to its businesses, archive and restore for an admin only), and the outcome lines.
 */
const assistants = (page) => page.getByRole('table', { name: 'Assistants to review' })
const requests = (page) => page.getByRole('table', { name: 'Callers\' requests' })

test.describe('Processing (owner)', () => {
  test('lists the jobs with what, state, progress, who and when, the report written, a cancel while open, and no cost', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    const table = page.getByRole('table', { name: 'Processing' })
    await expect(table.getByRole('columnheader')).toHaveText(['What', 'Status', 'Progress', 'Requested by', 'Started on', 'Result'], { timeout: 15000 })
    const running = table.getByRole('row').filter({ hasText: 'Analysis of the calls' })
    await expect(running.getByText('In preparation')).toBeVisible()
    await expect(running.getByText('12 of 40 calls')).toBeVisible()
    await expect(running.getByRole('button', { name: 'Cancel the processing' })).toBeVisible()
    const done = table.getByRole('row').filter({ hasText: 'Ready' })
    await expect(done.getByRole('link', { name: 'Open' })).toHaveAttribute('href', /\/analytics\/report\?id=test-biz-001&start=\d+&requestId=job-req-1/)
    await expect(done.getByText('You', { exact: true })).toBeVisible()
    const refused = table.getByRole('row').filter({ hasText: 'Automatic report prepared now' })
    // refused for the reserve kept for calls: said as such, not as "not enough credit" (the U17b review, B4)
    await expect(refused.getByText('Not run', { exact: true })).toBeVisible()
    await expect(refused.getByText('Reserve for calls')).toBeVisible()
    await expect(refused.getByText('Not run: not enough credit')).toHaveCount(0)
    await expect(refused.getByText('MrCall', { exact: true })).toBeVisible()
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/€|EUR|\d+\s*credits?\b|tokens?|admin-uid/i)
  })
})

test.describe('Assistants to review', () => {
  test('admin: pages on the server with its total, sorts by header with aria-sort, searches by name with the search undone where it shows', async ({ adminPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto('/analytics-admin')
    const table = assistants(page)
    await expect(page.getByText('1–10 of 23')).toBeVisible({ timeout: 15000 })
    expect(asked.assistants[0].url).toMatch(/sort=not_solved&direction=desc&from=0&size=10/)
    await page.getByRole('navigation', { name: 'Pages of Assistants to review' }).getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText('11–20 of 23')).toBeVisible()
    expect(asked.assistants[asked.assistants.length - 1].url).toContain('from=10')

    await expect(table.getByRole('columnheader', { name: /^Unresolved/ })).toHaveAttribute('aria-sort', 'descending')
    await sortBy(page, table, 'Calls')
    await expect(table.getByRole('columnheader', { name: 'Calls' })).toHaveAttribute('aria-sort', 'descending')
    expect(asked.assistants[asked.assistants.length - 1].url).toMatch(/sort=calls&direction=desc&from=0/)

    await page.getByRole('searchbox', { name: 'Search a business by name' }).fill('Studio 1')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText(/^1–\d+ of \d+$/)).toBeVisible()
    expect(asked.assistants[asked.assistants.length - 1].url).toContain('search=Studio%201')
    await page.getByRole('button', { name: 'Clear search “Studio 1”' }).click()
    await expect(page.getByText('1–10 of 23')).toBeVisible()
    expect(asked.assistants[asked.assistants.length - 1].url).not.toContain('search=')
  })

  test('admin: "Unresolved" is StarChat\'s notSolved over callsWithRequest, and each account is said in words', async ({ adminPage: page }) => {
    await mockInsights(page)
    await page.goto('/analytics-admin')
    const table = assistants(page)
    const first = table.getByRole('row').filter({ has: page.getByRole('button', { name: 'Studio 1', exact: true }) })
    // notSolved 29 over callsWithRequest 60
    await expect(first.getByText('48% (29 of 60)')).toBeVisible({ timeout: 15000 })
    await expect(first.getByText('Low credit')).toBeVisible()
    const second = table.getByRole('row').filter({ has: page.getByRole('button', { name: 'Studio 2', exact: true }) })
    await expect(second.getByText('In debt')).toBeVisible()
    await expect(second.getByText('Not paid')).toBeVisible()
    await expect(table.getByRole('row').filter({ has: page.getByRole('button', { name: 'Studio 4', exact: true }) }).getByText('In good standing')).toBeVisible()
    // a name selects the business: the page narrows to it, and the control above the table widens it again
    await first.getByRole('button', { name: 'Studio 1' }).click()
    await expect(page).toHaveURL(/businessId=biz-1/)
    await page.getByRole('button', { name: 'Show all' }).click()
    await expect(page).not.toHaveURL(/businessId=/)
  })
})

test.describe('the admin\'s business filter', () => {
  test('finds a business by company name and filters by it, never asking for an id', async ({ adminPage: page }) => {
    await mockInsights(page)
    const searches = []
    await page.route('**/crm/business/search', (route) => {
      const body = route.request().postDataJSON()
      if (body && body.companyName) {
        searches.push(body)
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ businessId: 'biz-77', companyName: 'Studio Dentistico Rossi' }]) })
      }
      return route.fallback()
    })
    await page.goto('/analytics-admin')
    const box = page.getByRole('combobox', { name: 'Business' })
    await box.pressSequentially('Rossi', { delay: 30 })
    await page.getByRole('option', { name: 'Studio Dentistico Rossi' }).click({ timeout: 15000 })
    expect(searches[searches.length - 1]).toMatchObject({ companyName: '%Rossi%' })
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(/businessId=biz-77/)
    await expect(page.getByText('Studio Dentistico Rossi').first()).toBeVisible()
  })
})

test.describe('Callers\' requests', () => {
  test('admin: one row per category from view=categories, following the page\'s period, each with its status, numbers and freshness in words', async ({ adminPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto('/analytics-admin')
    const table = requests(page)
    await expect(table.getByRole('row')).toHaveCount(4, { timeout: 15000 })
    const url = new URL(asked.categories[0].url)
    expect(url.searchParams.get('view')).toBe('categories')
    expect(asked.categories[0].body.timestampGte).toBeGreaterThan(0)
    expect(asked.categories[0].body.timestampLte).toBeGreaterThan(asked.categories[0].body.timestampGte)

    const booking = table.getByRole('row').filter({ hasText: 'Online booking' })
    await expect(booking.getByText('Rising', { exact: true })).toBeVisible()
    await expect(booking.getByText('3 businesses')).toBeVisible()
    await expect(booking.getByText('+2 compared with the previous period')).toBeVisible()
    await expect(booking.getByText('25% of the businesses with reports')).toBeVisible()
    await expect(booking.getByRole('img', { name: 'Businesses per week, from the oldest: 0, 1, 3, 2' })).toBeVisible()
    await expect(booking.getByText('Last request on Oct 21, 2026 · 67% in the last week')).toBeVisible()
    await expect(booking.getByText('Consider an integration with a booking system')).toBeVisible()
    const stale = table.getByRole('row').filter({ hasText: 'Opening hours and closures' })
    await expect(stale.getByText('No longer asked recently')).toBeVisible()
    await expect(stale.getByText(/^Reopened: 3 new businesses asked for it after it was archived on Oct 10, 2026\.$/)).toBeVisible()
    await expect(table.getByRole('row').filter({ hasText: 'Prices and rates' }).getByText('1 businesses dated by the end of the report')).toBeVisible()

    // the page's period moves the window
    await page.getByRole('button', { name: '7 days' }).click()
    await expect.poll(() => asked.categories.length).toBeGreaterThan(1)
    const last = asked.categories[asked.categories.length - 1].body
    expect(last.timestampLte - last.timestampGte).toBeLessThan(8 * 24 * 3600 * 1000)
  })

  test('admin: a row opens to its businesses, paged; a category is archived with a reason, and archived ones are shown on demand', async ({ adminPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto('/analytics-admin')
    const booking = requests(page).getByRole('row').filter({ hasText: 'Online booking' })
    await booking.getByRole('button', { name: 'Who asked' }).click({ timeout: 15000 })
    await expect(booking.getByRole('button', { name: 'Who asked' })).toHaveAttribute('aria-expanded', 'true')
    const businesses = page.getByRole('table', { name: 'Businesses that asked for Online booking' })
    await expect(businesses.getByRole('link', { name: 'Studio 0' })).toBeVisible()
    await expect(page.getByText('1–10 of 12')).toBeVisible()
    expect(asked.businesses[0].url).toMatch(/\/integrations\/online_booking\/businesses\?from=0&size=10/)

    await booking.getByRole('button', { name: 'Archive Online booking' }).click()
    const dialog = page.getByRole('dialog', { name: 'Archive' })
    await expect(dialog.getByRole('button', { name: 'Archive' })).toBeDisabled()
    await dialog.getByLabel('Already integrated').check()
    await dialog.getByLabel('Note (optional)').fill('Plateform connected')
    await dialog.getByRole('button', { name: 'Archive' }).click()
    await expect(dialog).toBeHidden()
    expect(asked.dismiss[0].url).toMatch(/\/integrations\/online_booking\/dismiss$/)
    expect(asked.dismiss[0].body).toEqual({ reason: 'already_integrated', note: 'Plateform connected' })

    await page.getByLabel('Show archived').check()
    await expect.poll(() => asked.categories[asked.categories.length - 1].url).toContain('includeDismissed=true')
  })

  test('admin: an example is hidden with a reason', async ({ adminPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto('/analytics-admin')
    await requests(page).getByRole('button', { name: 'Hide the example “How much is a visit?”' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Hide' })
    await dialog.getByLabel('Not relevant').check()
    await dialog.getByRole('button', { name: 'Archive' }).click()
    await expect(dialog).toBeHidden()
    expect(asked.dismiss[0].url).toMatch(/\/integrations\/prices\/examples\/dismiss$/)
    expect(asked.dismiss[0].body).toMatchObject({ text: 'How much is a visit?', reason: 'not_relevant' })
  })

  test('reseller: the same rows on its own page, with no archive control', async ({ resellerPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto('/analytics')
    const table = requests(page)
    await expect(table.getByRole('row').filter({ hasText: 'Online booking' })).toBeVisible({ timeout: 15000 })
    expect(new URL(asked.categories[0].url).searchParams.get('view')).toBe('categories')
    await expect(table.getByRole('button', { name: /^Archive/ })).toHaveCount(0)
    await expect(table.getByRole('button', { name: /^Hide/ })).toHaveCount(0)
    await expect(page.getByLabel('Show archived')).toHaveCount(0)
    // and its assistants table, paged and sortable
    await expect(page.getByText('1–10 of 23')).toBeVisible()
    await expect(assistants(page).getByRole('columnheader', { name: /^Unresolved/ })).toHaveAttribute('aria-sort', 'descending')
  })
})

test.describe('How the calls went: four outcome lines (U16b)', () => {
  test('resolved, passed to the business (complete and incomplete), passed to a person and not resolved, adding up to the calls with a request', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const lines = page.getByRole('list', { name: 'Outcome of the calls where the caller asked something' })
    await expect(page.getByText('Shares over the 100 calls in which the caller asked for something.')).toBeVisible({ timeout: 15000 })
    const line = (name) => lines.locator(':scope > li').filter({ has: page.getByText(name, { exact: true }) })
    await expect(line('Resolved in the call')).toContainText('5050% of 100')
    await expect(line('Request passed to the business')).toContainText('2525% of 100')
    await expect(line('Request passed to the business')).toContainText('with a complete message2020% of 100')
    await expect(line('Request passed to the business')).toContainText('with an incomplete message55% of 100')
    await expect(line('Passed to a person')).toContainText('1010% of 100')
    await expect(line('Not resolved')).toContainText('1515% of 100')
    // against the previous period: not resolved fell from 30 to 15
    await expect(line('Not resolved')).toContainText('-50.0%')
    // caller_left and spam are counted beside the outcome, not in it
    await expect(page.getByText('Not in the share')).toBeVisible()
  })

  test('a server without the outcome field shows no lines rebuilt from resolution', async ({ authenticatedPage: page }) => {
    const { OUTCOMES } = require('../fixtures/insights')
    const { outcome, callsWithRequest, ...older } = OUTCOMES
    void outcome; void callsWithRequest
    await mockInsights(page, { outcomes: older })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByText('This outcome appears once the server reads requests passed to the business.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Resolved in the call')).toHaveCount(0)
  })
})
