// @ts-check
const { expect } = require('@playwright/test')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O1: on an analytics page "Open the call" opens the call over the page.
 * What a link's href used to prove (this business, this call) is proved here by the read the dialog makes: clicking
 * `button` opens `.call-dialog`, which reads exactly `conversationId` of `businessId`; closing it leaves the address as
 * it was. The read is answered here (a call of that id), registered last so that it is the route Playwright tries first.
 */
async function opensCall (page, button, { businessId, conversationId }) {
  const asked = []
  const handler = (route) => {
    const body = route.request().postDataJSON() || {}
    if (!body.id) return route.fallback()
    asked.push(body)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalHits: 1, hitsCount: 1, maxScore: 1, hits: [{ document: { id: body.id, businessId: body.businessId, startTimestamp: Date.UTC(2026, 9, 20, 9, 30), details: { summary: 'The call opened.' } } }] })
    })
  }
  await page.route('**/customer/conversation/search*', handler)
  const before = page.url()
  await expect(button).toBeVisible({ timeout: 15000 })
  await button.click()
  const dialog = page.locator('.call-dialog')
  await expect(dialog).toBeVisible()
  await expect.poll(() => asked.map((b) => [b.businessId, b.id])).toContainEqual([businessId, conversationId])
  await expect(dialog).toContainText('The call opened.')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(page.url()).toBe(before)
  await page.unroute('**/customer/conversation/search*', handler)
}

module.exports = { opensCall }
