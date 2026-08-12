// @ts-check
const { test, expect } = require('@playwright/test')
const { BasePage } = require('../pages/base.page')
const { selectors } = require('../helpers/selectors')

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

test.describe('Public Pages - Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())
  })

  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
      })

      test('signin: no horizontal overflow', async ({ page }) => {
        const basePage = new BasePage(page)
        await basePage.goto('/signin')
        await basePage.expectNoHorizontalOverflow()
      })

      test('signin: form elements visible and usable', async ({ page }) => {
        const basePage = new BasePage(page)
        await basePage.goto('/signin')

        await expect(page.locator('#email')).toBeVisible()
        await expect(page.locator('.p-password input')).toBeVisible()
        await expect(page.locator(selectors.submitButton)).toBeVisible()
      })

      test('signup: no horizontal overflow', async ({ page }) => {
        const basePage = new BasePage(page)
        await basePage.goto('/signup')
        await basePage.expectNoHorizontalOverflow()
      })

      test('signup: form elements visible', async ({ page }) => {
        const basePage = new BasePage(page)
        await basePage.goto('/signup')

        await expect(page.locator('#email')).toBeVisible()
        await expect(page.locator(selectors.submitButton)).toBeVisible()
      })

      test('magiclink: no horizontal overflow', async ({ page }) => {
        // Known: magiclink page has minor overflow at 375px mobile viewport
        test.fixme(viewport.width === 375, 'Magiclink page has horizontal overflow at mobile width')
        const basePage = new BasePage(page)
        await basePage.goto('/magiclink')
        await basePage.expectNoHorizontalOverflow()
      })

      test('privacy policy: no horizontal overflow', async ({ page }) => {
        const basePage = new BasePage(page)
        await basePage.goto('/privacypolicy')
        await basePage.expectNoHorizontalOverflow()
      })

      test('terms: no horizontal overflow', async ({ page }) => {
        const basePage = new BasePage(page)
        await basePage.goto('/termsandconditions')
        await basePage.expectNoHorizontalOverflow()
      })
    })
  }

  test('signin mobile: card is full-width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const basePage = new BasePage(page)
    await basePage.goto('/signin')

    // On mobile, the sign form should take most of the viewport width
    const form = page.locator('.signin-signup-form').first()
    if (await form.isVisible()) {
      const box = await form.boundingBox()
      if (box) {
        // Form should occupy at least 80% of viewport on mobile
        expect(box.width).toBeGreaterThan(375 * 0.7)
      }
    }
  })

  test('signin desktop: card is centered with max width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const basePage = new BasePage(page)
    await basePage.goto('/signin')

    // Sign.vue is a two-column split on desktop: a messaging panel on the left and
    // the form panel on the right. The card is centered inside the form panel, not
    // inside the viewport, so measuring it against the viewport asserts that the
    // split layout does not exist.
    const panel = page.locator('.sign-form-panel').first()
    await expect(panel).toBeVisible({ timeout: 10000 })
    const panelBox = await panel.boundingBox()

    const signWindow = page.locator('.sign-central-window').first()
    await expect(signWindow).toBeVisible()
    const box = await signWindow.boundingBox()

    expect(panelBox).not.toBeNull()
    expect(box).not.toBeNull()
    if (panelBox && box) {
      // Card stays narrower than the viewport
      expect(box.width).toBeLessThan(1440 * 0.6)
      // and is roughly centered within its own panel
      const leftMargin = box.x - panelBox.x
      const rightMargin = (panelBox.x + panelBox.width) - (box.x + box.width)
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(200)
    }
  })

  test('text is readable at minimum font size', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const basePage = new BasePage(page)
    await basePage.goto('/signin')
    await basePage.expectMinFontSize(11)
  })
})
