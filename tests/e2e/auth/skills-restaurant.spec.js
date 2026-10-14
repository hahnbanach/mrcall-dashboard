// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')
const { catalogueFields } = require('../fixtures/restaurant')

/**
 * The restaurant skill in the generic skill form (StarChat plan, M6b): the fields marked `x-audience: page` are drawn
 * by nobody here, admins included, and named with a link to the page; the strip's switch is the page, the
 * assistant's switch is inside it; turning the page off saves the assistant off in the same write; and the server's
 * refusal of the assistant without its page, should it come, is said in the person's words.
 *
 * Seen failing first, 2026-10-13, one fault at a time: `visibleTo` letting `audience: page` through (both hidden-field
 * tests: "Book horizon (days)" drawn); the page switch writing only `page` (the coupled save: `enabled` still
 * "true" in the PUT); the refusal said as the server's path and English (the refusal test).
 */

const SECTION = '__SKILLS__'
const skillVariable = name => ({ name, humanName: 'Agent skills', description: 'What the assistant can do during a call', class: 'variable',
  templateName: 'generic_onboarding', type: 'apidomain_agent_skills', defaultValue: '[]', visible: true, mandatory: false, modifiable: true,
  advanced: false, position: '1', dependsOn: [], valuesSelection: [] })
const annotations = [{ collection: { id: SECTION, humanName: 'Skills', description: '' },
  variables: [[skillVariable('SKILL_PREFETCH_CONFIGURATION'), skillVariable('SKILL_RUNNINGLOOP_CONFIGURATION'), skillVariable('SKILL_FINAL_CONFIGURATION')]] }]
const catalogue = [{ name: 'skill_restaurant_booking', description: 'Tables and covers', descriptionI18n: { en: 'Tables and covers' },
  manifest: { title: { en: 'Restaurant: tables and covers' } },
  configSchema: { phases: ['during'], outputPrefix: 'restaurant_booking', instances: { max: 1, maxPerPhase: 1 }, fields: catalogueFields() } }]
const configured = [{ skill: 'skill_restaurant_booking', instanceId: 'restaurant_booking_1',
  params: { enabled: 'true', page: 'true', horizonDays: '200', daysAhead: '60', dinner: '{"friday":["19:00-22:00"]}' } }]
async function mockScreen (page, { role = 'owner', saveStatus = 200, saveBody = null, params = null } = {}) {
  const writes = []
  const restaurantCalls = []
  const instances = params ? [{ ...configured[0], params: { ...configured[0].params, ...params } }] : configured
  const business = { ...mockBusiness, variables: { SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify(instances) } }
  await page.route('**/*clarity.ms/**', route => route.abort())
  await page.route('**/crm/variables*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(annotations) }))
  await page.route('**/crm/business*', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([business]),
        headers: { 'x-mrcall-role': role, 'access-control-expose-headers': 'x-mrcall-role' } })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { businessId: business.businessId } }) })
  })
  await page.route('**/apidomain/agent/skills*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogue) }))
  await page.route('**/apidomain/agent/skills/configuration/**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefetch: [], during: instances, final: [] }) })
    }
    writes.push(route.request().postDataJSON())
    return route.fulfill({ status: saveStatus, contentType: 'application/json', body: JSON.stringify(saveBody || { saved: true, diagnostics: [] }) })
  })
  // the restaurant book: with the page off it answers only the export and the erasure, as StarChat does (R8)
  await page.route('**/apidomain/restaurant/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^.*\/apidomain\/restaurant\/[^/]+/, '')
    restaurantCalls.push({ method: request.method(), path, search: url.search, body: request.postData() ? request.postDataJSON() : null })
    if (path === '/export') return route.fulfill({ status: 200, contentType: 'text/csv', body: 'id,date\r\n' })
    if (path === '/erasure') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cleared: 2 }) })
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ diagnostics: [{ path: '/page', code: 'not_configured', detail: 'off' }] }) })
  })
  writes.restaurant = restaurantCalls
  return writes
}

async function openCard (page) {
  await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=${SECTION}`)
  await expect(page.locator('.agent-skills-configurator')).toBeVisible({ timeout: 20000 })
  await page.locator('.phase-has-entries .phase-header').click()
  await page.locator('.entry-header-toggle').click()
  await expect(page.locator('.entry-fields')).toBeVisible()
}

test.describe('the restaurant skill in the skill form', () => {
  for (const role of ['owner', 'admin']) {
    test(`draws none of the page's fields for an ${role}, names them, and links to the page`, async ({ authenticatedPage: page }) => {
      await mockScreen(page, { role })
      await openCard(page)
      const fields = page.locator('.entry-fields')
      for (const hidden of ['Book horizon (days)', 'Lunch: arrival times', 'What we ask for every booking', 'Closures and special days', 'Room: zones, tables and joins']) {
        await expect(fields.getByText(hidden, { exact: true })).toHaveCount(0)
      }
      // the assistant's policy, the calendar's closure word and the phone settings stay here
      for (const shown of ['Largest party booked by the assistant', 'Days ahead', 'Closure keyword in the calendar', 'Changes by phone',
        'Hidden number, anonymous web chat or unverified voice user']) {
        await expect(fields.getByText(shown, { exact: true })).toBeVisible()
      }
      await expect(fields).toContainText('At most the book\'s horizon (200 days)')
      const summary = page.locator('.entry-page-fields')
      await expect(summary).toContainText('Book horizon (days)')
      await expect(summary).not.toContainText('Closures and special days')
      await expect(summary.getByRole('link', { name: 'Open the restaurant page' })).toHaveAttribute('href', /section=__RESTAURANT_BOOKING__.*tab=rules|tab=rules.*section=__RESTAURANT_BOOKING__/)
    })
  }

  test('the page switch comes first; off, it saves the assistant off in the same write', async ({ authenticatedPage: page }) => {
    const writes = await mockScreen(page)
    await openCard(page)
    await expect(page.locator('.entry-state-badge').first()).toHaveText('Page on')
    const assistant = page.locator('.entry-assistant')
    await expect(assistant).toContainText('The assistant takes bookings')
    await page.locator('.page-switch').click()
    await expect(page.locator('.entry-state-badge').first()).toHaveText('Page off')
    await expect(assistant.locator('.assistant-toggle input')).toBeDisabled()
    await page.locator('button:has(.pi-save)').first().click()
    await expect.poll(() => writes.length, { timeout: 15000 }).toBe(1)
    const params = JSON.parse(writes[0].SKILL_RUNNINGLOOP_CONFIGURATION)[0].params
    expect(params.page).toBe('false')
    expect(params.enabled).toBe('false')
    // what the form does not draw travels back as it was read
    expect(params.horizonDays).toBe('200')
  })

  // StarChat keeps the export and the erasure open with the page off (R8); the page is not reachable then, so the card
  // offers them. The first test was seen failing on 2026-10-14 against 2622e5d (no such panel); the second guards that
  // the panel stays out of a card whose page is on.
  test('with the page off the card offers the export and the erasure, the erasure asked twice', async ({ authenticatedPage: page }) => {
    const writes = await mockScreen(page, { params: { page: 'false', enabled: 'false' } })
    await openCard(page)
    const panel = page.locator('.restaurant-data-panel')
    await expect(panel).toContainText('The guests\' data')
    const download = page.waitForEvent('download')
    await panel.getByRole('button', { name: 'Export' }).click()
    await download
    expect(writes.restaurant.filter(c => c.path === '/export')).toHaveLength(1)
    await panel.getByLabel('Guest\'s number').fill('+39 333 111 2233')
    await panel.getByRole('button', { name: 'Erase this guest\'s data' }).click()
    await expect(panel).toContainText('cannot be brought back')
    expect(writes.restaurant.filter(c => c.path === '/erasure')).toHaveLength(0)
    await panel.getByRole('button', { name: 'Erase now: it cannot be undone' }).click()
    await expect(panel).toContainText('Data erased from 2 bookings')
    expect(writes.restaurant.filter(c => c.path === '/erasure').map(c => c.body)).toEqual([{ phone: '+39 333 111 2233' }])
  })

  test('with the page on the card offers neither: they are in the page', async ({ authenticatedPage: page }) => {
    await mockScreen(page)
    await openCard(page)
    await expect(page.locator('.restaurant-data-panel')).toHaveCount(0)
  })

  test('the server\'s refusal of the assistant without its page is said readably', async ({ authenticatedPage: page }) => {
    await mockScreen(page, { saveStatus: 422, saveBody: { saved: false, diagnostics: [{ severity: 'error', path: '/during/0/enabled',
      code: 'assistant_without_page', detail: 'the assistant cannot take bookings while the restaurant\'s page is off' }] } })
    await openCard(page)
    await page.locator('button:has(.pi-save)').first().click()
    await expect(page.getByText(/The assistant cannot take bookings while the restaurant page is off: switch the assistant off, or the page on/))
      .toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/\/during\/0\/enabled/)).toHaveCount(0)
  })
})
