// @ts-check
/**
 * UI Audit Screenshot Capture
 *
 * Captures full-page screenshots of all dashboard pages at 3 viewports
 * for manual visual review. This is NOT visual regression testing —
 * it simply saves PNGs for human inspection.
 *
 * Run:
 *   npx playwright test tests/e2e/visual/ui-audit.spec.js --project=desktop
 *   npx playwright test tests/e2e/visual/ui-audit.spec.js  (all viewports)
 */

const { test, setupAuthPage } = require('../fixtures/auth')
const { mockUser, mockBusiness } = require('../fixtures/mock-data')
const { BasePage } = require('../pages/base.page')
const path = require('path')

const AUDIT_DIR = path.join('tests', 'screenshots', 'audit')

/** Map Playwright project names to short viewport labels */
function viewportLabel(page) {
  const vp = page.viewportSize()
  if (!vp) return 'unknown'
  if (vp.width >= 1440) return 'desktop'
  if (vp.width >= 768) return 'tablet'
  return 'mobile'
}

async function captureScreenshot(page, name) {
  const label = viewportLabel(page)
  const filePath = path.join(AUDIT_DIR, `${name}-${label}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
}

// ─── Authenticated pages ─────────────────────────────────────────────

test.describe('UI Audit - Authenticated Pages', () => {

  test('capture /businesses', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/businesses')
    await authenticatedPage.waitForTimeout(1000)
    await captureScreenshot(authenticatedPage, 'businesses')
  })

  test('capture /account', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/account')
    await authenticatedPage.waitForTimeout(1000)
    await captureScreenshot(authenticatedPage, 'account')
  })

  test('capture /onboardinglang', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardinglang')
    await authenticatedPage.waitForTimeout(1000)
    await captureScreenshot(authenticatedPage, 'onboardinglang')
  })

  test('capture /contacts', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/contacts')
    await authenticatedPage.waitForTimeout(1000)
    await captureScreenshot(authenticatedPage, 'contacts')
  })

  test('capture /conversations', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/conversations')
    await authenticatedPage.waitForTimeout(1000)
    await captureScreenshot(authenticatedPage, 'conversations')
  })

  test('capture /plan (with businessId)', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto(`/plan?id=${mockBusiness.businessId}`)
    await authenticatedPage.waitForTimeout(1000)
    await captureScreenshot(authenticatedPage, 'plan')
  })

  test('capture /analytics (with businessId)', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto(`/analytics?id=${mockBusiness.businessId}`)
    await authenticatedPage.waitForTimeout(1000)
    await captureScreenshot(authenticatedPage, 'analytics')
  })
})

// ─── Public pages (no auth needed) ──────────────────────────────────

test.describe('UI Audit - Public Pages', () => {

  test('capture /signin', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#app', { state: 'attached' })
    await page.waitForTimeout(1000)
    await captureScreenshot(page, 'signin')
  })

  test('capture /signup', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#app', { state: 'attached' })
    await page.waitForTimeout(1000)
    await captureScreenshot(page, 'signup')
  })

  test('capture /magiclink', async ({ page }) => {
    await page.goto('/magiclink', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#app', { state: 'attached' })
    await page.waitForTimeout(1000)
    await captureScreenshot(page, 'magiclink')
  })
})
