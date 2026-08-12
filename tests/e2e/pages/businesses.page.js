const { expect } = require('@playwright/test')
const { BasePage } = require('./base.page')
const { selectors } = require('../helpers/selectors')

class BusinessesPage extends BasePage {
  constructor(page) {
    super(page)
    this.businessCards = page.locator(selectors.businessCard)
    this.companyNames = page.locator(selectors.cardCompanyName)
    this.paginator = page.locator(selectors.paginator).first()
    this.statusBadges = page.locator(selectors.statusBadge)
    this.actionButtons = page.locator(selectors.cardActions)
  }

  async goto() {
    await super.goto('/businesses')
  }

  async expectBusinessCardsVisible() {
    await expect(this.businessCards.first()).toBeVisible()
  }

  async expectCompanyName(name) {
    await expect(this.companyNames.first()).toContainText(name)
  }

  async expectBusinessCount(count) {
    await expect(this.businessCards).toHaveCount(count)
  }

  async expectPaginatorVisible() {
    await expect(this.paginator).toBeVisible()
  }

  async expectStatusBadge() {
    await expect(this.statusBadges.first()).toBeVisible()
  }

  async clickEditAssistant() {
    const editBtn = this.page.locator(selectors.actionsPrimary).first().locator(selectors.button).first()
    await editBtn.click()
  }

  async expectNavbarAuthItems() {
    const navbar = this.page.locator(selectors.navbar)
    await expect(navbar).toBeVisible()
  }
}

module.exports = { BusinessesPage }
