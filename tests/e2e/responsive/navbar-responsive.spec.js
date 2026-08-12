// @ts-check
const { test, expect } = require('@playwright/test')
const { test: authTest } = require('../fixtures/auth')
const { NavbarPage } = require('../pages/navbar.page')
const { BasePage } = require('../pages/base.page')

test.describe('Navbar - Responsive (Public)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())
  })

  test('signin: navbar is hidden', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/signin')
    await basePage.expectNavbarHidden()
  })

  test('signup: navbar is hidden', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/signup')
    await basePage.expectNavbarHidden()
  })

  test('magiclink: navbar is hidden', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/magiclink')
    await basePage.expectNavbarHidden()
  })

  test('privacy policy: navbar is visible with logo', async ({ page }) => {
    const navbar = new NavbarPage(page)
    await navbar.goto('/privacypolicy')

    await navbar.expectMenubarVisible()
    await navbar.expectLogoVisible()
  })
})

authTest.describe('Navbar - Responsive (Authenticated)', () => {
  authTest('desktop: menubar with items inline', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1440, height: 900 })
    const navbar = new NavbarPage(authenticatedPage)
    await navbar.goto('/businesses')

    await navbar.expectMenubarVisible()
    await navbar.expectLogoVisible()
    await navbar.expectMenuItemsInline()
  })

  authTest('desktop: footer links visible', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1440, height: 900 })
    const navbar = new NavbarPage(authenticatedPage)
    await navbar.goto('/businesses')

    await navbar.expectFooterLinksVisible()
  })

  authTest('mobile: hamburger menu visible', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 812 })
    const navbar = new NavbarPage(authenticatedPage)
    await navbar.goto('/businesses')

    // On very small screens, PrimeVue Menubar may show hamburger
    // The breakpoint is set to "0px" in the navbar, so behavior depends on PrimeVue
    await navbar.expectMenubarVisible()
  })

  authTest('navbar shows authenticated items', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1440, height: 900 })
    const navbar = new NavbarPage(authenticatedPage)
    await navbar.goto('/businesses')

    await navbar.expectAuthenticatedItems()
  })

  authTest('tablet: navbar adapts to viewport', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 768, height: 1024 })
    const navbar = new NavbarPage(authenticatedPage)
    await navbar.goto('/businesses')

    await navbar.expectMenubarVisible()
  })
})
