const { test, expect } = require('@playwright/test')
const { setupOAuthPage, businessId } = require('../fixtures/skill-oauth')
const { operation, json } = require('../fixtures/skill-chat')
const scope = 'https://www.googleapis.com/auth/spreadsheets'
const calendarScope = 'https://www.googleapis.com/auth/calendar'

test.use({ serviceWorkers: 'block' })
async function setup(page, options = {}) {
  const model = await setupOAuthPage(page, { returnedScope: options.returnedScope || scope })
  model.pending = [operation('sheets-op', { skill: 'skill_google_sheets_write', phase: 'final',
    ...(options.saved ? { action: 'replace', instance_id: 'saved-sheets' } : {}),
    params: { enabled: 'true', spreadsheetId: 'sheet-id', ...(options.saved ? { auth: 'opaque/exact' } : {}) } })]
  if (options.calendar) model.pending.push(operation('calendar-op', { skill: 'calendar_skill', params: {} }))
  await page.route('**/apidomain/agent/skills?*', route => json(route, [
    { name: 'skill_google_sheets_write', configSchema: { phases: ['final'], fields: [
      { key: 'auth', type: 'oauth', provider: 'google_sheets', storage: 'oauth_provider', scopes: [scope], default: '' }
    ] } },
    { name: 'calendar_skill', configSchema: { phases: ['during'], fields: [
      { key: 'auth', type: 'oauth', provider: 'google_calendar', storage: 'oauth_provider', scopes: [calendarScope] }
    ] } }
  ]))
  if (options.locale) await page.addInitScript(locale => localStorage.setItem('mrcall-user-locale', locale), options.locale)
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
  await expect(page.locator('.sheets-google-connect')).toBeEnabled()
  return model
}
async function start(page) {
  await page.locator('.sheets-google-connect').click()
  await expect(page).toHaveURL(/__oauth_capture__/)
  return page.evaluate(() => ({ state: localStorage.getItem('oauthState'),
    context: JSON.parse(localStorage.getItem('oauthSkillContext')) }))
}
const resumeMessages = model => model.messages.filter(row => row.message.includes('get_call_log_setup'))
async function callback(page, state, denied = false) {
  await page.goto('/callback?' + (denied ? 'error=access_denied' : 'code=fake-code') + '&state=' + encodeURIComponent(state))
}

test('verified write consent returns to one read/explain turn without saving; Calendar remains available', async ({ page }) => {
  const model = await setup(page, { calendar: true })
  await expect(page.locator('.business-google-connect')).toBeEnabled()
  await expect(page.locator('[data-testid="sheets-connection"]')).toContainText('If Google shows an unverified-app warning')
  const { state, context } = await start(page)
  expect(context.provider).toBe('google_sheets')
  expect(context.grantName).toBe('')
  const auth = new URL(model.authorizationUrls[0])
  expect(auth.searchParams.get('scope')).toBe(scope)
  expect(auth.searchParams.get('code_challenge_method')).toBe('S256')
  expect(auth.searchParams.get('include_granted_scopes')).toBeNull()
  await callback(page, state)
  await expect(page.locator('.message-input')).toBeEnabled()
  await expect.poll(() => resumeMessages(model).length).toBe(1)
  expect(model.connects[0]).toMatchObject({ businessId, grantName: '', scopes: [scope] })
  expect(model.pending).toHaveLength(2)
  expect(model.saves).toEqual([])
  expect(model.mutations).toEqual([])
  expect(model.registryWrites).toEqual([])
  await page.reload()
  await expect(page.locator('.message-input')).toBeEnabled()
  expect(resumeMessages(model)).toHaveLength(1)
  await page.locator('.save-button').click()
  await expect.poll(() => model.saves.length).toBe(1)
})

test('return query alone never triggers a model turn or Save', async ({ page }) => {
  const model = await setup(page)
  await page.goto(`/businessconfiguration?id=${businessId}&skillBusinessConnection=google_sheets`)
  await expect(page.locator('.sheets-google-connect')).toBeEnabled()
  expect(resumeMessages(model)).toEqual([])
  expect(model.saves).toEqual([])
  expect(model.connects).toEqual([])
})

for (const scenario of ['denied', 'wrong-state', 'wrong-scope', 'changed-target', 'changed-owner', 'changed-session']) {
  test(`${scenario} never resumes or saves`, async ({ page }) => {
    const model = await setup(page, scenario === 'wrong-scope' ? { returnedScope: calendarScope } : {})
    const { state } = await start(page)
    if (scenario === 'changed-target') model.pending[0].params.spreadsheetId = 'different-sheet'
    if (['changed-owner', 'changed-session'].includes(scenario)) await page.evaluate(scenario => {
      const key = 'mrcall.sheetsConnectionIntent.v1'
      const intent = JSON.parse(sessionStorage.getItem(key))
      intent[scenario === 'changed-owner' ? 'ownerUid' : 'sessionId'] = 'different'
      sessionStorage.setItem(key, JSON.stringify(intent))
    }, scenario)
    await callback(page, scenario === 'wrong-state' ? 'wrong' : state, scenario === 'denied')
    if (['denied', 'wrong-state', 'wrong-scope'].includes(scenario)) {
      await expect(page.locator('.google-callback')).toContainText('Authorization could not be completed')
    } else await expect(page.locator('.message-input')).toBeEnabled()
    expect(resumeMessages(model)).toEqual([])
    expect(model.saves).toEqual([])
  })
}

test('saved edit preserves its exact opaque grant during consent and continuation', async ({ page }) => {
  const model = await setup(page, { saved: true })
  const { state, context } = await start(page)
  expect(context.grantName).toBe('opaque/exact')
  expect(context.instanceId).toBe('saved-sheets')
  await callback(page, state)
  await expect.poll(() => resumeMessages(model).length).toBe(1)
  expect(model.connects[0].grantName).toBe('opaque/exact')
  expect(model.saves).toEqual([])
})


test('Italian consent continuation preserves Italian instructions and asks for actual setup', async ({ page }) => {
  const model = await setup(page, { locale: 'it-IT' })
  const { state } = await start(page)
  await callback(page, state)
  await expect.poll(() => resumeMessages(model).length).toBe(1)
  expect(resumeMessages(model)[0].message).toContain('Chiama get_call_log_setup')
  expect(resumeMessages(model)[0].message).toContain('Non salvare e non aggiungere righe')
  expect(model.saves).toEqual([])
})
