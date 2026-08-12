// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

test.describe('Admin Pages (Admin Role)', () => {
  test('should load reseller management page', async ({ adminPage }) => {
    const basePage = new BasePage(adminPage)
    await basePage.goto('/admin/resellers')

    const body = adminPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display reseller management content', async ({ adminPage }) => {
    const basePage = new BasePage(adminPage)
    await basePage.goto('/admin/resellers')

    await adminPage.waitForTimeout(2000)

    const mainContent = adminPage.locator('.reseller-list').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should load provision reseller page', async ({ adminPage }) => {
    const basePage = new BasePage(adminPage)
    await basePage.goto('/admin/resellers/new')

    const body = adminPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should load user role management page', async ({ adminPage }) => {
    const basePage = new BasePage(adminPage)
    await basePage.goto('/admin/users')

    const body = adminPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display user role management content', async ({ adminPage }) => {
    const basePage = new BasePage(adminPage)
    await basePage.goto('/admin/users')

    await adminPage.waitForTimeout(2000)

    const mainContent = adminPage.locator('.user-role-management').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should show admin navbar items', async ({ adminPage }) => {
    const basePage = new BasePage(adminPage)
    await basePage.goto('/admin/resellers')

    await basePage.expectNavbarVisible()
  })

  test('should not have horizontal overflow on admin pages', async ({ adminPage }) => {
    const basePage = new BasePage(adminPage)
    const pages = ['/admin/resellers', '/admin/users']

    for (const path of pages) {
      await basePage.goto(path)
      await basePage.expectNoHorizontalOverflow()
    }
  })
})
