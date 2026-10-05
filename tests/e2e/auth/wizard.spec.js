// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * The wizard since 2026-08-29: one question, the agent researches the business and configures the
 * assistant, then the call. The agent is reached over the Zylch stream (/api/chat/message/stream,
 * server-sent events): first "/mrcall open <id>", then "/agent mrcall run ...", whose reply carries
 * the pending changes as metadata and a <research-summary> block; the changes are applied through
 * /api/mrcall/apply-changes. A business with no Google listing has nothing to research and is
 * offered the call straight away.
 */

const linked = { ...mockBusiness, variables: { ...mockBusiness.variables, SYNC_GOOGLE_BUSINESS: 'true' } }

/** The agent as the wizard talks to it, answering each of its two messages; returns what it was sent. */
async function mockAgent (page, { business = linked } = {}) {
  const sent = { messages: [], applied: [] }
  await page.route('**/crm/business*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([business]) })
  })
  await page.route('**/api/chat/message/stream', (route) => {
    const message = route.request().postDataJSON().message || ''
    sent.messages.push(message)
    const events = message.startsWith('/agent') ? [
      { type: 'progress', phase: 'research', text: 'Researching the business...' },
      { type: 'metadata', pending_changes: [{ variable_name: 'CONVERSATION_PROMPT', new_value: 'Buongiorno, come posso aiutarla?' }] },
      { type: 'text_delta', text: 'Configured. <research-summary>120 Google reviews, 4.6 on average.</research-summary>' },
      { type: 'done', session_id: 'mrcall_wizard_test123' }
    ] : [{ type: 'done', session_id: 'mrcall_wizard_test123' }]
    return route.fulfill({ status: 200, contentType: 'text/event-stream',
      body: events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') })
  })
  await page.route('**/api/mrcall/apply-changes', (route) => {
    sent.applied.push(route.request().postDataJSON())
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
  return sent
}

test.describe('Configuration Wizard (Authenticated)', () => {
  test('should load wizard page and show loading state', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)

    // Mock the Zylch streaming endpoint (agent open)
    await authenticatedPage.route('**/api/chat/message/stream', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"text_delta","text":"Quando qualcuno chiama, il tuo assistente "}\n\ndata: {"type":"text_delta","text":"risponde con un saluto cordiale."}\n\ndata: {"type":"done","session_id":"mrcall_wizard_test123"}\n\n',
      })
    })

    // Mock Zylch chat history
    await authenticatedPage.route('**/api/chat/history*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messages: [], session_id: null }),
      })
    })

    await basePage.goto('/wizard?id=test123')

    // Should show the wizard container
    const wizardContainer = authenticatedPage.locator('.wizard-container').first()
    await expect(wizardContainer).toBeVisible({ timeout: 10000 })

    // Take screenshot of initial state
    await authenticatedPage.waitForTimeout(2000)
    await authenticatedPage.screenshot({
      fullPage: true,
      path: 'tests/screenshots/baseline/wizard-step1-welcome.png',
    })
  })

  test('asks one question, configures through the agent, applies its changes, and offers the call', async ({ authenticatedPage: page }) => {
    const sent = await mockAgent(page)
    await new BasePage(page).goto('/wizard?id=test123')

    await expect(page.locator('.wizard-title')).toHaveText('Automatic Configuration', { timeout: 20000 })
    await page.getByRole('button', { name: 'Start' }).click()

    await expect(page.locator('.done-title')).toHaveText('Done.', { timeout: 20000 })
    await expect(page.locator('.research-summary')).toContainText('120 Google reviews, 4.6 on average.')
    await expect(page.locator('.call-headline')).toBeVisible()
    await expect(page.locator('.wizard-done').getByRole('button', { name: 'Call' })).toBeVisible()

    expect(sent.messages[0]).toBe('/mrcall open test123')
    expect(sent.messages[1]).toMatch(/^\/agent mrcall run /)
    expect(sent.applied).toEqual([{ business_id: 'test123',
      changes: [{ variable_name: 'CONVERSATION_PROMPT', new_value: 'Buongiorno, come posso aiutarla?' }] }])
  })

  test('offers the call straight away to a business with no Google listing', async ({ authenticatedPage: page }) => {
    const sent = await mockAgent(page, { business: mockBusiness })
    await new BasePage(page).goto('/wizard?id=test123')

    await expect(page.locator('.wizard-no-link .wizard-title')).toHaveText("We don't know you yet", { timeout: 20000 })
    await expect(page.locator('.wizard-no-link').getByRole('button', { name: 'Call' })).toBeVisible()
    expect(sent.messages).toEqual([])
  })

  test('should not have horizontal overflow', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)

    await authenticatedPage.route('**/api/chat/message/stream', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"done","session_id":"test"}\n\n',
      })
    })

    await authenticatedPage.route('**/api/chat/history*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messages: [], session_id: null }),
      })
    })

    await basePage.goto('/wizard?id=test123')
    await basePage.expectNoHorizontalOverflow()
  })
})
