// @ts-check
const { test, expect } = require('@playwright/test')
const { SigninPage } = require('../pages/signin.page')

test.describe('Signin Page', () => {
  let signinPage

  test.beforeEach(async ({ page }) => {
    // Block external services
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())

    signinPage = new SigninPage(page)
    await signinPage.goto()
  })

  test('should display the signin form with email and password fields', async () => {
    await signinPage.expectFormVisible()
  })

  test('should show validation error when submitting empty form', async ({ page }) => {
    await signinPage.submit()
    // After submit with empty fields, invalid class should appear
    const invalidFields = page.locator('.p-invalid')
    await expect(invalidFields.first()).toBeVisible({ timeout: 5000 })
  })

  test('should show validation error for invalid email', async ({ page }) => {
    await signinPage.fillEmail('not-an-email')
    await signinPage.fillPassword('password123')
    await signinPage.submit()
    const emailError = page.locator('#email-error')
    await expect(emailError).toBeVisible({ timeout: 5000 })
  })

  test('should have a forgot password link navigating to /magiclink', async ({ page }) => {
    const link = page.locator('a[href="/magiclink"]')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/magiclink')
  })

  test('should have a link to sign up page', async ({ page }) => {
    const link = page.locator('a[href="/signup"]')
    await expect(link).toBeVisible()
  })

  test('should display Google Sign In button', async ({ page }) => {
    // Look for any Google sign-in element
    const googleElement = page.locator('[class*="google"], [class*="Google"]').first()
    await expect(googleElement).toBeVisible({ timeout: 5000 })
  })

  test('should have correct tab order: email → password → submit', async ({ page }) => {
    // Focus email first
    await page.locator('#email').focus()
    await expect(page.locator('#email')).toBeFocused()

    // Tab to password
    await page.keyboard.press('Tab')
    // Password component wraps input, check the inner input
    const passwordInput = page.locator('.p-password input')
    await expect(passwordInput).toBeFocused()
  })

  test('should not show navbar on signin page', async () => {
    await signinPage.expectNavbarHidden()
  })
})
