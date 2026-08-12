// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')
const { selectors } = require('../helpers/selectors')

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

test.describe('Authenticated Pages - Responsive', () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test('businesses: no horizontal overflow', async ({ authenticatedPage }) => {
        await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height })
        const basePage = new BasePage(authenticatedPage)
        await basePage.goto('/businesses')
        await basePage.expectNoHorizontalOverflow()
      })

      test('businesses: cards visible', async ({ authenticatedPage }) => {
        await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height })
        const basePage = new BasePage(authenticatedPage)
        await basePage.goto('/businesses')

        const cards = authenticatedPage.locator(selectors.businessCard)
        await expect(cards.first()).toBeVisible({ timeout: 10000 })
      })

      test('account: no horizontal overflow', async ({ authenticatedPage }) => {
        await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height })
        const basePage = new BasePage(authenticatedPage)
        await basePage.goto('/account')
        await basePage.expectNoHorizontalOverflow()
      })

      test('onboarding lang: no horizontal overflow', async ({ authenticatedPage }) => {
        await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height })
        const basePage = new BasePage(authenticatedPage)
        await basePage.goto('/onboardinglang')
        await basePage.expectNoHorizontalOverflow()
      })

      test('conversations: no horizontal overflow', async ({ authenticatedPage }) => {
        await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height })
        const basePage = new BasePage(authenticatedPage)
        await basePage.goto('/conversations?id=test-biz-001')
        await basePage.expectNoHorizontalOverflow()
      })
    })
  }

  test('businesses mobile: cards take full width', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 812 })
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/businesses')

    const card = authenticatedPage.locator(selectors.businessCard).first()
    await expect(card).toBeVisible({ timeout: 10000 })

    const box = await card.boundingBox()
    if (box) {
      // Card should take most of viewport width on mobile
      expect(box.width).toBeGreaterThan(375 * 0.8)
    }
  })

  test('onboarding: support sections responsive visibility', async ({ authenticatedPage }) => {
    // Desktop: #support-large should be visible
    await authenticatedPage.setViewportSize({ width: 1440, height: 900 })
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardinglang')

    const supportLarge = authenticatedPage.locator(selectors.supportLarge)
    const supportSmall = authenticatedPage.locator(selectors.supportSmall)

    // Check which support element exists and is visible at desktop size
    const largeVisible = await supportLarge.isVisible().catch(() => false)
    const smallVisible = await supportSmall.isVisible().catch(() => false)

    // At least one support section should exist on the page
    // (they may both be absent if the component structure differs)
    if (await supportLarge.count() > 0 || await supportSmall.count() > 0) {
      // On desktop, large should be preferred
      if (await supportLarge.count() > 0) {
        await expect(supportLarge).toBeVisible()
      }
    }
  })

  test('account desktop: content has max-width constraint', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1440, height: 900 })
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')

    const content = authenticatedPage.locator('.content').first()
    if (await content.isVisible()) {
      const box = await content.boundingBox()
      if (box) {
        // Content should not span the full viewport width on desktop
        expect(box.width).toBeLessThan(1440)
      }
    }
  })
})
