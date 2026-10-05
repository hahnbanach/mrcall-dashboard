// @ts-check
// Responsive checks for the wizard: no horizontal overflow on tablet and mobile, on the first screen
// and on the last, with the research summary and the call.
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')
const { mockBusiness } = require('../fixtures/mock-data')

const VIEWPORTS = [
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]

const linked = { ...mockBusiness, variables: { ...mockBusiness.variables, SYNC_GOOGLE_BUSINESS: 'true' } }

/** The agent's two replies: the session opened, then the configuration with its research summary. */
function agentReply (message) {
  const events = message.startsWith('/agent') ? [
    { type: 'metadata', pending_changes: [{ variable_name: 'CONVERSATION_PROMPT', new_value: 'Buongiorno, come posso aiutarla?' }] },
    { type: 'text_delta', text: 'Configured. <research-summary>120 Google reviews, 4.6 on average; open every day for lunch and dinner, takeaway and delivery.</research-summary>' },
    { type: 'done', session_id: 'mrcall_wizard_test123' }
  ] : [{ type: 'done', session_id: 'mrcall_wizard_test123' }]
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
}

test.describe('Wizard responsive layout', () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow on ${vp.name} (${vp.width}x${vp.height}) — initial load`, async ({ authenticatedPage }) => {
      await authenticatedPage.setViewportSize({ width: vp.width, height: vp.height })
      const basePage = new BasePage(authenticatedPage)

      await authenticatedPage.route('**/api/chat/message/stream', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"type":"text_delta","text":"Il tuo assistente risponde al telefono con un saluto e chiede il nome."}\n\ndata: {"type":"done","session_id":"s1"}\n\n',
        })
      })
      await authenticatedPage.route('**/api/chat/history*', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, messages: [], session_id: null }) })
      })

      await basePage.goto('/wizard?id=test123')
      await authenticatedPage.waitForTimeout(1500)
      await basePage.expectNoHorizontalOverflow()
    })

    test(`no horizontal overflow on ${vp.name} — configured, with the research summary and the call`, async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const basePage = new BasePage(page)
      await page.route('**/crm/business*', (route) => route.request().method() !== 'GET' ? route.fallback()
        : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([linked]) }))
      await page.route('**/api/chat/message/stream', (route) => route.fulfill({ status: 200,
        contentType: 'text/event-stream', body: agentReply(route.request().postDataJSON().message || '') }))
      await page.route('**/api/mrcall/apply-changes', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }))

      await basePage.goto('/wizard?id=test123')
      await page.getByRole('button', { name: 'Start' }).click({ timeout: 20000 })
      await expect(page.locator('.research-summary')).toBeVisible({ timeout: 20000 })
      await basePage.expectNoHorizontalOverflow()
    })
  }
})
