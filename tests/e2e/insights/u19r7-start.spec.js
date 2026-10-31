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
async function hold (page, pattern, fulfill) {
  const answered = { at: 0 }
  await page.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, HOLD))
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
