// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')
const { mockRestaurant, openRestaurant, tomorrowDinner, TODAY, TOMORROW } = require('../fixtures/restaurant')

/**
 * "Prenotazioni Ristorante", end to end against a StarChat book in memory (fixtures/restaurant.js): the
 * evening (period strip, tables by zone judged by the minimum free time, the finder, the list and the
 * booking panel), the call that made a booking, the room editor and the first-run wizard. Each test drives
 * the page as a person does and checks what reached the server.
 *
 * Seen failing: on 2026-10-11 the suite ran against the counts page it replaces (desktop): 20 failed, and
 * the one that passed is the notice on a server without the routes, a behaviour the new page keeps. Each of
 * these was also seen failing on the new page with one fault put in (Undo at the version read instead of the
 * new one; the calls oldest first; the layout section sent with the minimum free time; the minimum free time
 * ignored by the tiles; the cancel confirmation without "Keep it" focused). After the page moved to StarChat
 * 9.34.63's shapes: the day read without `freeTables` fails the first test (the tiles read the server's
 * windows, nothing else), and the finder asking no later time fails the "nothing free" test. Tests that need a mouse drag
 * run on the desktop project only.
 */

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number)
  const x = new Date(y, m - 1, d)
  x.setDate(x.getDate() + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

async function ready (page) {
  await expect(page.locator('.strip .dcell').first()).toBeVisible({ timeout: 20000 })
}

/** Taps a control a third of the way down the screen: on phones the dashboard's support bar covers the
 *  bottom half and its header the top. */
async function tap (locator) {
  await locator.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - window.innerHeight * 0.3))
  await locator.click()
}

function tile (page, name) {
  return page.locator(`.tile[data-table="${name}"]`)
}

test.describe('the restaurant page', () => {
  test('opens from the menu on the evening: the strip is the server\'s, tables by zone, free judged by the minimum free time', async ({ authenticatedPage: page }, testInfo) => {
    await mockRestaurant(page)
    await page.goto(`/businessconfiguration?id=${mockBusiness.businessId}`)
    const narrowMenu = page.locator('.header_buttonbar button')
    if (await narrowMenu.isVisible()) await narrowMenu.click()
    await page.getByRole('menuitem', { name: 'Restaurant bookings', exact: true }).locator('visible=true').first().click()
    await expect(page).toHaveURL(/[?&]section=__RESTAURANT_BOOKING__(&|$)/)
    await ready(page)
    await expect(page.locator('.strip .dcell')).toHaveCount(14)
    const cell = key => page.locator(`.dcell[data-date="${key}"]`)
    await expect(cell(addDays(TODAY, 3)).locator('[data-service="dinner"]')).toContainText('full')
    await expect(cell(addDays(TODAY, 5)).locator('[data-service="dinner"]')).toContainText('closed')
    await expect(cell(TOMORROW).locator('[data-service="dinner"]')).toContainText('max 6')
    await expect(cell(TOMORROW).locator('[data-service="dinner"]')).toContainText('12 cov.')

    await tomorrowDinner(page)
    await expect(page.locator('.zone[data-zone="sala"] h3')).toHaveText('Dining room')
    await expect(page.locator('.zone[data-zone="dehors"] h3')).toHaveText('Terrace')
    // T3 frees at 20:00 for 30 minutes before Verdi's 20:30: under a 90-minute minimum it is not free.
    await expect(tile(page, 'T3')).toHaveClass(/short/)
    await expect(tile(page, 'T3')).toContainText('not available')
    await expect(tile(page, 'T1')).toHaveClass(/free/)
    await expect(tile(page, 'T4')).toContainText('Rossi')
    await expect(page.locator('.free-count b')).toHaveText('4')
    // What is painted, not only the class: free is green, too short is grey.
    const bg = loc => loc.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(await bg(tile(page, 'T1'))).not.toBe(await bg(tile(page, 'T3')))
    await expect(page.locator('.restaurant').getByText(/server English/)).toHaveCount(0)
    await expect(page.locator('#footer')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('restaurant-evening.png'), fullPage: true })
  })

  test('the finder asks the server where a party sits, books there, and Undo cancels it', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.getByRole('button', { name: 'One person more' }).click()
    await page.getByRole('button', { name: 'One person more' }).click()
    const best = page.locator('.find-line .chip').first()
    await expect(best).toHaveText('T1 (recommended)')
    // one question per party size, at the time chosen: 1, then 2, at 20:00
    expect(calls.filter(c => c.path === '/suggestions').map(c => c.search).slice(0, 2))
      .toEqual([`?date=${TOMORROW}&time=20%3A00&covers=1`, `?date=${TOMORROW}&time=20%3A00&covers=2`])
    await expect(tile(page, 'T1')).toHaveClass(/fit/)
    await best.click()
    const panel = page.locator('.panel')
    await expect(panel.getByRole('heading', { name: 'New booking' })).toBeVisible()
    await panel.getByLabel('Name').fill('Neri')
    await panel.locator('.save-btn').click()
    await expect(page.locator('.toast')).toContainText('Saved: Neri')
    const post = calls.find(c => c.method === 'POST' && c.path === '/reservations')
    expect(post.body).toMatchObject({ date: TOMORROW, time: '20:00', covers: 2, name: 'Neri', tableIds: [1] })
    expect(typeof post.body.idempotencyKey).toBe('string')
    await expect(tile(page, 'T1')).toContainText('Neri')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.method === 'DELETE').map(c => c.path + c.search)).toEqual(['/reservations/n1?expectedVersion=1'])
  })

  test('with nothing free the finder asks the next times and offers them; a failing finder says so', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    // T6 (6 seats) is Bianchi's from 19:30 to 21:30: a party of 6 fits again at 21:30.
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'One person more' }).click()
    await expect(page.locator('.find-line')).toContainText('For 6 at 20:00: no table')
    await expect(page.locator('.find-line .chip').first()).toHaveText('21:30')
    expect(calls.filter(c => c.path === '/suggestions' && new URLSearchParams(c.search).get('covers') === '6').length).toBeGreaterThan(1)
  })

  test('a finder that fails says so instead of guessing', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { suggestions: false })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.getByRole('button', { name: 'One person more' }).click()
    await expect(page.locator('.find-line')).toContainText('Something went wrong')
    await expect(page.locator('.find-line .chip')).toHaveCount(0)
  })

  test('seats a guest in one tap from the list, and Undo puts the state back at the new version', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).getByRole('button', { name: 'Seated' }).click()
    await expect(page.locator('.toast')).toContainText('Rossi: seated')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.path === '/reservations/b-rossi/state').map(c => c.body))
      .toEqual([{ expectedVersion: 1, state: 'seated' }, { expectedVersion: 2, state: null }])
  })

  test('asks before cancelling, naming the party with "Keep it" focused and readable, and sends nothing on keep', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).click()
    const panel = page.locator('.panel')
    await panel.getByRole('button', { name: 'Cancel booking' }).click()
    const confirm = page.locator('.mrcall-confirm-dialog')
    await expect(confirm).toContainText('Rossi')
    await expect(confirm).toContainText('20:00')
    await expect(confirm).toContainText('4 people')
    const keep = confirm.getByRole('button', { name: 'Keep it' })
    await expect(keep).toBeFocused()
    await expect(keep).toHaveCSS('color', 'rgb(255, 255, 255)')
    await keep.click()
    await expect(confirm).toHaveCount(0)
    expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
    await panel.getByRole('button', { name: 'Cancel booking' }).click()
    await confirm.getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.locator('.toast')).toContainText('Cancelled: Rossi')
    expect(calls.filter(c => c.method === 'DELETE').map(c => c.path + c.search)).toEqual(['/reservations/b-rossi?expectedVersion=1'])
  })

  test('marks a no-show after confirming, and shows the phone as a number to call and to write to', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).click()
    const panel = page.locator('.panel')
    await expect(panel.locator('a.restaurant-phone')).toHaveText('+39 333 111 2233')
    await expect(panel.locator('a.restaurant-phone')).toHaveAttribute('href', 'tel:+393331112233')
    await expect(panel.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/393331112233')
    await expect(panel).toContainText('Celiac')
    await panel.getByRole('button', { name: 'No-show' }).click()
    await page.locator('.mrcall-confirm-dialog').getByRole('button', { name: 'Mark as no-show' }).click()
    await expect(page.locator('.toast')).toContainText('Rossi: marked as no-show')
    expect(calls.filter(c => c.path.endsWith('/no-show')).map(c => c.search)).toEqual(['?expectedVersion=1'])
  })

  test('reads the calls that made and changed a booking, newest first, and returns to the same booking', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Read the call' }).click()
    const dialog = page.locator('.restaurant-call-dialog')
    await expect(dialog).toContainText('Asked to move the booking')
    await expect(dialog.getByRole('button', { name: 'Latest call' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('button', { name: 'First call' }).click()
    await expect(dialog).toContainText('Booked a table for 4 tomorrow at 20:00.')
    await expect(dialog).toContainText('A table for four tomorrow at eight.')
    expect(calls.filter(c => c.path === '/conversation/search').map(c => c.body.id)).toEqual(['CON-moved', 'CON-made'])
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.panel h2')).toHaveText('Rossi')
    await expect(page.locator(`.dcell[data-date="${TOMORROW}"]`)).toHaveClass(/sel/)
    // A staff booking and a walk-in were made by no call: nothing to read.
    await page.locator('.panel').getByRole('button', { name: 'Close' }).click()
    await page.locator('.brow', { hasText: 'Verdi' }).click()
    await expect(page.locator('.panel h2')).toHaveText('Verdi')
    await expect(page.locator('.panel').getByRole('button', { name: 'Read the call' })).toHaveCount(0)
  })

  test('moves a booking from its panel by tapping a free table, and Undo moves it back', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Move' }).click()
    await expect(page.locator('.move-banner')).toContainText('Move Rossi')
    await expect(tile(page, 'T5')).toHaveClass(/fit/)
    await tap(tile(page, 'T5'))
    await expect(page.locator('.toast')).toContainText('Rossi moved to T5')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.method === 'PATCH').map(c => c.body))
      .toEqual([{ expectedVersion: 1, tableIds: [5] }, { expectedVersion: 2, tableIds: [4], time: '20:00' }])
  })

  test('moves a booking by dragging it onto a free table', async ({ authenticatedPage: page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'a drag needs a mouse')
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tile(page, 'T4').dragTo(tile(page, 'T5'))
    await expect(page.locator('.toast')).toContainText('Rossi moved to T5')
    expect(calls.filter(c => c.method === 'PATCH').map(c => c.body)).toEqual([{ expectedVersion: 1, tableIds: [5] }])
  })

  test('seats a walk-in in two taps: a free table, then how many', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tap(tile(page, 'D2'))
    await page.locator('.panel .walkin').getByRole('button', { name: '2', exact: true }).click()
    await expect(page.locator('.toast')).toContainText('Walk-in of 2 seated')
    const post = calls.find(c => c.method === 'POST' && c.path === '/reservations')
    expect(post.body).toMatchObject({ date: TODAY, covers: 2, walkIn: true, tableIds: [8] })
  })

  test('a refused booking says why in its panel, offers the free time, and books anyway on request', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { refuseBook: 'full' })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.new-booking').click()
    const panel = page.locator('.panel')
    await panel.getByLabel('Name').fill('Neri')
    await panel.locator('.save-btn').click()
    await expect(panel.locator('.refusal')).toContainText('There is no room at that time.')
    await expect(panel.locator('.refusal').getByRole('button', { name: '21:15' })).toBeVisible()
    await expect(page.getByText(/server English/)).toHaveCount(0)
    await panel.getByRole('button', { name: 'Book anyway' }).click()
    await expect(page.locator('.toast')).toContainText('Saved: Neri')
    const posts = calls.filter(c => c.method === 'POST' && c.path === '/reservations')
    expect(posts.map(c => !!c.body.overbook)).toEqual([false, true])
  })

  test('accepts a request at the version read, and opens the call it came from', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const request = page.locator('.req', { hasText: 'Galli' })
    await expect(request).toContainText('Large party')
    await request.getByRole('button', { name: 'Read the call' }).click()
    await expect(page.locator('.restaurant-call-dialog')).toContainText('A party of nine.')
    await page.keyboard.press('Escape')
    await request.getByRole('button', { name: 'Accept' }).click()
    await expect(page.locator('.toast')).toContainText('Request accepted: Galli')
    expect(calls.filter(c => c.path.endsWith('/accept')).map(c => c.body)).toEqual([{ expectedVersion: 1 }])
  })

  test('"Good to know" names who has allergies and who is a large party, and highlights them', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.getByRole('button', { name: '1 with allergies' }).click()
    await expect(page.locator('.know-pop')).toContainText('Rossi')
    await expect(page.locator('.know-pop')).toContainText('Celiac')
    await expect(tile(page, 'T4')).toHaveClass(/hit/)
    await page.getByRole('button', { name: '1 party of 6+' }).click()
    await expect(page.locator('.know-pop')).toContainText('Bianchi')
  })

  test('search finds a booking on another day and opens it there', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await page.getByRole('searchbox', { name: 'Search a booking by name or phone' }).fill('Ross')
    await page.locator('.sr-item', { hasText: 'Rossi' }).click()
    await expect(page.locator('.panel h2')).toHaveText('Rossi')
    await expect(page.locator(`.dcell[data-date="${TOMORROW}"]`)).toHaveClass(/sel/)
  })

  test('exports the days shown as the server\'s CSV', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    expect((await download).suggestedFilename()).toBe(`prenotazioni-${TODAY}-${addDays(TODAY, 13)}.csv`)
    expect(calls.filter(c => c.path === '/export').map(c => c.search)).toEqual([`?from=${TODAY}&to=${addDays(TODAY, 13)}`])
  })

  test('the room: generated tables and a join by name are saved as one layout at its revision, the minimum free time through the skill', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await page.getByRole('tab', { name: 'Room and tables' }).click()
    const editor = page.locator('.room-editor')
    await editor.getByLabel('How many tables').fill('2')
    await editor.getByLabel('Seats per table').fill('4')
    await editor.getByLabel('Area', { exact: true }).selectOption('dehors')
    await expect(editor.locator('.gen .names')).toContainText('D3, D4')
    await editor.locator('.gen').getByRole('button', { name: 'Add' }).click()
    await tap(editor.locator('.pick').last().getByLabel('D3'))
    await tap(editor.locator('.pick').last().getByLabel('D4'))
    await editor.getByRole('button', { name: 'Create join' }).click()
    // the limits are the skill's: 1 to the longest table time (150)
    await editor.getByLabel('Minimum free time in minutes').fill('200')
    await expect(editor.locator('.issues')).toContainText('between 1 and 150 minutes')
    await expect(editor.locator('.save-room')).toBeDisabled()
    await editor.getByLabel('Minimum free time in minutes').fill('60')
    const pending = editor.locator('.pending')
    await expect(pending).toContainText('Tables added: D3, D4')
    await expect(pending).toContainText('Join added: D3+D4 (5-8)')
    await expect(pending).toContainText('Minimum free time: 90 → 60 min')
    await editor.locator('.save-room').click()
    await expect(page.locator('.toast')).toContainText('3 changes saved')
    const put = calls.find(c => c.method === 'PUT' && c.path === '/layout')
    expect(put.body.expectedRevision).toBe(3)
    expect(put.body.layout.tables.filter(t => t.zone === 'dehors')).toEqual([
      { id: 7, name: 'D1', zone: 'dehors', min: 1, max: 2, active: true },
      { id: 8, name: 'D2', zone: 'dehors', min: 1, max: 2, active: true },
      { name: 'D3', zone: 'dehors', min: 2, max: 4, active: true },
      { name: 'D4', zone: 'dehors', min: 2, max: 4, active: true }])
    expect(put.body.layout.joins).toContainEqual({ tables: ['D3', 'D4'], min: 5, max: 8 })
    expect(put.body.layout.nextTableId).toBeUndefined()
    const skill = calls.find(c => c.method === 'PUT' && c.path.includes('/skills/configuration/'))
    expect(skill.path).toContain('/during/restaurant_booking_1')
    expect(skill.body.expectedRevision).toBe('rev-1')
    expect(skill.body.params.minFreeMinutes).toBe('60')
    expect(skill.body.params.layout).toBeUndefined()
    expect(skill.body.params.dinner).toContain('19:00-22:00')
    // the server's ids are on the page now: nothing is left to save
    await expect(editor.locator('.savebar')).toContainText('No changes')
  })

  test('the room: removing a table someone is booked on is refused, naming who', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    // Read tomorrow first, as a person who has looked at the evening: the page knows who sits on T4.
    await tomorrowDinner(page)
    await page.getByRole('tab', { name: 'Room and tables' }).click()
    const editor = page.locator('.room-editor')
    await editor.getByRole('button', { name: 'Delete T4' }).click()
    await expect(page.locator('.toast')).toContainText('T4 cannot be deleted')
    await expect(page.locator('.toast')).toContainText('Rossi')
    // The server is the judge: T5 is booked on a day the page has not read, so the page lets the removal
    // through and the save is refused, naming the table.
    await editor.getByRole('button', { name: 'Delete T5' }).click()
    await editor.locator('.save-room').click()
    await expect(editor.locator('.issues')).toContainText('T5: it has future bookings')
    expect(calls.filter(c => c.method === 'PUT' && c.path === '/layout')).toHaveLength(1)
    // Discarding asks first, with "Keep it" focused.
    await editor.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.locator('.mrcall-confirm-dialog').getByRole('button', { name: 'Keep it' })).toBeFocused()
  })

  test('a restaurant without tables opens on the wizard and saves its first room, numbered by the server', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { layout: false })
    await openRestaurant(page)
    await expect(page.getByRole('heading', { name: 'Let\'s set up the room' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: 'Terrace' }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    // named as the prototype names them: a zone's initial (Sala alone gives T), unique across zones
    await expect(page.locator('.wz-zone[data-zone="Dining room"]')).toContainText('D1, D2, D3, D4, D5, D6, D7, D8, D9, D10')
    await expect(page.locator('.wz-zone[data-zone="Terrace"]')).toContainText('T1, T2, T3, T4')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.locator('.wz-zone', { hasText: 'Dining room' }).getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Done: open the evening' }).click()
    await ready(page)
    await expect(page.locator('.toast')).toContainText('Room ready: 14 tables')
    const put = calls.find(c => c.method === 'PUT' && c.path === '/layout')
    expect(put.body.expectedRevision).toBeNull()
    expect(put.body.layout.zones.map(z => [z.id, z.name])).toEqual([['dining-room', 'Dining room'], ['terrace', 'Terrace']])
    expect(put.body.layout.tables.every(t => t.id === undefined)).toBe(true)
    expect(put.body.layout.joins[0]).toEqual({ tables: ['D1', 'D2'], min: 3, max: 4 })
    await expect(tile(page, 'T4')).toBeVisible()
  })

  test('a restaurant without hours is asked for them before any table', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { layout: false, hours: false })
    await openRestaurant(page)
    await expect(page.getByRole('heading', { name: 'When do guests arrive?' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  })

  test('says the book is not available on a server without the restaurant routes', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { restaurant: false })
    await openRestaurant(page)
    await expect(page.getByText('The table book is not available on this server yet.', { exact: false })).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.strip')).toHaveCount(0)
  })

  test('opens the room editor from a link that names its tab', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    await openRestaurant(page, '&tab=room')
    await expect(page.locator('.room-editor')).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('tab', { name: 'Room and tables' })).toHaveAttribute('aria-selected', 'true')
  })
})
