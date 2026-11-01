// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, category, rome, BUSINESS_ID } = require('../fixtures/insights')
const { mockClassifications, mockConversations, conversation } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O1 and O2 (plan steps A2 and A3): a call and a count's calls open over
 * the analytics page, and closing them leaves the page as it was: the same address, the same history, the same scroll
 * of #app-central-content (the pages scroll inside it, not the window) and the same section still expanded. The panel
 * lists exactly the calls its count counts, and states the count. A call of a business the reader does not own opens
 * read-only; the owner's opens with its owner's view.
 *
 * Seen failing, 2026-11-01, before AnalyticsOverlayHost: "Open the call" and the counts were links, so there was no
 * button to press and following the link left the page.
 */
const QUALITY = {
  period: { from: 0, to: 0 }, extractions: { ok: 100 }, callsWithChecks: 100, checks: { caller_repeated: 7 },
  callsWithUnansweredRecorded: 100, callsWithUnanswered: 9, gaps: { missing_info: 6, needs_integration: 3 }, callsWithSkillErrors: 0,
}
const VIEW = {
  total: 1, asOf: 1761300000000, from: rome(2026, 9, 24), to: rome(2026, 10, 24), calls: 14, businesses: 2, businessesWithCalls: 2, backlog: { calls: 0 },
  items: [category('prices', {
    label: 'Prices and rates', unclassified: false, calls: 14, businesses: 2, share: 0.5, outcomes: { taken: 3, neither: 9, met: 2 },
    dominantOutcome: 'neither', kind: 'business_info', nextActionKind: 'business_info', nextAction: 'Ask the businesses to add their prices',
    examples: [{ text: 'How much is a visit?', businessId: 'biz-2', name: 'Studio Bianchi', conversationId: 'CON-p9' }],
  })],
}
const REQUESTS = {
  total: 1, calls: 1, asOf: 1761300000001,
  items: [{ requestId: 301, conversationId: 'CON-p1', callStart: rome(2026, 10, 20), businessId: 'biz-2', name: 'Studio Bianchi', text: 'How much is a whitening?', outcome: 'taken', outcomeModel: 'taken', category: 'prices', categoryModel: 'prices', corrected: false, resolution: 'forwarded' }],
}

const scrollTop = (page) => page.evaluate(() => document.getElementById('app-central-content').scrollTop)
const historyLength = (page) => page.evaluate(() => window.history.length)

test.describe('a call and a count\'s calls open over the analytics page', () => {
  test('admin: a request\'s call opens read-only over the page, and closing it leaves the page, its scroll and the open requests as they were', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin', categories: VIEW })
    await mockClassifications(page, { role: 'admin', categoryRequests: () => REQUESTS })
    await mockConversations(page, [], { byId: [conversation({ id: 'CON-p1', owner: 'someone-else', details: { summary: 'Asked the price of a whitening.' } })] })
    await page.goto('/analytics-admin')
    const section = page.getByRole('region', { name: 'Callers\' requests' })
    await section.getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    const list = page.getByRole('table', { name: 'Requests of Prices and rates' })
    const row = list.getByRole('row').filter({ hasText: 'How much is a whitening?' })
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.scrollIntoViewIfNeeded()
    const url = page.url()
    const length = await historyLength(page)
    const top = await scrollTop(page)
    expect(top).toBeGreaterThan(0)

    const trigger = row.getByRole('button', { name: 'Open the call: How much is a whitening?' })
    await trigger.click()
    const dialog = page.locator('.call-dialog')
    await expect(dialog).toContainText('Asked the price of a whitening.', { timeout: 15000 })
    await expect(dialog.getByText('Read-only view')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    // the keyboard is back where it was: on the control that opened the call
    await expect(trigger).toBeFocused()

    expect(page.url()).toBe(url)
    expect(await historyLength(page)).toBe(length)
    expect(Math.abs((await scrollTop(page)) - top)).toBeLessThanOrEqual(2)
    await expect(row).toBeVisible()
  })

  test('owner: a count opens exactly its calls in a panel stating the count; a call opens from it with the owner\'s view', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { quality: QUALITY })
    await mockClassifications(page, {})
    const docs = Array.from({ length: 6 }, (_, i) => conversation({
      id: `CON-g${i + 1}`, owner: 'test-uid-12345', startTimestamp: Date.UTC(2026, 9, 20 - i, 9, 30),
      details: { callerName: `Caller ${i + 1}`, summary: `Question ${i + 1} the assistant could not answer.` },
    }))
    const searches = await mockConversations(page, docs)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const url = page.url()
    const length = await historyLength(page)

    const count = page.getByRole('button', { name: 'Open the 6 calls: Missing information', exact: true })
    await count.click()
    const panel = page.locator('.counted-calls-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Missing information')
    await expect(panel).toContainText('6 calls')
    await expect(panel.getByRole('button', { name: /^Open the call of Caller \d/ })).toHaveCount(6)
    await expect(panel).toContainText('1–6 of 6')
    expect(searches.filter((s) => !s.id).pop()).toMatchObject({ businessId: BUSINESS_ID, counted: true, gap: 'missing_info' })

    await panel.getByRole('button', { name: /^Open the call of Caller 2,/ }).click()
    const dialog = page.locator('.call-dialog')
    await expect(dialog).toContainText('Question 2 the assistant could not answer.', { timeout: 15000 })
    await expect(dialog.getByText('Read-only view')).toHaveCount(0)
    expect(searches.filter((s) => s.id).map((s) => s.id)).toEqual(['CON-g2'])
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(count).toBeFocused()

    expect(page.url()).toBe(url)
    expect(await historyLength(page)).toBe(length)
  })

  test('reseller scope page: a request\'s example call opens read-only over the page, and closing it leaves the page as it was', async ({ resellerPage: page }) => {
    await mockInsights(page, { role: 'reseller', categories: VIEW })
    await mockClassifications(page, { role: 'reseller' })
    await mockConversations(page, [], { byId: [conversation({ id: 'CON-p9', businessId: 'biz-2', owner: 'someone-else', details: { summary: 'Asked the price of a visit.' } })] })
    await page.goto('/analytics')
    const section = page.getByRole('region', { name: 'Callers\' requests' })
    const example = section.getByRole('button', { name: 'Open the call: How much is a visit?' })
    await expect(example).toBeVisible({ timeout: 15000 })
    await example.scrollIntoViewIfNeeded()
    const url = page.url()
    const length = await historyLength(page)
    const top = await scrollTop(page)

    await example.click()
    const dialog = page.locator('.call-dialog')
    await expect(dialog).toContainText('Asked the price of a visit.', { timeout: 15000 })
    await expect(dialog.getByText('Read-only view')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(page.url()).toBe(url)
    expect(await historyLength(page)).toBe(length)
    expect(Math.abs((await scrollTop(page)) - top)).toBeLessThanOrEqual(2)
  })
})
