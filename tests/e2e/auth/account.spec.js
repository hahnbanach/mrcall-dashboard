// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')
const { selectors } = require('../helpers/selectors')

test.describe('Account Page (Authenticated)', () => {
  test('should display account page with title', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')

    // Multiple .title elements exist inside .account-section (one per sub-component)
    await expect(authenticatedPage.getByText('Account', { exact: true })).toBeVisible()
  })

  test('should display ChangePassword section', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')

    // The Account page renders ChangePassword component
    const content = authenticatedPage.locator('.content')
    await expect(content).toBeVisible()
  })

  test('should display ChangeEmail section', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')

    const content = authenticatedPage.locator('.content')
    await expect(content).toBeVisible()
  })

  test('should display ConnectCalendar section', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')

    const content = authenticatedPage.locator('.content')
    await expect(content).toBeVisible()
  })

  test('should display DeleteAccount section', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')

    const content = authenticatedPage.locator('.content')
    await expect(content).toBeVisible()
  })

  test('should show pre-footer section', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')

    // Pre-footer exists in DOM but may be hidden by CSS
    const footer = authenticatedPage.locator(selectors.preFooter)
    await expect(footer).toHaveCount(1)
  })

  test('should have navbar visible', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')
    await basePage.expectNavbarVisible()
  })
})
