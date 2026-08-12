// @ts-check
// Responsive checks for the new frozen-chat wizard UI (pending-changes diff, input area, action bar).
// Uses chromium-only (WebKit deps not installed on this host) with tablet + mobile viewport overrides.
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

const VIEWPORTS = [
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]

// Mock SSE body: streams a summary then emits pending_changes metadata, then done.
const sseWithPendingChanges = [
  'data: {"type":"text_delta","text":"Ho aggiornato il messaggio di benvenuto usando il \\"lei\\"."}\n\n',
  'data: {"type":"metadata","pending_changes":[{"variable_name":"CONVERSATION_PROMPT","new_value":"Buongiorno, sono l\'assistente. Come posso aiutarla?"},{"variable_name":"KNOWLEDGE_BASE_ANSWER_INSTRUCTIONS","new_value":"Rispondere sempre dando del lei, in modo cordiale e professionale."}]}\n\n',
  'data: {"type":"done","session_id":"mrcall_wizard_test123"}\n\n',
].join('')

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

    test(`no horizontal overflow on ${vp.name} — with pending_changes diff visible`, async ({ authenticatedPage }) => {
      await authenticatedPage.setViewportSize({ width: vp.width, height: vp.height })
      const basePage = new BasePage(authenticatedPage)

      await authenticatedPage.route('**/api/chat/message/stream', (route) => {
        route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseWithPendingChanges })
      })
      await authenticatedPage.route('**/api/chat/history*', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, messages: [], session_id: null }) })
      })

      await basePage.goto('/wizard?id=test123')
      // Wait for initial analysis to complete
      await authenticatedPage.waitForSelector('.wizard-summary-box', { timeout: 10000 })

      // Type an instruction and send
      const textarea = authenticatedPage.locator('.wizard-textarea')
      await expect(textarea).toBeVisible()
      await textarea.fill('Dai del lei invece che del tu')
      await authenticatedPage.locator('.wizard-send-btn').click()

      // Wait for Accept button (appears for all roles once pending_changes staged)
      await authenticatedPage.waitForSelector('.wizard-action-bar', { timeout: 10000 })

      // No horizontal overflow with the new UI active
      await basePage.expectNoHorizontalOverflow()

      await authenticatedPage.screenshot({
        fullPage: true,
        path: `tests/screenshots/baseline/wizard-responsive-${vp.name}-pending.png`,
      })
    })
  }
})
