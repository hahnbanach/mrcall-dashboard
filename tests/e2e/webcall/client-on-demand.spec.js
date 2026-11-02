// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')

/**
 * Plan docs/execution-plans/2026-10-23-dashboard-load.md, M4: the call client (MrCallWebCall, about 1.2 MB) is fetched
 * when a call starts, not with the page that shows the button. The admin's "Test webcall" on the businesses page is
 * such a button. The microphone is reported as askable, so the click goes past the blocked-microphone check to the
 * client.
 */
const WEBCALL_CHUNK = /\/js\/webcall(\.[0-9a-f]+)?\.js(\?.*)?$/
const MIC_ASKABLE = () => {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    get: () => ({ query: () => Promise.resolve({ state: 'prompt' }) }),
  })
}

test.describe('the call client is fetched when a call starts', () => {
  test('not before the click, and on it', async ({ adminPage: page }) => {
    await page.addInitScript(MIC_ASKABLE)
    const fetched = []
    page.on('request', (r) => { if (WEBCALL_CHUNK.test(r.url())) fetched.push(r.url()) })
    await page.goto('/businesses')
    const call = page.getByRole('button', { name: 'Test webcall' }).first()
    await expect(call).toBeVisible({ timeout: 20000 })
    expect(fetched, 'no call client before a call starts').toEqual([])
    await call.click()
    await expect.poll(() => fetched.length, { timeout: 15000 }).toBeGreaterThan(0)
  })

  test('a client that cannot be fetched is the start error, and the button is usable again', async ({ adminPage: page }) => {
    await page.addInitScript(MIC_ASKABLE)
    await page.route(WEBCALL_CHUNK, (route) => route.abort())
    await page.goto('/businesses')
    const call = page.getByRole('button', { name: 'Test webcall' }).first()
    await expect(call).toBeVisible({ timeout: 20000 })
    await call.click()
    await expect(page.locator('.p-toast-message').filter({ hasText: 'Error starting call' })).toBeVisible({ timeout: 15000 })
    await expect(call).toBeEnabled()
  })
})
