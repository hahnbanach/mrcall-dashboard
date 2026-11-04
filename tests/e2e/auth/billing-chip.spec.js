// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The billing chip on the business card (docs/briefs/2026-11-04-billing-data-chip.md): it says
 * whether the owner's billing data is in place, names what is missing under the strip, and is a
 * link to the configuration's billing section.
 */

const BLANK_BILLING = {
  'customer.companyName': '',
  'customer.vatId': '0000000',
  'customer.fiscalCode': '',
  'customer.sdi': '',
  'customer.pec': '',
  'customer.address.line1': '',
  'customer.address.line2': '',
  'customer.address.postal_code': '',
  'customer.address.city': '',
  'customer.address.state': '',
  'customer.address.country': '',
}

const complete = { ...mockBusiness, businessId: 'biz-complete', companyName: 'Complete Co', totalHits: 3 }
const defaults = {
  ...mockBusiness,
  businessId: 'biz-defaults',
  companyName: 'Defaults Co',
  totalHits: 3,
  variables: { ...mockBusiness.variables, ...BLANK_BILLING },
}
const noTaxId = {
  ...mockBusiness,
  businessId: 'biz-no-tax-id',
  companyName: 'No Tax Id Co',
  totalHits: 3,
  variables: { ...mockBusiness.variables, 'customer.vatId': '0000000', 'customer.fiscalCode': '' },
}

const annotations = [
  { collection: { id: '__BUSINESS_DATA__', humanName: 'Business data', description: '' }, variables: [] },
  { collection: { id: '__INVOICING__', humanName: 'Billing', description: 'Company data for billing' }, variables: [] },
]

const href = (id) => `/businessconfiguration?id=${id}&section=__INVOICING__`

async function mockPage (page) {
  // Playwright answers from the last registered route first: the single-business read of the
  // configuration page, then the search (a different path: `*` does not cross a slash).
  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations) }))
  await page.route('**/crm/business*', route => {
    const id = new URL(route.request().url()).searchParams.get('id')
    const found = [complete, defaults, noTaxId].find(b => b.businessId === id) || complete
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([found]),
      headers: { 'x-mrcall-role': 'owner', 'access-control-expose-headers': 'x-mrcall-role' } })
  })
  await page.route('**/crm/business/search*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([complete, defaults, noTaxId]),
    headers: { 'x-mrcall-role': 'owner', 'access-control-expose-headers': 'x-mrcall-role' } }))
}

const card = (page, name) => page.locator('.business-card').filter({ has: page.getByRole('heading', { name, exact: true }) })
const chip = (page, name) => card(page, name).locator('a.billing-pill')

async function expectBillingSection (page, id) {
  await expect(page).toHaveURL(new RegExp(`/businessconfiguration\\?.*id=${id}`))
  await expect(page).toHaveURL(/section=__INVOICING__/)
  // the section's own title, not its menu item (hidden in the popup menu on narrow screens)
  await expect(page.locator('#central-header-section #title')).toHaveText('Billing', { timeout: 20000 })
  const large = page.locator('.active-menu-item')
  if (await large.first().isVisible()) {
    await expect(large.first()).toContainText('Billing')
  }
}

test.describe('the billing chip on the business card', () => {
  test('states each owner\'s billing data and names what is missing', async ({ authenticatedPage: page }, testInfo) => {
    await mockPage(page)
    await page.goto('/businesses')
    await expect(page.locator('.business-card')).toHaveCount(3, { timeout: 20000 })

    const ok = chip(page, 'Complete Co')
    await expect(ok).toHaveAccessibleName('Billing data entered')
    await expect(ok).toHaveAttribute('href', href('biz-complete'))
    await expect(ok).not.toHaveAttribute('aria-describedby')
    await expect(card(page, 'Complete Co').locator('.billing-note')).toHaveCount(0)

    const missing = chip(page, 'Defaults Co')
    await expect(missing).toHaveAccessibleName('Billing data missing')
    await expect(missing).toHaveAttribute('href', href('biz-defaults'))
    const missingNote = 'To receive the electronic invoice, add: company name, billing address, province, ' +
      'VAT number or tax code, and SDI code or PEC'
    await expect(card(page, 'Defaults Co').locator('.billing-note')).toHaveText(missingNote)
    await expect(missing).toHaveAccessibleDescription(missingNote)

    const partial = chip(page, 'No Tax Id Co')
    await expect(partial).toHaveAccessibleName('Billing data incomplete')
    const partialNote = 'To receive the electronic invoice, add: VAT number or tax code'
    await expect(card(page, 'No Tax Id Co').locator('.billing-note')).toHaveText(partialNote)
    await expect(partial).toHaveAccessibleDescription(partialNote)

    // the warning text is readable: darker than the shared amber, which is under 4.5:1 there
    await expect(partial).toHaveCSS('color', 'rgb(166, 60, 0)')
    await expect(ok).toHaveCSS('color', 'rgb(46, 125, 50)')

    for (const [name, file] of [['Complete Co', 'complete'], ['Defaults Co', 'missing'], ['No Tax Id Co', 'incomplete']]) {
      await card(page, name).locator('.health-strip').scrollIntoViewIfNeeded()
      await card(page, name).screenshot({ path: testInfo.outputPath(`billing-card-${file}.png`) })
    }
  })

  test('opens the billing section from the keyboard', async ({ authenticatedPage: page, browserName }) => {
    await mockPage(page)
    await page.goto('/businesses')
    const target = chip(page, 'Defaults Co')
    await expect(target).toBeVisible({ timeout: 20000 })
    if (browserName === 'chromium') {
      // the pills before the chip are plain text and take no focus: Tab from the start of the page
      let reached = false
      for (let i = 0; i < 60 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await target.evaluate(el => el === document.activeElement)
      }
      expect(reached, 'Tab reaches the billing chip').toBe(true)
    } else {
      // WebKit's Tab skips links unless the system asks it not to
      await target.focus()
    }
    await expect(target).toBeFocused()
    await page.keyboard.press('Enter')
    await expectBillingSection(page, 'biz-defaults')
  })

  test('opens the billing section on a click', async ({ authenticatedPage: page }) => {
    await mockPage(page)
    await page.goto('/businesses')
    await chip(page, 'No Tax Id Co').click({ timeout: 20000 })
    await expectBillingSection(page, 'biz-no-tax-id')
  })
})
