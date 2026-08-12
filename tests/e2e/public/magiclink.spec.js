// @ts-check
const { test, expect } = require('@playwright/test')
const { BasePage } = require('../pages/base.page')

test.describe('Magic Link Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())
  })

  test('should display the magic link form with email input', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/magiclink')

    // The email input uses placeholder text, find it by role or placeholder
    const emailInput = page.locator('input[placeholder*="email" i], input[placeholder*="Email" i], .p-inputtext').first()
    await expect(emailInput).toBeVisible()
  })

  test('should have a submit button', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/magiclink')

    const submitButton = page.locator('button[type="submit"].signin-signup-button-text')
    await expect(submitButton).toBeVisible()
  })

  test('should show validation error for empty email', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/magiclink')

    // Submit with empty email
    const submitButton = page.locator('button[type="submit"].signin-signup-button-text')
    await submitButton.click()

    const invalidField = page.locator('.p-invalid')
    await expect(invalidField.first()).toBeVisible({ timeout: 5000 })
  })

  test('should display Magic link title', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/magiclink')

    // The page title "Magic link" is visible
    await expect(page.getByText(/magic link/i).first()).toBeVisible()
  })

  test('should not show navbar on magic link page', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/magiclink')
    await basePage.expectNavbarHidden()
  })
})
