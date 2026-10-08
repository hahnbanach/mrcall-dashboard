const { test, expect } = require('@playwright/test')
const { setupSkillPage, businessId, sessionId, ordinary, operation, json } = require('../fixtures/skill-chat')
test.use({ serviceWorkers: 'block' })
const open = async page => {
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
}
const send = async (page, text) => {
  await page.locator('.message-input').fill(text)
  await page.locator('.send-button').click()
  await expect(page.locator('.message-input')).toBeEnabled()
}

test('mixed preview hydrates, edits same draft, cancels empty snapshot and persists discard', async ({ page }) => {
  const model = await setupSkillPage(page, { pending: [ordinary, operation()], propose: body =>
    body.message.includes('cancel') ? [] : [ordinary, operation('op-1', { preview: { before: null, after: { label: '<img src=x onerror=alert(1)> edited' }, field_labels: { label: { en: 'Display name' } } } })] })
  await open(page)
  await expect(page.getByTestId('pending-preview')).toContainText('Display name')
  await expect(page.getByTestId('pending-preview')).toContainText('WELCOME_MESSAGE')
  await page.reload(); await expect(page.locator('.message-input')).toBeEnabled()
  await expect(page.locator('[data-operation-id="op-1"]')).toBeVisible()
  await send(page, 'edit draft')
  await expect(page.locator('[data-operation-id="op-1"]')).toContainText('<img src=x onerror=alert(1)> edited')
  await expect(page.getByTestId('pending-preview').locator('img')).toHaveCount(0)
  await send(page, 'cancel')
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  model.pending = [ordinary, operation()]
  await page.reload(); await expect(page.locator('.message-input')).toBeEnabled()
  await page.locator('.discard-button').click()
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  expect(model.discards[0]).toEqual({ business_id: businessId, session_id: sessionId,
    changes: [{ variable_name: 'WELCOME_MESSAGE', new_value: 'Welcome' }], skill_operation_ids: ['op-1'] })
  await page.reload(); await expect(page.locator('.message-input')).toBeEnabled()
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
})

test('Save sends IDs and retains exact conflicts and concurrently queued work', async ({ page }) => {
  const model = await setupSkillPage(page, { pending: [ordinary, operation()], save: async (route, model) => {
    model.pending = [operation('op-1', { last_outcome: { status: 'conflict' } }), operation('concurrent-op')]
    await json(route, { success: false, applied: 1, errors: ['revision_mismatch'], skill_outcomes: [{ operation_id: 'op-1', status: 'conflict' }], remaining_pending: model.pending })
  } })
  await open(page); await page.locator('.save-button').click()
  await expect(page.locator('[data-outcome="conflict"]')).toBeVisible()
  expect(model.saves).toEqual([{ business_id: businessId, session_id: sessionId,
    changes: [{ variable_name: 'WELCOME_MESSAGE', new_value: 'Welcome' }], skill_operation_ids: ['op-1'] }])
  await expect(page.locator('[data-operation-id]')).toHaveCount(2)
  await expect(page.getByTestId('pending-preview')).not.toContainText('WELCOME_MESSAGE')
  model.save = async (route, model) => {
    model.pending = [operation('later-op')]
    await json(route, { success: true, applied: 2, errors: [], remaining_pending: model.pending })
  }
  await page.locator('.save-button').click()
  await expect(page.locator('[data-operation-id="later-op"]')).toBeVisible()
  await expect(page.locator('[data-operation-id]')).toHaveCount(1)
})

test('lost Save response reloads unknown create and requires explicit reconciliation without resend', async ({ page }) => {
  const unknown = operation('op-1', { execution_state: 'unconfirmed', candidate_ids: ['server-id'], reconciliation_actions: ['read', 'close_without_retry', 'accept_instance'] })
  const model = await setupSkillPage(page, { pending: [operation()], save: async (route, model) => {
    model.pending = [unknown]; await route.abort('failed')
  }, reconcile: async (route, model, body) => {
    if (body.resolution) model.pending = []
    await json(route, { success: !!body.resolution, outcome: { operation_id: 'op-1', status: body.resolution ? 'saved' : 'unconfirmed' }, remaining_pending: model.pending })
  } })
  await open(page); await page.locator('.save-button').click()
  await expect(page.getByTestId('pending-preview')).toContainText('Outcome unknown')
  await expect(page.locator('.save-button')).toBeDisabled()
  expect(model.saves).toHaveLength(1)
  await page.locator('.discard-button').click()
  await expect(page.locator('[data-operation-id="op-1"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm instance server-id' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Check outcome', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm instance server-id' }).click()
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  expect(model.reconciles).toEqual([
    { business_id: businessId, session_id: sessionId, operation_id: 'op-1' },
    { business_id: businessId, session_id: sessionId, operation_id: 'op-1', resolution: 'accept_instance', instance_id: 'server-id' },
  ])
  expect(model.saves).toHaveLength(1)
})

test('failed tool does not announce a queued change', async ({ page }) => {
  await setupSkillPage(page, { toolResult: { success: false, error: 'invalid_params' } })
  await open(page); await send(page, 'invalid proposal')
  await expect(page.locator('.chat-messages')).toContainText('The proposal was refused. No change was queued.')
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
})

test('wizard auto-applies ordinary values with its session and retains unexpected skill proposals', async ({ page }) => {
  const model = await setupSkillPage(page, { propose: () => [ordinary, operation()] })
  await page.goto(`/wizard?id=${businessId}`)
  await page.locator('.wizard-start-btn').first().click()
  await expect(page.locator('.wizard-done')).toBeVisible()
  expect(model.saves).toEqual([{ business_id: businessId, session_id: `mrcall_wizard_${businessId}`,
    changes: [{ variable_name: 'WELCOME_MESSAGE', new_value: 'Welcome' }] }])
  await expect(page.getByText('navigation does not transfer it.', { exact: false })).toBeVisible()
  expect(model.pending.map(item => item.operation_id)).toEqual(['op-1'])
})

test('active request blocks chat and duplicate actions; failed history recovery blocks retry', async ({ page }) => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const model = await setupSkillPage(page, { pending: [operation()], save: async route => {
    await held
    await route.abort('failed')
  } })
  await open(page)
  await page.locator('.save-button').click()
  await expect(page.locator('.message-input')).toBeDisabled()
  await expect(page.locator('.discard-button')).toBeDisabled()
  await expect(page.locator('.save-button')).toBeDisabled()
  await page.route('**/api/chat/history*', route => route.abort('failed'))
  release()
  await expect(page.locator('.action-message')).toContainText('The response was lost')
  await expect(page.locator('.message-input')).toBeDisabled()
  await expect(page.locator('.save-button')).toBeDisabled()
  expect(model.saves).toHaveLength(1)
  await page.unroute('**/api/chat/history*')
  await page.route('**/api/chat/history*', route => json(route, { success: true, messages: [], pending_changes: [] }))
  await page.getByRole('button', { name: 'Refresh pending changes', exact: true }).click()
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  await expect(page.locator('.message-input')).toBeEnabled()
})

test('failed initial history keeps recovery visible through silent open and restores unknown or empty snapshots', async ({ page }) => {
  const unknown = operation('persisted-unknown', { execution_state: 'unconfirmed', reconciliation_actions: ['read', 'close_without_retry'] })
  const model = await setupSkillPage(page, { pending: [unknown] })
  let failHistory = true
  await page.route('**/api/chat/history*', route => failHistory ? route.abort('failed') :
    json(route, { success: true, session_id: sessionId, messages: [], pending_changes: model.pending }))
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.action-message')).toContainText('Pending changes could not be reloaded')
  await expect.poll(() => model.messages.length).toBe(1)
  const refresh = page.getByRole('button', { name: 'Refresh pending changes', exact: true })
  await expect(refresh).toBeEnabled()
  await expect(page.locator('.message-input')).toBeDisabled()
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  failHistory = false
  await refresh.click()
  await expect(page.locator('[data-operation-id="persisted-unknown"]')).toBeVisible()
  await expect(page.locator('.message-input')).toBeEnabled()
  await expect(page.locator('.save-button')).toBeDisabled()
  expect(model.saves).toHaveLength(0)
  expect(model.discards).toHaveLength(0)
  failHistory = true
  model.pending = []
  await page.reload()
  await expect(page.locator('.action-message')).toContainText('Pending changes could not be reloaded')
  await expect(refresh).toBeEnabled()
  await expect(page.locator('.message-input')).toBeDisabled()
  failHistory = false
  await refresh.click()
  await expect(page.locator('.message-input')).toBeEnabled()
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  await expect(page.locator('.action-message')).toContainText('Pending changes refreshed')
})

test('delayed initial history blocks proposals and actions until the authoritative snapshot arrives', async ({ page }) => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const model = await setupSkillPage(page, { pending: [ordinary, operation('held-unknown', {
    execution_state: 'unconfirmed', reconciliation_actions: ['read', 'close_without_retry'],
  })] })
  await page.route('**/api/chat/history*', async route => {
    await held
    await json(route, { success: true, session_id: sessionId, messages: [], pending_changes: model.pending })
  })
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect.poll(() => model.messages.length).toBe(1)
  await expect(page.locator('.action-message')).toContainText('Loading pending changes')
  await expect(page.locator('.message-input')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refresh pending changes', exact: true })).toBeDisabled()
  await expect(page.locator('.save-button')).toHaveCount(0)
  expect(model.saves).toHaveLength(0)
  release()
  await expect(page.locator('[data-operation-id="held-unknown"]')).toBeVisible()
  await expect(page.getByTestId('pending-preview')).toContainText('WELCOME_MESSAGE')
  await expect(page.locator('.message-input')).toBeEnabled()
  await expect(page.locator('.save-button')).toBeEnabled()
  await expect(page.locator('.save-button')).toContainText('(1)')
})

test('actual nested labels and label-only before/after stay readable alongside Save', async ({ page }, testInfo) => {
  await setupSkillPage(page, { pending: [operation('readable-label', {
    action: 'replace', instance_id: 'saved-ticket', preview: {
      before: { label: 'Original label' }, after: { label: 'Changed label' },
      field_labels: { label: { '*': { label: 'Name', hint: 'Do not display this hint as JSON' },
        en: { label: 'Name', hint: 'Do not display this hint as JSON' }, it: { label: 'Nome', hint: 'Suggerimento' } } },
    },
  })] })
  await open(page)
  const preview = page.getByTestId('pending-preview')
  await expect(preview).toContainText('Name')
  await expect(preview).not.toContainText('Do not display this hint as JSON')
  await preview.scrollIntoViewIfNeeded()
  const bounds = await preview.boundingBox()
  for (const label of ['Original label', 'Changed label']) {
    const field = await preview.getByText(label, { exact: true }).boundingBox()
    expect(field.y).toBeGreaterThanOrEqual(bounds.y)
    expect(field.y + field.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  }
  await page.locator('.save-button').scrollIntoViewIfNeeded()
  const save = await page.locator('.save-button').boundingBox()
  expect(save.y + save.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight))
  await page.screenshot({ path: testInfo.outputPath('readable-preview.png') })
  await page.locator('.save-button').click()
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
})

test('skill tool cancellation does not announce an English queued change', async ({ page }) => {
  await setupSkillPage(page, { pending: [operation()], propose: () => [],
    toolResult: { success: true, response_text: 'Draft cancelled. Skill configuration queued.' } })
  await open(page)
  await send(page, 'cancel draft')
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
  await expect(page.locator('.chat-messages')).not.toContainText('Skill configuration queued')
  await expect(page.locator('.chat-messages')).not.toContainText('Change proposed. Review and Save')
})
