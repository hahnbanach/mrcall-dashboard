const { test, expect } = require('@playwright/test')
const { setupOAuthPage, seedCallback, businessId, instanceId, returnUrl, calendarScope, mockUser } = require('../fixtures/skill-oauth')

test.use({ serviceWorkers: 'block' })
const card = page => page.locator(`[data-skill-instance="${instanceId}"][data-skill-phase="during"]`)
const open = async page => {
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
  const support = page.locator('#support-small:not(.collapsed) .panel-toggle-btn-small')
  if (await support.isVisible()) await support.click()
}
const manage = page => page.getByRole('button', { name: `Manage connection: ${instanceId}`, exact: true })
const openSaved = async (page, model) => {
  await open(page)
  await expect(manage(page)).toHaveCount(0)
  await page.locator('.save-button').click()
  await expect(manage(page)).toBeEnabled()
  await manage(page).click()
  await expect(card(page)).toBeVisible()
  await expect(card(page)).toHaveClass(/entry-focused/)
  await expect.poll(() => model.configurationReads).toBeGreaterThan(0)
}
const callbackFailure = async (page, state) => {
  await page.goto('/callback?code=fake-code&state=' + encodeURIComponent(state))
  await expect(page.locator('.google-callback')).toContainText('Authorization could not be completed')
  expect(await page.evaluate(() => ['codeVerifier', 'oauthState', 'oauthSkillContext'].map(key => localStorage.getItem(key)))).toEqual([null, null, null])
}

test('confirmed Save opens the dynamically located saved instance and scoped effective availability', async ({ page }) => {
  const model = await setupOAuthPage(page)
  await openSaved(page, model)
  await expect(card(page)).toContainText('Saved authorization reference: business-grant-exact')
  await expect(card(page).locator('.oauth-availability')).toContainText('A shared or fallback grant may provide it')
  expect(model.calendarReads.every(query => query.businessId === businessId && query.grantName === 'business-grant-exact')).toBe(true)
  expect(model.configuration.during[0].params.enabled).toBe('false')
  expect(model.mutations).toEqual([])
  expect(model.connects).toEqual([])
})

test('shared empty reference remains empty and an empty check stays unknown', async ({ page }) => {
  const model = await setupOAuthPage(page, { grant: '', calendars: [], providers: [{ provider: 'google_calendar', businessId, grantName: instanceId, providerAccountId: 'other-account@example.invalid' }] })
  await openSaved(page, model)
  await expect(card(page)).toContainText('Shared authorization (empty reference)')
  await expect(card(page).locator('.oauth-availability')).toContainText('unknown')
  expect(model.calendarReads.every(query => query.businessId === businessId && query.grantName === '')).toBe(true)
  await card(page).locator('.skill-oauth-connect').click()
  await expect.poll(() => model.authorizationUrls.length).toBe(1)
  await expect(page).toHaveURL(/__oauth_capture__/)
  const context = await page.evaluate(() => JSON.parse(localStorage.getItem('oauthSkillContext')))
  expect(context.grantName).toBe('')
  expect(context.instanceId).toBe(instanceId)
  expect(context.businessId).toBe(businessId)
  expect(model.mutations).toEqual([])
})

test('calendar check errors do not claim disconnection and refresh uses fresh saved reference', async ({ page }) => {
  const model = await setupOAuthPage(page, { calendarError: true })
  await openSaved(page, model)
  await expect(card(page).locator('.oauth-availability')).toContainText('unknown')
  model.configuration.during[0].params.SKILL_CALENDAR_AUTH = 'new-saved-reference'
  await card(page).getByRole('button', { name: 'Refresh connection status' }).click()
  await expect(card(page)).toContainText('new-saved-reference')
  expect(model.calendarReads.at(-1).grantName).toBe('new-saved-reference')
  expect(model.mutations).toEqual([])
})

test('hidden template collection reports unavailable handoff', async ({ page }) => {
  const model = await setupOAuthPage(page, { visible: false })
  await open(page)
  await page.locator('.save-button').click()
  await manage(page).click()
  await expect(page.getByText('The saved skill connection cannot be opened here.', { exact: true })).toBeVisible()
  await expect(page.locator('.agent-skills-configurator')).toHaveCount(0)
  expect(model.authorizationUrls).toEqual([])
  expect(model.mutations).toEqual([])
})

for (const unsupported of [{ provider: 'google_sheets' }, { scopes: ['https://www.googleapis.com/auth/drive'] }]) {
  test(`unsupported ${unsupported.provider || 'scopes'} keeps authorization unavailable`, async ({ page }) => {
    const model = await setupOAuthPage(page, unsupported)
    await openSaved(page, model)
    await expect(card(page)).toContainText('no supported authorization flow')
    await expect(card(page).locator('.skill-oauth-connect')).toBeDisabled()
    expect(model.calendarReads).toEqual([])
    expect(model.authorizationUrls).toEqual([])
    expect(model.mutations).toEqual([])
  })
}

test('actual authorization UI binds state and exact saved grant then callback connects and refreshes without enabling', async ({ page }) => {
  const model = await setupOAuthPage(page)
  await openSaved(page, model)
  await card(page).locator('.skill-oauth-connect').click()
  await expect.poll(() => model.authorizationUrls.length).toBe(1)
  await expect(page).toHaveURL(/__oauth_capture__/)
  const url = new URL(model.authorizationUrls[0])
  expect(url.searchParams.get('scope').split(' ')).toEqual([calendarScope])
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('include_granted_scopes')).toBeNull()
  const state = url.searchParams.get('state')
  expect(state).toMatch(/^skill\..+\.[a-f0-9]{64}$/)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('oauthSkillContext')))
  expect(stored).toEqual({ provider: 'google_calendar', businessId, grantName: 'business-grant-exact', phase: 'during', instanceId, ownerUid: mockUser.uid, returnUrl, scopes: [calendarScope] })
  expect(JSON.stringify(stored)).not.toMatch(/fake-oauth|accessToken|refreshToken/)
  const readsBefore = model.configurationReads
  await page.goto('/callback?code=fake-code&state=' + encodeURIComponent(state))
  await expect(page).toHaveURL(new RegExp('businessconfiguration\\?id=' + businessId + '&skillPhase=during&skillInstance=' + instanceId))
  await expect(card(page)).toBeVisible()
  await expect(card(page).locator('.oauth-availability')).toContainText('available')
  expect(model.exchanges).toHaveLength(1)
  expect(model.connects).toHaveLength(1)
  expect(model.connects[0]).toMatchObject({ businessId, grantName: 'business-grant-exact', scopes: [calendarScope], accessToken: 'fake-oauth-access', refreshToken: 'fake-oauth-refresh' })
  expect(model.configurationReads).toBeGreaterThan(readsBefore)
  expect(model.configuration.during[0].params.enabled).toBe('false')
  expect(model.mutations).toEqual([])
  expect(model.registryWrites).toEqual([])
  expect(await page.evaluate(() => ['codeVerifier', 'oauthState', 'oauthSkillContext'].map(key => localStorage.getItem(key)))).toEqual([null, null, null])
  await callbackFailure(page, state)
  expect(model.exchanges).toHaveLength(1)
  expect(model.connects).toHaveLength(1)
})

for (const scenario of ['state-mismatch', 'missing-context', 'tampered-context', 'wrong-owner', 'unsafe-return', 'unsupported-scopes']) {
  test(`callback refuses ${scenario} before exchange or connection and consumes state`, async ({ page }) => {
    const model = await setupOAuthPage(page, { pending: false })
    const overrides = scenario === 'wrong-owner' ? { ownerUid: 'other-owner' } : scenario === 'unsafe-return' ? { returnUrl: 'https://outside.invalid/steal' } : scenario === 'unsupported-scopes' ? { scopes: ['https://www.googleapis.com/auth/drive'] } : {}
    const mutation = scenario === 'missing-context' ? 'missing' : scenario === 'tampered-context' ? 'tamper' : null
    const state = await seedCallback(page, overrides, mutation)
    await callbackFailure(page, scenario === 'state-mismatch' ? 'wrong-state' : state)
    expect(model.exchanges).toEqual([])
    expect(model.connects).toEqual([])
    expect(model.mutations).toEqual([])
  })
}

test('callback refuses broader returned scopes after mocked exchange without connecting', async ({ page }) => {
  const model = await setupOAuthPage(page, { pending: false, returnedScope: calendarScope + ' https://www.googleapis.com/auth/drive' })
  const state = await seedCallback(page)
  await callbackFailure(page, state)
  expect(model.exchanges).toHaveLength(1)
  expect(model.connects).toEqual([])
  expect(model.mutations).toEqual([])
})

test('legacy calendar callback keeps calendar selection and registry path without skill binding', async ({ page }) => {
  const model = await setupOAuthPage(page, { pending: false })
  await page.evaluate(() => { localStorage.setItem('codeVerifier', 'legacy-verifier'); localStorage.setItem('oauthState', 'legacy-state'); localStorage.setItem('oauthFlow', 'calendar'); localStorage.removeItem('oauthSkillContext') })
  await page.goto('/callback?code=fake-code&state=legacy-state')
  await expect(page.locator('.calendar-selector')).toBeVisible()
  await expect(page.locator('.calendar-selector')).toContainText('Legacy calendar')
  expect(model.exchanges).toHaveLength(1)
  expect(model.connects).toEqual([])
  expect(model.mutations).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('oauthSkillContext'))).toBeNull()
})

for (const malformed of [[{}], [{ id: '' }], { items: [{ id: 'calendar' }] }]) {
  test(`malformed availability ${JSON.stringify(malformed)} remains unknown`, async ({ page }) => {
    const model = await setupOAuthPage(page, { calendars: malformed })
    await openSaved(page, model)
    await expect(card(page).locator('.oauth-availability')).toContainText('unknown')
    expect(model.connects).toEqual([])
    expect(model.mutations).toEqual([])
  })
}

test('callback refuses returned scopes missing requested calendar permission', async ({ page }) => {
  const model = await setupOAuthPage(page, { pending: false, returnedScope: 'openid email profile' })
  const state = await seedCallback(page)
  await callbackFailure(page, state)
  expect(model.exchanges).toHaveLength(1)
  expect(model.connects).toEqual([])
  expect(model.mutations).toEqual([])
})

test('legacy sign-in requests only identity and clears abandoned skill context', async ({ page }) => {
  const model = await setupOAuthPage(page, { pending: false })
  await seedCallback(page)
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('firebaseLocalStorageDb', 1)
    request.onsuccess = () => { const db = request.result; const transaction = db.transaction('firebaseLocalStorage', 'readwrite'); transaction.objectStore('firebaseLocalStorage').clear(); transaction.oncomplete = () => { db.close(); resolve() }; transaction.onerror = reject }
    request.onerror = reject
  }))
  await page.goto('/signin')
  await page.locator('.signin-signup-button-text').filter({ has: page.locator('.pi-google') }).click()
  await expect.poll(() => model.authorizationUrls.length).toBe(1)
  await expect(page).toHaveURL(/__oauth_capture__/)
  const url = new URL(model.authorizationUrls[0])
  expect(url.searchParams.get('scope').split(' ').sort()).toEqual(['email', 'openid', 'profile'])
  expect(url.searchParams.get('state')).not.toMatch(/^skill\./)
  expect(url.searchParams.get('access_type')).toBeNull()
  expect(url.searchParams.get('include_granted_scopes')).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('oauthSkillContext'))).toBeNull()
  expect(model.exchanges).toEqual([])
  expect(model.connects).toEqual([])
})

for (const unavailable of [{ noOAuth: true }, { oauthHidden: true }]) {
  test(`saved skill with ${unavailable.noOAuth ? 'no OAuth metadata' : 'conditional hidden OAuth'} has no handoff`, async ({ page }) => {
    const model = await setupOAuthPage(page, unavailable)
    await open(page)
    await page.locator('.save-button').click()
    await manage(page).click()
    await expect(page.getByText('The saved skill connection cannot be opened here.', { exact: true })).toBeVisible()
    expect(model.calendarReads).toEqual([])
    expect(model.authorizationUrls).toEqual([])
    expect(model.mutations).toEqual([])
  })
}

for (const invalidGrant of [42, null]) {
test(`saved invalid grant ${invalidGrant} is unknown and cannot be converted silently to shared authorization`, async ({ page }) => {
  const model = await setupOAuthPage(page, { grant: invalidGrant })
  await openSaved(page, model)
  await expect(card(page).locator('.oauth-availability')).toContainText('unknown')
  await expect(card(page).locator('.skill-oauth-connect')).toBeDisabled()
  await expect(card(page)).not.toContainText('Shared authorization (empty reference)')
  expect(model.calendarReads).toEqual([])
  expect(model.authorizationUrls).toEqual([])
  expect(model.mutations).toEqual([])
})
}

test('absent saved legacy grant authorizes the exact shared empty reference without an instance default', async ({ page }) => {
  const model = await setupOAuthPage(page, { missingGrant: true, calendars: [] })
  await openSaved(page, model)
  await expect(card(page)).toContainText('Shared authorization (empty reference)')
  await expect(card(page).locator('.oauth-availability')).toContainText('unknown')
  expect(model.calendarReads.at(-1)).toEqual({ businessId, grantName: '' })
  await card(page).locator('.skill-oauth-connect').click()
  await expect.poll(() => model.authorizationUrls.length).toBe(1)
  await expect(page).toHaveURL(/__oauth_capture__/)
  const context = await page.evaluate(() => JSON.parse(localStorage.getItem('oauthSkillContext')))
  expect(context.grantName).toBe('')
  const state = new URL(model.authorizationUrls[0]).searchParams.get('state')
  await page.goto('/callback?code=fake-code&state=' + encodeURIComponent(state))
  await expect(card(page)).toBeVisible()
  expect(model.connects).toHaveLength(1)
  expect(model.connects[0]).toMatchObject({ businessId, grantName: '' })
  expect(model.configuration.during[0].params).not.toHaveProperty('SKILL_CALENDAR_AUTH')
  expect(model.configuration.during[0].params.enabled).toBe('false')
  expect(model.mutations).toEqual([])
})


test('legacy manual skill callback preserves business grant and provider account identity', async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ email: 'calendar-owner@example.invalid' })).toString('base64url')
  const model = await setupOAuthPage(page, { pending: false, idToken: `header.${payload}.signature` })
  await page.evaluate(({ businessId }) => {
    localStorage.setItem('codeVerifier', 'legacy-skill-verifier')
    localStorage.setItem('oauthState', 'legacy-skill-state')
    localStorage.setItem('oauthProvider', 'google_calendar')
    localStorage.setItem('oauthBusinessId', businessId)
    localStorage.setItem('oauthGrantName', 'manual-instance-8')
    localStorage.setItem('oauthReturnUrl', `/businessconfiguration?id=${businessId}`)
    localStorage.removeItem('oauthSkillContext')
  }, { businessId })
  await page.goto('/callback?code=fake-code&state=legacy-skill-state')
  await expect(page).toHaveURL(new RegExp('businessconfiguration\\?id=' + businessId))
  expect(model.exchanges).toHaveLength(1)
  expect(model.connects).toHaveLength(1)
  expect(model.connects[0]).toMatchObject({ businessId, grantName: 'manual-instance-8', providerAccountId: 'calendar-owner@example.invalid' })
  expect(model.mutations).toEqual([])
  expect(model.registryWrites).toEqual([])
})
