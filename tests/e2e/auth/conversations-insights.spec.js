// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')

/**
 * StarChat's call insights (`details.outcome`, `topics`, `unanswered`, `checks`), on the call
 * opened by its deep link (`?conversation=<id>`, the path a call-report or a call-notification
 * email link takes) above the list, so the insights are visible without paging to find the call.
 * `tests/unit/callDetailsPanel.spec.js` already covers each insight kind in isolation; this is the
 * one real render, mocked at the real StarChat search path.
 */
const callWithInsights = {
  id: 'CON-insights-1',
  businessId: 'test-biz-001',
  owner: 'test-uid-12345',
  startTimestamp: 1791120976220,
  contactNumber: '+41700000000',
  contactName: 'Elena Rossi',
  subject: '',
  body: '',
  properties: [],
  data: { conversation_transcription: [] },
  details: {
    callerName: 'Elena Rossi',
    callerNumber: '+41700000000',
    summary: 'Asks about Sunday opening hours.',
    topics: ['opening hours', 'billing'],
    outcome: 'unresolved',
    unanswered: [{
      question: 'Do you open on Sundays?',
      gap: 'missing_info',
      suggestion: 'Tell the assistant your Sunday hours.'
    }],
    checks: { caller_repeated: true, caller_unsatisfied: false, promise_not_kept_in_call: false }
  }
}

async function mockConversationSearch (page, { byId = callWithInsights } = {}) {
  await page.route('**/customer/conversation/search*', (route) => {
    const body = route.request().postDataJSON() || {}
    const hits = body.id ? (byId ? [byId] : []) : [callWithInsights]
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalHits: hits.length,
        hitsCount: hits.length,
        maxScore: 1,
        hits: hits.map(document => ({ score: 1, document }))
      })
    })
  })
}

test.describe('Conversations: what the opened call said', () => {
  test('the deep-linked call shows its topics, its unanswered question and the assessed outcome, marked as such', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page)
    await page.goto('/conversations?id=test-biz-001&conversation=CON-insights-1')
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('Call opened from the link')).toBeVisible({ timeout: 15000 })

    const insights = opened.locator('.call-insights-box')
    await expect(insights.getByText('Unresolved')).toBeVisible()
    await expect(insights.getByText('Assessed by the assistant')).toBeVisible()
    await expect(insights.getByText('opening hours')).toBeVisible()
    await expect(insights.getByText('billing')).toBeVisible()
    await expect(insights.getByText('Missing information')).toBeVisible()
    await expect(insights.getByText('Do you open on Sundays?')).toBeVisible()
    await expect(insights.getByText('Tell the assistant your Sunday hours.')).toBeVisible()
    await expect(insights.getByText('The caller had to repeat themselves')).toBeVisible()
    await expect(insights.getByText('unsatisfied')).toHaveCount(0)
  })

  test('a recorded outcome (booked) shows with no assessed marking', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: { ...callWithInsights, details: { ...callWithInsights.details, outcome: 'booked' } } })
    await page.goto('/conversations?id=test-biz-001&conversation=CON-insights-1')
    const insights = page.locator('.opened-card .call-insights-box')
    await expect(insights.getByText('Booked')).toBeVisible({ timeout: 15000 })
    await expect(insights.locator('.insight-assessed-tag')).toHaveCount(0)
  })

  test('a call with none of the four insight fields shows the panel as before the feature', async ({ authenticatedPage: page }) => {
    const plain = { ...callWithInsights, details: { callerName: 'Elena Rossi', summary: 'Plain call.' } }
    await mockConversationSearch(page, { byId: plain })
    await page.goto('/conversations?id=test-biz-001&conversation=CON-insights-1')
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('Plain call.')).toBeVisible({ timeout: 15000 })
    await expect(opened.locator('.call-insights-box')).toHaveCount(0)
  })
})
