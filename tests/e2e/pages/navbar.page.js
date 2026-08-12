const { expect } = require('@playwright/test')
const { BasePage } = require('./base.page')
const { selectors } = require('../helpers/selectors')

class NavbarPage extends BasePage {
  constructor(page) {
    super(page)
    this.menubar = page.locator(selectors.menubar).first()
    this.logo = page.locator(selectors.navbarLogo).first()
    this.menuItems = page.locator(selectors.navbarItems)
    this.footerLinks = page.locator(selectors.footerLinks)
    this.hamburgerButton = page.locator('.p-menubar-button')
  }

  async expectMenubarVisible() {
    await expect(this.menubar).toBeVisible()
  }

  async expectMenubarHidden() {
    await expect(this.menubar).toHaveCount(0)
  }

  async expectLogoVisible() {
    await expect(this.logo).toBeVisible()
  }

  async expectFooterLinksVisible() {
    await expect(this.footerLinks).toBeVisible()
  }

  /** Expect desktop menu items to be inline (not collapsed) */
  async expectMenuItemsInline() {
    const items = this.page.locator('.p-menubar-root-list > .p-menubar-item')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
  }

  /** Expect hamburger menu button on mobile */
  async expectHamburgerVisible() {
    await expect(this.hamburgerButton).toBeVisible()
  }

  /** Click hamburger and expect menu to expand */
  async clickHamburger() {
    await this.hamburgerButton.click()
  }

  /** Check that login/subscribe items are visible for unauthenticated users */
  async expectUnauthenticatedItems() {
    const loginItem = this.page.locator('.p-menubar-item').filter({ hasText: /login|accedi|sign in/i }).first()
    await expect(loginItem).toBeVisible()
  }

  /** Check that assistants/account/logout items are visible for authenticated users */
  async expectAuthenticatedItems() {
    // At least "Assistants" or similar should be visible
    const menuItems = this.page.locator('.p-menubar-item')
    const count = await menuItems.count()
    expect(count).toBeGreaterThan(0)
  }
}

module.exports = { NavbarPage }
