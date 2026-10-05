// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The retention page, end to end: it is reached from the configuration menu, it shows the class and
 * its legal minimum, and a saved term leaves through /apidomain/retention with the revision it read.
 */

const annotations = [{
  collection: { id: '__BUSINESS_DATA__', humanName: 'Business data', description: '' },
  variables: []
}]

function described (set, revision) {
  const cls = { name: 'medical', minDeleteAfterDays: 1095, minTrashDeleteAfterDays: 0,
    defaultArchiveAfterDays: 90, defaultDeleteAfterDays: 1095, defaultTrashDeleteAfterDays: 30,
    source: 'Law X, art. 3', decidedBy: 'counsel' }
  const pick = (k, d) => (set[k] === null || set[k] === undefined ? d : set[k])
  return {
    businessId: mockBusiness.businessId,
    effective: { archiveAfterDays: pick('archiveAfterDays', 90), deleteAfterDays: pick('deleteAfterDays', 1095),
      trashDeleteAfterDays: pick('trashDeleteAfterDays', 30) },
    set: { archiveAfterDays: null, deleteAfterDays: null, trashDeleteAfterDays: null, ...set },
    retentionClass: cls,
    revision
  }
}

async function mockPage (page, { putStatus = 200, putBody = null } = {}) {
  const writes = []
  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations) }))
  await page.route('**/crm/business*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([mockBusiness]),
    headers: { 'x-mrcall-role': 'owner' } }))
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
  test('opens from the menu, shows the minimum, and saves a term with the revision it read', async ({ authenticatedPage: page }, testInfo) => {
    const writes = await mockPage(page)
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}`)
    // on a narrow screen the menu is a popup, opened from the button that names the current section
    const narrowMenu = page.locator('.header_buttonbar button')
    if (await narrowMenu.isVisible()) await narrowMenu.click()
    await page.getByRole('menuitem', { name: 'Data retention' }).locator('visible=true').first().click()
    await expect(page.getByText('Legal minimum of class medical: 1095 days (or never).')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Law X, art. 3')).toBeVisible()
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

  test('says which term the server refused, with its minimum', async ({ authenticatedPage: page }) => {
    await mockPage(page, { putStatus: 422, putBody: { code: 'retention.term_below_minimum', detail: 'below',
      constraint: { field: 'deleteAfterDays', value: 365, minimum: 1095, retentionClass: 'medical' } } })
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__DATA_RETENTION__`)
    await expect(page.getByText('Law X, art. 3')).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Deletion: the minimum is 1095 days.')).toBeVisible()
  })
})
