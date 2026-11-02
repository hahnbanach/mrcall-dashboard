// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, category, rome, BUSINESS_ID, OUTCOMES, REPORT } = require('../fixtures/insights')
const { mockClassifications, mockConversations, conversation } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-11-02-redirected-outcome.md (StarChat insight version 8, its brief
 * docs/briefs/2026-11-02-extraction-configuration-and-resolution.md, decision 5): `redirected`, the business handling
 * the request through a channel of its own the assistant gave the caller, read wherever a resolution, an outcome line
 * or a request outcome is read. Its line shows only when it, or the period before, has calls: a period analysed before
 * version 8 cannot carry it (the plan's R1 decision). StarChat answered as its code does at d85eb2b70.
 *
 * Seen failing on the base (c02054f source, these tests): every case but the period without redirected, which is the
 * no-change case and passes there by construction.
 */
const LABEL = 'Sent to the business\'s channel'

// OUTCOMES with 10 redirected calls: StarChat counts them in callsWithRequest, so the base grows by as many.
const V8 = {
  ...OUTCOMES,
  resolution: { ...OUTCOMES.resolution, totals: { ...OUTCOMES.resolution.totals, redirected: 10 } },
  callsWithRequest: 110,
  outcome: {
    ...OUTCOMES.outcome,
    callsWithValue: 110,
    totals: { ...OUTCOMES.outcome.totals, redirected: 10 },
    buckets: OUTCOMES.outcome.buckets.map((b) => ({ ...b, counts: { ...b.counts, redirected: 10 } })),
  },
}

const outcomeList = (page) => page.getByRole('list', { name: 'Outcome of the calls where the caller asked something' })

test.describe('redirected: the outcome lines', () => {
  test('a period with redirected calls: its line after the request passed on, the five adding up to the base, opening its calls', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { outcomes: V8 })
    const searches = await mockConversations(page, [conversation({ id: 'CON-r1', details: { resolution: 'redirected', message: 'none', booked: false } })])
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByText('Shares over the 110 calls in which the caller asked for something.')).toBeVisible({ timeout: 15000 })
    const lines = outcomeList(page).locator(':scope > li')
    await expect(lines).toHaveCount(5)
    await expect(lines.nth(2)).toContainText(LABEL)
    await expect(lines.nth(2)).toContainText('109% of 110')
    await expect(lines.nth(3)).toContainText('Escalated to staff')
    // the count opens its calls in the panel, with StarChat's outcome-line filter, and the list names the resolution
    const n = searches.filter((s) => !s.id).length
    await page.getByRole('button', { name: `Open the 10 calls: ${LABEL}`, exact: true }).click()
    const panel = page.locator('.counted-calls-panel')
    await expect(panel).toBeVisible()
    await expect.poll(() => searches.filter((s) => !s.id).length).toBeGreaterThan(n)
    expect(searches.filter((s) => !s.id).pop()).toMatchObject({ businessId: BUSINESS_ID, counted: true, outcomeLine: 'redirected' })
    await expect(panel.getByText(LABEL).first()).toBeVisible()
  })

  test('a period without them (analysed before version 8): the four lines of before, no redirected line at zero', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByText('Shares over the 100 calls in which the caller asked for something.')).toBeVisible({ timeout: 15000 })
    await expect(outcomeList(page).locator(':scope > li')).toHaveCount(4)
    await expect(outcomeList(page).getByText(LABEL)).toHaveCount(0)
  })

  test('only the period before had them: the line at zero, so the fall shows', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { outcomes: { ...OUTCOMES, outcome: { ...OUTCOMES.outcome, previousTotals: { ...OUTCOMES.outcome.previousTotals, redirected: 6 } } } })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByText('Shares over the 100 calls in which the caller asked for something.')).toBeVisible({ timeout: 15000 })
    const line = outcomeList(page).locator(':scope > li').filter({ has: page.getByText(LABEL, { exact: true }) })
    await expect(line).toHaveCount(1)
    await expect(line).toContainText('00% of 100')
  })
})

test.describe('redirected: a call, a report, a category', () => {
  test('a call whose resolution is redirected shows it among its insights', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation({ id: 'CON-r2', details: { summary: 'Wanted to order a cake.', resolution: 'redirected', message: 'none', booked: false } })])
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}&conversation=CON-r2`)
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('Wanted to order a cake.')).toBeVisible({ timeout: 15000 })
    await expect(opened.getByText(LABEL).first()).toBeVisible()
  })

  test('a report counting redirected: its line, the base including it', async ({ authenticatedPage: page }) => {
    const content = { ...REPORT.content, resolution: { ...REPORT.content.resolution, redirected: 10 } }
    await mockInsights(page, { report: { ...REPORT, content } })
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    const outcome = page.getByRole('region', { name: 'Outcome of the calls where the caller asked something' })
    await expect(outcome.getByText('Shares over the 120 calls in which the caller asked for something.')).toBeVisible({ timeout: 15000 })
    const lines = outcome.getByRole('list', { name: 'Outcome of the calls where the caller asked something' }).getByRole('listitem')
    await expect(lines).toHaveCount(5)
    await expect(lines.nth(2)).toHaveText(new RegExp(`^${LABEL}\\s*10\\s*8% of 120`))
  })

  test('a category row with redirected requests: its outcome opens them; the default view still asks for no outcome', async ({ adminPage: page }) => {
    const window = { from: rome(2026, 9, 24), to: rome(2026, 10, 24) }
    const view = {
      total: 1, asOf: 1761300000000, ...window, calls: 20, businesses: 2, businessesWithCalls: 2, backlog: { calls: 0 },
      items: [category('orders', {
        label: 'Orders', unclassified: false, calls: 14, businesses: 2, share: 1,
        outcomes: { redirected: 4, neither: 9, met: 1 }, dominantOutcome: 'neither', kind: 'business_info', nextActionKind: 'business_info',
        nextAction: 'Say how orders are taken', examples: [],
      })],
    }
    const requests = {
      total: 1, calls: 1, asOf: 1761300000001,
      items: [{ requestId: 401, conversationId: 'CON-o1', callStart: rome(2026, 10, 20), businessId: 'biz-2', name: 'Forno Rossi', text: 'Can I order a cake?', outcome: 'redirected', outcomeModel: 'redirected', category: 'orders', categoryModel: 'orders', corrected: false, resolution: 'redirected' }],
    }
    const asked = await mockInsights(page, { role: 'admin', categories: view })
    const { sent } = await mockClassifications(page, { role: 'admin', categoryRequests: () => requests })
    await page.goto('/analytics-admin')
    const section = page.getByRole('region', { name: 'Callers\' requests' })
    await expect(section.getByText('Orders').first()).toBeVisible({ timeout: 15000 })
    // the not-fulfilled default is StarChat's: the dashboard's request names no outcome and no `all`
    expect(new URL(asked.categories[asked.categories.length - 1].url).searchParams.get('all')).toBeNull()
    expect(new URL(asked.categories[asked.categories.length - 1].url).searchParams.get('outcome')).toBeNull()
    await section.getByRole('button', { name: `Show the requests of Orders with outcome ${LABEL} (4)` }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'category-requests').length).toBe(1)
    expect(sent.filter((s) => s.path === 'category-requests').pop()).toMatchObject({ category: 'orders', query: { outcome: 'redirected' } })
    const list = page.getByRole('table', { name: 'Requests of Orders' })
    const row = list.getByRole('row').filter({ hasText: 'Can I order a cake?' })
    await expect(row.getByRole('button', { name: new RegExp(`^Request outcome: ${LABEL}`) })).toBeVisible({ timeout: 15000 })
  })
})
