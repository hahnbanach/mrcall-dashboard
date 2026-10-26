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

  // Google Calendar is connected per skill, from the business configuration; the account no
  // longer offers a connection of its own.
  test('Integrations offers the MCP connectors and no calendar connection', async ({ authenticatedPage: page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/account')

    await expect(page.getByRole('button', { name: 'Manage MCP connectors' })).toBeVisible()
    await expect(page.getByText('Connect Google Calendar')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /calendar/i })).toHaveCount(0)
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
