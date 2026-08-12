const { expect } = require('@playwright/test')
const { selectors } = require('../helpers/selectors')

class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
  }

  /** Wait for the app to mount and render */
  async waitForApp() {
    await this.page.waitForSelector('#app', { state: 'attached' })
    // Wait for Vue to hydrate - the app div should have child content
    await this.page.waitForFunction(() => {
      const app = document.querySelector('#app')
      return app && app.children.length > 0
    }, { timeout: 15000 })
  }

  /** Check that the navbar is visible */
  async expectNavbarVisible() {
    await expect(this.page.locator(selectors.navbar).first()).toBeVisible()
  }

  /** Check that the navbar is hidden */
  async expectNavbarHidden() {
    await expect(this.page.locator(selectors.navbar)).toHaveCount(0)
  }

  /** Check that the logo is visible in the navbar */
  async expectLogoVisible() {
    await expect(this.page.locator(selectors.navbarLogo).first()).toBeVisible()
  }

  /** Assert no horizontal overflow on the page */
  async expectNoHorizontalOverflow() {
    // Poll instead of measuring once. A single reading right after navigation
    // catches whatever width the page happens to have mid-layout, and on WebKit
    // under parallel load that is sometimes a table or grid that has rendered
    // before the CSS constraining it applies. The assertion we care about is that
    // the page settles without overflow, not that it never overflows for a frame.
    await expect.poll(
      () => this.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
      { timeout: 10000, message: 'page still overflows horizontally after settling' }
    ).toBeLessThanOrEqual(0)
  }

  /** Assert no JavaScript errors were logged (call after page load) */
  /**
   * Collect page errors caused by our own code.
   *
   * Errors raised inside third-party embeds are dropped here rather than at each
   * call site. The one that forced this: WebKit reports Google Tag Manager's
   * cross-origin frame access as a page error, because the dev server is http and
   * the GTM frame is https, while Chromium stays quiet about it. That is a fact
   * about running GTM against a local server, not about the page under test, and
   * it made otherwise green smoke tests fail on the tablet and mobile projects
   * only.
   */
  collectJsErrors() {
    const thirdParty = [
      'googletagmanager.com',
      'google-analytics.com',
      'googleapis.com',
      'doubleclick.net',
      'Firebase',
      'analytics',
    ]
    const errors = []
    this.page.on('pageerror', (error) => {
      const message = error.message
      if (thirdParty.some(origin => message.includes(origin))) return
      errors.push(message)
    })
    return errors
  }

  /** Navigate to a path and wait for the app */
  async goto(path) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' })
    await this.waitForApp()
  }

  /** Take a full-page screenshot for visual regression */
  async takeScreenshot(name) {
    return this.page.screenshot({
      fullPage: true,
      path: `tests/screenshots/baseline/${name}.png`,
    })
  }

  /** Get computed style of an element */
  async getComputedStyle(selector, property) {
    return this.page.locator(selector).first().evaluate(
      (el, prop) => window.getComputedStyle(el)[prop],
      property
    )
  }

  /** Check minimum font size on all visible text */
  async expectMinFontSize(minPx = 12) {
    const tooSmall = await this.page.evaluate((min) => {
      const elements = document.querySelectorAll('body *')
      for (const el of elements) {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) continue
        const text = el.textContent?.trim()
        if (!text) continue
        const fontSize = parseFloat(window.getComputedStyle(el).fontSize)
        if (fontSize < min) return { el: el.tagName, fontSize, text: text.slice(0, 50) }
      }
      return null
    }, minPx)
    expect(tooSmall).toBeNull()
  }
}

module.exports = { BasePage }
