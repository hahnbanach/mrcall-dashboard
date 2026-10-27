// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockAdminUser, mockResellerUser } = require('../fixtures/mock-data')
const { mockClassifications, mockConversations, conversation, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 11 (StarChat's brief, decision 14): a reseller or an
 * admin listing an owner's calls gets reduced rows (no transcript, no body, a masked number; StarChat
 * `ConversationAccess.reduced`). The page says it is read-only and draws no owner-only control (archive, delete, read
 * mark, export, bulk archive and delete). Nothing is read by id, and no judgements, until the person opens a call: that
 * read is the recorded one. An opened call's recording comes from the one-time link. The business of the fixture is
 * owned by the owner `test-uid-12345`; the admin and the reseller are not it.
 *
 * Seen failing, 2026-10-27, before the non-owner view existed in Conversations.vue and CallDetailsPanel.vue: every case
 * (the owner-only controls drawn; no "Open the call"; the recording read by id).
 */
const reduced = (id, name) => ({
  id, businessId: BUSINESS_ID, startTimestamp: Date.UTC(2026, 9, 20, 9, 30), contactNumber: '+39****001', duration: 61000,
  details: { resolution: 'resolved', message: 'none', booked: false, fields: [], previousCalls: [], topics: [], unanswered: [], checks: {}, unkept: [] },
  requestCategories: ['prices'], archived: false, deleted: false,
})
const full = conversation({ id: 'CON-r1', owner: 'test-uid-12345', details: { callerName: 'Rita', summary: 'Asked about prices.', resolution: 'resolved', message: 'none', booked: false } })

for (const role of ['admin', 'reseller']) {
  test.describe(`a ${role} reading an owner's calls`, () => {
    const signIn = (page) => setupAuthPage(page, role === 'admin' ? mockAdminUser : mockResellerUser, role)

    test('the list is read-only, with no owner-only control and nothing read by id until a call is opened', async ({ page }) => {
      await signIn(page)
      const searches = await mockConversations(page, [reduced('CON-r1'), reduced('CON-r2')], { byId: [full] })
      const { sent } = await mockClassifications(page, { role })
      await page.goto(`/conversations?id=${BUSINESS_ID}`)
      await expect(page.getByText('Read-only view')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.conversation-card')).toHaveCount(2)
      // the owner-only controls: each row's archive, delete and read mark, the exports, archive and delete all
      await expect(page.locator('.conversation-card .desktop-actions, .conversation-card .mobile-action-trigger, .conversation-card .action-btn-read')).toHaveCount(0)
      for (const name of ['Archive All', 'Delete All', 'Mark as read', 'Mark as unread', 'TSV', 'JSON']) {
        await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
      }
      await page.waitForTimeout(1500)
      expect(searches.filter((s) => s.id)).toEqual([])
      expect(sent.filter((s) => s.path === 'classifications')).toEqual([])
      await page.locator('.conversation-card').first().getByRole('button', { name: 'Open the call' }).click()
      await expect(page.locator('.opened-card')).toContainText('Asked about prices.', { timeout: 15000 })
      expect(searches.filter((s) => s.id).map((s) => s.id)).toEqual(['CON-r1'])
      await expect(page.locator('.opened-card').getByText('Read-only view')).toBeVisible()
    })

    test('an opened call\'s recording comes from the one-time link', async ({ page }) => {
      await signIn(page)
      const searches = await mockConversations(page, [reduced('CON-r1')], { byId: [full] })
      const { sent } = await mockClassifications(page, { role })
      await page.goto(`/conversations?id=${BUSINESS_ID}&conversation=CON-r1`)
      const opened = page.locator('.opened-card')
      await expect(opened).toContainText('Asked about prices.', { timeout: 15000 })
      const byIdBefore = searches.filter((s) => s.id).length
      await opened.getByRole('button', { name: 'Listen' }).click()
      await expect(opened.locator('audio')).toHaveAttribute('src', 'https://test.example/session/audio/x/y/DASHBOARD-AUDIO-LINK/1.mp3')
      expect(sent.filter((s) => s.path === 'audio')).toEqual([{ method: 'POST', path: 'audio', query: { id: 'CON-r1' } }])
      expect(searches.filter((s) => s.id).length).toBe(byIdBefore)
    })
  })
}

test('the owner\'s own list keeps every control and reads its recording as before', async ({ authenticatedPage: page }) => {
  await mockConversations(page, [conversation({ id: 'CON-o1', contactName: 'Olga', details: { callerName: 'Olga', summary: 'Own call.' } })])
  await mockClassifications(page)
  await page.goto(`/conversations?id=${BUSINESS_ID}`)
  await expect(page.locator('.conversation-card')).toHaveCount(1, { timeout: 15000 })
  await expect(page.getByText('Read-only view')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'TSV' })).toBeVisible()
})
