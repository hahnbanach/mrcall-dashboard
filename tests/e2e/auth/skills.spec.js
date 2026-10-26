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
        labels: { en: { label: 'Appointment length' } } },
      // `x-audience: platform` in the manifest: a technical field an admin sees and an owner does not
      { key: 'holdSeconds', type: 'number', widget: 'number', default: 120, audience: 'platform',
        labels: { en: { label: 'Hold seconds' } } }
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
async function mockSkillsScreen (page, {
  saveStatus = 200, saveBody = null, role = 'owner', skills = catalogue, during = configured
} = {}) {
  const writes = { business: [], skills: [] }
  const shown = { ...business, variables: { SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify(during) } }

  await page.route('**/crm/variables*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(annotations)
  }))

  await page.route('**/crm/business*', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([shown]),
        headers: { 'x-mrcall-role': role, 'access-control-expose-headers': 'x-mrcall-role' }
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
    status: 200, contentType: 'application/json', body: JSON.stringify(skills)
  }))

  await page.route('**/apidomain/agent/skills/configuration/**', route => {
    // The screen also reads the saved configuration from this path (the chat's OAuth status and
    // hand-off check it against what is saved). A read is not a write: recording it as one made the
    // first "write" a GET with no body. Seen on 2026-10-11 at bf2d2d0: writes were GET, then the PUT.
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ prefetch: [], during, final: [] })
      })
    }
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

  /* Seen failing on 2026-10-06 twice: before the card read `audience` (the owner was shown 'Hold
   * seconds'), and with the filter hiding the field from everybody (the admin was not). */
  test('hides a field the manifest keeps for the platform from an owner', async ({ authenticatedPage: page }) => {
    await mockSkillsScreen(page)
    await openSkills(page)
    await page.locator('.entry-header-toggle').click()
    await expect(page.getByText('Appointment length')).toBeVisible()
    await expect(page.getByText('Hold seconds')).toHaveCount(0)
  })

  test('shows the platform field to an admin', async ({ authenticatedPage: page }) => {
    await mockSkillsScreen(page, { role: 'admin' })
    await openSkills(page)
    await page.locator('.entry-header-toggle').click()
    await expect(page.getByText('Hold seconds')).toBeVisible()
  })
})

/* A skill only an admin may add (StarChat 9.34.115, brief `2026-10-26-skill-visibility-admin` in
 * StarChat). Every catalogue row carries `addable`; a non-admin receives an admin-only row only when
 * the business already runs an instance of it, marked `addable: false`, so that instance can still be
 * drawn and configured. The screen must not offer another one, by adding or by duplicating.
 *
 * Seen failing on 2026-10-26 before the fix, all four. The card's icon buttons had no accessible
 * name (the title is not one), so the admin and old-server cases could not find "Duplicate"; the
 * owner case failed too, at a line the log did not keep. An assertion that the duplicate button is
 * absent would have passed whatever the rule did. With the names in place, the owner case was seen failing on each of
 * its two assertions alone: with `isAddable` forced true the duplicate button counted 1, not 0, and
 * with only the add-list guard removed `calendar_booking` was offered. The Italian refusal case did
 * not find its message, which no locale carried. */
const bookingRow = addable => ({
  name: 'calendar_booking',
  description: 'Books an appointment',
  descriptionI18n: { en: 'Books an appointment' },
  manifest: { title: { en: 'Booking' } },
  ...(addable === undefined ? {} : { addable }),
  configSchema: {
    phases: ['during'],
    outputPrefix: 'calendar_booking',
    instances: { max: null, maxPerPhase: null },
    fields: [
      { key: 'enabled', type: 'boolean', default: 'false' },
      { key: 'label', type: 'string', labels: { en: { label: 'Name of this instance' } } },
      { key: 'calendarNote', type: 'string', labels: { en: { label: 'Calendar note' } } }
    ]
  }
})

const runningBooking = [{
  skill: 'calendar_booking',
  instanceId: 'calendar_booking_1',
  params: { enabled: 'true', label: 'Agenda', calendarNote: 'front desk' }
}]

async function addOptions (page) {
  await page.locator('.add-skill-dropdown').click()
  const options = page.getByRole('option')
  await expect(options.first()).toBeVisible()
  return options.allTextContents()
}

test.describe('a skill only an admin may add', () => {

  test('an owner sees the instance the business runs, configurable, and is offered no other',
    async ({ authenticatedPage: page }) => {
      await mockSkillsScreen(page, { skills: [catalogue[0], bookingRow(false)], during: runningBooking })
      await openSkills(page)

      const card = page.locator('.entry-card', { hasText: 'Agenda' })
      await expect(card).toHaveCount(1)
      await expect(card.getByRole('button', { name: 'Duplicate, switched off' })).toHaveCount(0)
      await expect(card.getByRole('button', { name: 'Remove' })).toBeVisible()

      await card.locator('.entry-header-toggle').click()
      await expect(page.getByText('Calendar note')).toBeVisible()

      const offered = await addOptions(page)
      expect(offered.some(label => label.includes('calendar_availability'))).toBe(true)
      expect(offered.some(label => label.includes('calendar_booking'))).toBe(false)
    })

  test('an admin is offered it, and may duplicate it', async ({ authenticatedPage: page }) => {
    await mockSkillsScreen(page, { role: 'admin', skills: [catalogue[0], bookingRow(true)], during: runningBooking })
    await openSkills(page)

    const card = page.locator('.entry-card', { hasText: 'Agenda' })
    await expect(card.getByRole('button', { name: 'Duplicate, switched off' })).toBeVisible()
    const offered = await addOptions(page)
    expect(offered.some(label => label.includes('calendar_booking'))).toBe(true)
  })

  test('a row from a server that does not send the field stays addable', async ({ authenticatedPage: page }) => {
    await mockSkillsScreen(page, { skills: [catalogue[0], bookingRow(undefined)], during: runningBooking })
    await openSkills(page)

    const card = page.locator('.entry-card', { hasText: 'Agenda' })
    await expect(card.getByRole('button', { name: 'Duplicate, switched off' })).toBeVisible()
    const offered = await addOptions(page)
    expect(offered.some(label => label.includes('calendar_booking'))).toBe(true)
  })

  test.describe('in Italian', () => {
    test.use({ locale: 'it-IT' })

    /* A page opened before the server learnt the rule can still send a new instance; the server
     * refuses it, and the person reads why in their language rather than the server's English. */
    test('the admin_only_skill refusal is said in its own words', async ({ authenticatedPage: page }) => {
      const detail = 'skill_calendar_booking can be added only by an admin: this business has 1 instance(s) of it and this would make 2'
      await mockSkillsScreen(page, {
        skills: [catalogue[0], bookingRow(false)],
        during: runningBooking,
        saveStatus: 422,
        saveBody: { saved: false, diagnostics: [{ severity: 'error', path: '#', code: 'admin_only_skill', detail }] }
      })
      await openSkills(page)
      await page.locator('button:has(.pi-save)').first().click()

      await expect(page.getByText('Solo un amministratore può aggiungere questa skill', { exact: false }))
        .toBeVisible({ timeout: 15000 })
      await expect(page.getByText(detail, { exact: false })).toHaveCount(0)
    })
  })
})
