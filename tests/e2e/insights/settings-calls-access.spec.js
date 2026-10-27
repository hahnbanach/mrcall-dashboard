// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockBusiness, mockAdminUser } = require('../fixtures/mock-data')
// the restaurant fixture answers a whole configuration page (template, variables), which this section sits in
const { mockRestaurant } = require('../fixtures/restaurant')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 10 (StarChat's brief, decisions 6 and 14): the
 * business's settings carry, for its owner, the numbers treated as spam (each deletable; deleting reverts what the rule
 * marked) and who opened the business's calls (when, what, which call, who by role and name, never an e-mail or an id),
 * paged on the server. Not shown to a reader who does not own the business.
 *
 * Seen failing, 2026-10-27, before the section existed: every case but the admin's, which passed by construction
 * and was then seen failing by perturbation (the menu entry shown to everyone).
 */
const BUSINESS_ID = mockBusiness.businessId
const section = (page) => page.getByRole('region', { name: 'Spam numbers and call access' })
const LOG = {
  total: 12, asOf: 1761300000000,
  items: Array.from({ length: 10 }, (_, i) => ({
    at: Date.UTC(2026, 9, 25, 9, i), event: i === 1 ? 'audio' : 'opened', conversationId: `CON-${i}`, businessId: BUSINESS_ID,
    callStart: Date.UTC(2026, 9, 20, 9, i), role: i % 2 ? 'reseller' : 'admin', name: i % 2 ? 'Partner Srl' : 'MrCall',
  })),
}

test.describe('the business\'s calls: spam numbers and who opened them', () => {
  test('the owner lists the numbers treated as spam and deletes one', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    const { sent } = await mockClassifications(page, { rules: [{ caller: '+393331112233', createdAt: Date.UTC(2026, 9, 20) }], accessLog: LOG })
    await page.goto(`/businessconfiguration?id=${BUSINESS_ID}&section=__CALLS_ACCESS__`)
    const rules = section(page).getByRole('list', { name: 'Numbers treated as spam' })
    await expect(rules.getByRole('listitem')).toHaveCount(1, { timeout: 15000 })
    await expect(rules.getByRole('listitem')).toContainText('+393331112233')
    await rules.getByRole('button', { name: 'Delete the rule for +393331112233' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'caller-rules' && s.method === 'DELETE').length).toBe(1)
    expect(sent.find((s) => s.method === 'DELETE').query).toEqual({ businessId: BUSINESS_ID, caller: '+393331112233' })
  })

  test('the owner reads who opened its calls, paged, by role and name, each call a link', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    const { sent } = await mockClassifications(page, { accessLog: LOG })
    await page.goto(`/businessconfiguration?id=${BUSINESS_ID}&section=__CALLS_ACCESS__`)
    const log = section(page).getByRole('table', { name: 'Who opened your calls' })
    await expect(log.getByRole('row')).toHaveCount(11, { timeout: 15000 })
    await expect(log.getByRole('row').nth(1)).toContainText('MrCall')
    await expect(log.getByRole('row').nth(1)).toContainText('Admin')
    await expect(log.getByRole('row').nth(2)).toContainText('Partner Srl')
    await expect(log.getByRole('row').nth(2)).toContainText('Recording heard')
    await expect(log.getByRole('row').nth(1).getByRole('link')).toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-0`)
    await expect(section(page).getByText('1–10 of 12')).toBeVisible()
    expect(sent.find((s) => s.path === 'access-log').query).toMatchObject({ businessId: BUSINESS_ID, from: '0', size: '10' })
  })

  test('a reader who does not own the business has no such section', async ({ page }) => {
    await setupAuthPage(page, mockAdminUser, 'admin')
    await mockRestaurant(page)
    await mockClassifications(page, { role: 'admin' })
    await page.goto(`/businessconfiguration?id=${BUSINESS_ID}`)
    // the menu is drawn (its retention entry, a synthetic page as this one is), and has no entry for this section
    await expect(page.getByText('Data retention').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Spam numbers and call access')).toHaveCount(0)
  })
})
