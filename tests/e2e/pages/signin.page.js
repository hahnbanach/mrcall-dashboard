const { expect } = require('@playwright/test')
const { BasePage } = require('./base.page')
const { selectors } = require('../helpers/selectors')

class SigninPage extends BasePage {
  constructor(page) {
    super(page)
    this.emailInput = page.locator(selectors.emailInput)
    this.passwordInput = page.locator(`${selectors.password} input`)
    this.submitButton = page.locator('button[type="submit"].signin-signup-button-text')
    this.forgotPasswordLink = page.locator('a').filter({ hasText: /forgot|password|dimenticato/i }).first()
    this.form = page.locator(selectors.signinForm)
    this.dialog = page.locator(selectors.dialog)
  }

  async goto() {
    await super.goto('/signin')
  }

  async fillEmail(email) {
    await this.emailInput.fill(email)
  }

  async fillPassword(password) {
    await this.passwordInput.fill(password)
  }

  async submit() {
    await this.submitButton.click()
  }

  async expectFormVisible() {
    await expect(this.emailInput).toBeVisible()
    await expect(this.passwordInput).toBeVisible()
    await expect(this.submitButton).toBeVisible()
  }

  async expectEmailError() {
    await expect(this.page.locator(selectors.invalidInput).first()).toBeVisible()
  }

  async expectDialogVisible() {
    await expect(this.dialog.first()).toBeVisible()
  }

  async expectGoogleSignInVisible() {
    // Google sign-in component should be present
    const googleBtn = this.page.locator('[class*="google"], [id*="google"]').first()
    await expect(googleBtn).toBeVisible()
  }

  async expectForgotPasswordLinkVisible() {
    const link = this.page.locator('a[href="/magiclink"]')
    await expect(link).toBeVisible()
  }
}

module.exports = { SigninPage }
