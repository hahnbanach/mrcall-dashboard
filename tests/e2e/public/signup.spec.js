// @ts-check
const { test, expect } = require('@playwright/test')
const { SignupPage } = require('../pages/signup.page')

test.describe('Signup Page', () => {
  let signupPage

  test.beforeEach(async ({ page }) => {
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())

    signupPage = new SignupPage(page)
    await signupPage.goto()
  })

  test('should display the signup form with email and password fields', async () => {
    await signupPage.expectFormVisible()
  })

  test('should show validation error when submitting empty form', async ({ page }) => {
    await signupPage.submit()
    const invalidFields = page.locator('.p-invalid')
    await expect(invalidFields.first()).toBeVisible({ timeout: 5000 })
  })

  test('should show validation error for invalid email', async ({ page }) => {
    await signupPage.fillEmail('bad-email')
    await signupPage.fillPassword('password123')
    await signupPage.submit()
    const emailError = page.locator('#email-error')
    await expect(emailError).toBeVisible({ timeout: 5000 })
  })

  test('should have a link to sign in page', async ({ page }) => {
    const link = page.locator('a[href="/signin"]')
    await expect(link).toBeVisible()
  })

  test('should display Google Sign In option', async ({ page }) => {
    const googleElement = page.locator('[class*="google"], [class*="Google"]').first()
    await expect(googleElement).toBeVisible({ timeout: 5000 })
  })

  test('should not show navbar on signup page', async () => {
    await signupPage.expectNavbarHidden()
  })

  test('should have divider between form and Google sign-in', async ({ page }) => {
    const divider = page.locator('.divider')
    await expect(divider).toBeVisible()
  })
})
