// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The restaurant page, end to end against a mocked StarChat: it is reached from the configuration menu
 * of a business that runs the restaurant_booking skill; it shows each slot's tables in use against the
 * room and the assistant's share; a refusal is said in the owner's language and can be overridden;
 * requests are accepted at the version read; the room is saved to the skill instance at the revision
 * read; and on a server without the restaurant routes the page says so instead of failing.
 *
 * Each test was seen failing before the page existed (2026-10-06): the menu item, the section and every
 * string below were absent, so each first assertion timed out.
 */

const annotations = [{
  collection: { id: '__BUSINESS_DATA__', humanName: 'Business data', description: '' },
  variables: []
}]

const instance = {
  skill: 'skill_restaurant_booking',
  instanceId: 'restaurant_booking_1',
  params: {
    enabled: 'true',
    indoorSeats: '40',
    outdoorSeats: '0',
    tables: JSON.stringify({ indoor: [{ size: 2, count: 2 }, { size: 4, count: 2 }] })
  }
}


function day (date) {
  return {
    date,
    configured: true,
    held: 0,
    covers: { dinner: 6 },
    seats: { indoor: 12 },
    assistantShare: 50,
    tables: { indoor: [{ size: 2, count: 2, minParty: 1 }, { size: 4, count: 2, minParty: 3 }] },
    reservations: [
      { id: 'r1', version: 1, date, time: '20:00', minutes: 105, covers: 4, area: 'indoor', service: 'dinner',
        status: 'confirmed', source: 'assistant', name: 'Bianchi', phone: '393331112233', overbooked: false,
        tableSize: 4, tables: 1 },
      { id: 'r2', version: 3, date, time: '20:30', minutes: 150, covers: 9, area: 'indoor', service: 'dinner',
        status: 'requested', source: 'assistant', name: 'Galli', requestReason: 'large_party', overbooked: false },
      { id: 'b1', version: 2, date, time: '19:00', minutes: 330, covers: 4, area: 'indoor', service: 'dinner',
        status: 'confirmed', source: 'block', notes: 'stop dinner', overbooked: false, tableSize: 2, tables: 2 }
    ],
    occupancy: {
      dinner: [
        { time: '20:00', arriving: 4, areas: [{ area: 'indoor', seatsUsed: 6, seats: 12, assistantSeats: 6,
          tables: [{ size: 2, used: 0, count: 2, assistantLimit: 1 }, { size: 4, used: 1, count: 2, assistantLimit: 1 }] }] },
        { time: '20:15', arriving: 0, areas: [{ area: 'indoor', seatsUsed: 14, seats: 12, assistantSeats: 6,
          tables: [{ size: 2, used: 0, count: 2, assistantLimit: 1 }, { size: 4, used: 3, count: 2, assistantLimit: 1 }] }] }
      ]
    }
  }
}

async function mockPage (page, { restaurant = true, putStatus = 200, bookStatus = 201, role = 'owner', skill = instance.skill } = {}) {
  const calls = []
  // `skill` null: a business that runs no restaurant skill; otherwise the name its configuration uses.
  const entry = skill ? { ...instance, skill } : null
  const business = { ...mockBusiness,
    variables: { ...mockBusiness.variables, ...(entry ? { SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify([entry]) } : {}) } }
  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations) }))
  await page.route('**/crm/business*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([business]),
    headers: { 'x-mrcall-role': role, 'access-control-expose-headers': 'x-mrcall-role' } }))
  await page.route('**/apidomain/agent/skills/configuration/**', route => {
    const request = route.request()
    if (request.method() === 'PUT') {
      calls.push({ method: 'PUT', url: request.url(), body: request.postDataJSON() })
      return route.fulfill({ status: putStatus, contentType: 'application/json',
        body: JSON.stringify({ saved: putStatus === 200, revision: 'rev-2', diagnostics: [] }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ prefetch: [], during: entry ? [entry] : [], final: [], revisions: { prefetch: 'p', during: 'rev-1', final: 'f' } }) })
  })
  await page.route('**/apidomain/restaurant/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!restaurant) {
      // what an older StarChat answers: no such route at all
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'The requested resource could not be found.' })
    }
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(day(url.searchParams.get('date'))) })
    }
    const body = request.postData() ? request.postDataJSON() : null
    calls.push({ method: request.method(), path: url.pathname, search: url.search, body })
    if (url.pathname.endsWith('/reservations') && request.method() === 'POST' && !(body && body.overbook)) {
      return route.fulfill({ status: bookStatus, contentType: 'application/json',
        body: JSON.stringify(bookStatus === 201 ? { id: 'n1', version: 1 } :
          { diagnostics: [{ path: '/', code: 'full', detail: 'the party does not fit there; send overbook: true to book it anyway' }] }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', version: 2 }) })
  })
  return calls
}

async function openPage (page) {
  await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__RESTAURANT__`)
  await expect(page.locator('.restaurant-slot').first()).toBeVisible({ timeout: 20000 })
}

test.describe('the restaurant page', () => {
  test('opens from the menu and paints each slot\'s tables against the room and the assistant\'s share', async ({ authenticatedPage: page }, testInfo) => {
    await mockPage(page)
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}`)
    const narrowMenu = page.locator('.header_buttonbar button')
    if (await narrowMenu.isVisible()) await narrowMenu.click()
    await page.getByRole('menuitem', { name: 'Bookings' }).locator('visible=true').first().click()
    await expect(page.locator('.restaurant-slot')).toHaveCount(2, { timeout: 20000 })
    const first = page.locator('.restaurant-slot').first()
    await expect(first.locator('.restaurant-table-use')).toHaveText(['0/2 tables of 2', '1/2 tables of 4'])
    // What is painted, not only the attribute: the assistant's share reached is drawn apart from free,
    // and a slot over the room apart from both.
    const colour = loc => loc.evaluate(el => getComputedStyle(el).backgroundColor)
    const free = await colour(first.locator('[data-state="free"]'))
    const staffOnly = await colour(first.locator('[data-state="staff"]'))
    const over = await colour(page.locator('.restaurant-slot').nth(1).locator('[data-state="over"]'))
    expect(new Set([free, staffOnly, over]).size).toBe(3)
    await expect(page.locator('.restaurant-booking')).toContainText(['20:00'])
    await expect(page.locator('.restaurant-booking').first()).toContainText('1 × table of 4')
    // No raw server English anywhere on the page
    await expect(page.locator('.restaurant').getByText(/overbook: true|does not fit there/)).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('restaurant.png'), fullPage: true })
  })

  test('says a refusal in its own words and books anyway on request', async ({ authenticatedPage: page }) => {
    const calls = await mockPage(page, { bookStatus: 409 })
    await openPage(page)
    const form = page.locator('.restaurant-new')
    await form.locator('input[type="time"]').fill('20:00')
    await form.getByRole('button', { name: 'Book' }).click()
    await expect(page.getByText('There is no room at that time.')).toBeVisible()
    await expect(page.getByText(/send overbook/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Book anyway' }).click()
    await expect(page.getByText('Booking saved.')).toBeVisible()
    const posts = calls.filter(c => c.method === 'POST' && c.path.endsWith('/reservations'))
    expect(posts.map(c => !!c.body.overbook)).toEqual([false, true])
    expect(posts[1].body).toMatchObject({ time: '20:00', covers: 2 })
  })

  test('accepts a request at the version it read', async ({ authenticatedPage: page }) => {
    const calls = await mockPage(page)
    await openPage(page)
    await page.locator('.restaurant-request').getByRole('button', { name: 'Accept' }).click()
    await expect(page.getByText('Request accepted.')).toBeVisible()
    const accept = calls.find(c => c.path.endsWith('/reservations/r2/accept'))
    expect(accept && accept.body).toEqual({ expectedVersion: 3 })
  })

  test('saves the room to the skill instance with the revision it read, tables as the skill stores them', async ({ authenticatedPage: page }) => {
    const calls = await mockPage(page)
    await openPage(page)
    const settings = page.locator('.restaurant-settings')
    await expect(settings.locator('.restaurant-table-type')).toHaveCount(2)
    await settings.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Settings saved.')).toBeVisible()
    const put = calls.find(c => c.method === 'PUT')
    expect(put.url).toContain('/during/restaurant_booking_1')
    expect(put.body.expectedRevision).toBe('rev-1')
    expect(put.body.skill).toBe('skill_restaurant_booking')
    expect(JSON.parse(put.body.params.tables)).toEqual({ indoor: [{ size: 2, count: 2, minParty: 1 }, { size: 4, count: 2, minParty: 3 }] })
    expect(put.body.params.assistantShare).toBe('100')
    expect(put.body.params.enabled).toBe('true')
  })

  test('reloads and says so when the room changed in the meantime', async ({ authenticatedPage: page }) => {
    await mockPage(page, { putStatus: 409 })
    await openPage(page)
    await page.locator('.restaurant-settings').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('The settings changed in the meantime', { exact: false })).toBeVisible()
  })

  // Seen failing on 2026-10-06 with the page's Remove not wired (no DELETE left the page).
  test('stops a service and removes a block with the version read', async ({ authenticatedPage: page }) => {
    const calls = await mockPage(page)
    await openPage(page)
    await page.locator('.restaurant-service').getByRole('button', { name: 'Stop bookings' }).click()
    await expect(page.getByText('Bookings stopped for this service.')).toBeVisible()
    const stop = calls.find(c => c.path.endsWith('/stop-sell'))
    expect(stop.body).toMatchObject({ service: 'dinner' })
    expect(typeof stop.body.idempotencyKey).toBe('string')
    const block = page.locator('.restaurant-block')
    await expect(block).toContainText('2 × table of 2')
    await block.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('Cancelled.')).toBeVisible()
    const removal = calls.find(c => c.method === 'DELETE')
    expect(removal && removal.path).toMatch(/\/reservations\/b1$/)
    expect(removal.search).toBe('?expectedVersion=2')
  })

  test('says the book is not available on a server without the restaurant routes', async ({ authenticatedPage: page }) => {
    await mockPage(page, { restaurant: false })
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__RESTAURANT__`)
    await expect(page.getByText('The table book is not available on this server yet.', { exact: false })).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.restaurant-new')).toHaveCount(0)
  })

  test('has no footer Save for an owner', async ({ authenticatedPage: page }) => {
    await mockPage(page)
    await openPage(page)
    await expect(page.locator('#footer')).toHaveCount(0)
  })

  // Seen failing on 2026-10-06 with the page recognising only skill_restaurant_booking: no menu item.
  test('recognises a configuration written with the short skill name, and saves under that name', async ({ authenticatedPage: page }) => {
    const calls = await mockPage(page, { skill: 'restaurant_booking' })
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}`)
    const narrowMenu = page.locator('.header_buttonbar button')
    if (await narrowMenu.isVisible()) await narrowMenu.click()
    await page.getByRole('menuitem', { name: 'Bookings' }).locator('visible=true').first().click()
    await expect(page.locator('.restaurant-settings .restaurant-table-type')).toHaveCount(2, { timeout: 20000 })
    await page.locator('.restaurant-settings').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Settings saved.')).toBeVisible()
    expect(calls.find(c => c.method === 'PUT').body.skill).toBe('restaurant_booking')
  })

  // Seen failing on 2026-10-06 with the section opening the book for a business without the skill.
  test('says there is no book on the section URL of a business without the skill', async ({ authenticatedPage: page }) => {
    await mockPage(page, { skill: null })
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}&section=__RESTAURANT__`)
    await expect(page.getByText('This assistant does not take table bookings', { exact: false })).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.restaurant-new')).toHaveCount(0)
    await expect(page.locator('.restaurant-settings')).toHaveCount(0)
  })

  // Seen failing on 2026-10-06 with a row whose size was cleared dropped from the save in silence.
  test('refuses to save a table row whose size was cleared, and says why', async ({ authenticatedPage: page }) => {
    const calls = await mockPage(page)
    await openPage(page)
    const size = page.locator('.restaurant-settings .restaurant-table-type').first().locator('input').first()
    await size.click()
    await size.press('ControlOrMeta+a')
    await size.press('Backspace')
    await size.press('Tab')
    await page.locator('.restaurant-settings').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Every table needs a size: fill it in or remove the row.')).toBeVisible()
    expect(calls.filter(c => c.method === 'PUT')).toHaveLength(0)
  })
})
