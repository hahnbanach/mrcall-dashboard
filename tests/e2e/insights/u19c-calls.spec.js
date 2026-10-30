// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockAdminUser } = require('../fixtures/mock-data')
const { mockClassifications, mockConversations, conversation, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * U19r6 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md, the brief's amendment of 2026-10-30,
 * on the calls a count opens and a call opened: m3, a count's list says the count it opened, its resolution control
 * agrees with the chip, and no "Archive all" or "Delete all" is offered on it; m15, a call opened read-only offers none
 * of the owner's actions, and a web caller is named as the analytics name it, never by its identity string.
 *
 * Seen failing on c0a4e35, each case, before its repair.
 */
const from = Date.UTC(2026, 9, 1)
const to = Date.UTC(2026, 9, 28)
const docs = ['CON-a', 'CON-b', 'CON-c'].map((id) => conversation({ id }))

test.describe('m3: a count\'s list', () => {
  test('shows the count it opened, a resolution control that agrees with the chip, and no "all" action', async ({ authenticatedPage: page }) => {
    await mockConversations(page, docs)
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}&from=${from}&to=${to}&counted=true&outcomeLine=resolved`)
    const filters = page.getByRole('group', { name: 'Filters from the link' })
    await expect(filters.getByText('3 calls', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('combobox', { name: 'Resolution' })).toContainText('Resolved')
    for (const name of ['Archive All', 'Delete All']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
  })
})

test.describe('m15: a call opened', () => {
  test('read-only, by an admin: no call-back, WhatsApp or calendar action', async ({ page }) => {
    await setupAuthPage(page, mockAdminUser, 'admin')
    const full = conversation({ id: 'CON-r1', owner: 'test-uid-12345', details: { callerName: 'Rita', callerNumber: '+39 333 000 0001', summary: 'Asked about prices.', calendarLink: 'https://calendar.google.com/x', resolution: 'resolved', message: 'none', booked: false } })
    await mockConversations(page, [full])
    await mockClassifications(page, { role: 'admin' })
    await page.goto(`/conversations?id=${BUSINESS_ID}&conversation=CON-r1`)
    const opened = page.locator('.opened-card')
    await expect(opened).toContainText('Asked about prices.', { timeout: 15000 })
    await expect(opened.getByRole('link', { name: /Call back|WhatsApp|Google Calendar/ })).toHaveCount(0)
  })

  test('a web caller is named as the analytics name it', async ({ authenticatedPage: page }) => {
    const web = conversation({ id: 'CON-w1', contactNumber: 'uid:abc123:someone@example.com:Some One', contactName: undefined, details: { summary: 'A web call.', resolution: 'resolved', message: 'none', booked: false } })
    await mockConversations(page, [web])
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}&conversation=CON-w1`)
    const opened = page.locator('.opened-card')
    await expect(opened).toContainText('A web call.', { timeout: 15000 })
    await expect(opened.locator('.card-header')).toContainText('Web call')
    await expect(page.getByText(/uid:abc123/)).toHaveCount(0)
  })
})
