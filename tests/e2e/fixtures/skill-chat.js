const { setupAuthPage, setupApiMocks } = require('./auth')
const { mockUser, mockBusiness } = require('./mock-data')

const businessId = mockBusiness.businessId
const sessionId = `mrcall_config_${mockUser.uid}_${businessId}`
const ordinary = { variable_name: 'WELCOME_MESSAGE', old_value: 'Hello', new_value: 'Welcome' }
const operation = (id = 'op-1', extra = {}) => ({
  kind: 'skill_instance', operation_id: id, business_id: businessId, phase: 'during',
  action: 'create', skill: 'example_skill', instance_id: null, draft_id: 'draft_1',
  base_revision: 'a'.repeat(64), params: { label: 'Draft label', enabled: 'false' },
  execution_state: 'pending', preview: { before: null, after: { label: 'Draft label', enabled: 'false' },
    field_labels: { label: { '*': { label: 'Display name', hint: 'Private hint must not render as a label' }, en: { label: 'Display name', hint: 'Helpful description' }, it: { label: 'Nome visualizzato', hint: 'Descrizione' } } }, skill_label: 'Example skill' }, ...extra,
})
const collections = [{ collection: { id: '__GENERAL__', humanName: 'General' }, variables: [[{
  name: 'WELCOME_MESSAGE', humanName: 'Welcome message', class: 'variable', type: 'string',
  visible: true, mandatory: false, modifiable: true, advanced: false, defaultValue: '',
}]] }]
const json = (route, value) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })
const sse = (route, events) => route.fulfill({ status: 200, contentType: 'text/event-stream',
  body: events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join('') })

async function setupSkillPage(page, state = {}, user = mockUser) {
  const blocked = []
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://localhost:8080') return route.continue()
    blocked.push(url.origin)
    return route.abort()
  })
  await setupAuthPage(page, user, 'owner')
  await page.addInitScript(() => localStorage.setItem('mrcall-user-locale', 'en-US'))
  await setupApiMocks(page, { businessDetail: { ...mockBusiness, variables: { ...mockBusiness.variables, GOOGLE_PLACE_ID: 'mock-place' } }, templateVariables: collections })
  const model = { pending: [], saves: [], discards: [], reconciles: [], messages: [], ...state, blocked }
  await page.route('**/api/**', route => json(route, {}))
  await page.route('**/api/chat/history*', route => json(route, { success: true, session_id: sessionId, messages: [], pending_changes: model.pending }))
  await page.route('**/api/chat/message/stream', async route => {
    const body = route.request().postDataJSON()
    model.messages.push(body)
    if (body.message.startsWith('/mrcall open')) return sse(route, [{ type: 'done', session_id: body.session_id }])
    if (model.propose) model.pending = model.propose(body, model)
    return sse(route, [{ type: 'metadata', pending_changes: model.pending },
      ...(model.toolResult ? [{ type: 'tool_result', tool_used: 'configure_skill_instance', result: model.toolResult }] : [{ type: 'text_delta', text: 'Review the proposed changes.' }]),
      { type: 'done', session_id: body.session_id }])
  })
  await page.route('**/api/mrcall/apply-changes', async route => {
    const body = route.request().postDataJSON(); model.saves.push(body)
    if (model.save) return model.save(route, model, body)
    model.pending = model.pending.filter(item => item.kind === 'skill_instance'
      ? !body.skill_operation_ids?.includes(item.operation_id)
      : !body.changes.some(change => change.variable_name === item.variable_name && change.new_value === item.new_value))
    return json(route, { success: true, applied: body.changes.length + (body.skill_operation_ids?.length || 0), errors: [], remaining_pending: model.pending })
  })
  await page.route('**/api/mrcall/pending/discard', route => {
    model.discards.push(route.request().postDataJSON())
    model.pending = model.pending.filter(item => item.kind === 'skill_instance' && item.execution_state !== 'pending')
    return json(route, { success: true, remaining_pending: model.pending })
  })
  await page.route('**/api/mrcall/pending/reconcile', route => {
    const body = route.request().postDataJSON(); model.reconciles.push(body)
    if (model.reconcile) return model.reconcile(route, model, body)
    return json(route, { success: false, outcome: { operation_id: body.operation_id, status: 'unconfirmed' }, remaining_pending: model.pending })
  })
  return model
}
module.exports = { setupSkillPage, businessId, sessionId, ordinary, operation, collections, json, sse }
