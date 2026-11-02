// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const authPages = [
  { name: 'businesses', path: '/businesses' },
  { name: 'account', path: '/account' },
  { name: 'onboarding-lang', path: '/onboardinglang' },
]

test.describe('Visual Regression - Authenticated Pages', () => {
  for (const viewport of viewports) {
    for (const pageInfo of authPages) {
      test(`${pageInfo.name} at ${viewport.name} matches screenshot`, async ({ authenticatedPage }) => {
        await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height })
        await authenticatedPage.goto(pageInfo.path, { waitUntil: 'domcontentloaded' })

        // Wait for app to render
        // the mounted app and its first page, not the splash index.html carries inside #app (load work, M6)
        await authenticatedPage.waitForSelector('#app-container, .app-first-page-failed', { state: 'attached', timeout: 15000 })

        // Wait for animations/transitions to settle (longer for parallel runs)
        await authenticatedPage.waitForTimeout(2000)

        await expect(authenticatedPage).toHaveScreenshot(
          `${pageInfo.name}-${viewport.name}.png`,
          {
            maxDiffPixels: 200,
            threshold: 0.3,
            fullPage: true,
          }
        )
      })
    }
  }
})
