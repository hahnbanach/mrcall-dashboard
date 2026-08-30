// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')

// Verifies the mic-permission popup end-to-end: a denied/dismissed microphone
// prompt must open the localized dialog (title + body + OK), not stack two raw
// English toasts. Headless Chromium cannot dismiss a real permission bubble, so
// getUserMedia is stubbed to reject with the NotAllowedError shape a denied
// prompt produces — the exact failure mode the classifier must catch.
//
// `getUserMedia` is a non-configurable read-only property on MediaDevices in
// modern Chromium, so Object.defineProperty on it throws and crashes the page
// boot. Replacing the `navigator.mediaDevices` getter with a fake that inherits
// from the real one (so enumerateDevices etc. still work) is the only override
// that survives.
test.describe('Mic permission failure popup', () => {
  test('denied mic opens the localized dialog, not a raw toast', async ({ authenticatedPage }) => {
    await authenticatedPage.addInitScript(() => {
      const real = navigator.mediaDevices
      const fake = Object.create(real)
      window.__gumCalls = 0
      fake.getUserMedia = () => {
        window.__gumCalls++
        return Promise.reject({
          name: 'NotAllowedError',
          message: 'Permission dismissed',
        })
      }
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        get: () => fake,
      })
      // Playwright's default mic state is 'denied', which would route the flow
      // to the pre-check branch. Force 'prompt' so this exercises what it means
      // to: a dismissal, where a retry re-arms the browser prompt.
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        get: () => ({ query: () => Promise.resolve({ state: 'prompt' }) }),
      })
    })

    await authenticatedPage.goto('/businesses')

    // DirectVoiceButton renders once the business card loads (EN, default locale).
    const callBtn = authenticatedPage.getByRole('button', { name: 'Talk to the assistant' })
    await expect(callBtn).toBeVisible({ timeout: 20000 })

    await callBtn.click()

    // The dialog (not a toast) appears with the localized title + the
    // dismissal-specific body (permissions state forced to 'prompt' above, so
    // the post-error Permissions API check reads the rejection as a dismissal).
    const dialog = authenticatedPage.locator('.p-dialog').first()
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog).toContainText('Microphone unavailable')
    await expect(dialog).toContainText('permission request was closed')

    // Chrome discards the permission bubble on any click in the page, so by the
    // time the dialog shows the request is dead: Retry is what fires a fresh
    // getUserMedia. The stub keeps rejecting, so the dialog comes back — do NOT
    // assert a hidden gap in between, close-and-reopen is a race by design.
    const retryBtn = authenticatedPage.getByRole('button', { name: 'Try again' })
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()
    await expect.poll(() => authenticatedPage.evaluate(() => window.__gumCalls)).toBe(2)
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // The close button dismisses the dialog without re-requesting.
    const okBtn = authenticatedPage.getByRole('button', { name: 'Got it' })
    await expect(okBtn).toBeVisible()
    await okBtn.click()
    await expect(dialog).toBeHidden({ timeout: 5000 })
    expect(await authenticatedPage.evaluate(() => window.__gumCalls)).toBe(2)
  })

  // With the mic permission persistently blocked, getUserMedia would reject
  // instantly with no bubble and nothing for the user to act on: the pre-check
  // must open the padlock-instructions dialog WITHOUT ever calling getUserMedia.
  test('blocked mic opens the padlock dialog without calling getUserMedia', async ({ authenticatedPage }) => {
    await authenticatedPage.addInitScript(() => {
      window.__gumCalls = 0
      const real = navigator.mediaDevices
      const fake = Object.create(real)
      fake.getUserMedia = () => {
        window.__gumCalls++
        return Promise.reject({ name: 'NotAllowedError', message: 'Permission denied' })
      }
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: () => fake })
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        get: () => ({ query: () => Promise.resolve({ state: 'denied' }) }),
      })
    })

    await authenticatedPage.goto('/businesses')
    const callBtn = authenticatedPage.getByRole('button', { name: 'Talk to the assistant' })
    await expect(callBtn).toBeVisible({ timeout: 20000 })
    await callBtn.click()

    const dialog = authenticatedPage.locator('.p-dialog').first()
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog).toContainText('padlock')
    expect(await authenticatedPage.evaluate(() => window.__gumCalls)).toBe(0)
  })
})
