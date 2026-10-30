// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, rome, REPORT, OUTCOMES, assistantRow } = require('../fixtures/insights')
const { mockClassifications, mockConversations, conversation, CALL_ID } = require('../fixtures/classifications')

/**
 * U19r6b's REVISE (StarChat plan docs/execution-plans/2026-10-24-insights-reports-ux.md), checked against StarChat
 * 9.34.124 (b1b863694): M1, "Latest report" opens the report StarChat names, a requested one by its `requestId`; M3, a
 * withdrawal StarChat refuses (403 `not_author`, 409 `feedback_state`) said as such; the minors: each "Withdraw" named by
 * its proposal (m-c), "What callers ask" naming the region it opens (m-d), the reason of an "n/a" reachable as its
 * accessible description, not only a `title` (m-e).
 *
 * Seen failing on c1389ee, each case, before its repair.
 */
test.describe('M1: "Latest report" opens the report StarChat names', () => {
  test('a requested latest report is opened by its requestId, never as an automatic report of the same start', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    const row = { ...assistantRow(1), latestReport: { periodStart: REPORT.periodStart, requestId: REPORT.requestId } }
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ period: { from: 0, to: 0 }, sort: 'not_solved', businesses: [row], total: 1, from: 0, size: 10, direction: 'desc' }) }))
    // StarChat reads the automatic report at that start without a requestId: there is none
    await page.route('**/customer/insights/reports/*', (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/overlap')) { route.fallback(); return }
      route.fulfill(url.searchParams.get('requestId') === REPORT.requestId
        ? { status: 200, contentType: 'application/json', body: JSON.stringify(REPORT) }
        : { status: 404, contentType: 'application/json', body: '"Not found"' })
    })
    await page.goto('/analytics-admin')
    await page.getByRole('table', { name: 'Assistants to review' }).getByRole('link', { name: 'Latest report' }).click({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Calls report, Oct 1, 2026 – Oct 7, 2026' })).toBeVisible({ timeout: 15000 })
  })
})

test.describe('M3: a withdrawal StarChat refuses', () => {
  const open = (page) => page.goto(`/conversations?id=${BUSINESS_ID}&conversation=${CALL_ID}`)
  const chip = (page, name) => page.locator('.opened-card').getByRole('button', { name })
  for (const [status, code, said] of [[403, 'not_author', 'Only its author can withdraw a proposal.'], [409, 'feedback_state', 'This proposal has already been decided.']]) {
    test(`${status} ${code} is said in its own words`, async ({ authenticatedPage: page }) => {
      await mockConversations(page, [conversation()])
      await mockClassifications(page)
      await open(page)
      await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
      await chip(page, /^Category: Book an appointment$/).first().click()
      await page.getByRole('listbox').getByRole('option', { name: 'Prices and quotes', exact: true }).click()
      await expect(chip(page, /Proposal sent/)).toBeVisible()
      await page.route(/\/customer\/insights\/feedback\/\d+\/withdraw$/, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message: 'refused' }) }))
      await chip(page, /Proposal sent/).click()
      await page.getByRole('listbox').getByRole('option', { name: 'Withdraw my proposal' }).click()
      await expect(page.locator('.opened-card').getByRole('alert')).toHaveText(said)
    })
  }
})

test.describe('the minors of U19r6b', () => {
  test('m-c: each "Withdraw" of "My proposals" is named by its proposal', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    const at = Date.UTC(2026, 9, 25, 9)
    const s = (id, text) => ({ feedbackId: id, businessId: BUSINESS_ID, conversationId: 'CON-p' + id, callStart: at, subject: 'request', requestId: id, field: 'category', signal: 'wrong_value',
      valueFrom: 'prices', valueTo: 'opening_hours', source: 'person', status: 'proposed', actorRole: 'owner', byMe: true, createdAt: at, requestText: text })
    await mockClassifications(page, { queue: () => ({ total: 1, asOf: 1, items: [], groups: [{ category: 'opening_hours', businessId: BUSINESS_ID, calls: 2, items: 2, signals: [s(61, 'How much is a whitening?'), s(62, 'Are you open on Saturday?')] }] }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const section = page.getByRole('region', { name: 'My proposals' })
    await expect(section.getByRole('button', { name: 'Withdraw the proposal: How much is a whitening?' })).toBeVisible({ timeout: 15000 })
    await expect(section.getByRole('button', { name: 'Withdraw the proposal: Are you open on Saturday?' })).toBeVisible()
  })

  test('m-d: "What callers ask" names the region it opens', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const ask = page.getByRole('table', { name: 'Assistants to review' }).getByRole('button', { name: 'Online booking: 29 requests' })
    await ask.click({ timeout: 15000 })
    const controls = await ask.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    await expect(page.locator('#' + controls)).toBeVisible()
  })

  test('m-e: the reason of an "n/a" is its accessible description, on the KPIs and the outcome lines', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/dashboard*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ totalCalls: 900, avgCallDurationMs: 60000, totalCallDurationMs: 54000000, uniqueCallers: 400, previousPeriod: { totalCalls: 300, avgCallDurationMs: 50000, totalCallDurationMs: 15000000, uniqueCallers: 200 }, previousPartial: true }) }))
    await mockInsights(page, { outcomes: { ...OUTCOMES, previousPartial: true, lastCallAt: rome(2026, 10, 20) } })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const help = 'The period before has calls for only part of its days: the change is not meaningful.'
    // described by text in the page (aria-describedby), not by a `title` alone, which keyboard and touch never reach
    const describedBy = async (na) => {
      const ids = await na.getAttribute('aria-describedby')
      expect(ids, 'an n/a names the text that says why').toBeTruthy()
      return page.locator(ids.split(' ').map((id) => '#' + id).join(', '))
    }
    const card = page.locator('.kpi-card').filter({ hasText: 'Total Calls' })
    const kpi = card.getByText('n/a', { exact: true })
    await expect(kpi).toBeVisible({ timeout: 15000 })
    await expect(await describedBy(kpi)).toHaveText(help)
    // the reason reaches assistive technology once (U19r6b n3): as the n/a's description, never read again in place
    await expect(kpi).toHaveAccessibleDescription(help)
    await expect(kpi).not.toHaveAccessibleName(/meaningful/)
    await expect(card.locator('.not-available')).not.toHaveAccessibleName(/meaningful/)
    await expect(card.locator('.not-available')).not.toHaveAccessibleDescription(/meaningful/)
    expect(await card.ariaSnapshot()).not.toContain(help)
    // for a pointer, the reason shows on hover
    await kpi.hover()
    await expect(card.locator('.not-available-reason')).toBeInViewport()
    const line = page.getByRole('list', { name: 'Outcome of the calls where the caller asked something' }).getByText('n/a', { exact: true }).first()
    await expect(await describedBy(line)).toHaveText(help)
  })
})
