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
      fake.getUserMedia = () => Promise.reject({
        name: 'NotAllowedError',
        message: 'Permission dismissed',
      })
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        get: () => fake,
      })
    })

    await authenticatedPage.goto('/businesses')

    // DirectVoiceButton renders once the business card loads (EN, default locale).
    const callBtn = authenticatedPage.getByRole('button', { name: 'Talk to the assistant' })
    await expect(callBtn).toBeVisible({ timeout: 20000 })

    await callBtn.click()

    // The dialog (not a toast) appears with the localized title + body.
    const dialog = authenticatedPage.locator('.p-dialog').first()
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog).toContainText('Microphone unavailable')
    await expect(dialog).toContainText('MrCall needs your microphone')

    // Exactly one OK button; clicking it closes the dialog.
    const okBtn = authenticatedPage.getByRole('button', { name: 'Got it' })
    await expect(okBtn).toBeVisible()
    await okBtn.click()
    await expect(dialog).toBeHidden({ timeout: 5000 })
  })
})
