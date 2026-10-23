// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The business settings' generic number field, end to end, on the call report cadence: a whole
 * number of days, 0 to 366, declared by the variable's `constraints`. The field keeps a typed value
 * inside those bounds, and a field the owner empties is saved as "" (StarChat puts the variable's
 * default in its place), never as "null", which every StarChat reader of a number fails to parse.
 */

const SECTION = '__BUSINESS_DATA__'
const NAME = 'CALL_INSIGHTS_REPORT_CADENCE'

const cadence = {
  name: NAME,
  humanName: 'Call report',
  description: 'Every how many days the call report arrives; 0 for none',
  class: 'variable',
  templateName: 'generic_onboarding',
  type: 'number',
  defaultValue: '0',
  visible: true,
  mandatory: false,
  modifiable: true,
  admin: false,
  advanced: false,
  position: '1',
  dependsOn: [],
  valuesSelection: [],
  constraints: { integer: true, min: 0, max: 366 }
}

const annotations = [{
  collection: { id: SECTION, humanName: 'Business data', description: '' },
  variables: [[cadence]]
}]

const business = { ...mockBusiness, variables: { ...mockBusiness.variables, [NAME]: '7' } }

async function mockSettings (page) {
  const writes = []
  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations) }))
  await page.route('**/crm/business*', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([business]),
        headers: { 'x-mrcall-role': 'owner', 'access-control-expose-headers': 'x-mrcall-role' } })
    }
    const body = route.request().postDataJSON()
    writes.push(body)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: body }) })
  })
  return writes
}

/** The cadence field, once the page has drawn it with the business's value. */
async function openField (page) {
  await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=${SECTION}`)
  const field = page.locator('.p-inputnumber input')
  await expect(field).toHaveValue('7', { timeout: 20000 })
  return field
}

/** Typed as a person types it: the number field updates its model on key events, not on fill. */
async function retype (field, text) {
  await field.click()
  await field.press('ControlOrMeta+a')
  if (text === '') await field.press('Backspace')
  else await field.pressSequentially(text)
  await field.press('Tab')
}

test.describe('a number setting with bounds', () => {
  test('a cleared field is saved as an empty value, not "null"', async ({ authenticatedPage: page }) => {
    const writes = await mockSettings(page)
    const field = await openField(page)
    await retype(field, '')
    await expect(field).toHaveValue('')
    await page.locator('#footer').getByRole('button', { name: 'Save' }).click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0].variables[NAME]).toBe('')
  })

  test('keeps the cadence within 0 to 366 days and in whole days', async ({ authenticatedPage: page }) => {
    const writes = await mockSettings(page)
    const field = await openField(page)
    await retype(field, '367')
    await expect(field).toHaveValue('366')
    // the decimal separator is not taken: "1.5" and "1,5" both type 15
    await retype(field, '1.5')
    await expect(field).toHaveValue('15')
    await retype(field, '1,5')
    await expect(field).toHaveValue('15')
    // nor a minus sign, below a minimum of 0
    await retype(field, '-3')
    await expect(field).toHaveValue('3')
    await page.locator('#footer').getByRole('button', { name: 'Save' }).click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0].variables[NAME]).toBe('3')
  })
})
