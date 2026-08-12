// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

test.describe('Reseller Dashboard (Reseller Role)', () => {
  test('should load reseller dashboard', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller')

    const body = resellerPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display reseller dashboard content', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller')

    await resellerPage.waitForTimeout(2000)

    const mainContent = resellerPage.locator('.reseller-dashboard').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should load invitation codes page', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller/codes')

    const body = resellerPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display invitation codes content', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller/codes')

    await resellerPage.waitForTimeout(2000)

    const mainContent = resellerPage.locator('.invitation-codes').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should load reseller profile page', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller/profile')

    const body = resellerPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display reseller profile content', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller/profile')

    await resellerPage.waitForTimeout(2000)

    const mainContent = resellerPage.locator('.reseller-profile').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should show reseller navbar items', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller')

    // Navbar should be visible for reseller
    await basePage.expectNavbarVisible()
  })

  test('should not have horizontal overflow', async ({ resellerPage }) => {
    const basePage = new BasePage(resellerPage)
    await basePage.goto('/reseller')
    await basePage.expectNoHorizontalOverflow()
  })
})
