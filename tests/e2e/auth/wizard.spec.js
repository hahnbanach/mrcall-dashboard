// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

test.describe('Configuration Wizard (Authenticated)', () => {
  test('should load wizard page and show loading state', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)

    // Mock the Zylch streaming endpoint (agent open)
    await authenticatedPage.route('**/api/chat/message/stream', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"text_delta","text":"Quando qualcuno chiama, il tuo assistente "}\n\ndata: {"type":"text_delta","text":"risponde con un saluto cordiale."}\n\ndata: {"type":"done","session_id":"mrcall_wizard_test123"}\n\n',
      })
    })

    // Mock Zylch chat history
    await authenticatedPage.route('**/api/chat/history*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messages: [], session_id: null }),
      })
    })

    await basePage.goto('/wizard?id=test123')

    // Should show the wizard container
    const wizardContainer = authenticatedPage.locator('.wizard-container').first()
    await expect(wizardContainer).toBeVisible({ timeout: 10000 })

    // Take screenshot of initial state
    await authenticatedPage.waitForTimeout(2000)
    await authenticatedPage.screenshot({
      fullPage: true,
      path: 'tests/screenshots/baseline/wizard-step1-welcome.png',
    })
  })

  test('should display wizard header with progress', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)

    await authenticatedPage.route('**/api/chat/message/stream', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"text_delta","text":"Il tuo assistente risponde con: Buongiorno, come posso aiutarla?"}\n\ndata: {"type":"done","session_id":"mrcall_wizard_test123"}\n\n',
      })
    })

    await authenticatedPage.route('**/api/chat/history*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messages: [], session_id: null }),
      })
    })

    await basePage.goto('/wizard?id=test123')

    // Wait for content to render
    await authenticatedPage.waitForTimeout(3000)

    // Check progress bar exists
    const progressBar = authenticatedPage.locator('.wizard-progress-bar').first()
    await expect(progressBar).toBeVisible({ timeout: 10000 })

    // Check dots
    const dots = authenticatedPage.locator('.wizard-dot')
    await expect(dots).toHaveCount(8)

    // Take screenshot after summary loads
    await authenticatedPage.screenshot({
      fullPage: true,
      path: 'tests/screenshots/baseline/wizard-step1-summary.png',
    })
  })

  test('should not have horizontal overflow', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)

    await authenticatedPage.route('**/api/chat/message/stream', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"done","session_id":"test"}\n\n',
      })
    })

    await authenticatedPage.route('**/api/chat/history*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messages: [], session_id: null }),
      })
    })

    await basePage.goto('/wizard?id=test123')
    await basePage.expectNoHorizontalOverflow()
  })
})
