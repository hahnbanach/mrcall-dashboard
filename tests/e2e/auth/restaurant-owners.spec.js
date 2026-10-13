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
 * not marked (the inbox test); the staff
 * warnings not drawn (the warnings test); the missing-fields refusal said without its fields (the refusal test); a
 * request accepted without asking its missing field (the accept test); "make the change" without the closing
 * DELETE (the call-back test); the request's details not pre-filled (the call-back test); a late arrival treated as
 * a move (the late-arrival test); the editor drawing a not-asked field, or its Undo at the version read rather than
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

  test('allergies "required" is offered only where the server says so; a stored "required" is kept and said to act as optional', async ({ authenticatedPage: page }) => {
    // the server does not say (StarChat does not send it yet): not offered, with the reason
    await openRules(page)
    await expect(choice(page, 'allergies', 'Required')).toBeDisabled()
    await expect(page.locator('.ask-editor [data-ask="allergies"]')).toContainText('not available in this environment')
  })

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
      status: 'requested', requestReason: 'callback', about: 'b-verdi', allergies: 'Celiac', notes: 'Asks for later' }] })
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
    await expect(editor.locator('.apply-move input')).toBeChecked()
    expect(calls.filter(c => c.method === 'PATCH')).toHaveLength(0)
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    const patch = calls.find(c => c.method === 'PATCH')
    expect(patch.path).toBe('/reservations/b-verdi')
    expect(patch.body).toEqual({ expectedVersion: 1, allergies: 'Celiac', notes: 'Asks for later', date: TOMORROW, time: '22:30', covers: 3 })
    expect(calls.filter(c => c.method === 'DELETE').map(c => c.path + c.search)).toEqual(['/reservations/b-chg?expectedVersion=1'])
    expect(calls.filter(c => c.path.endsWith('/accept'))).toHaveLength(0)
  })

  test('a late arrival asked by phone is written in the notes and the table stays', async ({ authenticatedPage: page }) => {
    const { calls } = await mockRestaurant(page, { extraRows: [{ id: 'b-late-req', time: '21:00', covers: 4, name: 'Rossi', phone: '393331112233',
      status: 'requested', requestReason: 'callback', about: 'b-rossi' }] })
    await openRestaurant(page)
    await ready(page)
    await tomorrowDinner(page)
    await tap(page.locator('.req[data-request="b-late-req"] .make-change'))
    const editor = page.locator('.panel .details-editor')
    await expect(editor.locator('.late-arrival')).toContainText('Late arrival at 21:00')
    await expect(editor.locator('.apply-move')).toHaveCount(0)
    await expect(editor.getByLabel('Notes')).toHaveValue('Arrives at 21:00')
    await editor.locator('.save-details').click()
    await expect(page.locator('.toast')).toContainText('the request is closed')
    const patch = calls.find(c => c.method === 'PATCH')
    expect(patch.body).toEqual({ expectedVersion: 1, notes: 'Arrives at 21:00' })
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
