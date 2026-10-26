const { test, expect } = require('@playwright/test')
const { setupSkillPage, businessId, sessionId, operation, json } = require('../fixtures/skill-chat')
test.use({ serviceWorkers: 'block' })
const hours = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => [day, ['10:00-12:00']]))
const proposed = (extra = {}) => operation('appointment-op', { skill: 'arbitrary_schedule_integration', preview: {
  skill_label: { en: 'Appointments', it: 'Appuntamenti' }, before: null,
  after: { mode: 'ranges', hours: JSON.stringify(hours), label: 'Appuntamenti Café 124', enabled: 'false',
    calendar: 'mario.alemi@example.test', duration: '15', notice: 2, confirm: true, title: 'MRCALL', unknown: { x: 1 } },
  field_labels: { mode: 'How periods are read', hours: { en: 'Weekly hours', it: 'Orari settimanali' }, label: 'Card name',
    enabled: 'Active', calendar: 'Which calendar', duration: 'Appointment length (minutes)', notice: 'Minimum notice (hours)',
    confirm: { en: 'Ask the caller to confirm', it: 'Chiedi conferma' }, title: 'Title in the calendar', unknown: 'Other settings' },
}, ...extra })
const open = async page => {
  await page.goto(`/businessconfiguration?id=${businessId}`)
  await expect(page.locator('.message-input')).toBeEnabled()
}

test('booking-shaped create is readable, exact details closed, and Save still sends only operation ID', async ({ page }, testInfo) => {
  const model = await setupSkillPage(page, { pending: [proposed()] })
  await open(page)
  const summary = page.getByTestId('skill-summary')
  await expect(summary).toContainText('After saving: inactive')
  await expect(summary).toContainText('Monday: 10:00–12:00')
  await expect(summary).toContainText('Friday: 10:00–12:00')
  await expect(summary).toContainText('15')
  await expect(summary).toContainText('mario.alemi@example.test')
  await expect(summary).toContainText('Yes')
  await expect(summary).not.toContainText('Before')
  await expect(summary).not.toContainText('ranges')
  await expect(summary).not.toContainText('{')
  const details = page.getByTestId('skill-technical-details')
  await expect(details).not.toHaveAttribute('open')
  await expect(details.getByText('ranges', { exact: true })).not.toBeVisible()
  await expect(details.getByText('New instance draft', { exact: true })).not.toBeVisible()
  await summary.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('readable-summary.png') })
  await details.locator('summary').click()
  await expect(details.getByText('ranges', { exact: true })).toBeVisible()
  await expect(details).toContainText('"x": 1')
  await page.locator('.save-button').click()
  expect(model.saves).toEqual([{ business_id: businessId, session_id: sessionId, changes: [], skill_operation_ids: ['appointment-op'] }])
  await expect(page.getByTestId('pending-preview')).toHaveCount(0)
})

test('summary follows Italian locale while preserving safe labels and weekday meaning', async ({ page }) => {
  await setupSkillPage(page, { pending: [proposed()] })
  await page.addInitScript(() => localStorage.setItem('mrcall-user-locale', 'it-IT'))
  await open(page)
  const summary = page.getByTestId('skill-summary')
  await expect(summary).toContainText('Dopo il salvataggio: non attiva')
  await expect(summary).toContainText('Orari settimanali')
  await expect(summary).toContainText('Lunedì: 10:00–12:00')
  await expect(summary).toContainText('Sì')
  await expect(page.getByTestId('skill-technical-details').locator('summary')).toHaveText('Dettagli tecnici')
})

test('edit preserves before/after and unknown activation; removal does not claim activation', async ({ page }) => {
  const model = await setupSkillPage(page, { pending: [proposed({ action: 'replace', instance_id: 'saved-private-id', preview: {
    skill_label: 'Appointments', before: { label: 'Original label' }, after: { label: '<img src=x onerror=alert(1)> edited' }, field_labels: { label: 'Name' },
  } })] })
  await open(page)
  const summary = page.getByTestId('skill-summary')
  await expect(summary).toContainText('Activation is not specified')
  await expect(summary).toContainText('Original label')
  await expect(summary).toContainText('<img src=x onerror=alert(1)> edited')
  await expect(summary.locator('img')).toHaveCount(0)
  await expect(page.getByTestId('pending-preview').getByText('saved-private-id', { exact: true })).not.toBeVisible()
  model.pending = [proposed({ action: 'remove', preview: { skill_label: 'Appointments', before: { enabled: true, label: 'Previous configuration' }, after: null, field_labels: { label: 'Name' } } })]
  await page.reload()
  await expect(summary).toContainText('will be removed after saving')
  await expect(summary).toContainText('Previous configuration')
  await expect(summary).not.toContainText('After saving: active')
})

test('resource access refusal names the skill, keeps pending and hides raw operation/code by default', async ({ page }) => {
  const model = await setupSkillPage(page, { pending: [proposed()], save: async (route, model) =>
    json(route, { success: false, applied: 0, errors: [], remaining_pending: model.pending,
      skill_outcomes: [{ operation_id: 'appointment-op', status: 'refused', code: 'resource_access_refused' }] }) })
  await open(page)
  await page.locator('.save-button').click()
  const outcome = page.locator('[data-outcome="refused"]')
  await expect(outcome).toContainText('Appointments')
  await expect(outcome).toContainText('Check the connection and permissions')
  await expect(outcome.getByText('appointment-op', { exact: false })).not.toBeVisible()
  await expect(outcome).not.toContainText('Google')
  await expect(page.locator('[data-operation-id="appointment-op"]')).toBeVisible()
  await outcome.locator('summary').click()
  await expect(outcome.getByText('appointment-op', { exact: false })).toBeVisible()
  await expect(outcome).toContainText('resource_access_refused')
  expect(model.saves).toHaveLength(1)
})
