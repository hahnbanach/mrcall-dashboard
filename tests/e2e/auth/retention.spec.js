// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The retention page, end to end: it is reached from the configuration menu, it shows the defaults,
 * and a saved term leaves through /apidomain/retention with the revision it read.
 */

const annotations = [{
  collection: { id: '__BUSINESS_DATA__', humanName: 'Business data', description: '' },
  variables: []
}]

function described (set, revision) {
  const defaults = { archiveAfterDays: -1, deleteAfterDays: -1, trashDeleteAfterDays: -1 }
  const pick = k => (set[k] === null || set[k] === undefined ? defaults[k] : set[k])
  return {
    businessId: mockBusiness.businessId,
    effective: { archiveAfterDays: pick('archiveAfterDays'), deleteAfterDays: pick('deleteAfterDays'),
      trashDeleteAfterDays: pick('trashDeleteAfterDays') },
    set: { archiveAfterDays: null, deleteAfterDays: null, trashDeleteAfterDays: null, ...set },
    defaults,
    revision
  }
}

async function mockPage (page, { putStatus = 200, putBody = null, role = 'owner' } = {}) {
  const writes = []
  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations) }))
  await page.route('**/crm/business*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([mockBusiness]),
    // cross-origin: the page reads the role only if the response exposes the header
    headers: { 'x-mrcall-role': role, 'access-control-expose-headers': 'x-mrcall-role' } }))
  await page.route('**/apidomain/retention/**', route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      writes.push(body)
      return route.fulfill({ status: putStatus, contentType: 'application/json',
        body: JSON.stringify(putBody || described(body, 'r2')) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(described({}, 'r1')) })
  })
  return writes
}

test.describe('the retention page', () => {
  test('opens from the menu, shows the defaults, and saves a term with the revision it read', async ({ authenticatedPage: page }, testInfo) => {
    const writes = await mockPage(page)
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}`)
    // on a narrow screen the menu is a popup, opened from the button that names the current section
    const narrowMenu = page.locator('.header_buttonbar button')
    if (await narrowMenu.isVisible()) await narrowMenu.click()
    await page.getByRole('menuitem', { name: 'Data retention' }).locator('visible=true').first().click()
    await expect(page.getByText('Default (Never)').first()).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.retention').getByText(/minimum|class/i)).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('retention.png'), fullPage: true })

    const archive = page.locator('.retention-term').first()
    await archive.getByText('Custom').click()
    // typed as a person types it: the number field updates its model on key events, not on fill
    const days = archive.locator('input')
    await days.click()
    await days.press('ControlOrMeta+a')
    await days.pressSequentially('30')
    await days.press('Tab')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Settings saved.')).toBeVisible()
    expect(writes).toEqual([{ archiveAfterDays: 30, deleteAfterDays: null, trashDeleteAfterDays: null, expectedRevision: 'r1' }])
  })

  test('says when the server refused the settings', async ({ authenticatedPage: page }) => {
    await mockPage(page, { putStatus: 422, putBody: { code: 'retention.invalid_term', detail: 'below -1',
      constraint: { field: 'deleteAfterDays', value: -5, minimum: -1 } } })
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__DATA_RETENTION__`)
    await expect(page.getByText('Default (Never)').first()).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('The settings could not be saved.')).toBeVisible()
  })

  // The footer's Save writes the business variables, not the retention: on this page it is not shown,
  // and the footer stays only for what else it carries, the admin's button.
  test('has one Save, its own, and no footer for an owner', async ({ authenticatedPage: page }) => {
    await mockPage(page)
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__DATA_RETENTION__`)
    await expect(page.getByText('Default (Never)').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(1)
    await expect(page.locator('#footer')).toHaveCount(0)
  })

  test('leaves the footer\'s Save on the other configuration pages', async ({ authenticatedPage: page }) => {
    await mockPage(page)
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__BUSINESS_DATA__`)
    await expect(page.locator('#footer').getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 20000 })
  })

  test('keeps the admin\'s AladMin AI button in the footer, with still one Save', async ({ authenticatedPage: page }) => {
    await mockPage(page, { role: 'admin' })
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__DATA_RETENTION__`)
    await expect(page.getByText('Default (Never)').first()).toBeVisible({ timeout: 20000 })
    await expect(page.locator('#footer').getByRole('button', { name: 'AladMin AI' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(1)
  })
})
