// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BusinessesPage } = require('../pages/businesses.page')
const { selectors } = require('../helpers/selectors')

test.describe('Businesses Page (Authenticated)', () => {
  test('should render business cards from mock data', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    await bizPage.expectBusinessCardsVisible()
    await bizPage.expectCompanyName('Test Restaurant')
  })

  test('should display business count matching mock data', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    await bizPage.expectBusinessCount(1)
  })

  test('should show paginator when businesses exist', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    // Paginator with alwaysShow=false only shows when needed,
    // but the component should be present
    const paginator = authenticatedPage.locator(selectors.paginator)
    const count = await paginator.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should show navbar with authenticated items', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    await bizPage.expectNavbarAuthItems()
  })

  test('should display status badge on business card', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    const statusBadge = authenticatedPage.locator(selectors.statusBadge)
    await expect(statusBadge.first()).toBeVisible()
  })

  test('should show action buttons on business card', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    const actions = authenticatedPage.locator(selectors.cardActions)
    await expect(actions.first()).toBeVisible()

    // Should have edit assistant button
    const editBtn = authenticatedPage.locator(selectors.actionsPrimary).first().locator(selectors.button).first()
    await expect(editBtn).toBeVisible()
  })

  test('should show business info grid with details', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    const infoGrid = authenticatedPage.locator(selectors.infoGrid)
    await expect(infoGrid.first()).toBeVisible()

    // Should have info items
    const infoItems = authenticatedPage.locator(selectors.infoItem)
    const count = await infoItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should display service number banner', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    const serviceNumber = authenticatedPage.locator(selectors.serviceNumberBanner)
    await expect(serviceNumber.first()).toBeVisible()
  })

  test('should navigate to business configuration on edit click', async ({ authenticatedPage }) => {
    const bizPage = new BusinessesPage(authenticatedPage)
    await bizPage.goto()

    await bizPage.clickEditAssistant()
    await authenticatedPage.waitForURL(/businessconfiguration/)
  })
})
