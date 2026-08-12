// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

test.describe('Contacts Page (Authenticated)', () => {
  test('should load contacts page', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/contacts?id=test-biz-001')

    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display contact data from mock', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/contacts?id=test-biz-001')

    await authenticatedPage.waitForTimeout(2000)

    const mainContent = authenticatedPage.locator('.main-page-content-section').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should have navbar visible', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/contacts?id=test-biz-001')
    await basePage.expectNavbarVisible()
  })

  test('should not have horizontal overflow', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/contacts?id=test-biz-001')
    await basePage.expectNoHorizontalOverflow()
  })
})
