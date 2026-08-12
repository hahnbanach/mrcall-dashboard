// @ts-check
const { expect } = require('@playwright/test')
// The auth fixture extends the base test, so `page` still works for the public
// pages below; only the success page needs authenticatedPage.
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

test.describe('Payment Result Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/googleapis.com/**', route => route.abort())
    await page.route('**/google-analytics.com/**', route => route.abort())
    await page.route('**/googletagmanager.com/**', route => route.abort())
    await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())
  })

  // Unlike the other pages here, this one renders nothing useful on its own: the
  // whole success block sits behind v-if="assignmentOperationCompleted", which
  // only flips once the business has been fetched. So it needs a signed-in user
  // and an ?id=, and it confirms the outcome ("your assistant is active") rather
  // than the transaction, which is why looking for the word "success" never
  // matched anything.
  test('Success Payment page shows positive feedback', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/success_payment?id=test-biz-001')

    await expect(authenticatedPage.getByText(/your assistant is active/i).first())
      .toBeVisible({ timeout: 15000 })
  })

  test('Success Payment Product page shows positive feedback', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/success_payment_product')

    await expect(page.getByText(/successful|success|purchased/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/return/i).first()).toBeVisible()
  })

  test('Failed Payment page shows error feedback', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/failed_payment')

    // Page shows failure text
    await expect(page.getByText(/not successful|failed|error/i).first()).toBeVisible({ timeout: 10000 })

    // "Return to assistants" button present
    await expect(page.getByText(/return/i).first()).toBeVisible()
  })

  test('Failed Payment Product page shows error feedback', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/failed_payment_product')

    await expect(page.getByText(/not successful|failed|error/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/return/i).first()).toBeVisible()
  })
})
