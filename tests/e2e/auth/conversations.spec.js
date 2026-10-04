// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { BasePage } = require('../pages/base.page')

test.describe('Conversations Page (Authenticated)', () => {
  test('should load conversations page', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/conversations?id=test-biz-001')

    const body = authenticatedPage.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('should display conversation data from mock', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/conversations?id=test-biz-001')

    // Wait for the page to render content
    await authenticatedPage.waitForTimeout(2000)

    // Page should have loaded and rendered some content
    const mainContent = authenticatedPage.locator('.main-page-content-section').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should have navbar visible', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/conversations?id=test-biz-001')
    await basePage.expectNavbarVisible()
  })

  test('should not have horizontal overflow', async ({ authenticatedPage }) => {
    const basePage = new BasePage(authenticatedPage)
    await basePage.goto('/conversations?id=test-biz-001')
    await basePage.expectNoHorizontalOverflow()
  })
})

/** A call as StarChat returns it with `details` (CallDetails): the shape of a production call of
 * 2026-10-04, name and number replaced. Before `details` the page drew it as "Unknown contact" and
 * its transcript, and nothing of what the assistant collected. */
const callWithDetails = {
  id: 'CON-e2e-1',
  businessId: 'test-biz-001',
  owner: 'test-uid-12345',
  startTimestamp: 1791120976220,
  contactNumber: '+41700000000',
  contactName: 'Elena Rossi',
  subject: '',
  body: '',
  properties: [],
  data: {
    conversation_transcription: [
      { alias: 'Assistente', speaker_type: 'agent', content: 'Buongiorno, come posso aiutarla?' },
      { alias: 'Chiamante', speaker_type: 'user', content: 'Devo disdire l\'appuntamento di domani alle tre.' }
    ]
  },
  details: {
    callerName: 'Elena Rossi',
    callerNumber: '+41700000000',
    summary: 'Disdice l\'appuntamento di domani alle 15:00.',
    fields: [
      { name: 'ACTION', label: 'Azione da intraprendere da parte nostra (ricontattare, inviare ricetta etc)', value: 'ricontattare' },
      { name: 'CALL_REASON', label: 'Perché il chiamante ci ha contattato', value: 'disdetta appuntamento per domani alle 15:00' }
    ],
    previousCalls: [{ date: '12/09/2026', summary: 'Prenota un controllo' }]
  }
}

/** Answers the conversation search: the list, and a search by id with the call or with nothing. */
async function mockConversationSearch (page, { byId = callWithDetails } = {}) {
  const requests = []
  await page.route('**/customer/conversation/search*', (route) => {
    const body = route.request().postDataJSON() || {}
    requests.push(body)
    const hits = body.id ? (byId ? [byId] : []) : [callWithDetails]
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
  return requests
}

test.describe('Conversations: the details of a call', () => {
  test('a call shows who called, what to do and what was collected, the transcript closed', async ({ authenticatedPage: page }, testInfo) => {
    const requests = await mockConversationSearch(page)
    await page.goto('/conversations?id=test-biz-001')
    const card = page.locator('.conversation-card').first()
    await expect(card.getByText('Elena Rossi')).toBeVisible({ timeout: 15000 })
    await expect(card.getByText('Disdice l\'appuntamento di domani alle 15:00.')).toBeVisible()
    await expect(card.getByText('ricontattare', { exact: true })).toBeVisible()
    await expect(card.getByRole('link', { name: 'Call back' })).toHaveAttribute('href', 'tel:+41700000000')
    await expect(card.getByText('Devo disdire l\'appuntamento di domani alle tre.')).toBeHidden()
    await expect(card.getByRole('button', { name: /Conversation \(2 messages\)/ })).toHaveAttribute('aria-expanded', 'false')
    // the list asks for no recordings
    expect(requests.find(r => !r.id).lightweight).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('conversation-card.png'), fullPage: true })
  })

  test('?conversation=<id> opens that call above the list', async ({ authenticatedPage: page }, testInfo) => {
    const requests = await mockConversationSearch(page)
    await page.goto('/conversations?id=test-biz-001&conversation=CON-e2e-1')
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('Call opened from the link')).toBeVisible({ timeout: 15000 })
    await expect(opened.getByText('Devo disdire l\'appuntamento di domani alle tre.')).toBeVisible()
    expect(requests.find(r => r.id)).toMatchObject({ id: 'CON-e2e-1', businessId: 'test-biz-001' })
    await page.screenshot({ path: testInfo.outputPath('conversation-opened.png'), fullPage: true })
  })

  test('?conversation=<id> of a call in the trash opens it and says it is in the trash', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: { ...callWithDetails, deleted: true, archived: false } })
    await page.goto('/conversations?id=test-biz-001&conversation=CON-e2e-1')
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('In the trash')).toBeVisible({ timeout: 15000 })
    await expect(opened.getByText('Archived')).toBeHidden()
  })

  test('?conversation=<id> of a call the owner does not have says so', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: null })
    await page.goto('/conversations?id=test-biz-001&conversation=CON-missing')
    await expect(page.getByText('This call was not found among your conversations.')).toBeVisible({ timeout: 15000 })
  })
})

test.describe('Conversations: without a session', () => {
  test('sign-in is asked for, and it is told to come back to the call', async ({ page }) => {
    await page.goto('/conversations?id=test-biz-001&conversation=CON-e2e-1')
    await expect(page).toHaveURL(/\/signin\?/, { timeout: 15000 })
    const redirect = JSON.parse(new URL(page.url()).searchParams.get('redirect'))
    expect(redirect).toEqual({ path: '/conversations', query: { id: 'test-biz-001', conversation: 'CON-e2e-1' } })
  })
})
