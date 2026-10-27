const { test, expect } = require('@playwright/test')
const { setupOAuthPage, businessId, calendarScope } = require('../fixtures/skill-oauth')
const { operation, json, sessionId, ordinary, sse } = require('../fixtures/skill-chat')

test.use({ serviceWorkers: 'block' })
const token = 'a'.repeat(64)
const names = ['availability', 'event_create', 'events_read', 'event_update', 'event_delete']
const calendar = { id: 'calendar-private-id', summary: 'Appointments', primary: true }
const five = () => names.map((name, index) => operation(`booking-${index}`, {
  skill: `skill_calendar_${name}`, params: { enabled: 'false' }, preview: {
    skill_label: `Booking ${name}`, before: null,
    after: { enabled: 'false', trigger: 'Runtime instruction '.repeat(50),
      promptSuccess: '%%FUNCTION_RESPONSE_BODY%%', hours: JSON.stringify({ monday: ['09:00-13:00'] }) },
    field_labels: { trigger: 'When to use', promptSuccess: 'After the tool', hours: 'Weekly hours' },
  },
}))

async function setup(page, options = {}) {
  const model = await setupOAuthPage(page, options)
  model.pending = options.saved ? [] : [...five(), ...(options.sibling ? [ordinary] : [])]
  model.booking = { available: true, state: options.active ? 'active' : 'prepared', configured: options.configured, setup_token: token,
    connection_status: 'unknown', calendars: options.connected ? [calendar] : [], oauth_scopes: [calendarScope] }
  model.activations = []
  await page.route('**/api/mrcall/booking/setup*', route => json(route, model.booking))
  await page.route('**/oauth/providers/*/connect', route => {
    model.connects.push(route.request().postDataJSON())
    model.booking.connection_status = 'available'
    model.booking.calendars = options.afterConnect || [calendar]
    return json(route, {})
  })
  await page.route('**/api/mrcall/booking/activate', route => {
    model.activations.push(route.request().postDataJSON())
    if (options.activationError) return route.fulfill({ status: options.activationError, body: '{}' })
    if (options.malformedActivation) return json(route, { success: true, booking_active: true })
    const outcomes = names.map((name, index) => ({ operation_id: `booking-${index}`,
      instance_id: `saved-${index}`, status: options.partial && index ? 'pending' : 'saved' }))
    model.pending = model.pending.filter(p => p.kind !== 'skill_instance' ||
      (options.partial && p.operation_id !== 'booking-0'))
    if (!options.partial) { model.booking.state = 'active'; model.booking.configured = true }
    if (options.promptFailure) {
      model.booking.state = 'prepared'; model.booking.configured = true
      return json(route, { success: false, booking_active: false, applied: 5, skill_outcomes: outcomes,
        errors: ['booking_conversation_write_failed'], remaining_pending: model.pending })
    }
    return json(route, { success: !options.partial, applied: options.partial ? 1 : 5,
      booking_active: !options.partial, skill_outcomes: outcomes, errors: [], remaining_pending: model.pending })
  })
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
  const support = page.locator('#support-small:not(.collapsed) .panel-toggle-btn-small')
  if (await support.isVisible()) await support.click()
  if (options.configured || options.active) await expect(page.getByTestId('booking-connection')).toHaveCount(0)
  else await expect(page.getByTestId('booking-connection')).toBeVisible()
  return model
}
async function start(page) {
  await page.locator('.booking-google-connect').click()
  await expect(page).toHaveURL(/__oauth_capture__/)
  return page.evaluate(() => localStorage.getItem('oauthState'))
}
async function callback(page, state, denied = false) {
  await page.goto('/callback?' + (denied ? 'error=access_denied' : 'code=fake-code') + '&state=' + encodeURIComponent(state))
}

test('verified single-calendar return activates exactly five and preserves unrelated pending', async ({ page }) => {
  const model = await setup(page, { sibling: true })
  const reads = model.configurationReads
  const state = await start(page)
  await callback(page, state)
  await expect(page.locator('.action-message')).toContainText('Booking is active.')
  await expect(page.getByTestId('booking-connection')).toHaveCount(0)
  expect(model.activations).toEqual([{ business_id: businessId, session_id: sessionId,
    setup_token: token, calendar_id: calendar.id }])
  expect(model.pending).toEqual([ordinary])
  expect(model.saves).toEqual([])
  expect(model.connects).toHaveLength(1)
  await expect.poll(() => model.configurationReads).toBeGreaterThan(reads)
  await page.reload()
  await expect(page.locator('.message-input')).toBeEnabled()
  expect(model.activations).toHaveLength(1)
})

test('multiple calendars require an explicit named choice after successful return', async ({ page }) => {
  const model = await setup(page, { afterConnect: [calendar, { id: 'second-private-id', summary: 'Studio', primary: false }] })
  const state = await start(page)
  await callback(page, state)
  await expect(page.locator('.booking-calendar-picker')).toBeVisible()
  expect(model.activations).toEqual([])
  await page.locator('.booking-calendar-picker').click()
  await page.getByRole('option', { name: 'Studio', exact: true }).click()
  await page.locator('.booking-activate').click()
  await expect(page.locator('.action-message')).toContainText('Booking is active.')
  await expect(page.getByTestId('booking-connection')).toHaveCount(0)
  expect(model.activations[0].calendar_id).toBe('second-private-id')
  await expect(page.locator('.booking-calendar-picker')).toHaveCount(0)
})

test('already-connected saved disabled setup needs an explicit activation action', async ({ page }) => {
  const model = await setup(page, { saved: true, connected: true })
  await expect(page.locator('.booking-calendar-picker')).toBeVisible()
  expect(model.activations).toEqual([])
  await page.locator('.booking-calendar-picker').click()
  await page.getByRole('option', { name: 'Appointments (primary)', exact: true }).click()
  await page.locator('.booking-activate').click()
  await expect(page.locator('.action-message')).toContainText('Booking is active.')
  await expect(page.getByTestId('booking-connection')).toHaveCount(0)
  expect(model.activations).toHaveLength(1)
})

for (const denial of [true, false]) {
  test(`denied=${denial} or mismatched OAuth never activates`, async ({ page }) => {
    const model = await setup(page)
    const state = await start(page)
    await callback(page, denial ? state : 'wrong-state', denial)
    await expect(page.locator('.google-callback')).toContainText('Authorization could not be completed')
    expect(model.activations).toEqual([])
    expect(model.connects).toEqual([])
    expect(await page.evaluate(() => sessionStorage.getItem('mrcall.bookingConnectionIntent.v1'))).toBeNull()
  })
}

test('a return marker without an explicit intent cannot activate', async ({ page }) => {
  const model = await setup(page, { connected: true })
  await page.goto(`/businessconfiguration?id=${businessId}&skillBusinessConnection=google_calendar`)
  await expect(page.locator('.booking-calendar-picker')).toBeVisible()
  expect(model.activations).toEqual([])
})

for (const change of ['setup', 'owner', 'business', 'expiry']) {
  test(`changed ${change} intent does not activate`, async ({ page }) => {
    const model = await setup(page)
    const state = await start(page)
    if (change === 'setup') model.booking.setup_token = 'b'.repeat(64)
    else await page.evaluate(change => {
      const key = 'mrcall.bookingConnectionIntent.v1'
      const intent = JSON.parse(sessionStorage.getItem(key))
      if (change === 'owner') intent.ownerUid = 'other-owner'
      if (change === 'business') intent.businessId = 'other-business'
      if (change === 'expiry') intent.expiresAt = 0
      sessionStorage.setItem(key, JSON.stringify(intent))
    }, change)
    await callback(page, state)
    await expect(page.locator('.booking-calendar-picker')).toBeVisible()
    expect(model.activations).toEqual([])
  })
}

test('partial activation is truthful and never retries on reload', async ({ page }) => {
  const model = await setup(page, { partial: true })
  const state = await start(page)
  await callback(page, state)
  await expect(page.getByTestId('booking-connection')).toContainText('Activation is incomplete.')
  expect(model.pending).toHaveLength(4)
  expect(model.activations).toHaveLength(1)
  await page.reload()
  await expect(page.locator('.message-input')).toBeEnabled()
  expect(model.activations).toHaveLength(1)
})

test('malformed calendar list cannot activate or expose raw identifiers', async ({ page }) => {
  const model = await setup(page, { afterConnect: [{ id: 'private-id', summary: {}, primary: true }] })
  const state = await start(page)
  await callback(page, state)
  await expect(page.getByTestId('booking-connection')).toContainText('Activation could not be completed.')
  expect(model.activations).toEqual([])
  await expect(page.getByTestId('booking-connection')).not.toContainText('private-id')
})

test('empty calendars after connection stay inactive and preserve the setup', async ({ page }) => {
  const model = await setup(page, { afterConnect: [] })
  const state = await start(page)
  await callback(page, state)
  await expect(page.getByTestId('booking-connection')).toContainText('Activation could not be completed.')
  expect(model.activations).toEqual([])
  expect(model.pending).toHaveLength(5)
})

test('stale activation refusal cannot claim success or retry automatically', async ({ page }) => {
  const model = await setup(page, { activationError: 409 })
  const state = await start(page)
  await callback(page, state)
  await expect(page.getByTestId('booking-connection')).toContainText('The setup changed.')
  expect(model.activations).toHaveLength(1)
  expect(model.pending).toHaveLength(5)
  await expect(page.locator('.booking-activate')).toBeDisabled()
})

test('malformed activation response stays unconfirmed and preserves pending', async ({ page }) => {
  const model = await setup(page, { malformedActivation: true })
  const state = await start(page)
  await callback(page, state)
  await expect(page.getByTestId('booking-connection')).toContainText('Activation could not be completed.')
  expect(model.activations).toHaveLength(1)
  expect(model.pending).toHaveLength(5)
  await expect(page.getByTestId('booking-connection')).not.toContainText('Booking is active.')
})

test('fixed English booking tool text is omitted while the Italian final answer remains', async ({ page }) => {
  await setup(page)
  await page.route('**/api/chat/message/stream', route => {
    const body = route.request().postDataJSON()
    return sse(route, [{ type: 'tool_result', tool_used: 'configure_appointment_booking',
      result: { success: true, display_summary: false, response_text: 'All five appointment skills are queued.' } },
    { type: 'text_delta', text: 'Le cinque configurazioni sono pronte. Collega il calendario con il pulsante qui sotto.' },
    { type: 'metadata', pending_changes: five() }, { type: 'done', session_id: body.session_id }])
  })
  await page.locator('.message-input').fill('Prepara gli appuntamenti')
  await page.locator('.send-button').click()
  await expect(page.locator('.message-wrapper.assistant .message-content').last()).toContainText('Le cinque configurazioni sono pronte.')
  await expect(page.locator('.message-wrapper.assistant .message-content').last()).not.toContainText('All five')
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 964, height: 640 }, { width: 375, height: 812 }]) {
  test(`five-skill review keeps composer and connection separate at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await setup(page)
    await expect(page.locator('.pending-review')).not.toHaveAttribute('open')
    const composer = await page.locator('.chat-input-container').boundingBox()
    const connection = await page.getByTestId('booking-connection').boundingBox()
    expect(composer.height).toBeGreaterThan(70)
    expect(composer.y + composer.height).toBeLessThanOrEqual(connection.y)
    await page.screenshot({ path: testInfo.outputPath('booking-layout-collapsed.png'), fullPage: true })
    await page.locator('.pending-review > summary').click()
    await expect(page.getByTestId('skill-summary').first()).not.toContainText('Runtime instruction')
    await expect(page.getByTestId('skill-summary').first()).not.toContainText('FUNCTION_RESPONSE_BODY')
    const input = await page.locator('.chat-input-container').boundingBox()
    const card = await page.getByTestId('booking-connection').boundingBox()
    expect(input.y + input.height).toBeLessThanOrEqual(card.y)
    await page.screenshot({ path: testInfo.outputPath('booking-layout.png'), fullPage: true })
  })
}


for (const active of [false, true]) {
  test(`saved configured booking never shows the setup wizard (active=${active})`, async ({ page }) => {
    const model = await setup(page, { saved: true, connected: true, configured: true, active })
    await expect(page.locator('.booking-calendar-picker')).toHaveCount(0)
    await expect(page.locator('.booking-activate')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.message-input')).toBeEnabled()
    await expect(page.getByTestId('booking-connection')).toHaveCount(0)
    expect(model.activations).toEqual([])
    expect(model.saves).toEqual([])
  })
}

test('explicit failed prompt activation retains recovery even after status refresh', async ({ page }) => {
  const model = await setup(page, { saved: true, connected: true, promptFailure: true })
  await page.locator('.booking-calendar-picker').click()
  await page.getByRole('option', { name: 'Appointments (primary)', exact: true }).click()
  await page.locator('.booking-activate').click()
  await expect(page.locator('.booking-refresh')).toBeVisible()
  expect(model.booking.configured).toBe(true)
  await page.locator('.booking-refresh').click()
  await expect(page.getByTestId('booking-connection')).toBeVisible()
  await expect(page.locator('.booking-calendar-picker')).toBeVisible()
  expect(model.activations).toHaveLength(1)
})
