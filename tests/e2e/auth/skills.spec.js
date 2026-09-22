// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The skills screen, end to end: the card opens, a setting is changed, Save is pressed, and the
 * configuration leaves through the API that owns it.
 *
 * WHY THIS ONE PATH. The unit tests know what a card emits and what the persistence helper sends;
 * neither knows that the page joins them. It did not: the skill configuration travelled in the
 * business PUT, which drops every `apidomain_*` variable, so the screen reported a save that wrote
 * nothing. That is the failure this spec would have caught, and the only way to catch it is to
 * press the button the person presses.
 */

const SECTION = '__SKILLS__'

/** The three variables, as the server declares them: one type, owned by one API. */
function skillVariableSpec (name) {
  return {
    name,
    humanName: 'Agent skills',
    description: 'What the assistant can do during a call',
    class: 'variable',
    templateName: 'generic_onboarding',
    type: 'apidomain_agent_skills',
    defaultValue: '[]',
    visible: true,
    mandatory: false,
    modifiable: true,
    advanced: false,
    position: '1',
    // Sent by the server for every variable, and read without a guard: `dependsOn.length` is the
    // first thing the decorator asks, so a fixture without it renders nothing and says why nowhere.
    dependsOn: [],
    valuesSelection: []
  }
}

const annotations = [{
  collection: { id: SECTION, humanName: 'Skills', description: '' },
  variables: [[
    skillVariableSpec('SKILL_PREFETCH_CONFIGURATION'),
    skillVariableSpec('SKILL_RUNNINGLOOP_CONFIGURATION'),
    skillVariableSpec('SKILL_FINAL_CONFIGURATION')
  ]]
}]

const catalogue = [{
  name: 'calendar_availability',
  description: 'Offers the free slots of the business',
  descriptionI18n: { en: 'Offers the free slots of the business' },
  manifest: { title: { en: 'Availability' } },
  configSchema: {
    phases: ['during'],
    outputPrefix: 'calendar_availability',
    instances: { max: null, maxPerPhase: null },
    fields: [
      { key: 'enabled', type: 'boolean', default: 'false' },
      { key: 'label', type: 'string', labels: { en: { label: 'Name of this instance' } } },
      { key: 'durationMinutes', type: 'number', widget: 'number', default: 30,
        labels: { en: { label: 'Appointment length' } } }
    ]
  }
}]

const configured = [{
  skill: 'calendar_availability',
  instanceId: 'calendar_availability_1',
  params: { enabled: 'true', label: 'Sala 1', durationMinutes: '30' }
}]

const business = {
  ...mockBusiness,
  variables: { SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify(configured) }
}

/** Every call this screen makes, and a record of the two writes so a test can read them. */
async function mockSkillsScreen (page, { saveStatus = 200, saveBody = null } = {}) {
  const writes = { business: [], skills: [] }

  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations)
  }))

  await page.route('**/crm/business*', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([business]), headers: { 'x-mrcall-role': 'owner' }
      })
    }
    writes.business.push(route.request().postDataJSON())
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ result: { businessId: business.businessId } })
    })
  })

  // `*` does not cross a slash, so this is the catalogue and never the configuration below it.
  await page.route('**/apidomain/agent/skills*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(catalogue)
  }))

  await page.route('**/apidomain/agent/skills/configuration/**', route => {
    writes.skills.push(route.request().postDataJSON())
    return route.fulfill({
      status: saveStatus, contentType: 'application/json',
      body: JSON.stringify(saveBody || { saved: true, diagnostics: [] })
    })
  })

  return writes
}

async function openSkills (page) {
  await page.goto(`/businessconfiguration?id=${business.businessId}&section=${SECTION}`)
  await expect(page.locator('.agent-skills-configurator')).toBeVisible({ timeout: 20000 })
  // The first phase is the one that opens, and the instance is configured in the second: one
  // phase open at a time is the widget's own rule, so reaching a card means opening its phase.
  await page.locator('.phase-has-entries .phase-header').click()
}

test.describe('the skills screen', () => {

  test('draws the configured instance, shut, and says whether it runs', async ({ authenticatedPage: page }) => {
    await mockSkillsScreen(page)
    await openSkills(page)

    const card = page.locator('.entry-card')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('Sala 1')
    await expect(card.locator('.entry-state-badge')).toBeVisible()
    // Shut: the setting is not on the screen until the card is opened.
    await expect(page.getByText('Appointment length')).toHaveCount(0)
  })

  test('sends what was changed to the API that owns those variables, not in the business write',
    async ({ authenticatedPage: page }) => {
      const writes = await mockSkillsScreen(page)
      await openSkills(page)

      await page.locator('.entry-header-toggle').click()
      const duration = page.locator('.entry-fields input').first()
      await expect(duration).toBeVisible()
      // Typed rather than filled: the number widget formats as it goes and reads the keystrokes,
      // so a value written straight into the DOM never reaches the model.
      await duration.click()
      await duration.press('ControlOrMeta+a')
      await duration.pressSequentially('45')
      await duration.press('Tab')

      await page.locator('button:has(.pi-save)').first().click()
      await expect.poll(() => writes.skills.length, { timeout: 15000 }).toBe(1)

      const sent = writes.skills[0]
      expect(Object.keys(sent)).toContain('SKILL_RUNNINGLOOP_CONFIGURATION')
      expect(JSON.parse(sent.SKILL_RUNNINGLOOP_CONFIGURATION)[0].params.durationMinutes).toBe('45')
      // The business write happened, and it is a different call to a different path: what it
      // carries of the skills is dropped by the server, which is why the one above exists.
      expect(writes.business.length).toBe(1)
    })

  /* A refused configuration is not a failed call, and the two read differently to the person: this
   * one has something to correct. */
  test('reports a refusal with what is wrong, rather than a save that seemed to work',
    async ({ authenticatedPage: page }) => {
      await mockSkillsScreen(page, {
        saveStatus: 422,
        saveBody: {
          saved: false,
          diagnostics: [{ severity: 'error', path: '/during/0/hours', code: 'overlap', detail: 'two slots cover 23:55' }]
        }
      })
      await openSkills(page)

      await page.locator('.entry-header-toggle').click()
      await page.locator('button:has(.pi-save)').first().click()

      await expect(page.getByText('two slots cover 23:55')).toBeVisible({ timeout: 15000 })
    })
})
