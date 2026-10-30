// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockResellerUser } = require('../fixtures/mock-data')
const { mockInsights, category, assistantRow, OUTCOMES, rome } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * U19r6 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md, the brief's amendment of 2026-10-30
 * on the pages over several businesses: "What callers ask" in "Assistants to review", each category opening that
 * business's requests with all outcomes (rule 3, U19c M2); a next action on every category row (rule 4, M3); a change
 * against a partial previous window is "n/a" with its reason (rule 10, m18); the message deltas neutral (m1); a zero
 * base a dash and two businesses of one name told apart (m11); the assistants table inside its card (m12); a row's
 * status and change saying what each compares (m13); no stray status from an empty autocomplete (m14).
 *
 * Seen failing on c0a4e35, each case, before its repair.
 */
const assistants = (page) => page.getByRole('table', { name: 'Assistants to review' })
const requests = (page) => page.getByRole('table', { name: 'Callers\' requests' })

const VIEW = {
  total: 8, asOf: 1761300000000, from: rome(2026, 9, 24), to: rome(2026, 10, 24), calls: 60, businesses: 4, businessesWithCalls: 4, backlog: { calls: 0 },
  items: [
    category('prices', { label: 'Prices and rates', nextActionKind: 'business_info', nextAction: 'Ask the businesses to add their prices', outcomes: { neither: 9 } }),
    category('booking_changes', { label: 'Change a booking', nextActionKind: 'integration', nextAction: 'Enable changes from the calendar', outcomes: { neither: 5 } }),
    category('online_booking', { label: 'Online booking', nextActionKind: 'delegate', nextAction: undefined, outcomes: { taken: 20 } }),
    category('messaging', { label: 'Leave a message', nextActionKind: 'handled', nextAction: undefined, outcomes: { met: 8 } }),
    category('complaints', { label: 'Complaints', nextActionKind: 'withdrawn', nextAction: undefined, outcomes: { withdrawn: 4 } }),
    category('insurance', { label: 'Insurance', nextActionKind: 'unrated', nextAction: undefined, outcomes: {} }),
    category(null, { label: undefined, unclassified: true, nextActionKind: 'none', nextAction: undefined, outcomes: { neither: 3 } }),
  ],
}

test.describe('rule 4: every category row says what to do next', () => {
  test('each kind is worded, the unrated and unclassified rows open their requests', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin', categories: VIEW })
    const { sent } = await mockClassifications(page, { role: 'admin', categoryRequests: { total: 0, calls: 0, asOf: 1, items: [] } })
    await page.goto('/analytics-admin')
    const row = (label) => requests(page).getByRole('row').filter({ hasText: label }).first()
    await expect(row('Prices and rates')).toContainText('Ask the businesses to add their prices', { timeout: 15000 })
    await expect(row('Change a booking')).toContainText('Enable changes from the calendar')
    await expect(row('Online booking')).toContainText('Consider letting the assistant handle these requests')
    await expect(row('Leave a message')).toContainText('Handled by the assistant')
    await expect(row('Complaints')).toContainText('Withdrawn by the callers')
    await row('Insurance').getByRole('button', { name: 'Outcome not rated yet: open the requests' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'category-requests' && s.category === 'insurance').length).toBe(1)
    await row('Not classified yet').getByRole('button', { name: 'Classify these requests' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'category-requests' && s.category === 'unclassified').length).toBe(1)
  })
})

test.describe('rule 3: "What callers ask" in "Assistants to review"', () => {
  test('a business\'s top categories, each opening its requests for that business with all outcomes, its latest report beside', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    const one = { requestId: 401, conversationId: 'CON-q1', callStart: rome(2026, 10, 20), businessId: 'biz-1', name: 'Studio 1', text: 'Can I book online?', outcome: 'taken', outcomeModel: 'taken', category: 'online_booking', categoryModel: 'online_booking', corrected: false, resolution: 'forwarded' }
    const { sent } = await mockClassifications(page, { role: 'admin', categoryRequests: { total: 1, calls: 1, asOf: 1, items: [one] } })
    await page.goto('/analytics-admin')
    const row = assistants(page).getByRole('row').filter({ hasText: 'Studio 1' }).first()
    await expect(row.getByRole('button', { name: 'Online booking: 29 requests' })).toBeVisible({ timeout: 15000 })
    await expect(row.getByRole('button', { name: 'Prices and rates: 12 requests' })).toBeVisible()
    await expect(row.getByRole('link', { name: 'Latest report' })).toHaveAttribute('href', `/analytics/report?id=biz-1&start=${rome(2026, 10, 14)}`)
    await row.getByRole('button', { name: 'Online booking: 29 requests' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'category-requests').length).toBe(1)
    const asked = sent.find((s) => s.path === 'category-requests')
    expect(asked.category).toBe('online_booking')
    expect(asked.query).toMatchObject({ businessId: 'biz-1', all: 'true' })
    await expect(assistants(page).getByRole('table', { name: 'Requests of Online booking' }).getByText('Can I book online?')).toBeVisible()
  })
})

test.describe('rule 10, m1: changes', () => {
  test('against a previous window with calls for part of its days, every change is "n/a" with its reason', async ({ page }) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    await mockInsights(page, { role: 'reseller', outcomes: { ...OUTCOMES, previousPartial: true, message: { ...OUTCOMES.message, previousTotals: { complete: 40, incomplete: 30, none: 50 } } } })
    await mockClassifications(page, { role: 'reseller' })
    await page.goto('/analytics')
    const outcome = page.getByRole('list', { name: 'Outcome of the calls where the caller asked something' })
    await expect(outcome.getByText('n/a').first()).toBeVisible({ timeout: 15000 })
    await expect(outcome.locator('abbr').first()).toHaveAttribute('title', 'The period before has calls for only part of its days: the change is not meaningful.')
    await expect(page.locator('.legend-delta:not(:has(abbr))')).toHaveCount(0)
  })

  test('the message deltas carry the outcome lines\' neutral colour', async ({ page }) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    await mockInsights(page, { role: 'reseller', outcomes: { ...OUTCOMES, message: { ...OUTCOMES.message, previousTotals: { complete: 40, incomplete: 3, none: 50 } } } })
    await mockClassifications(page, { role: 'reseller' })
    await page.goto('/analytics')
    await expect(page.locator('.legend-delta').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.legend-delta.delta-positive, .legend-delta.delta-negative')).toHaveCount(0)
  })
})

test.describe('m11, m12, m13, m14: the admin page', () => {
  test('a zero base prints a dash, two businesses of one name are told apart, a partial window is "n/a"', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    const rows = [
      { ...assistantRow(1), businessId: 'aaaa1111-0000', businessName: 'Ottica Bianchi', callsWithUnansweredRecorded: 0, callsWithUnanswered: 0 },
      { ...assistantRow(2), businessId: 'bbbb2222-0000', businessName: 'Ottica Bianchi', previousPartial: true, previousCallsWithRequest: 50, previousNotSolved: 20 },
    ]
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ period: { from: 0, to: 0 }, sort: 'not_solved', businesses: rows, total: 2, from: 0, size: 10, direction: 'desc' }) }))
    await page.goto('/analytics-admin')
    const first = assistants(page).getByRole('row').filter({ hasText: 'aaaa1111' })
    const second = assistants(page).getByRole('row').filter({ hasText: 'bbbb2222' })
    await expect(first).toContainText('Ottica Bianchi', { timeout: 15000 })
    await expect(second).toContainText('Ottica Bianchi')
    await expect(first).not.toContainText('0% (0 of 0)')
    await expect(first.getByRole('cell').filter({ hasText: /^—$/ }).first()).toBeVisible()
    await expect(second).toContainText('n/a')
  })

  test('the table stays inside its card: no sideways scroll at 1440 px, and under 600 px no row wider than the screen', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    await expect(assistants(page)).toBeVisible({ timeout: 15000 })
    const width = page.viewportSize().width
    const scroll = assistants(page).locator('xpath=..')
    if (width >= 1440) {
      const over = await scroll.evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(over).toBeLessThanOrEqual(1)
    }
    if (width < 600) {
      const widest = await assistants(page).evaluate((t) => Math.max(...[...t.querySelectorAll('tr')].map((r) => r.getBoundingClientRect().width)))
      expect(widest).toBeLessThanOrEqual(width)
    }
  })

  test('a category\'s status and change each say what they compare', async ({ adminPage: page }) => {
    const view = { ...VIEW, items: [category('online_booking', { label: 'Online booking', status: 'falling', trend: 3, previousBusinesses: 3, businesses: 6 })] }
    await mockInsights(page, { role: 'admin', categories: view })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const row = requests(page).getByRole('row').filter({ hasText: 'Online booking' }).first()
    await expect(row).toContainText('Falling in the second half of the period', { timeout: 15000 })
    await expect(row).toContainText('+3 businesses compared with the previous period')
  })

  test('the business filter, left empty, leaves no status to announce', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    await expect(assistants(page)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('status').filter({ hasText: /No business (with|by) this name/ })).toHaveCount(0)
  })
})
