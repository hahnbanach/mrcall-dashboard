const { expect } = require('@playwright/test')
const { BasePage } = require('./base.page')
const { selectors } = require('../helpers/selectors')

class SignupPage extends BasePage {
  constructor(page) {
    super(page)
    this.emailInput = page.locator(selectors.emailInput)
    this.passwordInput = page.locator(`${selectors.password} input`)
    this.submitButton = page.locator('button[type="submit"].signin-signup-button-text')
    this.form = page.locator(selectors.signinForm)
    this.dialog = page.locator(selectors.dialog)
    this.successIcon = page.locator('#response-message-success-symbol')
  }

  async goto() {
    await super.goto('/signup')
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

  async expectSuccessDialog() {
    await expect(this.successIcon).toBeVisible()
  }
}

module.exports = { SignupPage }
