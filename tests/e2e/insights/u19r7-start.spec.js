// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * StarChat plan docs/execution-plans/2026-10-24-insights-reports-ux.md, U19r7b (rule 6 of the amendment of 2026-10-30,
 * pages within one second): on test with StarChat 9.34.125 the pages spent 370-800 ms before their first analytics or
 * insights read, behind reads those reads do not need. Measured on dashboard-test (a timeline of a reload): a forced
 * token refresh and the role search (`crm/business/search`), then the business record (`crm/business`), one after the
 * other, before the first read. A read starts as soon as its own inputs exist: a business's page needs its id and its
 * window, never the role nor the business record; the admin's page is gated by the server, not by the role search.
 *
 * Each case holds the reads they do not need for 2 s and asserts the page's reads were asked before those answered.
 * Seen failing on 0b8f614.
 */
const HOLD = 2000
async function hold (page, pattern, fulfill, ms = HOLD) {
  const answered = { at: 0 }
  await page.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, ms))
    answered.at = Date.now()
    await fulfill(route)
  })
  return answered
}

const firstRequest = (page, re) => page.waitForRequest((r) => re.test(r.url()), { timeout: 15000 }).then(() => Date.now())

test.describe('U19r7b: a page\'s reads start with their inputs, not behind reads they do not need', () => {
  for (const tab of ['overview', 'reports', 'jobs']) {
    test(`a business's ${tab} tab asks before the role search and the business record answer`, async ({ authenticatedPage: page }) => {
      await mockInsights(page)
      await mockClassifications(page)
      const role = await hold(page, '**/crm/business/search*', (route) => route.fallback())
      const record = await hold(page, /\/crm\/business\?id=/, (route) => route.fallback())
      const read = tab === 'overview' ? /\/customer\/analytics\/outcomes/ : tab === 'reports' ? /\/customer\/insights\/reports\?/ : /\/customer\/insights\/jobs\?/
      const asked = firstRequest(page, read)
      await page.goto(`/analytics?id=${BUSINESS_ID}${tab === 'overview' ? '' : '&tab=' + tab}`)
      const at = await asked
      expect(role.at === 0 || at < role.at, 'asked before the role search answered').toBe(true)
      expect(record.at === 0 || at < record.at, 'asked before the business record answered').toBe(true)
    })
  }

  test('the admin page asks before the role search answers', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    const role = await hold(page, '**/crm/business/search*', (route) => route.fallback())
    const asked = firstRequest(page, /\/customer\/analytics\/outcomes/)
    await page.goto('/analytics-admin')
    const at = await asked
    expect(role.at === 0 || at < role.at).toBe(true)
  })
})

/**
 * P17's review (REVISE, B1): StarChat answers most of the admin page's reads to anyone, scoped to the reader (the
 * classic analytics, outcomes, quality), so the page draws nothing until the role search has confirmed an admin:
 * a non-admin is never shown their own data under the title for all businesses (U19 m12). Seen failing on 5f08d1f.
 */
const { setupAuthPage } = require('../fixtures/auth')
const { mockResellerUser } = require('../fixtures/mock-data')
test.describe('P17 B1: the admin page draws nothing before the role search confirms an admin', () => {
  for (const role of ['owner', 'reseller']) {
    test(`a ${role} on the admin page sees none of its content while the search is held, then is taken away`, async ({ page }) => {
      await setupAuthPage(page, role === 'owner' ? require('../fixtures/mock-data').mockUser : mockResellerUser, role)
      await mockInsights(page, { role })
      await mockClassifications(page, { role })
      await page.route('**/customer/analytics/dashboard*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ totalCalls: 4242, avgCallDurationMs: 1000, totalCallDurationMs: 4242000, uniqueCallers: 17 }) }))
      // held long enough that the reads answer while it is still out
      const search = await hold(page, '**/crm/business/search*', (route) => route.fallback(), 5000)
      const asked = firstRequest(page, /\/customer\/analytics\/dashboard/)
      await page.goto('/analytics-admin')
      await asked
      await page.waitForTimeout(800)
      expect(search.at, 'the search is still held').toBe(0)
      // read now, while the search is held: a retrying assertion would wait for the redirect and pass on it
      expect(await page.locator('.admin-mode-banner').isVisible(), 'no title for all businesses').toBe(false)
      expect(await page.getByText('4,242').first().isVisible(), 'none of the reader\'s own figures').toBe(false)
      expect(await page.getByRole('heading', { name: 'How the calls went' }).isVisible(), 'no section').toBe(false)
      await expect(page).toHaveURL(/\/analytics(\?|$)/, { timeout: 15000 })
    })
  }

  test('an admin\'s page shows once the search confirms it', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    await expect(page.locator('.admin-mode-banner')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'How the calls went' })).toBeVisible()
  })
})

test.describe('P17: what the early reads keep', () => {
  test('a business\'s page reads once more only when the role found differs from the one it read with', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page)
    await mockClassifications(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByRole('heading', { name: 'How the calls went' })).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(500)
    expect(asked.outcomes).toHaveLength(1)
    // the same reader, the search now naming another role than the one remembered
    await page.route('**/crm/business/search*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]',
      headers: { 'x-mrcall-role': 'reseller', 'access-control-expose-headers': 'x-mrcall-role' } }))
    await page.reload()
    await expect.poll(() => asked.outcomes.length).toBe(3)
  })

  test('the Report tab reads at once and draws its rows only once the business\'s zone is known', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page)
    await mockClassifications(page)
    const record = await hold(page, /\/crm\/business\?id=/, (route) => route.fallback())
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect.poll(() => asked.reports.length).toBeGreaterThan(0)
    expect(record.at).toBe(0)
    await expect(page.getByRole('table', { name: 'All reports' })).toHaveCount(0)
    await expect(page.getByRole('table', { name: 'All reports' })).toBeVisible({ timeout: 15000 })
    expect(record.at).toBeGreaterThan(0)
  })
})
