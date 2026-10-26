const { test, expect } = require('@playwright/test')
const { setupOAuthPage, businessId, calendarScope, mockUser } = require('../fixtures/skill-oauth')
const { operation, json } = require('../fixtures/skill-chat')

test.use({ serviceWorkers: 'block' })
const button = page => page.locator('.business-google-connect')
const draft = (extra = {}) => operation('business-calendar-draft', {
  skill: 'calendar_skill', params: { enabled: 'true', calendarId: 'chosen-calendar@example.test' }, ...extra
})
async function setup(page, options = {}) {
  const model = await setupOAuthPage(page, options)
  model.pending = [draft(options.change)]
  model.businessCatalogueReads = []
  await page.route('**/apidomain/agent/skills?*', route => {
    model.businessCatalogueReads.push(Object.fromEntries(new URL(route.request().url()).searchParams))
    if (options.catalogueError) return route.fulfill({ status: 503, body: '{}' })
    if (options.malformedCatalogue) return json(route, {})
    return json(route, [{
    name: 'calendar_skill', configSchema: { phases: ['during'], fields: options.fields || (options.noOAuth ? [] : [{
      key: 'SKILL_CALENDAR_AUTH', type: 'oauth', provider: options.provider || 'google_calendar',
      storage: 'oauth_provider', scopes: options.scopes || [calendarScope],
      ...(options.oauthHidden ? { visibleWhen: { bookingMode: 'calendar' } } : {})
    }]) }
    }])
  })
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
  const support = page.locator('#support-small:not(.collapsed) .panel-toggle-btn-small')
  if (await support.isVisible()) await support.click()
  return model
}
async function start(page) {
  await expect(button(page)).toBeEnabled()
  await button(page).click()
  await expect(page).toHaveURL(/__oauth_capture__/)
  return page.evaluate(() => ({ state: localStorage.getItem('oauthState'),
    context: JSON.parse(localStorage.getItem('oauthSkillContext')) }))
}
async function callback(page, state, code = true) {
  await page.goto('/callback?' + (code ? 'code=fake-code' : 'error=access_denied') + '&state=' + encodeURIComponent(state))
}
async function resign(page, patch) {
  return page.evaluate(async patch => {
    const context = { ...JSON.parse(localStorage.getItem('oauthSkillContext')), ...patch }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(context)))
    const state = 'skill.fixture.' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('oauthState', state)
    localStorage.setItem('oauthSkillContext', JSON.stringify(context))
    return state
  }, patch)
}

test('refused active draft authorizes exact business without Save or activation, then retains proposal', async ({ page }) => {
  const model = await setup(page)
  model.save = (route, state) => json(route, { success: false, applied: 0, errors: [],
    remaining_pending: state.pending, skill_outcomes: [{ operation_id: 'business-calendar-draft', status: 'refused', code: 'resource_access_refused' }] })
  const original = JSON.stringify(model.pending)
  await page.locator('.save-button').click()
  await expect(page.locator('[data-outcome="refused"]')).toBeVisible()
  const { state, context } = await start(page)
  expect(model.businessCatalogueReads.length).toBeGreaterThan(0)
  expect(model.businessCatalogueReads.every(query => query.businessId === businessId)).toBe(true)
  expect(context).toEqual({ target: 'business', provider: 'google_calendar', businessId,
    grantName: '', ownerUid: mockUser.uid,
    returnUrl: `/businessconfiguration?id=${businessId}&skillBusinessConnection=google_calendar`, scopes: [calendarScope] })
  const auth = new URL(model.authorizationUrls[0])
  expect(auth.searchParams.get('scope')).toBe(calendarScope)
  expect(auth.searchParams.get('code_challenge_method')).toBe('S256')
  expect(auth.searchParams.get('include_granted_scopes')).toBeNull()
  await callback(page, state)
  await expect(page).toHaveURL(/businessconfiguration.*skillBusinessConnection=google_calendar/)
  await expect(button(page)).toBeEnabled()
  expect(model.connects).toHaveLength(1)
  expect(model.connects[0]).toMatchObject({ businessId, grantName: '', scopes: [calendarScope] })
  expect(model.saves).toHaveLength(1)
  expect(JSON.stringify(model.pending)).toBe(original)
  expect(model.mutations).toEqual([])
  expect(model.registryWrites).toEqual([])
  expect(await page.evaluate(() => ['codeVerifier', 'oauthState', 'oauthSkillContext'].map(k => localStorage.getItem(k)))).toEqual([null, null, null])
  // A later explicit Save remains the authority; returning from consent is not access proof.
  await page.locator('.save-button').click()
  await expect(page.locator('[data-outcome="refused"]')).toBeVisible()
  expect(model.saves).toHaveLength(2)
})

for (const [name, options] of [
  ['unsupported provider', { provider: 'google_sheets' }],
  ['unsupported scope', { scopes: ['https://www.googleapis.com/auth/drive'] }],
  ['unknown catalogue field', { noOAuth: true }],
  ['catalogue unavailable', { catalogueError: true }],
  ['malformed catalogue', { malformedCatalogue: true }],
  ['hidden OAuth field', { oauthHidden: true }],
  ['named draft reference', { change: { params: { SKILL_CALENDAR_AUTH: 'named-grant' } } }],
  ['saved instance', { change: { instance_id: 'saved-one', action: 'replace' } }],
  ['named default', { fields: [{ key: 'AUTH', type: 'oauth', provider: 'google_calendar', storage: 'oauth_provider', scopes: [calendarScope], default: 'named-default' }] }]
]) {
  test(`${name} cannot start the business connection`, async ({ page }) => {
    const model = await setup(page, options)
    await expect(page.locator('[data-testid="pending-preview"]')).toBeVisible()
    await expect(button(page)).toHaveCount(0)
    expect(model.authorizationUrls).toEqual([])
    expect(model.connects).toEqual([])
    expect(model.saves).toEqual([])
  })
}

for (const [name, patch] of [
  ['owner changed', { ownerUid: 'another-owner' }],
  ['unsafe return', { returnUrl: 'https://example.invalid/return' }],
  ['different business return', { businessId: 'different-business' }],
  ['named grant', { grantName: 'named-grant' }],
  ['invented instance', { instanceId: 'invented' }]
]) {
  test(`business callback rejects ${name} before exchanging or connecting`, async ({ page }) => {
    const model = await setup(page)
    await start(page)
    const state = await resign(page, patch)
    await callback(page, state)
    await expect(page.locator('.google-callback')).toContainText('Authorization could not be completed')
    expect(model.exchanges).toEqual([])
    expect(model.connects).toEqual([])
    expect(model.saves).toEqual([])
    expect(model.pending).toHaveLength(1)
  })
}

test('cancelled or mismatched business callback never exchanges or connects', async ({ page }) => {
  const model = await setup(page)
  const { state } = await start(page)
  await callback(page, state, false)
  await expect(page.locator('.google-callback')).toContainText('Authorization could not be completed')
  expect(model.exchanges).toEqual([])
  expect(model.connects).toEqual([])
  expect(model.pending).toHaveLength(1)
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
  await start(page)
  await callback(page, 'wrong-state')
  await expect(page.locator('.google-callback')).toContainText('Authorization could not be completed')
  expect(model.exchanges).toEqual([])
  expect(model.connects).toEqual([])
})
