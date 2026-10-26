// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The business configuration's data-sending section draws the variables StarChat declares for it,
 * and nothing else: Google Calendar is connected per skill, not from this section.
 */

const SECTION = '__SEND_DATA__'
const NAME = 'SEND_DATA_WEBHOOK_URL'

const webhook = {
  name: NAME,
  humanName: 'Webhook address',
  description: 'Where call data is sent',
  class: 'variable',
  templateName: 'generic_onboarding',
  type: 'string',
  defaultValue: '',
  visible: true,
  mandatory: false,
  modifiable: true,
  admin: false,
  advanced: false,
  position: '1',
  dependsOn: [],
  valuesSelection: []
}

const annotations = [{
  collection: { id: SECTION, humanName: 'Send data', description: '' },
  variables: [[webhook]]
}]

const business = { ...mockBusiness, variables: { ...mockBusiness.variables, [NAME]: 'https://hooks.example.invalid/calls' } }

test('the send data section shows its variables and no calendar connection', async ({ authenticatedPage: page }) => {
  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations) }))
  await page.route('**/crm/business*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([business]),
    headers: { 'x-mrcall-role': 'owner', 'access-control-expose-headers': 'x-mrcall-role' } }))

  await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=${SECTION}`)

  await expect(page.getByText('Webhook address')).toBeVisible({ timeout: 20000 })
  await expect(page.locator(`#${NAME}`)).toHaveValue('https://hooks.example.invalid/calls')
  // Settled first: a calendar control that draws itself only after its own request answers must
  // have had the chance to appear before its absence counts.
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: /calendar/i })).toHaveCount(0)
})
