const { test, expect } = require('@playwright/test')
const { setupOAuthPage, businessId, instanceId } = require('../fixtures/skill-oauth')
const { mockBusiness } = require('../fixtures/mock-data')
const { json, operation, collections } = require('../fixtures/skill-chat')
test.use({ serviceWorkers: 'block' })
const card = (page, id = instanceId) => page.locator(`[data-skill-instance="${id}"][data-skill-phase="during"]`)
const entry = (id = instanceId, enabled = 'true') => ({ skill: 'calendar_skill', instanceId: id, params: { enabled, SKILL_CALENDAR_AUTH: '' } })
const route = async (page, section, id = businessId) => page.evaluate(({ section, id }) => {
  const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router
  return router.push({ query: { id, ...(section ? { section } : {}) } })
}, { section, id })
async function setup(page, options = {}) {
  const model = await setupOAuthPage(page)
  model.configuration.during = options.initial || []
  model.pending[0].params.enabled = 'true'
  model.pending[0].preview.after.enabled = 'true'
  const business = () => ({ ...mockBusiness, variables: { ...mockBusiness.variables, GOOGLE_PLACE_ID: 'mock-place',
    SKILL_PREFETCH_CONFIGURATION: '[]', SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify(model.configuration.during), SKILL_FINAL_CONFIGURATION: '[]' } })
  await page.route(/\/crm\/business(?:\?|$)/, request => json(request, [business()]))
  await page.route('**/crm/variable*', request => json(request, [
    { collection: { id: '__CUSTOM_SKILL_SECTION__', humanName: 'Custom integration section' }, variables: [[{
      name: 'SKILL_PREFETCH_CONFIGURATION', humanName: 'Skill settings', class: 'variable', type: 'json', visible: true,
      modifiable: true, mandatory: false, advanced: false, dependsOn: [], defaultValue: '[]', description: '' }]] },
    { ...collections[0], variables: collections[0].variables.map(group => group.map(v => ({ ...v, dependsOn: [] }))) }
  ]))
  model.save = async (request, state) => {
    state.configuration.during = [...(options.initial || []), entry()]
    state.pending = []
    return json(request, { success: true, applied: 1, errors: [], remaining_pending: [],
      skill_outcomes: [{ operation_id: 'oauth-op', status: 'saved', instance_id: instanceId }] })
  }
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
  const support = page.locator('#support-small:not(.collapsed) .panel-toggle-btn-small')
  if (await support.isVisible()) await support.click()
  return model
}
async function editor(page) {
  await route(page, '__CUSTOM_SKILL_SECTION__')
  await expect(page.locator('.agent-skills-configurator')).toBeVisible()
  await page.locator('.phase-header').filter({ hasText: 'During the call' }).click()
}

test('confirmed Save refreshes same-page skills and preserves unsaved ordinary edits', async ({ page }) => {
  const model = await setup(page)
  await route(page, '__GENERAL__')
  await page.locator('#WELCOME_MESSAGE').fill('My unsaved ordinary edit')
  await route(page)
  await expect(page.locator('.message-input')).toBeEnabled()
  await page.locator('.save-button').click()
  await expect.poll(() => model.configurationReads).toBe(1)
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  await editor(page)
  await expect(card(page)).toBeVisible()
  await expect(card(page).locator('.entry-switch input')).toBeChecked()
  await route(page, '__GENERAL__')
  await expect(page.locator('#WELCOME_MESSAGE')).toHaveValue('My unsaved ordinary edit')
  expect(model.saves).toHaveLength(1)
  expect(model.mutations).toEqual([])
})

test('partial Save refreshes only phases with confirmed outcomes and keeps refused pending', async ({ page }) => {
  const model = await setup(page)
  const refused = operation('refused-final', { skill: 'calendar_skill', phase: 'final' })
  model.pending.push(refused)
  model.save = async (request, state) => {
    state.configuration.during = [entry()]; state.configuration.final = [entry('unrelated-remote')]
    state.pending = [refused]
    return json(request, { success: false, applied: 1, errors: ['refused'], remaining_pending: state.pending,
      skill_outcomes: [{ operation_id: 'oauth-op', status: 'saved', instance_id: instanceId }, { operation_id: 'refused-final', status: 'refused' }] })
  }
  await page.reload(); await expect(page.locator('.message-input')).toBeEnabled()
  await page.locator('.save-button').click()
  await expect(page.locator('[data-operation-id="refused-final"]')).toBeVisible()
  await expect.poll(() => model.configurationReads).toBe(1)
  await editor(page); await expect(card(page)).toBeVisible()
  await page.locator('.phase-header').last().click()
  await expect(page.locator('[data-skill-instance="unrelated-remote"]')).toHaveCount(0)
  expect(model.saves).toHaveLength(1)
})

for (const status of ['refused', 'unconfirmed']) test(`${status} Save does not refresh or invent saved skill state`, async ({ page }) => {
  const model = await setup(page)
  model.save = (request, state) => json(request, { success: false, applied: 0, errors: [status], remaining_pending: state.pending,
    skill_outcomes: [{ operation_id: 'oauth-op', status }] })
  const beforeSaveReads = model.configurationReads
  await page.locator('.save-button').click()
  await expect(page.locator(`[data-outcome="${status}"]`)).toBeVisible()
  const afterSaveReads = model.configurationReads
  expect(afterSaveReads).toBe(beforeSaveReads)
  await editor(page)
  await expect(card(page)).toHaveCount(0)
  expect(model.pending).toHaveLength(1)
  await expect.poll(() => model.configurationReads).toBe(beforeSaveReads + 1)
  console.log(JSON.stringify({ outcome: status, beforeSaveReads, afterSaveReads, afterEditorReads: model.configurationReads }))
})

test('malformed refresh leaves saved outcome truthful and cached configuration intact', async ({ page }) => {
  const model = await setup(page)
  await page.route('**/apidomain/agent/skills/configuration/**', request => json(request, { during: 'invalid' }))
  await page.locator('.save-button').click()
  await expect(page.locator('[data-outcome="saved"]')).toBeVisible()
  await expect(page.getByText('Skill saved, but its configuration could not be refreshed here.', { exact: false })).toBeVisible()
  await editor(page); await expect(card(page)).toHaveCount(0)
  expect(model.saves).toHaveLength(1)
})

test('dirty manual skill edits survive refresh with an explicit warning', async ({ page }) => {
  const model = await setup(page, { initial: [entry('manual-existing', 'false')] })
  await editor(page); await card(page, 'manual-existing').locator('.entry-switch').click()
  await expect(card(page, 'manual-existing').locator('.entry-switch input')).toBeChecked()
  await route(page); await expect(page.locator('.message-input')).toBeEnabled()
  await page.locator('.save-button').click()
  await expect(page.getByText('Your unsaved skill edits were kept', { exact: false })).toBeVisible()
  await editor(page)
  await expect(card(page, 'manual-existing').locator('.entry-switch input')).toBeChecked()
  await expect(card(page)).toHaveCount(0)
  expect(model.configuration.during[0].params.enabled).toBe('false')
  expect(model.saves).toHaveLength(1)
})

test('route change invalidates a delayed refresh even after returning to the original assistant', async ({ page }) => {
  const model = await setup(page)
  let release; const held = new Promise(resolve => { release = resolve }); let started = false
  await page.route('**/apidomain/agent/skills/configuration/**', async request => { started = true; await held; return json(request, model.configuration) })
  await page.locator('.save-button').click(); await expect.poll(() => started).toBe(true)
  await route(page, '__CUSTOM_SKILL_SECTION__', 'another-business')
  await route(page, '__CUSTOM_SKILL_SECTION__')
  release()
  await page.waitForResponse(response => response.url().includes('/agent/skills/configuration/'))
  await expect(page.locator('.agent-skills-configurator')).toBeVisible()
  await page.locator('.phase-header').filter({ hasText: 'During the call' }).click()
  await expect(card(page)).toHaveCount(0)
  expect(model.saves).toHaveLength(1)
})

for (const action of ['replace', 'remove']) test(`confirmed ${action} refreshes the affected saved phase`, async ({ page }) => {
  const model = await setup(page, { initial: [entry(instanceId, 'false')] })
  model.pending = [operation('oauth-op', { skill: 'calendar_skill', action, instance_id: instanceId,
    params: action === 'remove' ? {} : { enabled: 'true' }, preview: { before: { enabled: 'false' }, after: action === 'remove' ? null : { enabled: 'true' } } })]
  model.save = (request, state) => {
    state.pending = []; state.configuration.during = action === 'remove' ? [] : [entry()]
    return json(request, { success: true, applied: 1, errors: [], remaining_pending: [], skill_outcomes: [{ operation_id: 'oauth-op', status: 'saved', ...(action === 'remove' ? {} : { instance_id: instanceId }) }] })
  }
  await page.reload(); await expect(page.locator('.message-input')).toBeEnabled()
  await page.locator('.save-button').click(); await expect.poll(() => model.configurationReads).toBe(1)
  await editor(page)
  if (action === 'remove') await expect(card(page)).toHaveCount(0)
  else await expect(card(page).locator('.entry-switch input')).toBeChecked()
  expect(model.saves).toHaveLength(1)
})

test('overlapping saved phases are coalesced and a late old response cannot drop either phase', async ({ page }) => {
  const model = await setup(page)
  const later = operation('second-save', { skill: 'calendar_skill', phase: 'final' })
  model.save = (request, state, body) => {
    const first = body.skill_operation_ids.includes('oauth-op')
    if (first) { state.configuration.during = [entry()]; state.pending = [later] }
    else { state.configuration.final = [entry('final-saved')]; state.pending = [] }
    return json(request, { success: true, applied: 1, errors: [], remaining_pending: state.pending,
      skill_outcomes: [{ operation_id: first ? 'oauth-op' : 'second-save', status: 'saved', instance_id: first ? instanceId : 'final-saved' }] })
  }
  let release; const held = new Promise(resolve => { release = resolve }); let reads = 0
  await page.route('**/apidomain/agent/skills/configuration/**', async request => {
    const snapshot = JSON.parse(JSON.stringify(model.configuration)); reads++
    if (reads === 1) await held
    return json(request, snapshot)
  })
  await page.locator('.save-button').click(); await expect.poll(() => reads).toBe(1)
  await expect(page.locator('[data-operation-id="second-save"]')).toBeVisible()
  await page.locator('.save-button').click(); await expect.poll(() => reads).toBe(2)
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  await editor(page); await expect(card(page)).toBeVisible()
  await page.locator('.phase-header').last().click()
  await expect(page.locator('[data-skill-instance="final-saved"]')).toBeVisible()
  const oldResponse = page.waitForResponse(response => response.url().includes('/agent/skills/configuration/'))
  release(); await oldResponse
  await page.locator('.phase-header').filter({ hasText: 'During the call' }).click()
  await expect(card(page)).toBeVisible()
  expect(model.saves).toHaveLength(2)
})

test('a failed latest read retains earlier saved phases for the next confirmed refresh', async ({ page }) => {
  const model = await setup(page)
  const later = operation('second-save', { skill: 'calendar_skill', phase: 'final' })
  const third = operation('third-save', { skill: 'calendar_skill', phase: 'prefetch' })
  model.save = (request, state, body) => {
    const op = body.skill_operation_ids[0]
    if (op === 'oauth-op') { state.configuration.during = [entry()]; state.pending = [later] }
    else if (op === 'second-save') { state.configuration.final = [entry('final-saved')]; state.pending = [third] }
    else { state.configuration.prefetch = [entry('prefetch-saved')]; state.pending = [] }
    return json(request, { success: true, applied: 1, errors: [], remaining_pending: state.pending,
      skill_outcomes: [{ operation_id: op, status: 'saved', instance_id: op }] })
  }
  let release; const held = new Promise(resolve => { release = resolve }); let reads = 0
  await page.route('**/apidomain/agent/skills/configuration/**', async request => {
    reads++
    if (reads === 1) { const snapshot = JSON.parse(JSON.stringify(model.configuration)); await held; return json(request, snapshot) }
    if (reads === 2) return request.fulfill({ status: 503, body: '{}' })
    return json(request, model.configuration)
  })
  await page.locator('.save-button').click(); await expect.poll(() => reads).toBe(1)
  await page.locator('.save-button').click()
  await expect(page.getByText('Skill saved, but its configuration could not be refreshed here.', { exact: false })).toBeVisible()
  await page.locator('.save-button').click(); await expect.poll(() => reads).toBe(3)
  await editor(page); await expect(card(page)).toBeVisible()
  await expect(page.getByText('Skill saved, but its configuration could not be refreshed here.', { exact: false })).toHaveCount(0)
  await page.locator('.phase-header').last().click(); await expect(page.locator('[data-skill-instance="final-saved"]')).toBeVisible()
  await page.locator('.phase-header').first().click(); await expect(page.locator('[data-skill-instance="prefetch-saved"]')).toBeVisible()
  const oldResponse = page.waitForResponse(response => response.url().includes('/agent/skills/configuration/'))
  release(); await oldResponse
  expect(model.saves).toHaveLength(3)
})
