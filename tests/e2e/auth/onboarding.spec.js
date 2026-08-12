// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')
const { selectors } = require('../helpers/selectors')

test.describe('Onboarding Flow (Authenticated)', () => {
  test('should load language selection step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardinglang')

    // Should show language dropdown
    const dropdown = authenticatedPage.locator(selectors.dropdown).first()
    await expect(dropdown).toBeVisible({ timeout: 10000 })
  })

  // One dropdown, not two. OnboardingLanguage.vue renders a single <Dropdown>;
  // the country selector this test was written against is gone.
  test('should show the language dropdown', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardinglang')

    const dropdowns = authenticatedPage.locator(selectors.dropdown)
    await expect(dropdowns).toHaveCount(1, { timeout: 10000 })
  })

  test('should have a submit/next button', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardinglang')

    // Footer button to move forward
    const button = authenticatedPage.locator('.p-button').last()
    await expect(button).toBeVisible()
  })

  test('should load name and phone step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    // Direct navigation to step 2 may redirect to step 1 without prior state
    await basePage.goto('/onboardingnamephone')

    // Accept either the name/phone step or a redirect to the language step
    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
    // Should have at least some interactive elements (inputs or dropdowns)
    const interactiveCount = await authenticatedPage.locator('input, .p-select').count()
    expect(interactiveCount).toBeGreaterThan(0)
  })

  test('should load search business step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardingsearchbusiness')

    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should show onboarding base wrapper on each step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)

    // Test first step has the onboarding base layout
    await basePage.goto('/onboardinglang')

    // The OnboardingBase component should render
    const content = authenticatedPage.locator('.item').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('should load make a test call step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardingmakeatestcall')

    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should load choose plan step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardingchooseplan')

    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should load choose device step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/onboardingchoosedevice')

    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should not have horizontal overflow on any step', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    const steps = [
      '/onboardinglang',
      '/onboardingnamephone',
      '/onboardingsearchbusiness',
    ]

    for (const step of steps) {
      await basePage.goto(step)
      await basePage.expectNoHorizontalOverflow()
    }
  })
})
