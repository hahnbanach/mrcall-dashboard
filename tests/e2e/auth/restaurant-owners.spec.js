// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockRestaurant, openRestaurant, tomorrowDinner, TODAY, TOMORROW } = require('../fixtures/restaurant')

/**
 * One owner per setting, from the page's side (StarChat plan, M6b; brief, addendum 2026-10-12 (2)): "Hours and
 * rules" with "what we ask for every booking" and the one list of closures, the booking form following the setting,
 * staff warnings before they confirm, the missing-fields refusal, a request accepted with its missing fields, the
 * call-back request about a change, the overbooking's intended tables, bookings on a closed day, the page switched
 * off. Against the StarChat book in memory (fixtures/restaurant.js), which answers in R8's shapes.
 *
 * Seen failing first, 2026-10-13: this file and skills-restaurant.spec.js against the page before M6b (src at
 * 3448f55, desktop): 19 failed of 19. On this page, one fault at a time, each failing the test it names: the booking
 * form drawing every field whatever the setting (the required-fields test); the allergies option never disabled
 * (the allergies test); the calendar's closures drawn with a remove button (the closures test); the closed
 * service's bookings not listed (the closed-day test); the closed mark never drawn (the closed-area test); a request
 * not marked (the inbox test); the walk-in sending only its table and party (both walk-in tests, against the
 * mock applying the server's walk-in rule); the staff
 * warnings not drawn (the warnings test); the missing-fields refusal said without its fields (the refusal test); a
 * request accepted without asking its missing field (the accept test); "make the change" without the closing
 * DELETE (the call-back test, before the apply route); the two-call path back in place of POST .../apply (every
 * call-back test asserting one apply call); Undo of an apply reinstating or rewriting the booking instead of the
 * book's reverse (the cancellation and Undo tests); the request's details not pre-filled (the call-back test); a late arrival treated as
 * a move (the late-arrival test); the kind not read (the late-arrival test: no "will arrive late"); the page not going
 * to the day the request names (the other-day test); a cancellation pre-filling the editor (the
 * cancellation test); `recognised` not read (the recognised test); `openRequest` not read, or acted on without
 * its own version (the other-day-request tests); the editor drawing a not-asked field, or its Undo at the version read rather than
 * the one answered (the details test); a not-asked allergy hidden although stored (the stored-allergy test); `intendedTableIds` not read (the overbooking test); the menu ignoring the page
 * switch (the menu test); the instance's page switch not read (the page-off test: the day was asked).
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

/** Taps a control a third of the way down the screen: on phones the dashboard's support bar covers the bottom. */
async function tap (locator) {
  await locator.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - window.innerHeight * 0.3))
  await locator.click()
}

async function openRules (page, opts) {
  const book = await mockRestaurant(page, opts)
  await openRestaurant(page, '&tab=rules')
  await expect(page.locator('.rules-editor')).toBeVisible({ timeout: 20000 })
  return book
}

const applies = c => c.method === 'POST' && c.path.endsWith('/apply')
/** No booking write and no request close outside the one apply call (StarChat 2d055d7e6). */
const twoCalls = c => c.method === 'PATCH' || c.method === 'DELETE'
const choice = (page, field, name) => page.locator(`.ask-editor [data-ask="${field}"]`).getByRole('radio', { name, exact: true })

test.describe('the restaurant page, one owner per setting', () => {
  test('what we ask for every booking is saved in the instance, and the booking form follows it with no deploy', async ({ authenticatedPage: page }) => {
    const { calls } = await openRules(page)
    await expect(page.locator('.ask-editor .ask-fixed')).toContainText('Always required')
    await expect(choice(page, 'phone', 'Required')).toHaveAttribute('aria-checked', 'true')
    await tap(choice(page, 'phone', 'Not asked'))
    await expect(page.locator('.ask-editor [data-ask="phone"]')).toContainText('no booking will require a number')
    await tap(choice(page, 'notes', 'Required'))
    await expect(page.locator('.rules-editor .pending')).toContainText('Phone: Not asked')
    await tap(page.locator('.rules-editor .save-rules'))
    await expect(page.locator('.toast')).toContainText('2 changes saved')
    const put = calls.find(c => c.method === 'PUT' && c.path.includes('/skills/configuration/'))
    expect(JSON.parse(put.body.params.requiredFields)).toEqual({ name: 'required', phone: 'not_asked', allergies: 'optional', notes: 'required', zone: 'optional' })
    expect(put.body.params.layout).toBeUndefined()
    expect(calls.filter(c => c.method === 'PUT' && c.path === '/layout')).toHaveLength(0)

    // the booking form, read from the saved setting: no phone, notes required
    await page.getByRole('tab', { name: 'Evening' }).click()
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.new-booking').click()
    const panel = page.locator('.panel')
    await expect(panel.locator('[data-field="phone"]')).toHaveCount(0)
    await expect(panel.locator('[data-field="notes"]')).toContainText('Notes *')
    await panel.getByLabel('Name').fill('Neri')
    await panel.locator('.save-btn').click()
    await expect(panel.locator('.check')).toContainText('Notes: required for every booking.')
    expect(calls.filter(c => c.method === 'POST' && c.path === '/reservations')).toHaveLength(0)
    await panel.getByLabel('Notes').fill('Window table')
    await panel.locator('.save-btn').click()
    await expect(page.locator('.toast')).toContainText('Saved: Neri')
  })

  for (const [what, opts] of [['as production answers', {}], ['when the server says nothing', { allergiesAbsent: true }]]) {
    test(`allergies "required" is not offered ${what}, with the reason`, async ({ authenticatedPage: page }) => {
      await openRules(page, opts)
      await expect(choice(page, 'allergies', 'Required')).toBeDisabled()
      await expect(page.locator('.ask-editor [data-ask="allergies"]')).toContainText('not available in this environment')
    })
  }

  test('allergies "required" where it is available is saved; refused by the server, the refusal is said readably', async ({ authenticatedPage: page }) => {
    const { calls } = await openRules(page, { allergies: { stored: 'optional', effective: 'optional', requiredAvailable: true }, allergiesRefused: true })
    await expect(choice(page, 'allergies', 'Required')).toBeEnabled()
    await tap(choice(page, 'allergies', 'Required'))
    await tap(page.locator('.rules-editor .save-rules'))
    await expect(page.locator('.rules-editor .issues')).toContainText('Allergies cannot be made required here yet')
    await expect(page.getByText(/server English/)).toHaveCount(0)
    expect(calls.filter(c => c.method === 'PUT' && c.path.includes('/skills/configuration/'))).toHaveLength(1)
  })

  test('a stored allergies "required" stays editable where it is not offered, and acts as optional', async ({ authenticatedPage: page }) => {
    const { calls } = await openRules(page, { params: { requiredFields: JSON.stringify({ allergies: 'required' }) },
      allergies: { stored: 'required', effective: 'optional', requiredAvailable: false } })
    await expect(choice(page, 'allergies', 'Required')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('.ask-editor [data-ask="allergies"]')).toContainText('acts as optional')
    await tap(choice(page, 'notes', 'Required'))
    await tap(page.locator('.rules-editor .save-rules'))
    await expect(page.locator('.toast')).toContainText('1 change saved')
    const put = calls.find(c => c.method === 'PUT' && c.path.includes('/skills/configuration/'))
    expect(JSON.parse(put.body.params.requiredFields).allergies).toBe('required')
  })

  test('one list of closures: the calendar\'s read-only with their age and where to change them, the page\'s own saved in the layout', async ({ authenticatedPage: page }) => {
    const day = addDays(TODAY, 9)
    const { calls } = await openRules(page, { calendar: { closures: [{ date: day, title: 'CLOSED Holiday' }],
      readAt: new Date(Date.now() - 3600000).toISOString(), triedAt: new Date().toISOString(), outcome: 'error' } })
    const list = page.locator('.rules-editor .closures')
    const fromCalendar = list.locator('.closure-row.from-calendar')
    await expect(fromCalendar).toContainText('CLOSED Holiday')
    await expect(fromCalendar).toContainText('from the calendar')
    await expect(fromCalendar.getByRole('button')).toHaveCount(0)
    await expect(list.locator('.calendar-age')).toContainText('failed')
    await expect(list).toContainText('changed in the calendar connected in the skill settings')
    // a closed dinner for the whole restaurant, and a whole day of the terrace
    await list.getByLabel('From').fill(addDays(TODAY, 12))
    await list.getByLabel('Service').selectOption('dinner')
    await tap(list.getByRole('button', { name: 'Add to the list' }))
    await list.getByLabel('From').fill(addDays(TODAY, 13))
    await list.getByLabel('Where').selectOption('dehors')
    await tap(list.getByRole('button', { name: 'Add to the list' }))
    await expect(list.locator('.closure-row:not(.from-calendar)')).toHaveCount(2)
    await tap(page.locator('.rules-editor .save-rules'))
    await expect(page.locator('.toast')).toContainText('1 change saved')
    const put = calls.find(c => c.method === 'PUT' && c.path === '/layout')
    expect(put.body.expectedRevision).toBe(3)
    expect(put.body.layout.exceptions).toEqual([{ from: addDays(TODAY, 12), to: addDays(TODAY, 12), service: 'dinner' }])
    expect(put.body.layout.zones.find(z => z.id === 'dehors').closures).toEqual([{ from: addDays(TODAY, 13), to: addDays(TODAY, 13) }])
    expect(calls.filter(c => c.method === 'PUT' && c.path.includes('/skills/configuration/'))).toHaveLength(0)
  })

  test('bookings on a service closed after they were taken are listed for staff to call; a closed area marks its own', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { closures: { [TOMORROW]: [{ service: 'dinner', source: 'calendar' }] } })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const toCall = page.locator('.closed-bookings')
    await expect(toCall).toContainText('bookings on this closed service: call the guests')
    await expect(toCall.locator('.brow', { hasText: 'Rossi' })).toBeVisible()
    await expect(toCall.locator('.brow', { hasText: 'Bianchi' })).toBeVisible()
    await tap(toCall.locator('.brow', { hasText: 'Rossi' }))
    await expect(page.locator('.panel .closed-day-note')).toBeVisible()
  })

  test('a closed area marks the bookings in it, for staff to call', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { closures: { [TOMORROW]: [{ zone: 'dehors', source: 'page' }] } })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await expect(page.locator('.brow', { hasText: 'Walk-in' }).locator('.closed-mark')).toBeVisible()
    await expect(page.locator('.brow', { hasText: 'Rossi' }).locator('.closed-mark')).toHaveCount(0)
  })

  test('a request in the inbox on a closed area is marked too', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { closures: { [TOMORROW]: [{ zone: 'sala', service: 'dinner', source: 'calendar' }] } })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await expect(page.locator('.req', { hasText: 'Galli' }).locator('.closed-mark')).toBeVisible()
  })

  // A walk-in may omit name and phone only (StarChat NativeReservationBook.staffBook, RestaurantRules.missingFields).
  test('a walk-in with notes required asks for them and sends them, on the table chosen', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { params: { requiredFields: JSON.stringify({ notes: 'required' }) } })
    await openRestaurant(page)
    await ready(page)
    await tap(page.locator('.tile[data-table="D2"]'))
    const walkin = page.locator('.panel .walkin')
    await expect(walkin.locator('[data-walkin-field="notes"]')).toBeVisible()
    await expect(walkin.locator('[data-walkin-field="name"], [data-walkin-field="phone"], [data-walkin-field="zone"]')).toHaveCount(0)
    await walkin.getByRole('button', { name: '2', exact: true }).click()
    await expect(walkin).toContainText('Every booking here needs: Notes.')
    expect(calls.filter(c => c.method === 'POST' && c.path === '/reservations')).toHaveLength(0)
    await walkin.getByLabel('Walk-in: Notes').fill('Pram')
    await walkin.getByRole('button', { name: '2', exact: true }).click()
    await expect(page.locator('.toast')).toContainText('Walk-in of 2 seated')
    const post = calls.find(c => c.method === 'POST' && c.path === '/reservations')
    expect(post.body).toMatchObject({ date: TODAY, covers: 2, walkIn: true, tableIds: [8], notes: 'Pram' })
    expect(post.body.name).toBeUndefined()
  })

  test('a walk-in with the area required and no table chosen asks for the area and sends it', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { params: { requiredFields: JSON.stringify({ zone: 'required' }) } })
    await openRestaurant(page)
    await ready(page)
    await page.locator('.new-booking').click()
    const walkin = page.locator('.panel .walkin')
    await walkin.getByRole('button', { name: '3', exact: true }).click()
    await expect(walkin).toContainText('Every booking here needs: Area.')
    expect(calls.filter(c => c.method === 'POST' && c.path === '/reservations')).toHaveLength(0)
    await walkin.getByLabel('Walk-in: Area').selectOption('dehors')
    await walkin.getByRole('button', { name: '3', exact: true }).click()
    await expect(page.locator('.toast')).toContainText('Walk-in of 3 seated')
    const post = calls.find(c => c.method === 'POST' && c.path === '/reservations')
    expect(post.body).toMatchObject({ covers: 3, walkIn: true, zone: 'dehors' })
    expect(post.body.tableIds).toBeUndefined()
  })

  test('staff are warned, not refused, before they confirm: outside the hours and off the grid told apart', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { staffWarnings: ['outside_hours', 'above_max_party'], writeWarnings: ['outside_hours'] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.new-booking').click()
    const panel = page.locator('.panel')
    const warnings = panel.locator('.staff-warnings')
    await expect(warnings).toContainText('Outside the opening hours of the service.')
    await expect(warnings).toContainText('Larger than the assistant books by itself.')
    await expect(warnings).not.toContainText('Not on the arrival times')
    await panel.getByLabel('Name').fill('Neri')
    await panel.getByLabel('Phone').fill('393331234567')
    await panel.locator('.save-btn').click()
    await expect(page.locator('.toast')).toContainText('Noted: Outside the opening hours of the service.')
    expect(calls.filter(c => c.method === 'POST' && c.path === '/reservations')).toHaveLength(1)
  })

  test('a missing-fields refusal names each field the server named, in the owner\'s words', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { serverRequires: ['allergies'] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.new-booking').click()
    const panel = page.locator('.panel')
    await panel.getByLabel('Name').fill('Neri')
    await panel.getByLabel('Phone').fill('393331234567')
    await panel.locator('.save-btn').click()
    await expect(panel.locator('.refusal')).toContainText('Every booking here needs: Allergies.')
    await expect(page.getByText(/server English/)).toHaveCount(0)
  })

  test('accepting a request that lacks a required field asks for it, and the accept carries it in the same call', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000)
    const { calls } = await mockRestaurant(page, { params: { requiredFields: JSON.stringify({ notes: 'required' }) } })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.req', { hasText: 'Galli' }).getByRole('button', { name: 'Accept' }).click()
    const panel = page.locator('.panel')
    await expect(panel).toContainText('To accept, this booking needs: Notes.')
    await panel.locator('.accept-with').click()
    expect(calls.filter(c => c.path.endsWith('/accept'))).toHaveLength(0)
    await panel.getByLabel('Notes').fill('Birthday')
    await panel.locator('.accept-with').click()
    await expect(page.locator('.toast')).toContainText('Request accepted: Galli')
    await page.waitForRequest(r => r.url().endsWith('/accept'), { timeout: 15000 })
    await expect.poll(() => calls.filter(c => c.path.endsWith('/accept')).map(c => c.body)).toEqual([{ expectedVersion: 1, notes: 'Birthday' }])
  })

  test('a call-back request about a change is shown on the booking and in the inbox; "make the change" pre-fills it, and one save moves it and closes the request', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-chg', time: '22:30', covers: 3, name: 'Verdi', phone: '393330001111',
      status: 'requested', requestReason: 'callback', about: 'b-verdi', allergies: 'Celiac', notes: 'Asks for later',
      change: { kind: 'move', date: TOMORROW, time: '22:30', covers: 3, zone: 'sala', allergies: 'Celiac', notes: 'Asks for later' } }],
      writeWarnings: ['outside_hours'] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const request = page.locator('.req[data-request="b-chg"]')
    await expect(request).toContainText('Verdi asks to change 20:30 · 2 people to 22:30 · 3 people')
    await expect(request.getByRole('button', { name: 'Accept' })).toHaveCount(0)
    await expect(page.locator('.brow', { hasText: 'Verdi' }).locator('.change-mark')).toBeVisible()
    await tap(request.locator('.make-change'))
    const panel = page.locator('.panel')
    await expect(panel.locator('.change-request')).toContainText('Change asked by phone')
    const editor = panel.locator('.details-editor')
    await expect(editor).toContainText('What the guest asked by phone')
    await expect(editor.getByLabel('Allergies')).toHaveValue('Celiac')
    await expect(editor.getByLabel('Notes')).toHaveValue('Asks for later')
    await expect(editor.locator('.apply-move')).toContainText('The request moves it to')
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    await expect(page.locator('.toast')).toContainText('Noted: Outside the opening hours of the service.')
    // the asked values are the book's to apply: nothing staff left as it was travels (an override would win)
    expect(calls.filter(applies).map(c => [c.path, c.body])).toEqual([['/reservations/b-chg/apply', { expectedVersion: 1, bookingVersion: 1 }]])
    expect(calls.filter(twoCalls)).toHaveLength(0)
    expect(calls.filter(c => c.path.endsWith('/accept'))).toHaveLength(0)
  })

  test('a late arrival asked by phone is applied by the book, the table kept, in one call', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-late-req', time: '21:00', covers: 4, name: 'Rossi', phone: '393331112233',
      status: 'requested', requestReason: 'callback', about: 'b-rossi',
      change: { kind: 'late_arrival', date: TOMORROW, time: '20:00', covers: 4, zone: 'sala', eta: '21:00' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-late-req"] .make-change'))
    const editor = page.locator('.panel .details-editor')
    await expect(page.locator('.req[data-request="b-late-req"]')).toContainText('Rossi (20:00 · 4 people) will arrive late, at 21:00')
    await expect(editor.locator('.late-arrival')).toContainText('Late arrival at 21:00')
    await expect(editor.locator('.apply-move')).toHaveCount(0)
    await expect(editor.getByLabel('Notes')).toHaveValue('')
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    expect(calls.filter(applies).map(c => [c.path, c.body])).toEqual([['/reservations/b-late-req/apply', { expectedVersion: 1, bookingVersion: 1 }]])
    expect(calls.filter(twoCalls)).toHaveLength(0)
  })

  test('staff correct a booking\'s details; allergies not asked is not drawn; emptying a required field is refused, named', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { params: { requiredFields: JSON.stringify({ allergies: 'not_asked' }) } })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.brow', { hasText: 'Bianchi' }))
    const panel = page.locator('.panel')
    await panel.locator('.edit-details').click()
    const editor = panel.locator('.details-editor')
    await expect(editor.locator('[data-detail="allergies"]')).toHaveCount(0)
    await expect(editor.locator('[data-detail="name"]')).toContainText('Name *')
    await editor.getByLabel('Name').fill('')
    await editor.locator('.save-details').click()
    await expect(editor).toContainText('Every booking here needs: Name.')
    expect(calls.filter(c => c.method === 'PATCH')).toHaveLength(0)
    await editor.getByLabel('Name').fill('Bianchi Neri')
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('Details saved: Bianchi Neri')
    expect(calls.find(c => c.method === 'PATCH').body).toEqual({ expectedVersion: 1, name: 'Bianchi Neri' })
    await expect(panel.getByRole('heading', { name: 'Bianchi Neri' })).toBeVisible()
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => calls.filter(c => c.method === 'PATCH').map(c => c.body)[1]).toEqual({ expectedVersion: 2, name: 'Bianchi' })
  })

  // Undo of a details edit puts back an empty field as empty, and leaves a required one as the edit set it (the book
  // refuses to clear it). The first test guards behaviour that was already right (it passes on 2622e5d); the second
  // was seen failing on 2026-10-14 against 2622e5d, where Undo was offered and sent "" for a now-required field.
  test('Undo of a details edit clears a field that was empty, and is not offered for a required one the book cannot clear', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page)
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.brow', { hasText: 'Verdi' }))
    const panel = page.locator('.panel')
    await panel.locator('.edit-details').click()
    await panel.locator('.details-editor').getByLabel('Notes').fill('Window')
    await panel.locator('.save-details').click()
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => calls.filter(c => c.method === 'PATCH').map(c => c.body)).toEqual([{ expectedVersion: 1, notes: 'Window' }, { expectedVersion: 2, notes: '' }])
  })

  test('a details edit that fills a now-required field offers no Undo the book would refuse', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { params: { requiredFields: JSON.stringify({ notes: 'required' }) } })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.brow', { hasText: 'Verdi' }))
    const panel = page.locator('.panel')
    await panel.locator('.edit-details').click()
    await panel.locator('.details-editor').getByLabel('Notes').fill('Window')
    await panel.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('Details saved: Verdi')
    await expect(page.locator('.toast').getByRole('button', { name: 'Undo' })).toHaveCount(0)
  })

  // A move by a tap or a drag is told the staff warnings before it is made. Seen failing on 2026-10-14 against 2622e5d.
  test('a move to another table says what staff are warned of before it is made, and is made on "move anyway"', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { staffWarnings: ['off_grid'] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.brow', { hasText: 'Rossi' }).click()
    await page.locator('.panel').getByRole('button', { name: 'Move' }).click()
    await tap(page.locator('.tile[data-table="T5"]'))
    const dialog = page.locator('.mrcall-confirm-dialog')
    await expect(dialog).toContainText('Move Rossi anyway?')
    await expect(dialog).toContainText('Not on the arrival times')
    expect(calls.filter(c => c.method === 'PATCH')).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Move anyway' }).click()
    await expect(page.locator('.toast')).toContainText('Rossi moved to T5')
    expect(calls.filter(c => c.method === 'PATCH').map(c => c.body)).toEqual([{ expectedVersion: 1, tableIds: [5] }])
  })

  // A server error on a setting the skill form owns is named by that setting's label. Seen failing on 2026-10-14 against
  // 2622e5d: "maxPartySize: the value is outside the allowed range."
  test('a refusal naming a setting of the skill form says its label, not its key', async ({ authenticatedPage: page }) => {
    await openRules(page, { configRefusal: [{ severity: 'error', path: '/maxPartySize', code: 'out_of_range', detail: 'server English' }] })
    await tap(choice(page, 'notes', 'Required'))
    await tap(page.locator('.rules-editor .save-rules'))
    await expect(page.locator('.rules-editor .issues')).toContainText('Largest party booked by the assistant: the value is outside the allowed range.')
    await expect(page.locator('.rules-editor .issues')).not.toContainText('maxPartySize')
  })

  test('with allergies not asked, a booking that holds one shows it with the hint, and staff can clear it', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { params: { requiredFields: JSON.stringify({ allergies: 'not_asked' }) } })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.brow', { hasText: 'Rossi' }))
    const panel = page.locator('.panel')
    await panel.locator('.edit-details').click()
    const field = panel.locator('.details-editor [data-detail="allergies"]')
    await expect(field.getByRole('textbox')).toHaveValue('Celiac (1 person)')
    await expect(field).toContainText('Not asked in this restaurant')
    await field.getByRole('textbox').fill('')
    await panel.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('Details saved: Rossi')
    expect(calls.find(c => c.method === 'PATCH').body).toEqual({ expectedVersion: 1, allergies: '' })
  })

  test('a request about a booking on another day finds it there, from the day the request names', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-far-req', time: '21:00', covers: 3, name: 'Moretti Bis', status: 'requested',
      requestReason: 'callback', about: 'b-far', change: { kind: 'details', date: addDays(TODAY, 20), time: '20:00', covers: 3, zone: 'sala', name: 'Moretti Bis' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const request = page.locator('.req[data-request="b-far-req"]')
    await expect(request).toContainText('Moretti (')
    await expect(request).toContainText('asks to change the details')
    await tap(request.locator('.make-change'))
    const editor = page.locator('.panel .details-editor')
    await expect(editor.getByLabel('Name')).toHaveValue('Moretti Bis')
    expect(calls.filter(c => c.path === '/reservations' && c.search === `?date=${addDays(TODAY, 20)}`)).toHaveLength(1)
    expect(calls.filter(c => c.path === '/search')).toHaveLength(0)
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    expect(calls.filter(applies).map(c => c.body)).toEqual([{ expectedVersion: 1, bookingVersion: 1 }])
    expect(calls.filter(twoCalls)).toHaveLength(0)
  })

  test('a cancellation asked by phone: one action cancels the booking and closes the request, with Undo', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-cancel-req', time: '19:30', covers: 6, name: 'Bianchi', status: 'requested',
      requestReason: 'callback', about: 'b-bianchi', change: { kind: 'cancellation', date: TOMORROW, time: '19:30', covers: 6, zone: 'sala' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const request = page.locator('.req[data-request="b-cancel-req"]')
    await expect(request).toContainText('Bianchi asks to cancel 19:30 · 6 people')
    await tap(request.getByRole('button', { name: 'Cancel the booking' }))
    await expect(page.locator('.toast')).toContainText('Cancelled as asked: Bianchi')
    expect(calls.filter(applies).map(c => [c.path, c.body])).toEqual([['/reservations/b-cancel-req/apply', { expectedVersion: 1, bookingVersion: 1 }]])
    expect(calls.filter(twoCalls)).toHaveLength(0)
    await expect(page.locator('.req[data-request="b-cancel-req"]')).toHaveCount(0)
    // Undo is the book's reverse: the booking reinstated and the guest's request back in the inbox, in one call
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.path.endsWith('/unapply')).map(c => [c.path, c.body])).toEqual([['/reservations/b-cancel-req/unapply', { requestVersion: 2, bookingVersion: 2 }]])
    expect(calls.filter(c => c.path.endsWith('/reinstate'))).toHaveLength(0)
    await expect(page.locator('.req[data-request="b-cancel-req"]')).toHaveCount(1)
    await expect(page.locator('.brow', { hasText: 'Bianchi' })).toBeVisible()
  })

  test('a booking whose number did not place it is marked as reached by a recognised number', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { extraRows: [{ id: 'b-rec', time: '19:00', covers: 2, name: 'Conti', phone: '393339998877', status: 'confirmed',
      source: 'staff', tableIds: [8], zone: 'dehors', recognised: true }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    const row = page.locator('.brow', { hasText: 'Conti' })
    await expect(row.locator('.recognised-mark')).toContainText('recognised number')
    await expect(page.locator('.brow', { hasText: 'Rossi' }).locator('.recognised-mark')).toHaveCount(0)
    await tap(row)
    await expect(page.locator('.panel .recognised-note')).toContainText('did not place this booking')
  })

  test('a request filed for another day shows on the booking\'s card and row, and "make the change" works from there', async ({ authenticatedPage: page }) => {
    const filedFor = addDays(TODAY, 3)
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-far-day', date: filedFor, time: '21:00', covers: 4, name: 'Rossi',
      phone: '393331112233', status: 'requested', requestReason: 'callback', about: 'b-rossi',
      change: { kind: 'move', date: filedFor, time: '21:00', covers: 4, zone: 'sala' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    // the request is not in tomorrow's read: the booking's row says it exists
    await expect(page.locator('.req[data-request="b-far-day"]')).toHaveCount(0)
    await expect(page.locator('.brow', { hasText: 'Rossi' }).locator('.change-mark')).toBeVisible()
    await tap(page.locator('.brow', { hasText: 'Rossi' }))
    const card = page.locator('.panel .change-request')
    await expect(card).toContainText('Change asked by phone: move ·')
    await expect(card).toContainText('21:00 · 4 people · asked on')
    await card.locator('.make-change').click()
    const editor = page.locator('.panel .details-editor')
    await expect(editor.locator('.apply-move')).toContainText('21:00')
    // everything the action needs comes with the booking's row (StarChat c790d9d11): nothing is searched
    expect(calls.filter(c => c.path === '/search')).toHaveLength(0)
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    expect(calls.filter(applies).map(c => [c.path, c.body])).toEqual([['/reservations/b-far-day/apply', { expectedVersion: 1, bookingVersion: 1 }]])
    expect(calls.filter(twoCalls)).toHaveLength(0)
  })

  test('a request filed for another day is closed from the booking\'s card at its version', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000)
    const filedFor = addDays(TODAY, 3)
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-far-day', version: 3, date: filedFor, time: '21:00', covers: 4,
      name: 'Rossi', status: 'requested', requestReason: 'callback', about: 'b-rossi', change: { kind: 'details', date: filedFor, time: '20:00', covers: 4, zone: 'sala', notes: 'Window' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.brow', { hasText: 'Rossi' }))
    await page.locator('.panel .change-request .close-request').click()
    await page.waitForRequest(r => r.method() === 'DELETE', { timeout: 15000 })
    await expect.poll(() => calls.filter(c => c.method === 'DELETE').map(c => c.path + c.search)).toEqual(['/reservations/b-far-day?expectedVersion=3'])
    expect(calls.filter(c => c.path === '/search' || c.method === 'PATCH')).toHaveLength(0)
  })

  // Notes asked by phone are added to the booking's ("existing · asked") by the book; the editor shows that, sends no
  // notes when they are left so, and the whole edited text when staff edit them (an override replaces). The three
  // unedited cases were seen failing on 2026-10-14 against 2cd167a's mock, which replaced the booking's notes and
  // applied the asked details for `details` only; the edited ones guard the override.
  for (const kind of ['details', 'move', 'late_arrival']) {
    for (const edit of [false, true]) {
      test(`a ${kind} request with notes on a booking with notes, ${edit ? 'edited: the whole text replaces' : 'unedited: kept and added, no notes sent'}`, async ({ authenticatedPage: page }) => {
        const change = { kind, date: TOMORROW, time: kind === 'move' ? '21:30' : '19:30', covers: 6, zone: 'sala', notes: 'Window' }
        if (kind === 'late_arrival') change.eta = '20:00'
        const { calls, state } = await mockRestaurant(page, { extraRows: [{ id: 'b-n', time: '19:30', covers: 6, name: 'Bianchi', status: 'requested',
          requestReason: 'callback', about: 'b-bianchi', notes: 'Window', change }] })
        await openRestaurant(page)
        await ready(page)
        await tomorrowDinner(page)
        await tap(page.locator('.req[data-request="b-n"] .make-change'))
        const notes = page.locator('.panel .details-editor').getByLabel('Notes')
        await expect(notes).toHaveValue('Birthday cake at 22:00 · Window')
        if (edit) await notes.fill('Birthday cake at 22:00 · Window seat, please')
        await page.locator('.panel .details-editor .save-details').click()
        await expect(page.locator('.toast')).toContainText('the request is closed')
        const body = calls.find(applies).body
        const bianchi = state.rows.find(r => r.id === 'b-bianchi')
        if (edit) {
          expect(body.notes).toBe('Birthday cake at 22:00 · Window seat, please')
          expect(bianchi.notes).toContain('Birthday cake at 22:00 · Window seat, please')
        } else {
          expect('notes' in body).toBe(false)
          expect(bianchi.notes).toContain('Birthday cake at 22:00 · Window')
        }
      })
    }
  }

  test('Undo of an applied move puts the booking back and the request in the inbox, in one call', async ({ authenticatedPage: page }) => {
    const { calls, state } = await mockRestaurant(page, { extraRows: [{ id: 'b-chg', time: '22:30', covers: 3, name: 'Verdi', status: 'requested',
      requestReason: 'callback', about: 'b-verdi', change: { kind: 'move', date: TOMORROW, time: '22:30', covers: 3, zone: 'sala' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-chg"] .make-change'))
    await page.locator('.panel .details-editor .save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    expect(state.rows.find(r => r.id === 'b-verdi').time).toBe('22:30')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.path.endsWith('/unapply')).map(c => c.body)).toEqual([{ requestVersion: 2, bookingVersion: 2 }])
    expect(calls.filter(twoCalls)).toHaveLength(0)
    expect(state.rows.find(r => r.id === 'b-verdi').time).toBe('20:30')
    await expect(page.locator('.req[data-request="b-chg"]')).toHaveCount(1)
  })

  // An overbooked booking (no table, its intended tables kept) that a move seats is put back overbooked by Undo, with its
  // intended tables and no table (StarChat 3c2a6b31d). Seen failing on 2026-10-14 with the mock's apply snapshot
  // leaving out the intended tables (the unapply 9c02e69d7 answered).
  test('Undo of an apply on an overbooked booking puts it back overbooked, with its intended tables', async ({ authenticatedPage: page }) => {
    const { state } = await mockRestaurant(page, { extraRows: [
      { id: 'b-over', time: '20:00', covers: 2, name: 'Conti', phone: '393339998877', status: 'confirmed', source: 'staff', tableIds: [],
        overbooked: true, intendedTableIds: [5] },
      { id: 'b-over-req', time: '22:00', covers: 2, name: 'Conti', status: 'requested', requestReason: 'callback', about: 'b-over',
        change: { kind: 'move', date: TOMORROW, time: '22:00', covers: 2, zone: 'sala' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await expect(page.locator('.unseated .intended', { hasText: 'Conti' })).toContainText('meant for T5')
    await tap(page.locator('.req[data-request="b-over-req"] .make-change'))
    await page.locator('.panel .details-editor .save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    const conti = () => state.rows.find(r => r.id === 'b-over')
    expect(conti().tableIds.length).toBeGreaterThan(0)
    await expect(page.locator('.unseated .intended', { hasText: 'Conti' })).toHaveCount(0)
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect([conti().time, conti().tableIds, conti().overbooked, conti().intendedTableIds]).toEqual(['20:00', [], true, [5]])
    await expect(page.locator('.unseated .intended', { hasText: 'Conti' })).toContainText('meant for T5')
    await expect(page.locator('.req[data-request="b-over-req"]')).toHaveCount(1)
  })

  test('a refused Undo of an applied request is said in the open panel', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { unapplyRefusal: 'superseded', extraRows: [{ id: 'b-chg', time: '22:30', covers: 3, name: 'Verdi', status: 'requested',
      requestReason: 'callback', about: 'b-verdi', change: { kind: 'move', date: TOMORROW, time: '22:30', covers: 3, zone: 'sala' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-chg"] .make-change'))
    await page.locator('.panel .details-editor .save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.panel .panel-refusal')).toContainText('the guest has asked for another change of this booking since')
    await expect(page.locator('.panel .restore-anyway')).toHaveCount(0)
    await expect(page.getByText(/server English/)).toHaveCount(0)
  })

  // Undo of an apply whose tables were taken since: said on the booking, with "restore anyway", which puts it back with
  // no table (overbook), as "book anyway" books one. Seen failing on 2026-10-14 without the retry, and with the retry
  // sent without overbook; the superseded test failed with the retry offered for superseded too.
  test('an Undo refused because the tables are taken offers "restore anyway", which puts the booking back with no table', async ({ authenticatedPage: page }) => {
    const { calls, state } = await mockRestaurant(page, { unapplyRefusal: 'table_taken', extraRows: [{ id: 'b-cancel-req', time: '19:30', covers: 6, name: 'Bianchi',
      status: 'requested', requestReason: 'callback', about: 'b-bianchi', change: { kind: 'cancellation', date: TOMORROW, time: '19:30', covers: 6, zone: 'sala' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-cancel-req"]').getByRole('button', { name: 'Cancel the booking' }))
    await expect(page.locator('.toast')).toContainText('Cancelled as asked: Bianchi')
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
    const refusal = page.locator('.panel .panel-refusal')
    await expect(refusal).toContainText('Its tables are taken.')
    await refusal.getByRole('button', { name: 'Restore anyway' }).click()
    await expect(page.locator('.toast')).toContainText('action undone')
    expect(calls.filter(c => c.path.endsWith('/unapply')).map(c => c.body)).toEqual([
      { requestVersion: 2, bookingVersion: 2 }, { requestVersion: 2, bookingVersion: 2, overbook: true }])
    const bianchi = state.rows.find(r => r.id === 'b-bianchi')
    expect([bianchi.status, bianchi.tableIds, bianchi.overbooked]).toEqual(['confirmed', [], true])
    await expect(page.locator('.req[data-request="b-cancel-req"]')).toHaveCount(1)
  })

  // The apply body's optional fields are staff's overrides and win over the asked values: a date or a time sent for a
  // details request would move the booking. Only what staff changed in the editor travels. Seen failing on 2026-10-14
  // with the editor comparing with the booking (the asked name and allergies echoed back).
  test('a details request applied without edits sends no field of its own, and an edit travels as the override', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-det', time: '20:30', covers: 2, name: 'Verdi Neri', status: 'requested',
      requestReason: 'callback', about: 'b-verdi', change: { kind: 'details', date: TOMORROW, time: '20:30', covers: 2, zone: 'sala', name: 'Verdi Neri', allergies: 'Nuts' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-det"] .make-change'))
    const editor = page.locator('.panel .details-editor')
    await expect(editor.getByLabel('Name')).toHaveValue('Verdi Neri')
    await expect(editor.getByLabel('Allergies')).toHaveValue('Nuts')
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    const body = calls.find(applies).body
    expect(body).toEqual({ expectedVersion: 1, bookingVersion: 1 })
    expect('date' in body || 'time' in body || 'covers' in body).toBe(false)
  })

  test('a details request with staff\'s edit sends that field alone, as the override', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-det', time: '20:30', covers: 2, name: 'Verdi Neri', status: 'requested',
      requestReason: 'callback', about: 'b-verdi', change: { kind: 'details', date: TOMORROW, time: '20:30', covers: 2, zone: 'sala', name: 'Verdi Neri', allergies: 'Nuts' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-det"] .make-change'))
    const editor = page.locator('.panel .details-editor')
    await editor.getByLabel('Allergies').fill('Nuts, peanuts')
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    expect(calls.find(applies).body).toEqual({ expectedVersion: 1, bookingVersion: 1, allergies: 'Nuts, peanuts' })
  })

  // A refusal of the apply changes nothing and is said in the owner's words, by its code. Seen failing on 2026-10-14
  // against 2a0bdb1 (the two-call path never called /apply).
  for (const [code, path, said] of [['no_change', '/id', 'records no change to make'], ['booking_not_confirmed', '/id', 'no longer confirmed'],
    ['stale', '/bookingVersion', 'The booking this request is about changed in the meantime'], ['full', '/', 'There is no room at that time.']]) {
    test(`applying a request refused ${code} at ${path} says so and changes nothing`, async ({ authenticatedPage: page }) => {
      const { calls } = await mockRestaurant(page, { applyRefusal: { code, path }, extraRows: [{ id: 'b-chg', time: '22:30', covers: 3, name: 'Verdi',
        status: 'requested', requestReason: 'callback', about: 'b-verdi', change: { kind: 'move', date: TOMORROW, time: '22:30', covers: 3, zone: 'sala' } }] })
      await openRestaurant(page)
      await ready(page)
      await tomorrowDinner(page)
      await tap(page.locator('.req[data-request="b-chg"] .make-change'))
      await page.locator('.panel .details-editor .save-details').click()
      await expect(page.locator('.panel .details-editor')).toContainText(said)
      await expect(page.getByText(/server English/)).toHaveCount(0)
      expect(calls.filter(applies)).toHaveLength(1)
      expect(calls.filter(twoCalls)).toHaveLength(0)
    })
  }

  // A move refused `full` may be booked anyway, as every staff booking: the same overrides again with overbook. Seen
  // failing on 2026-10-14 against 8710563 (no "Book anyway" in the apply editor), and with `overbook` left out of the retry.
  test('a move refused for room is booked anyway on request, with the same overrides and overbook', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { applyRefusal: { code: 'full', path: '/' }, extraRows: [{ id: 'b-chg', time: '22:30', covers: 3,
      name: 'Verdi', status: 'requested', requestReason: 'callback', about: 'b-verdi', change: { kind: 'move', date: TOMORROW, time: '22:30', covers: 3, zone: 'sala' } }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-chg"] .make-change'))
    const editor = page.locator('.panel .details-editor')
    await editor.getByLabel('Notes').fill('By the window')
    await editor.locator('.save-details').click()
    await expect(editor.locator('.refusal')).toContainText('There is no room at that time.')
    await editor.getByRole('button', { name: 'Book anyway' }).click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    expect(calls.filter(applies).map(c => c.body)).toEqual([
      { expectedVersion: 1, bookingVersion: 1, notes: 'By the window' },
      { expectedVersion: 1, bookingVersion: 1, notes: 'By the window', overbook: true }])
    expect(calls.filter(twoCalls)).toHaveLength(0)
  })

  test('"close without changing" closes a call-back request and leaves the booking as it is', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000)
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-chg', time: '21:30', covers: 3, name: 'Verdi', status: 'requested',
      requestReason: 'callback', about: 'b-verdi' }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await page.locator('.req[data-request="b-chg"] .close-request').click()
    await page.waitForRequest(r => r.method() === 'DELETE', { timeout: 15000 })
    await expect.poll(() => calls.filter(c => c.method === 'DELETE').map(c => c.path + c.search)).toEqual(['/reservations/b-chg?expectedVersion=1'])
    expect(calls.filter(c => c.method === 'PATCH')).toHaveLength(0)
  })

  test('an overbooking over a taken table keeps the tables staff meant, on the "no table yet" lane', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { refuseBook: 'full' })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.tile[data-table="T5"]'))
    const panel = page.locator('.panel')
    await panel.getByLabel('Name').fill('Neri')
    await panel.getByLabel('Phone').fill('393331234567')
    await panel.locator('.save-btn').click()
    await panel.getByRole('button', { name: 'Book anyway' }).click()
    await expect(page.locator('.toast')).toContainText('Saved: Neri')
    const posts = calls.filter(c => c.method === 'POST' && c.path === '/reservations')
    expect(posts.map(c => [!!c.body.overbook, c.body.tableIds])).toEqual([[false, [5]], [true, [5]]])
    await expect(page.locator('.unseated .intended', { hasText: 'Neri' })).toContainText('meant for T5')
  })
})

test.describe('the restaurant page switched off', () => {
  test('the menu has no entry for it, and its address opens the default section', async ({ authenticatedPage: page }) => {
    await mockRestaurant(page, { params: { page: 'false', enabled: 'false' } })
    await openRestaurant(page)
    // on a narrow screen the menu is behind the header's button
    await expect(page.locator('.header_buttonbar button, [role="menuitem"]').first()).toBeAttached({ timeout: 20000 })
    const narrowMenu = page.locator('.header_buttonbar button')
    if (await narrowMenu.isVisible()) await narrowMenu.click()
    await expect(page.getByRole('menuitem', { name: 'Data retention', exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('menuitem', { name: 'Restaurant bookings' })).toHaveCount(0)
    await expect(page.locator('.rb')).toHaveCount(0)
  })

  test('switched off since the page was opened, it says where to turn it on and asks the book nothing', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { params: { page: 'false', enabled: 'false' }, businessPage: 'true' })
    await openRestaurant(page)
    const message = page.locator('.restaurant-page-off')
    await expect(message).toContainText('switched off in the skill settings', { timeout: 20000 })
    await expect(message.getByRole('link', { name: 'Open the skill settings' })).toHaveAttribute('href', /section=__SKILLS__/)
    expect(calls.filter(c => c.path === '/reservations')).toHaveLength(0)
  })
})
