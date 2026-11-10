// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockClassifications, mockConversations, conversation, CALL_ID, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * A call's link without its business (`/conversations?conversation=<id>`, no `id=`). The dashboard's own links carry
 * both (the call email: `?id=<business>&conversation=<call>`), but a link trimmed by hand used to open the call with no
 * business. The judgements' read then went out without `businessId`, StarChat refused it (400), and the call showed no
 * chip, and the owner was taken for a reader of someone else's call. The call names its business, which the page now
 * takes as if the link had carried it. Reported by StarChat's session on v2.2.57-test.
 */
test('a call link without its business takes the business from the call', async ({ authenticatedPage: page }) => {
  const searches = await mockConversations(page, [conversation()])
  const { sent } = await mockClassifications(page)
  const reads = []
  page.on('request', (r) => { if (r.url().includes('/classifications')) reads.push(new URL(r.url()).searchParams.get('businessId')) })
  await page.goto(`/conversations?conversation=${CALL_ID}`)
  const opened = page.locator('.opened-card')
  // the owner's chips, read at once as an owner's opened call is
  await expect(opened.getByRole('button', { name: /^Resolution: Resolved/ })).toBeVisible({ timeout: 15000 })
  await expect.poll(() => sent.filter((s) => s.path === 'classifications').length).toBeGreaterThan(0)
  expect(reads.every((b) => b === BUSINESS_ID)).toBe(true)
  await expect(opened.getByText('Read-only view')).toHaveCount(0)
  // the address now names the business, and the list is the business's
  await expect(page).toHaveURL(new RegExp(`[?&]id=${BUSINESS_ID}(&|$)`))
  await expect(page).toHaveURL(new RegExp(`[?&]conversation=${CALL_ID}(&|$)`))
  expect(searches.filter((s) => s.id).length).toBe(1)
  expect(searches.filter((s) => !s.id).every((s) => s.businessId === BUSINESS_ID)).toBe(true)
})
