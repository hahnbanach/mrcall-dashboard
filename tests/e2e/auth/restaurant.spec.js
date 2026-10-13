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
 * windows, nothing else), and the finder asking no later time fails the "nothing free" test. After StarChat R5
 * (reinstate, search, pastNoShows, the finder's later times), each failed with one fault put in: a cancellation
 * without Undo, a table_taken refusal said as a plain error, pastNoShows not read, the server's later times
 * ignored. Tests that need a mouse drag
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
    // the phone is required by the manifest's default (R8, "what we ask for every booking")
    await panel.getByLabel('Phone').fill('393331234567')
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

  test('with nothing free the finder offers the next times the server gives', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    // T6 (6 seats) is Bianchi's from 19:30 to 21:30: a party of 6 fits again at 21:30.
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'One person more' }).click()
    await expect(page.locator('.find-line')).toContainText('For 6 at 20:00: no table')
    await expect(page.locator('.find-line .chip').first()).toHaveText('21:30')
    // the later times are the server's answer to the one question at 20:00, not more questions
    expect(calls.filter(c => c.path === '/suggestions' && new URLSearchParams(c.search).get('covers') === '6').map(c => new URLSearchParams(c.search).get('time'))).toEqual(['20:00'])
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

  test('cancels in one tap, and Undo reinstates it at the version the cancellation answered', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.locator('.mrcall-confirm-dialog')).toHaveCount(0)
    await expect(page.locator('.toast')).toContainText('Cancelled: Rossi')
    await expect(tile(page, 'T4')).toHaveClass(/free/)
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    await expect(tile(page, 'T4')).toContainText('Rossi')
    expect(calls.filter(c => c.method === 'DELETE').map(c => c.path + c.search)).toEqual(['/reservations/b-rossi?expectedVersion=1'])
    expect(calls.filter(c => c.path.endsWith('/reinstate')).map(c => c.path + c.search)).toEqual(['/reservations/b-rossi/reinstate?expectedVersion=2'])
  })

  test('a reinstatement whose table was taken names who took it and reinstates without a table only when asked', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.locator('.toast')).toContainText('Cancelled: Rossi')
    // T4 goes to somebody else
    await tap(tile(page, 'T4'))
    const panel = page.locator('.panel')
    await panel.getByLabel('Name').fill('Neri')
    // the phone is required by the manifest's default (R8, "what we ask for every booking")
    await panel.getByLabel('Phone').fill('393331234567')
    await panel.locator('.save-btn').click()
    await expect(page.locator('.toast')).toContainText('Saved: Neri')
    // Rossi, among the cancelled, is taken back from its panel
    await page.locator('details.gone summary').click()
    await page.locator('details.gone .brow', { hasText: 'Rossi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Reinstate' }).click()
    const confirm = page.locator('.mrcall-confirm-dialog')
    await expect(confirm).toContainText('The tables of Rossi are taken')
    await expect(confirm).toContainText('T4: Neri, 20:00, 2 people')
    await expect(confirm.getByRole('button', { name: 'Keep it' })).toBeFocused()
    await confirm.getByRole('button', { name: 'Reinstate without a table' }).click()
    await expect(page.locator('.toast')).toContainText('Rossi: reinstated with no table yet')
    expect(calls.filter(c => c.path.endsWith('/reinstate')).map(c => c.search)).toEqual(['?expectedVersion=2', '?expectedVersion=2&overbook=true'])
    // and that too can be undone: the cancellation again, at the version the reinstatement answered
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.method === 'DELETE' && c.path.endsWith('b-rossi')).map(c => c.search)).toEqual(['?expectedVersion=1', '?expectedVersion=3'])
  })

  // Declining and accepting a request have no server reverse: each is held back for the Undo window (8 s, the
  // other undo toasts' time) and sent at its end, or at once when the page is left. Seen failing on 2026-10-12,
  // one fault each: the Undo keeping the held request, no flush when the page is left, the request sent at once.
  const ANSWERS = [
    { button: 'Decline', toast: 'Request declined: Galli', method: 'DELETE', sent: c => c.method === 'DELETE',
      what: c => c.path + c.search, expected: '/reservations/b-req?expectedVersion=1' },
    { button: 'Accept', toast: 'Request accepted: Galli', method: 'POST', sent: c => c.path.endsWith('/accept'),
      what: c => c.path + JSON.stringify(c.body), expected: '/reservations/b-req/accept{"expectedVersion":1}' }
  ]

  async function answerGalli (page, a) {
    await tomorrowDinner(page)
    await page.locator('.req', { hasText: 'Galli' }).getByRole('button', { name: a.button }).click()
    await expect(page.locator('.toast')).toContainText(a.toast)
    await expect(page.locator('.req', { hasText: 'Galli' })).toHaveCount(0)
  }

  for (const a of ANSWERS) {
    // These wait the real 8 s window: under a full parallel run, load, 8 s and the reload ran past the default 30 s
    // once (tablet, 2026-10-12), so they get twice that.
    test(`${a.button} on a request: Undo inside the window brings it back and sends nothing`, async ({ authenticatedPage: page }) => {
      test.setTimeout(60000)
      const { calls } = await mockRestaurant(page)
      await openRestaurant(page)
      await ready(page)
      await answerGalli(page, a)
      await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
      await expect(page.locator('.req', { hasText: 'Galli' })).toHaveCount(1)
      await page.waitForTimeout(9000)
      expect(calls.filter(a.sent)).toHaveLength(0)
    })

    test(`${a.button} on a request: when the Undo time is up, exactly one request at the version read, and its toast goes`, async ({ authenticatedPage: page }) => {
      test.setTimeout(60000)
      const { calls } = await mockRestaurant(page)
      await openRestaurant(page)
      await ready(page)
      await answerGalli(page, a)
      expect(calls.filter(a.sent)).toHaveLength(0)
      await page.waitForRequest(r => r.method() === a.method && (a.method === 'DELETE' || r.url().endsWith('/accept')), { timeout: 15000 })
      // the Undo went with the send: one clock, no Undo of something already sent
      await expect(page.locator('.toast').getByRole('button', { name: 'Undo' })).toHaveCount(0)
      await page.waitForTimeout(2000)
      expect(calls.filter(a.sent).map(a.what)).toEqual([a.expected])
    })

    test(`${a.button} on a request: leaving the page sends it at once`, async ({ authenticatedPage: page }) => {
      const { calls } = await mockRestaurant(page)
      await openRestaurant(page)
      await ready(page)
      await answerGalli(page, a)
      const narrowMenu = page.locator('.header_buttonbar button')
      if (await narrowMenu.isVisible()) await narrowMenu.click()
      const sent = page.waitForRequest(r => r.method() === a.method && (a.method === 'DELETE' || r.url().endsWith('/accept')), { timeout: 4000 })
      await page.getByRole('menuitem', { name: 'Data retention', exact: true }).locator('visible=true').first().click()
      await sent
      expect(calls.filter(a.sent).map(a.what)).toEqual([a.expected])
    })
  }

  // StarChat's day read returns a declined request as `handled`. Seen failing on 2026-10-12 against c1fbd1c: back
  // as a guest of 9, its covers counted. The other new tests of this round (Accept held back, one-tap no-show, Undo
  // of a reinstatement, the export's name) failed against c1fbd1c too.
  test('a declined request, read again from the server, is no guest and adds no covers', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000)
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const dinner = page.locator('.svc-tab', { hasText: 'Dinner' }).locator('small')
    const before = await dinner.innerText()
    await page.locator('.req', { hasText: 'Galli' }).getByRole('button', { name: 'Decline' }).click()
    await page.waitForRequest(r => r.method() === 'DELETE', { timeout: 15000 })
    await page.getByRole('button', { name: 'Previous day' }).click()
    await page.getByRole('button', { name: 'Next day' }).click()
    await expect(page.locator('.brow', { hasText: 'Rossi' })).toHaveCount(1)
    expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(1)
    await expect(page.locator('.brow', { hasText: 'Galli' })).toHaveCount(0)
    await expect(page.locator('.req', { hasText: 'Galli' })).toHaveCount(0)
    await expect(dinner).toHaveText(before)
    await page.getByRole('searchbox', { name: 'Search a booking by name or phone' }).fill('Galli')
    await expect(page.locator('.sr-empty')).toContainText('No booking found')
  })

  // Criterion 7: a no-show is one tap, on the late guest's row; late is the tile's rule, ten minutes after the
  // arrival time. Seen failing on 2026-10-12 with the button from minute 0 (it showed at 20:05).
  test('a guest due at 20:00 is not late at 20:05, and is at 20:10', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    await page.clock.setFixedTime(new Date(`${TODAY}T20:05:00`))
    await openRestaurant(page)
    await ready(page)
    await expect(page.locator('.brow', { hasText: 'Lato' })).toHaveCount(1)
    await expect(page.locator('.brow .quick-noshow')).toHaveCount(0)
    await page.clock.setFixedTime(new Date(`${TODAY}T20:10:00`))
    await page.reload()
    await ready(page)
    await expect(page.locator('.brow', { hasText: 'Lato' }).locator('.quick-noshow')).toHaveCount(1)
  })

  // The page's clock is set to 20:20 today.
  test('a late guest is a no-show in one tap on its row, with Undo', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await page.clock.setFixedTime(new Date(`${TODAY}T20:20:00`))
    await openRestaurant(page)
    await ready(page)
    const row = page.locator('.brow', { hasText: 'Lato' })
    await row.getByRole('button', { name: 'No-show' }).click()   // the one tap
    await expect(page.locator('.toast')).toContainText('Lato: marked as no-show')
    await expect(page.locator('.panel')).toHaveCount(0)
    expect(calls.filter(c => c.path.endsWith('/no-show')).map(c => c.path + c.search)).toEqual(['/reservations/b-late/no-show?expectedVersion=1'])
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.path.endsWith('/reinstate')).map(c => c.search)).toEqual(['?expectedVersion=2'])
    // back to expected, and still late: the late guest's row is the only one that offers it
    await expect(page.locator('.brow .quick-noshow')).toHaveCount(1)
  })

  test('reinstating from the panel has Undo: the cancellation again at the version it answered', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Verdi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.locator('.toast')).toContainText('Cancelled: Verdi')
    await page.locator('details.gone summary').click()
    await page.locator('details.gone .brow', { hasText: 'Verdi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Reinstate' }).click()
    await expect(page.locator('.toast')).toContainText('Verdi: booking reinstated')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.method === 'DELETE').map(c => c.search)).toEqual(['?expectedVersion=1', '?expectedVersion=3'])
  })

  test('marks a no-show from the panel with Undo, and shows the phone as a number to call and to write to', async ({ authenticatedPage: page }) => {
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
    await expect(panel).toContainText('from the message at the bottom. On the phone the assistant said')
    await panel.getByRole('button', { name: 'No-show' }).click()
    await expect(page.locator('.mrcall-confirm-dialog')).toHaveCount(0)
    await expect(page.locator('.toast')).toContainText('Rossi: marked as no-show')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.path.endsWith('/no-show')).map(c => c.search)).toEqual(['?expectedVersion=1'])
    expect(calls.filter(c => c.path.endsWith('/reinstate')).map(c => c.search)).toEqual(['?expectedVersion=2'])
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
    // the phone is required by the manifest's default (R8, "what we ask for every booking")
    await panel.getByLabel('Phone').fill('393331234567')
    await panel.locator('.save-btn').click()
    await expect(panel.locator('.refusal')).toContainText('There is no room at that time.')
    await expect(panel.locator('.refusal').getByRole('button', { name: '21:15' })).toBeVisible()
    await expect(page.getByText(/server English/)).toHaveCount(0)
    await panel.getByRole('button', { name: 'Book anyway' }).click()
    await expect(page.locator('.toast')).toContainText('Saved: Neri')
    const posts = calls.filter(c => c.method === 'POST' && c.path === '/reservations')
    expect(posts.map(c => !!c.body.overbook)).toEqual([false, true])
  })

  test('opens the call a request came from', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const request = page.locator('.req', { hasText: 'Galli' })
    await expect(request).toContainText('Large party')
    await request.getByRole('button', { name: 'Read the call' }).click()
    await expect(page.locator('.restaurant-call-dialog')).toContainText('A party of nine.')
    await page.keyboard.press('Escape')
    await expect(page.locator('.restaurant-call-dialog')).toHaveCount(0)
    expect(calls.filter(c => c.path === '/conversation/search').map(c => c.body.id)).toEqual(['CON-req'])
  })

  test('"Good to know" names who has allergies, who is a large party and who did not come before, and highlights them', async ({ authenticatedPage: page }) => {
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
    await page.getByRole('button', { name: '1 with past no-shows' }).click()
    await expect(page.locator('.know-pop')).toContainText('Bianchi')
    await expect(page.locator('.know-pop')).toContainText('1 past no-show')
    await page.locator('.know-pop').getByRole('button', { name: 'Bianchi' }).click()
    await expect(page.locator('.panel')).toContainText('1 past no-show with this number.')
  })

  test('search asks the server once and opens a booking on another day there', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await page.getByRole('searchbox', { name: 'Search a booking by name or phone' }).fill('Ross')
    await page.locator('.sr-item', { hasText: 'Rossi' }).click()
    await expect(page.locator('.panel h2')).toHaveText('Rossi')
    await expect(page.locator(`.dcell[data-date="${TOMORROW}"]`)).toHaveClass(/sel/)
    expect(calls.filter(c => c.path === '/search').map(c => c.body)).toEqual([{ q: 'Ross', limit: 20 }])
  })

  test('exports the days shown as the server\'s CSV', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    expect((await download).suggestedFilename()).toBe(`bookings-${TODAY}-${addDays(TODAY, 13)}.csv`)
    expect(calls.filter(c => c.path === '/export').map(c => c.search)).toEqual([`?from=${TODAY}&to=${addDays(TODAY, 13)}`])
  })

  // Since R8 the room editor writes the layout alone, the exceptions kept. Seen failing on 2026-10-13 against 3448f55
  // (a minimum free time field there, and no `exceptions` on the wire).
  test('the room: generated tables and a join by name are saved as one layout at its revision, and nothing of the skill', async ({ authenticatedPage: page }) => {
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
    const pending = editor.locator('.pending')
    await expect(pending).toContainText('Tables added: D3, D4')
    await expect(pending).toContainText('Join added: D3+D4 (5-8)')
    // the settings are in "Hours and rules" now (R8): the room editor has none
    await expect(editor.getByLabel('Minimum free time', { exact: false })).toHaveCount(0)
    await editor.locator('.save-room').click()
    await expect(page.locator('.toast')).toContainText('2 changes saved')
    const put = calls.find(c => c.method === 'PUT' && c.path === '/layout')
    expect(put.body.expectedRevision).toBe(3)
    expect(put.body.layout.tables.filter(t => t.zone === 'dehors')).toEqual([
      { id: 7, name: 'D1', zone: 'dehors', min: 1, max: 2, active: true },
      { id: 8, name: 'D2', zone: 'dehors', min: 1, max: 2, active: true },
      { name: 'D3', zone: 'dehors', min: 2, max: 4, active: true },
      { name: 'D4', zone: 'dehors', min: 2, max: 4, active: true }])
    expect(put.body.layout.joins).toContainEqual({ tables: ['D3', 'D4'], min: 5, max: 8 })
    expect(put.body.layout.nextTableId).toBeUndefined()
    expect(put.body.layout.exceptions).toEqual([])
    expect(calls.filter(c => c.method === 'PUT' && c.path.includes('/skills/configuration/'))).toHaveLength(0)
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
    await expect(editor.locator('.issues')).toContainText('T5 has future bookings: move or cancel them before you remove the table')
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

  // The owner's change 2: in "What is still free" no text ever leaves its coloured box, in the longest languages
  // and Greek, on every viewport, fourteen days and month. Seen failing on 2026-10-12 with a 43-letter word injected
  // into de-DE's "max {n}" and the strip's `overflow-wrap` removed (the word ran 219 px out of its box); with the
  // injected word alone the box wraps it and the test passes, which is the behaviour it guards.
  for (const locale of ['it-IT', 'en-US', 'de-DE', 'el-GR']) {
    test(`the strip keeps every label inside its coloured box (${locale})`, async ({ authenticatedPage: page }) => {
      await page.addInitScript(l => localStorage.setItem('mrcall-user-locale', l), locale)
      await mockRestaurant(page)
      await openRestaurant(page)
      await ready(page)
      for (const mode of ['14', 'month']) {
        if (mode === 'month') await page.locator('.strip .seg button').nth(1).click()
        await expect(page.locator('.strip .dc-svc').first()).toBeVisible()
        const outside = await page.locator('.strip .dc-svc').evaluateAll(boxes => boxes.flatMap(box => {
          const b = box.getBoundingClientRect()
          return Array.from(box.querySelectorAll('*')).filter(el => el.textContent.trim()).filter(el => {
            const r = el.getBoundingClientRect()
            return r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1 || el.scrollWidth > el.clientWidth + 1
          }).map(el => `${el.textContent.trim()} (${Math.round(el.getBoundingClientRect().right - b.right)}px)`)
        }))
        expect(outside, `${locale}, ${mode}`).toEqual([])
      }
    })
  }

  // Inside the dashboard the page sits between the left menu and the open assistant panel, in a column of at most
  // 800 px: the side columns (the evening preview, the bookings list) must go below their main column rather than
  // squeeze it, and nothing may lie over anything else. Seen failing on 2026-10-12 against 945a956: at 1280, 1440
  // and 1920 wide the room editor was 277-340 px beside a 380 px preview.
  async function sideBySide (page, mainSel, sideSel) {
    return page.evaluate(([mainSel, sideSel]) => {
      const main = document.querySelector(mainSel)
      const side = document.querySelector(sideSel)
      const m = main.getBoundingClientRect()
      const s = side.getBoundingClientRect()
      const meets = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
      const overlapping = Array.from(main.querySelectorAll('*')).filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && meets(r, s)
      }).length
      // stacked either way: on a phone the list comes first
      return { below: s.top >= m.bottom - 1 || s.bottom <= m.top + 1, mainWidth: Math.round(m.width), overlapping }
    }, [mainSel, sideSel])
  }

  const WIDTHS = [1280, 1440, 1920]
  test('in the dashboard with the assistant panel open, the room editor stays readable and the preview never covers it', async ({ authenticatedPage: page }, testInfo) => {
    await mockRestaurant(page)
    for (const width of testInfo.project.name === 'desktop' ? WIDTHS : [null]) {
      if (width) await page.setViewportSize({ width, height: 900 })
      await openRestaurant(page, '&tab=room')
      await expect(page.locator('.room-editor .preview')).toBeVisible({ timeout: 20000 })
      if (testInfo.project.name === 'desktop') await expect(page.locator('#support-large')).toBeVisible()
      const r = await sideBySide(page, '.room-editor > div:first-child', '.room-editor .preview')
      expect(r.overlapping, `${width || testInfo.project.name}: elements of the editor under the preview`).toBe(0)
      expect(r.below || r.mainWidth >= 480, `${width || testInfo.project.name}: editor ${r.mainWidth}px beside the preview`).toBe(true)
    }
  })

  test('in the dashboard with the assistant panel open, the tables and the bookings list never cover each other', async ({ authenticatedPage: page }, testInfo) => {
    await mockRestaurant(page)
    for (const width of testInfo.project.name === 'desktop' ? WIDTHS : [null]) {
      if (width) await page.setViewportSize({ width, height: 900 })
      await openRestaurant(page)
      await ready(page)
      await tomorrowDinner(page)
      await expect(page.locator('.tile').first()).toBeVisible()
      const r = await sideBySide(page, '.day-body > div:first-child', '.day-body .list')
      expect(r.overlapping, `${width || testInfo.project.name}: tiles under the list`).toBe(0)
      expect(r.below || r.mainWidth >= 480, `${width || testInfo.project.name}: tables ${r.mainWidth}px beside the list`).toBe(true)
    }
  })

  // The evening preview moves through days as the day view does; clicking through days asks the server once,
  // for the day the owner stops on. Seen failing on 2026-10-12 against 945a956 (Today and Tomorrow only).
  test('the evening preview moves through days with the arrows and asks once per day it settles on', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page, '&tab=room')
    const nav = page.locator('.room-editor .preview-day')
    await expect(nav).toBeVisible({ timeout: 20000 })
    await expect.poll(() => calls.filter(c => c.path === '/layout/preview').map(c => c.body.date)).toEqual([TOMORROW])
    // three clicks in one go, as fast as a person clicking through days (a click per Playwright action could be
    // slower than the wait under a loaded machine, and ask for a day in between)
    await nav.getByRole('button', { name: 'Next day' }).evaluate(b => { b.click(); b.click(); b.click() })
    await expect.poll(() => calls.filter(c => c.path === '/layout/preview').map(c => c.body.date)).toEqual([TOMORROW, addDays(TODAY, 4)])
    await page.waitForTimeout(1200)
    expect(calls.filter(c => c.path === '/layout/preview')).toHaveLength(2)
    await nav.getByRole('button', { name: 'Today' }).click()
    await expect.poll(() => calls.filter(c => c.path === '/layout/preview').map(c => c.body.date)).toEqual([TOMORROW, addDays(TODAY, 4), TODAY])
    await nav.getByRole('button', { name: 'Previous day' }).click()
    await expect.poll(() => calls.filter(c => c.path === '/layout/preview').pop().body.date).toBe(addDays(TODAY, -1))
  })

  // A warning about the room says what happens, with the numbers, and what the owner can do; without the server's
  // values it says the same without numbers, never the server's English. Seen failing on 2026-10-12 against
  // 945a956 (no numbers: "The largest party the assistant books does not fit any table or join").
  test('the room\'s warnings say what happens with the numbers, and what to do', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    await openRestaurant(page, '&tab=room')
    const issues = page.locator('.room-editor .issues')
    await expect(issues).toContainText('Good to know (you can save anyway)', { timeout: 20000 })
    await expect(issues).toContainText('The assistant accepts parties of up to 10 people, but the largest table or join seats 8. It does not book parties of 9 to 10')
    await expect(issues).toContainText('No table or join fits a party of 5')
    await expect(issues.getByText(/no seating takes it|larger parties become requests/)).toHaveCount(0)
  })

  test('without the server\'s values the warnings are said without numbers, never in its English', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { values: false })
    await openRestaurant(page, '&tab=room')
    const issues = page.locator('.room-editor .issues')
    await expect(issues).toContainText('The assistant accepts parties larger than the largest table or join', { timeout: 20000 })
    await expect(issues).toContainText('For some party sizes no table or join fits')
    await expect(issues.getByText(/\{|no seating takes it|larger parties become requests/)).toHaveCount(0)
  })

  // A setting not stored is StarChat's default, the manifest's (120 for the minimum free time): the field is
  // empty, says it is the default and what it is. Seen failing on 2026-10-12 against e228974 (90, the table time).
  // Since R8 the setting lives in "Hours and rules"; this and the next test were seen failing on 2026-10-13 against
  // 3448f55, where it was in the room editor.
  test('an unset minimum free time shows the manifest\'s default, as the default', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { minFree: false })
    await openRestaurant(page, '&tab=rules')
    const field = page.locator('.rules-editor [data-setting="minFreeMinutes"]')
    const input = field.getByRole('spinbutton')
    await expect(input).toHaveValue('', { timeout: 20000 })
    await expect(input).toHaveAttribute('placeholder', '120')
    await expect(field).toContainText('Default: 120 minutes')
    await expect(field.locator('.default-tag')).toBeVisible()
    await expect(page.locator('.rules-editor .savebar')).toContainText('No changes')
  })

  // A stored value different from the default shows that value, and emptying the field goes back to the default,
  // written as unset. Seen failing on 2026-10-12 against 8a110e9: the hint said "it is 120" over a stored 90, and
  // the emptied field was refused as not a number.
  test('a stored minimum free time shows as itself, and emptying it goes back to the default, written as unset', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page, '&tab=rules')
    const field = page.locator('.rules-editor [data-setting="minFreeMinutes"]')
    const input = field.getByRole('spinbutton')
    await expect(input).toHaveValue('90', { timeout: 20000 })
    await expect(field).toContainText('Default: 120 minutes')
    await expect(field.locator('.default-tag')).toHaveCount(0)
    // the limits are the skill's: 1 to the longest table time (150)
    await input.fill('200')
    await expect(page.locator('.rules-editor .issues')).toContainText('Minimum free time: between 1 and 150')
    await expect(page.locator('.rules-editor .save-rules')).toBeDisabled()
    await input.fill('')
    await expect(field.locator('.default-tag')).toBeVisible()
    await expect(page.locator('.rules-editor .pending')).toContainText('Minimum free time: 90 → default (120)')
    await page.locator('.rules-editor .save-rules').click()
    await expect(page.locator('.toast')).toContainText('1 change saved')
    const put = calls.find(c => c.method === 'PUT' && c.path.includes('/skills/configuration/'))
    expect(put.path).toContain('/during/restaurant_booking_1')
    expect(put.body.expectedRevision).toBe('rev-1')
    expect('minFreeMinutes' in put.body.params).toBe(false)
    expect(put.body.params.layout).toBeUndefined()
    expect(put.body.params.dinner).toContain('19:00-22:00')
  })

  // Without the skill's manifest the page has no defaults to show: it says so and reads it again on request,
  // never drawing with numbers of its own. Seen failing on 2026-10-12 against 8a110e9 (drawn with fallbacks,
  // and a failed read kept for good).
  test('a catalogue that could not be read is said, and read again on request', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { manifest: 'once' })
    await openRestaurant(page)
    const missing = page.locator('.restaurant-manifest-missing')
    await expect(missing).toContainText('could not be read', { timeout: 20000 })
    await expect(page.locator('.strip')).toHaveCount(0)
    await missing.getByRole('button', { name: 'Try again' }).click()
    await ready(page)
    await expect(missing).toHaveCount(0)
  })

  // The largest party the assistant books by itself is the assistant's policy (R8): the page does not edit it, and the
  // warning about it leads to the skill form. Seen failing on 2026-10-13 against 3448f55, where the room editor had
  // the field and the warning focused it.
  test('the largest party is not edited in the page: its warning leads to the skill form', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page)
    await openRestaurant(page, '&tab=room')
    const issues = page.locator('.room-editor .issues')
    await expect(issues).toContainText('Good to know (you can save anyway)', { timeout: 20000 })
    await expect(page.getByLabel('Largest party the assistant books by itself')).toHaveCount(0)
    const link = issues.getByRole('link', { name: 'Change it in the skill settings' })
    await expect(link).toHaveAttribute('href', /section=__SKILLS__/)
    await issues.getByRole('button', { name: 'Go to the joins' }).click()
    await expect(page.locator('.room-editor [data-ref="joins"]')).toBeFocused()
  })
})

