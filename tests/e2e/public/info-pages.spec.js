// @ts-check
const { test, expect } = require('@playwright/test')
const { BasePage } = require('../pages/base.page')

test.describe('Info Pages - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())
  })

  test('Privacy Policy page loads with content', async ({ page }) => {
    const basePage = new BasePage(page)
    const errors = basePage.collectJsErrors()

    await basePage.goto('/privacypolicy')

    // Page should have visible text content
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()

    // Should have some meaningful content
    const mainContent = page.locator('.main-page-content-section, .privacy, [class*="privacy"]').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })

    // No critical JS errors
    const criticalErrors = errors.filter(e => !e.includes('Firebase') && !e.includes('analytics'))
    expect(criticalErrors).toHaveLength(0)
  })

  test('Terms and Conditions page loads with content', async ({ page }) => {
    const basePage = new BasePage(page)
    const errors = basePage.collectJsErrors()

    await basePage.goto('/termsandconditions')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()

    const mainContent = page.locator('.main-page-content-section, .terms, [class*="terms"]').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })

    const criticalErrors = errors.filter(e => !e.includes('Firebase') && !e.includes('analytics'))
    expect(criticalErrors).toHaveLength(0)
  })

  test('Call Forwarding Guide page loads with content', async ({ page }) => {
    const basePage = new BasePage(page)
    const errors = basePage.collectJsErrors()

    await basePage.goto('/callforwardingguide')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()

    const criticalErrors = errors.filter(e => !e.includes('Firebase') && !e.includes('analytics'))
    expect(criticalErrors).toHaveLength(0)
  })

  test('Partner Program page loads with content', async ({ page }) => {
    const basePage = new BasePage(page)
    const errors = basePage.collectJsErrors()

    await basePage.goto('/partnerprogram')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()

    const criticalErrors = errors.filter(e => !e.includes('Firebase') && !e.includes('analytics'))
    expect(criticalErrors).toHaveLength(0)
  })
})
