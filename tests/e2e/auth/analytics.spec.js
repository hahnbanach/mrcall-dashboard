// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

test.describe('Analytics Page (Authenticated)', () => {
  test('should load analytics page', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/analytics?id=test-biz-001')

    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display analytics content', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/analytics?id=test-biz-001')

    await authenticatedPage.waitForTimeout(2000)

    const mainContent = authenticatedPage.locator('.main-page-content-section').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should have navbar visible', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/analytics?id=test-biz-001')
    await basePage.expectNavbarVisible()
  })

  test('should not have horizontal overflow', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/analytics?id=test-biz-001')
    await basePage.expectNoHorizontalOverflow()
  })
})

// The business page asks for the time series and the heatmap in the browser's zone. v2.2.8 changed
// the client to take a zone for the series and this page kept calling it without one, so it sent
// timezone=undefined and StarChat answered 400 in production (2026-10-04). Seen failing against
// that version (the series request carries "undefined"), and with only the page's fix reverted
// (the client refuses the call, so no series request is made).
test.describe('Analytics time zone (business page)', () => {
  test.use({ timezoneId: 'Asia/Tokyo' })

  test('the time series and the heatmap carry the browser time zone', async ({ authenticatedPage }) => {
    const seen = []
    await authenticatedPage.route('**/customer/analytics/**', (route) => {
      const url = new URL(route.request().url())
      seen.push({ endpoint: url.pathname.split('/').pop(), timezone: url.searchParams.get('timezone') })
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await authenticatedPage.goto('/analytics?id=test-biz-001')

    // Each endpoint on its own: a page that skipped the series would otherwise pass on two heatmaps.
    await expect.poll(() => seen.some(r => r.endpoint === 'timeseries')).toBe(true)
    await expect.poll(() => seen.some(r => r.endpoint === 'hourly-heatmap')).toBe(true)
    for (const r of seen.filter(r => r.endpoint === 'timeseries' || r.endpoint === 'hourly-heatmap')) {
      expect(r.timezone, r.endpoint).toBe('Asia/Tokyo')
    }
  })
})
