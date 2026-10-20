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

/**
 * The list's outcome and "unanswered questions" filters (brief outcome 2): one body
 * (`searchBody` in `Conversations.vue`) feeds the list search, its poll, both exports and the two
 * bulk actions alike, so an export or a bulk action acts on exactly the calls the list shows.
 * `totalHits` is answered as 25 regardless of the filters (this stub does not implement StarChat's
 * filtering), on purpose: the point here is the request each of the six call sites sends, not the
 * result StarChat would compute from it.
 */
async function mockConversationFiltering (page, { totalHits = 25 } = {}) {
  const searchRequests = []
  const exportRequests = { tsv: [], json: [] }
  const actionRequests = { archive: [], delete: [] }

  await page.route('**/customer/conversation/search*', (route) => {
    const body = route.request().postDataJSON() || {}
    searchRequests.push(body)
    const hits = [callWithInsights]
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalHits,
        hitsCount: hits.length,
        maxScore: 1,
        hits: hits.map(document => ({ score: 1, document }))
      })
    })
  })
  await page.route('**/customer/conversation/stream/tsv/**', (route) => {
    exportRequests.tsv.push(route.request().postDataJSON() || {})
    route.fulfill({ status: 200, contentType: 'text/csv', body: 'id\n' })
  })
  await page.route('**/customer/conversation/stream/json/**', (route) => {
    exportRequests.json.push(route.request().postDataJSON() || {})
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/customer/conversation/archive*', (route) => {
    actionRequests.archive.push(route.request().postDataJSON() || {})
    route.fulfill({ status: 200, contentType: 'application/json', body: '3' })
  })
  await page.route('**/customer/conversation/delete*', (route) => {
    actionRequests.delete.push(route.request().postDataJSON() || {})
    route.fulfill({ status: 200, contentType: 'application/json', body: '3' })
  })

  return { searchRequests, exportRequests, actionRequests }
}

test.describe('Conversations: filtering on what the call said', () => {
  test('the outcome filter and the unanswered toggle reach the list, both exports and the bulk actions alike, and a change starts over from the first page', async ({ authenticatedPage: page }) => {
    const { searchRequests, exportRequests, actionRequests } = await mockConversationFiltering(page)
    await page.goto('/conversations?id=test-biz-001')
    await expect(page.locator('.conversation-card').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Next Page' }).first().click()
    await expect.poll(() => searchRequests.at(-1).from).toBe(10)

    await page.getByRole('combobox', { name: 'Outcome' }).click()
    await page.getByRole('option', { name: 'Unresolved' }).click()
    await expect.poll(() => searchRequests.at(-1).outcome).toBe('unresolved')
    expect(searchRequests.at(-1).from).toBe(0)

    await page.getByRole('button', { name: 'Unanswered questions' }).click()
    await expect.poll(() => searchRequests.at(-1).hasUnanswered).toBe(true)
    expect(searchRequests.at(-1).outcome).toBe('unresolved')
    expect(searchRequests.at(-1).from).toBe(0)

    await page.getByRole('button', { name: 'TSV' }).click()
    await expect.poll(() => exportRequests.tsv.length).toBeGreaterThan(0)
    expect(exportRequests.tsv.at(-1)).toMatchObject({ outcome: 'unresolved', hasUnanswered: true })

    await page.getByRole('button', { name: 'JSON' }).click()
    await expect.poll(() => exportRequests.json.length).toBeGreaterThan(0)
    expect(exportRequests.json.at(-1)).toMatchObject({ outcome: 'unresolved', hasUnanswered: true })

    await page.getByRole('button', { name: 'Archive All' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => actionRequests.archive.length).toBeGreaterThan(0)
    expect(actionRequests.archive.at(-1)).toMatchObject({ outcome: 'unresolved', hasUnanswered: true })

    await page.getByRole('button', { name: 'Delete All' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => actionRequests.delete.length).toBeGreaterThan(0)
    expect(actionRequests.delete.at(-1)).toMatchObject({ outcome: 'unresolved', hasUnanswered: true })
  })

  test('the poll carries the filters set on the list', async ({ authenticatedPage: page }) => {
    const { searchRequests } = await mockConversationFiltering(page)
    await page.clock.install()
    await page.goto('/conversations?id=test-biz-001')
    await expect(page.locator('.conversation-card').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('combobox', { name: 'Outcome' }).click()
    await page.getByRole('option', { name: 'Booked' }).click()
    await expect.poll(() => searchRequests.at(-1).outcome).toBe('booked')

    const before = searchRequests.length
    await page.clock.fastForward(11000)
    await expect.poll(() => searchRequests.length).toBeGreaterThan(before)
    expect(searchRequests.at(-1).outcome).toBe('booked')
  })

  test('the outcome dropdown groups booked and transferred as recorded, the rest as the assistant\'s own assessment', async ({ authenticatedPage: page }) => {
    await mockConversationFiltering(page)
    await page.goto('/conversations?id=test-biz-001')
    await expect(page.locator('.conversation-card').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('combobox', { name: 'Outcome' }).click()
    const text = await page.getByRole('listbox').innerText()
    expect(text.indexOf('Recorded')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('Recorded')).toBeLessThan(text.indexOf('Booked'))
    expect(text.indexOf('Booked')).toBeLessThan(text.indexOf('Transferred'))
    expect(text.indexOf('Transferred')).toBeLessThan(text.indexOf('Assessed by the assistant'))
    expect(text.indexOf('Assessed by the assistant')).toBeLessThan(text.indexOf('Resolved'))
  })
})
