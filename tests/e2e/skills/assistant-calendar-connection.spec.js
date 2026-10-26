const { test, expect } = require('@playwright/test')
const { setupOAuthPage, businessId } = require('../fixtures/skill-oauth')
const { operation, json, collections } = require('../fixtures/skill-chat')
test.use({ serviceWorkers: 'block' })
const chosenCalendar = 'chosen-calendar@example.test'
const screen = page => page.locator('.assistant-calendar-connection')
async function setup(page, options = {}) {
  const model = await setupOAuthPage(page, { grant: '' })
  model.pending = [operation('screen-draft', { skill: 'calendar_skill', params: { enabled: 'true', calendarId: chosenCalendar },
    preview: { skill_label: 'Calendar appointments', before: null, after: { enabled: 'true', calendarId: chosenCalendar },
      field_labels: { calendarId: 'Calendar', enabled: 'Active' } } })]
  model.scopedReads = []
  await page.route('**/crm/variable*', route => json(route, [
    { collection: { id: '__SEND_DATA__', humanName: 'Calendar connections' }, variables: collections[0].variables.map(group => group.map(variable => ({ ...variable, dependsOn: [] }))) }
  ]))
  await page.route('**/crm/customer/registry*', route => {
    if (route.request().method() === 'PUT') model.registryWrites.push(route.request().postDataJSON())
    return json(route, { data: { oauth: { GOOGLE_CALENDAR: { connected: true, calendarId: chosenCalendar } } } })
  })
  await page.route('**/oauth/providers/google_calendar/calendars*', route => {
    const query = Object.fromEntries(new URL(route.request().url()).searchParams)
    model.scopedReads.push(query)
    if (options.error) return route.fulfill({ status: 503, body: '{}' })
    if (options.wrongBusiness) return json(route, query.businessId === 'another-business' ? [{ id: chosenCalendar }] : [])
    return json(route, options.calendars === undefined ? [] : options.calendars)
  })
  return model
}
async function openBusiness(page) {
  await page.goto(`/businessconfiguration?id=${businessId}&section=__SEND_DATA__`)
  await expect(screen(page)).toBeVisible()
  await expect(page.locator('.assistant-google-connect')).toBeEnabled()
}

test('Account connected to same calendar remains separate from unknown assistant authorization', async ({ page }) => {
  const model = await setup(page)
  await page.goto('/account')
  await expect(page.locator('.connect-calendar')).toContainText(chosenCalendar)
  await expect(page.getByText('Authorize each assistant separately to use it.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Disconnect Calendar', exact: true })).toBeVisible()
  expect(model.scopedReads).toEqual([])
  await openBusiness(page)
  await expect(screen(page).locator('.account-calendar-state')).toContainText(chosenCalendar)
  await expect(screen(page).locator('.assistant-calendar-state')).toHaveAttribute('data-status', 'unknown')
  await expect(screen(page)).toContainText('has not been verified')
  await expect(page.getByRole('button', { name: 'Disconnect Calendar', exact: true })).toHaveCount(0)
  expect(model.scopedReads).toEqual([{ businessId, grantName: '' }])
  expect(model.registryWrites).toEqual([])
  expect(model.connects).toEqual([])
})

test('Account reconnect retains legacy picker and global registry write without business grant', async ({ page }) => {
  const model = await setup(page)
  await page.goto('/account')
  await page.getByRole('button', { name: 'Change Calendar', exact: true }).click()
  await expect(page).toHaveURL(/__oauth_capture__/)
  const state = await page.evaluate(() => localStorage.getItem('oauthState'))
  expect(await page.evaluate(() => localStorage.getItem('oauthSkillContext'))).toBeNull()
  await page.goto('/callback?code=fake-code&state=' + encodeURIComponent(state))
  await expect(page.locator('.calendar-selector')).toBeVisible()
  await page.locator('.selector-confirm').click()
  await expect(page).toHaveURL(/\/account$/)
  expect(model.registryWrites).toHaveLength(1)
  expect(model.registryWrites[0].oauth.GOOGLE_CALENDAR.calendarId).toBe('legacy-calendar')
  expect(model.registryWrites[0].businessId).toBeUndefined()
  expect(model.connects).toEqual([])
})

test('assistant consent uses exact business grant, retains draft and still requires explicit Save', async ({ page }) => {
  const model = await setup(page)
  const original = JSON.stringify(model.pending)
  await openBusiness(page)
  await page.locator('.assistant-google-connect').click()
  await expect(page).toHaveURL(/__oauth_capture__/)
  const stored = await page.evaluate(() => ({ state: localStorage.getItem('oauthState'), context: JSON.parse(localStorage.getItem('oauthSkillContext')) }))
  expect(stored.context).toMatchObject({ target: 'business', businessId, grantName: '' })
  expect(stored.context.instanceId).toBeUndefined()
  await page.goto('/callback?code=fake-code&state=' + encodeURIComponent(stored.state))
  await expect(page.locator('.message-input')).toBeEnabled()
  await expect(page.getByTestId('skill-summary')).toContainText('After saving: active')
  await expect(page.getByTestId('skill-summary')).toContainText(chosenCalendar)
  expect(model.connects).toHaveLength(1)
  expect(model.connects[0]).toMatchObject({ businessId, grantName: '' })
  expect(model.registryWrites).toEqual([])
  expect(JSON.stringify(model.pending)).toBe(original)
  expect(model.saves).toEqual([])
  model.save = (route, state) => json(route, { success: false, applied: 0, errors: [], remaining_pending: state.pending,
    skill_outcomes: [{ operation_id: 'screen-draft', status: 'refused', code: 'resource_access_refused' }] })
  await page.locator('.save-button').click()
  await expect(page.locator('[data-outcome="refused"]')).toBeVisible()
  expect(model.saves).toHaveLength(1)
})

for (const [name, options] of [
  ['revoked or refused access', { error: true }],
  ['malformed calendars', { calendars: [{}] }],
  ['availability for another business', { wrongBusiness: true }],
]) {
  test(`${name} stays unknown while account connection remains visible`, async ({ page }) => {
    const model = await setup(page, options)
    await openBusiness(page)
    await expect(screen(page).locator('.account-calendar-state')).toContainText(chosenCalendar)
    await expect(screen(page).locator('.assistant-calendar-state')).toHaveAttribute('data-status', 'unknown')
    expect(model.scopedReads.every(query => query.businessId === businessId && query.grantName === '')).toBe(true)
    expect(model.connects).toEqual([])
  })
}

test('nonempty scoped list means availability only; refresh can return unknown', async ({ page }) => {
  await setup(page, { calendars: [{ id: chosenCalendar }] })
  await openBusiness(page)
  await expect(screen(page).locator('.assistant-calendar-state')).toHaveAttribute('data-status', 'available')
  await expect(screen(page)).toContainText('does not save or activate bookings')
  let release
  const held = new Promise(resolve => { release = resolve })
  await page.route('**/oauth/providers/google_calendar/calendars*', async route => { await held; return json(route, []) })
  await page.locator('.assistant-google-refresh').click()
  await expect(page.locator('.assistant-google-refresh')).toBeDisabled()
  release()
  await expect(page.locator('.assistant-google-refresh')).toBeEnabled()
  await expect(screen(page).locator('.assistant-calendar-state')).toHaveAttribute('data-status', 'unknown')
})

test('Italian Account and assistant wording preserves separate connection scopes', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => localStorage.setItem('mrcall-user-locale', 'it-IT'))
  await page.goto('/account')
  await expect(page.getByText('Autorizza separatamente ciascun assistente per usarlo.', { exact: false })).toBeVisible()
  await openBusiness(page)
  await expect(screen(page).locator('.account-calendar-state')).toContainText(chosenCalendar)
  await expect(screen(page)).toContainText('Questo assistente')
  await expect(screen(page)).toContainText('non è stato verificato')
})

for (const [name, id] of [['missing', null], ['changed', 'another-business']]) {
  test(`in-app ${name} business ID stays assistant-unknown and cannot fall back to Account`, async ({ page }) => {
    const model = await setup(page)
    await openBusiness(page)
    await page.evaluate(async id => {
      const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router
      await router.push({ path: '/businessconfiguration', query: { section: '__SEND_DATA__', ...(id ? { id } : {}) } })
    }, id)
    await expect(screen(page)).toBeVisible()
    await expect(screen(page).locator('.assistant-calendar-state')).toHaveAttribute('data-status', 'unknown')
    await expect(page.locator('.assistant-google-connect')).toBeDisabled()
    await expect(page.locator('.assistant-google-refresh')).toBeDisabled()
    await expect(page.locator('.connect-calendar')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Disconnect Calendar', exact: true })).toHaveCount(0)
    expect(model.scopedReads).toEqual([{ businessId, grantName: '' }])
    expect(model.authorizationUrls).toEqual([])
    expect(model.connects).toEqual([])
  })
}
