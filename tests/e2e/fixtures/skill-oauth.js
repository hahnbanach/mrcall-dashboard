const { setupSkillPage, businessId, operation, json } = require('./skill-chat')
const { setupApiMocks } = require('./auth')
const { mockBusiness, mockUser } = require('./mock-data')

const calendarScope = 'https://www.googleapis.com/auth/calendar'
const instanceId = 'calendar-server-7'
const target = { phase: 'during', instanceId }
const returnUrl = `/businessconfiguration?id=${businessId}&skillPhase=during&skillInstance=${instanceId}`
const savedEntry = grant => ({ skill: 'calendar_skill', instanceId, params: { enabled: 'false', SKILL_CALENDAR_AUTH: grant } })

async function setupOAuthPage(page, options = {}) {
  const grant = options.grant === undefined ? 'business-grant-exact' : options.grant
  const configuration = { prefetch: [], during: [savedEntry(grant)], final: [], revisions: { prefetch: 'a'.repeat(64), during: 'b'.repeat(64), final: 'c'.repeat(64) } }
  if (options.missingGrant) delete configuration.during[0].params.SKILL_CALENDAR_AUTH
  const pending = operation('oauth-op', { action: 'create', skill: 'calendar_skill', params: { enabled: 'false', SKILL_CALENDAR_AUTH: grant }, preview: { before: null, after: { label: 'Calendar draft' } } })
  const model = await setupSkillPage(page, { pending: options.pending === false ? [] : [pending], save: async (route, state) => {
    state.pending = []
    return json(route, { success: true, applied: 1, errors: [], remaining_pending: [], skill_outcomes: [{ operation_id: 'oauth-op', status: 'saved', instance_id: instanceId }] })
  } }, options.user || mockUser)
  Object.assign(model, { configuration, configurationReads: 0, calendarReads: [], exchanges: [], connects: [], authorizationUrls: [], mutations: [], registryWrites: [], calendars: options.calendars === undefined ? [{ id: 'shared-calendar', summary: 'Shared calendar' }] : options.calendars })
  const variable = { name: 'SKILL_PREFETCH_CONFIGURATION', humanName: 'Skill settings', class: 'variable', type: 'json', visible: options.visible !== false, modifiable: true, mandatory: false, advanced: false, dependsOn: [], defaultValue: '[]', description: '' }
  const collections = [{ collection: { id: '__CUSTOM_SKILL_SECTION__', humanName: 'Custom integration section' }, variables: [[variable]] }]
  const business = { ...mockBusiness, variables: { ...mockBusiness.variables, SKILL_PREFETCH_CONFIGURATION: '[]', SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify(configuration.during), SKILL_FINAL_CONFIGURATION: '[]' } }
  await setupApiMocks(page, { businessDetail: business, businesses: [business], templateVariables: collections })
  await page.route('**/agent/skills/available*', route => json(route, [{ name: 'calendar_skill', configSchema: { phases: ['during'], fields: options.noOAuth ? [] : [{ key: 'SKILL_CALENDAR_AUTH', type: 'oauth', widget: 'oauth', provider: options.provider || 'google_calendar', scopes: options.scopes || [calendarScope], storage: 'oauth_provider', ...(options.oauthHidden ? { visibleWhen: { bookingMode: 'calendar' } } : {}), labels: { en: { label: 'Calendar authorization' } } }] } }]))
  await page.route('**/apidomain/agent/skills/configuration/**', route => {
    if (route.request().method() !== 'GET') { model.mutations.push(route.request().method()); return route.fulfill({ status: 500, body: '{}' }) }
    model.configurationReads++
    return json(route, model.configuration)
  })
  await page.route('**/oauth/providers/google_calendar/calendars*', route => {
    model.calendarReads.push(Object.fromEntries(new URL(route.request().url()).searchParams))
    if (options.calendarError) return route.fulfill({ status: 500, body: '{}' })
    return json(route, model.calendars)
  })
  await page.route('**/oauth/google/token', route => {
    model.exchanges.push(route.request().postDataJSON())
    return json(route, { accessToken: 'fake-oauth-access', refreshToken: 'fake-oauth-refresh', expiresIn: 3600, scope: options.returnedScope || calendarScope, tokenType: 'Bearer' })
  })
  await page.route('**/oauth/providers/*/connect', route => { model.connects.push(route.request().postDataJSON()); return json(route, {}) })
  await page.route('**/crm/business', route => { model.mutations.push(route.request().method()); return route.fulfill({ status: 500, body: '{}' }) })
  await page.route('**/crm/customer/registry*', route => {
    if (route.request().method() === 'PUT') model.registryWrites.push(route.request().postDataJSON())
    return json(route, { data: {} })
  })
  await page.route('**/www.googleapis.com/calendar/v3/users/me/calendarList*', route => json(route, { items: [{ id: 'legacy-calendar', summary: 'Legacy calendar', primary: true }] }))
  await page.route('**/accounts.google.com/o/oauth2/v2/auth*', route => {
    model.authorizationUrls.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><script>window.location.replace("http://localhost:8080/__oauth_capture__")</script></html>' })
  })
  await page.route('**/localhost:8080/__oauth_capture__', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Authorization intercepted locally</body></html>' }))
  return model
}

async function seedCallback(page, overrides = {}, mutation = null) {
  return page.evaluate(async ({ context, mutation }) => {
    const normalized = { provider: context.provider, businessId: context.businessId, grantName: context.grantName, phase: context.phase, instanceId: context.instanceId, ownerUid: context.ownerUid, returnUrl: context.returnUrl, scopes: [...context.scopes].sort() }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)))
    const state = 'skill.fixture-nonce.' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('codeVerifier', 'fake-verifier')
    localStorage.setItem('oauthState', state)
    localStorage.setItem('oauthSkillContext', JSON.stringify(normalized))
    if (mutation === 'missing') localStorage.removeItem('oauthSkillContext')
    if (mutation === 'tamper') { normalized.grantName = 'tampered-grant'; localStorage.setItem('oauthSkillContext', JSON.stringify(normalized)) }
    return state
  }, { context: { provider: 'google_calendar', businessId, grantName: 'business-grant-exact', ...target, ownerUid: mockUser.uid, returnUrl, scopes: [calendarScope], ...overrides }, mutation })
}

module.exports = { setupOAuthPage, seedCallback, businessId, instanceId, returnUrl, calendarScope, target, mockUser }
