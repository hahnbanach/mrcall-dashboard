// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockAdminUser } = require('../fixtures/mock-data')
const { mockRestaurant, openRestaurant, tomorrowDinner } = require('../fixtures/restaurant')
const { mockClassifications, judged } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 1 and 11, and its amendment of 2026-10-27, item 7: the
 * call a restaurant booking carries, read from the bookings page, is drawn with its judgements as chips and an undo, as
 * on the conversations page; for a reader who does not own the business it opens read-only, its recording from the
 * one-time link, its judgements read only when the person opens one. The dialog was opened on purpose, so an owner's
 * call reads its judgements at once.
 *
 * Seen failing, 2026-10-27, on cff5331, where the dialog drew today's panel: both cases (no chip for the owner; for the
 * admin the recording read by id a second time).
 */
async function readTheCall (page) {
  await page.getByRole('button', { name: 'Next day' }).waitFor({ timeout: 15000 })
  await tomorrowDinner(page)
  await page.locator('.brow', { hasText: 'Rossi' }).click()
  await page.locator('.panel').getByRole('button', { name: 'Read the call' }).click()
  return page.locator('.restaurant-call-dialog')
}

test('the owner reads a booking\'s call with its judgements as chips, and undoes a correction', async ({ authenticatedPage: page }) => {
  await mockRestaurant(page)
  const { sent } = await mockClassifications(page, { calls: { 'CON-moved': judged({ conversationId: 'CON-moved', requests: [] }) } })
  await openRestaurant(page)
  const dialog = await readTheCall(page)
  const chip = dialog.getByRole('button', { name: /^Resolution: Resolved/ })
  await expect(chip).toBeVisible({ timeout: 15000 })
  await chip.click()
  await page.getByRole('listbox').getByRole('option', { name: 'Unresolved', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /^Resolution: Unresolved, Corrected/ })).toBeVisible()
  const bar = page.getByRole('status').filter({ hasText: 'Changed' })
  await expect(bar).toBeVisible()
  await bar.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => sent.filter((s) => s.path === 'gesture-revert').length).toBe(1)
  await expect(dialog.getByRole('button', { name: /^Resolution: Resolved$/ })).toBeVisible()
})

test('a reader who does not own the business reads the call read-only, its recording from the one-time link', async ({ page }) => {
  await setupAuthPage(page, mockAdminUser, 'admin')
  const { calls } = await mockRestaurant(page)
  const { sent } = await mockClassifications(page, { role: 'admin' })
  await openRestaurant(page)
  const dialog = await readTheCall(page)
  await expect(dialog).toContainText('Asked to move the booking', { timeout: 15000 })
  await expect(dialog.getByText('Read-only view')).toBeVisible()
  const byId = calls.filter((c) => c.path === '/conversation/search').length
  await dialog.getByRole('button', { name: 'Listen' }).click()
  await expect(dialog.locator('audio')).toHaveAttribute('src', /DASHBOARD-AUDIO-LINK/)
  expect(calls.filter((c) => c.path === '/conversation/search').length).toBe(byId)
  expect(sent.filter((s) => s.path === 'classifications')).toEqual([])
})
