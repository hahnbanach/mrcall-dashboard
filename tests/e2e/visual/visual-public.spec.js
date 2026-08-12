// @ts-check
const { test, expect } = require('@playwright/test')

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const publicPages = [
  { name: 'signin', path: '/signin' },
  { name: 'signup', path: '/signup' },
  { name: 'magiclink', path: '/magiclink' },
  { name: 'privacy', path: '/privacypolicy' },
  { name: 'terms', path: '/termsandconditions' },
]

test.describe('Visual Regression - Public Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())
  })

  for (const viewport of viewports) {
    for (const pageInfo of publicPages) {
      test(`${pageInfo.name} at ${viewport.name} matches screenshot`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' })

        // Wait for app to render
        await page.waitForSelector('#app', { state: 'attached' })
        await page.waitForFunction(() => {
          const app = document.querySelector('#app')
          return app && app.children.length > 0
        }, { timeout: 15000 })

        // Wait for animations/transitions to settle
        await page.waitForTimeout(1000)

        await expect(page).toHaveScreenshot(
          `${pageInfo.name}-${viewport.name}.png`,
          {
            maxDiffPixels: 100,
            threshold: 0.2,
            fullPage: true,
          }
        )
      })
    }
  }
})
