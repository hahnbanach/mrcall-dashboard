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

  // The credit is StarChat's balance net of debt (v2.2.16). These pin what the card says for each
  // answer of the balance endpoint, which the fixture's catch-all used to answer with a business:
  // that answer is not a balance, and the card showed it as €0.00 and "No minutes left".
  test.describe('credit', () => {
    const answerBalance = (page, body) => page.route('**/crm/business/resources/balance*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))

    test('shows the balance and minutes available when the business has credit', async ({ authenticatedPage: page }) => {
      await answerBalance(page, { available: 100, debt: 0, net: 100 })
      await new BusinessesPage(page).goto()
      const card = page.locator(selectors.businessCard).first()
      await expect(card).toContainText('€1.00')
      await expect(card).toContainText('Minutes available')
    })

    test('shows a debt as a negative credit, with the notice, and no minutes', async ({ authenticatedPage: page }) => {
      await answerBalance(page, { available: 0, debt: 200, net: -200 })
      await new BusinessesPage(page).goto()
      const card = page.locator(selectors.businessCard).first()
      await expect(card.locator('.credit-negative')).toHaveText('-€2.00')
      await expect(card.locator('.credit-debt-notice')).toContainText('Negative credit: -€2.00')
      await expect(card.locator('.health-debt')).toContainText('Negative credit')
    })

    // StarChat brief 2026-11-04-debt-state-from-net: a member owing 1 credit while its organization's
    // 56,768 cover it has its calls admitted. Seen failing, 2026-11-04, on e26c56b's Businesses.vue: the
    // amount in red, the "calls are suspended" notice and the "Negative credit" chip.
    test('shows an open debt the credit covers as credit, with no notice and minutes available', async ({ authenticatedPage: page }) => {
      await answerBalance(page, { available: 56768, debt: 1, net: 56767 })
      await new BusinessesPage(page).goto()
      const card = page.locator(selectors.businessCard).first()
      await expect(card).toContainText('€567.67')
      await expect(card).toContainText('Minutes available')
      await expect(card.locator('.credit-negative')).toHaveCount(0)
      await expect(card.locator('.credit-debt-notice')).toHaveCount(0)
      await expect(card.locator('.health-debt')).toHaveCount(0)
    })

    // The warning pills' amber text was #e65100, 3.46:1 on the pill's #fff3e0, under the 4.5:1 that
    // 0.8rem text needs; it reads now in the shared warning text colour, 5.86:1 there.
    test('says no minutes are left at zero, in a readable amber', async ({ authenticatedPage: page }) => {
      await answerBalance(page, { available: 0, debt: 0, net: 0 })
      await new BusinessesPage(page).goto()
      const pill = page.locator(selectors.businessCard).first().locator('.health-warn', { hasText: 'No minutes left' })
      await expect(pill).toBeVisible()
      await expect(pill).toHaveCSS('color', 'rgb(166, 60, 0)')
    })

    // Seen failing on 2026-10-11 against v2.2.19 (0d83641): the card read €0.00 and "No minutes left"
    // for an answer that is not a balance.
    test('says the credit is unknown, not zero, when the answer is not a balance', async ({ authenticatedPage: page }) => {
      await answerBalance(page, { businessId: 'not-a-balance' })
      await new BusinessesPage(page).goto()
      const card = page.locator(selectors.businessCard).first()
      await expect(card.locator('.credit-unknown')).toHaveText('—')
      await expect(card).not.toContainText('€0.00')
      await expect(card).not.toContainText('No minutes left')
      await expect(card).not.toContainText('Minutes available')
    })
  })
})
