// @ts-check
const { expect } = require('@playwright/test')
const { test: base, setupAuthPage } = require('../fixtures/auth')
const { mockUser } = require('../fixtures/mock-data')

/**
 * The poll test needs a fake clock, and a clock installed after the page has navigated also fakes
 * the timers of the dev server's client, which raised its error overlay over the page once. The
 * clock is installed before the page's first navigation, the seed page `setupAuthPage` opens
 * included, as Playwright prescribes; the other tests use the plain page. The third-party tag
 * scripts (Google Tag Manager, Analytics, Clarity) really load in these tests, since the shared
 * fixture's abort patterns (a glob starting at the slash before the bare domain) do not match their `www.` hosts, and
 * Clarity throws a cross-origin SecurityError into the page, which the dev server shows as an
 * "Uncaught runtime errors" overlay over the list. This test has no use for them, so the requests
 * are refused here.
 */
const test = base.extend({
  clockedPage: async ({ page }, use) => {
    await page.clock.install()
    for (const host of ['googletagmanager.com', 'google-analytics.com', 'doubleclick.net', 'clarity.ms', 'google.it']) {
      await page.route(`**/*${host}/**`, (route) => route.abort())
    }
    await setupAuthPage(page, mockUser, 'owner')
    await use(page)
  }
})

/**
 * StarChat's call insights, version 2 (`details.resolution`, `message`, `booked`, `transferred`,
 * `topics`, `unanswered`, `checks`), on the call
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
    resolution: 'unresolved',
    message: 'incomplete',
    booked: false,
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

const open = (page) => page.goto('/conversations?id=test-biz-001&conversation=CON-insights-1')
const fact = (page, label) => page.locator('.opened-card .insight-fact').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })
const withInsights = (insights, extra = {}) => ({ ...callWithInsights, details: { callerName: 'Elena Rossi', summary: 'A call.', ...insights }, ...extra })

test.describe('Conversations: what the opened call said', () => {
  test('the deep-linked call shows its topics, its unanswered question, the judged resolution and message marked as the assistant\'s, the booking and the unknown transfer', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page)
    await open(page)
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('Call opened from the link')).toBeVisible({ timeout: 15000 })

    const insights = opened.locator('.call-insights-box')
    await expect(fact(page, 'Resolution')).toContainText('Unresolved')
    await expect(fact(page, 'Resolution').getByText('Assessed by the assistant')).toBeVisible()
    await expect(fact(page, 'Message')).toContainText('Incomplete message')
    await expect(fact(page, 'Message').getByText('Assessed by the assistant')).toBeVisible()
    await expect(fact(page, 'Booking')).toContainText('Not booked')
    await expect(fact(page, 'Booking').locator('.insight-assessed-tag')).toHaveCount(0)
    await expect(fact(page, 'Transfer')).toContainText('Not known')
    await expect(fact(page, 'Transfer').locator('.insight-assessed-tag')).toHaveCount(0)
    await expect(insights.locator('.insight-assessed-tag')).toHaveCount(2)
    await expect(insights.getByText('opening hours')).toBeVisible()
    await expect(insights.getByText('billing')).toBeVisible()
    await expect(insights.getByText('Missing information')).toBeVisible()
    await expect(insights.getByText('Do you open on Sundays?')).toBeVisible()
    await expect(insights.getByText('Tell the assistant your Sunday hours.')).toBeVisible()
    await expect(insights.getByText('The caller had to repeat themselves')).toBeVisible()
    await expect(insights.getByText('unsatisfied')).toHaveCount(0)
  })

  test('booked true and transferred true show as recorded facts with no marking', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({ resolution: 'handed_over', booked: true, transferred: true }) })
    await open(page)
    await expect(fact(page, 'Booking')).toContainText('Booked', { timeout: 15000 })
    await expect(fact(page, 'Booking')).not.toContainText('Not booked')
    await expect(fact(page, 'Booking').locator('.insight-assessed-tag')).toHaveCount(0)
    await expect(fact(page, 'Transfer')).toHaveText(/Transferred/)
    await expect(fact(page, 'Transfer').locator('.insight-assessed-tag')).toHaveCount(0)
    await expect(fact(page, 'Resolution')).toContainText('Handed over')
  })

  test('a resolution, a message and a booked that are absent show nothing', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({ topics: ['billing'], transferred: true }) })
    await open(page)
    await expect(page.locator('.opened-card .call-insights-box').getByText('billing')).toBeVisible({ timeout: 15000 })
    await expect(fact(page, 'Resolution')).toHaveCount(0)
    await expect(fact(page, 'Message')).toHaveCount(0)
    await expect(fact(page, 'Booking')).toHaveCount(0)
    await expect(fact(page, 'Transfer')).toContainText('Transferred')
  })

  test('a call without version-2 insights (version 1 on test) shows none of the four', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({ outcome: 'unresolved', topics: ['billing'] }) })
    await open(page)
    const insights = page.locator('.opened-card .call-insights-box')
    await expect(insights.getByText('billing')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.opened-card .insight-fact')).toHaveCount(0)
    await expect(insights.getByText('Unresolved')).toHaveCount(0)
    await expect(insights.getByText('Not known')).toHaveCount(0)
  })

  test('a transfer the carrier reported after the call ended shows when the call is read again', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({ resolution: 'handed_over', booked: false }) })
    await open(page)
    await expect(fact(page, 'Transfer')).toContainText('Not known', { timeout: 15000 })

    await page.unroute('**/customer/conversation/search*')
    await mockConversationSearch(page, { byId: withInsights({ resolution: 'handed_over', booked: false, transferred: true }) })
    await page.reload()
    await expect(fact(page, 'Transfer')).toHaveText(/Transferred/, { timeout: 15000 })
  })

  test('a German caller\'s call shows its labels in the viewer\'s language and its text as received, never translated', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, {
      byId: withInsights({
        resolution: 'resolved',
        message: 'complete',
        booked: true,
        summary: 'Der Anrufer fragt nach den Öffnungszeiten am Sonntag.',
        topics: ['Öffnungszeiten', 'Terminabsage'],
        unanswered: [{ question: 'Haben Sie sonntags geöffnet?', gap: 'missing_info', suggestion: 'Nennen Sie dem Assistenten Ihre Sonntagszeiten.' }]
      })
    })
    await open(page)
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('Der Anrufer fragt nach den Öffnungszeiten am Sonntag.')).toBeVisible({ timeout: 15000 })
    await expect(fact(page, 'Resolution')).toContainText('Resolved')
    await expect(fact(page, 'Message')).toContainText('Complete message')
    await expect(opened.locator('.insight-topic-tag')).toHaveText(['Öffnungszeiten', 'Terminabsage'])
    await expect(opened.getByText('Haben Sie sonntags geöffnet?')).toBeVisible()
    await expect(opened.getByText('Nennen Sie dem Assistenten Ihre Sonntagszeiten.')).toBeVisible()
    await expect(opened.getByText('Missing information')).toBeVisible()
  })

  test('a call with none of the insight fields shows the panel as before the feature', async ({ authenticatedPage: page }) => {
    const plain = { ...callWithInsights, details: { callerName: 'Elena Rossi', summary: 'Plain call.' } }
    await mockConversationSearch(page, { byId: plain })
    await open(page)
    const opened = page.locator('.opened-card')
    await expect(opened.getByText('Plain call.')).toBeVisible({ timeout: 15000 })
    await expect(opened.locator('.call-insights-box')).toHaveCount(0)
  })
})

/**
 * `details.unkept` (StarChat M13): what the assistant told the caller and the record does not show
 * done, in the panel of the opened call, above the unanswered questions; the check line that states
 * the same fact is hidden while entries show.
 */
test.describe('Conversations: told to the caller and not recorded as done', () => {
  const unkept = [
    { action: 'book', said: 'I have booked you for Monday at 10.' },
    { action: 'refund', said: 'Your money is on its way back.' }
  ]
  const checks = { caller_repeated: false, caller_unsatisfied: false, promise_not_kept_in_call: true }
  const entries = (page) => page.locator('.opened-card .insight-unkept-entry')
  const promiseLine = (page) => page.locator('.opened-card .insight-checks').getByText('A promise made in the call was not kept')

  test('the entries show above the unanswered questions with their label and quoted words, and the check line is hidden', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({
      booked: false,
      unkept,
      checks,
      unanswered: [{ question: 'Do you open on Sundays?', gap: 'missing_info' }]
    }) })
    await open(page)
    await expect(page.locator('.opened-card').getByText('Told to the caller, not recorded as done')).toBeVisible({ timeout: 15000 })
    await expect(entries(page)).toHaveCount(2)
    await expect(entries(page).first()).toContainText('Booking')
    await expect(entries(page).first()).toContainText('\u201cI have booked you for Monday at 10.\u201d')
    await expect(entries(page).first().locator('.insight-assessed-tag')).toHaveText('Assessed by the assistant')
    await expect(promiseLine(page)).toHaveCount(0)
    const unkeptBox = await page.locator('.opened-card .insight-unkept').boundingBox()
    const unansweredBox = await page.locator('.opened-card .insight-unanswered').boundingBox()
    expect(unkeptBox.y + unkeptBox.height).toBeLessThanOrEqual(unansweredBox.y)
  })

  test('an action the dashboard does not know shows the neutral label, never its key', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({ booked: false, unkept, checks }) })
    await open(page)
    await expect(entries(page)).toHaveCount(2, { timeout: 15000 })
    await expect(entries(page).nth(1)).toContainText('Another action')
    await expect(entries(page).nth(1)).toContainText('Your money is on its way back.')
    await expect(entries(page).nth(1)).not.toContainText('refund')
  })

  test('the same call without unkept shows the check line once', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({ booked: false, unkept: [], checks }) })
    await open(page)
    await expect(promiseLine(page)).toHaveCount(1, { timeout: 15000 })
    await expect(entries(page)).toHaveCount(0)
    await expect(page.locator('.opened-card').getByText('not recorded as done')).toHaveCount(0)
  })

  test('an empty list shows nothing and the panel is as before', async ({ authenticatedPage: page }) => {
    await mockConversationSearch(page, { byId: withInsights({ unkept: [] }) })
    await open(page)
    await expect(page.locator('.opened-card').getByText('A call.')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.opened-card .call-insights-box')).toHaveCount(0)
    await expect(page.locator('.opened-card .insight-unkept')).toHaveCount(0)
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

const dropdown = (page, name) => page.getByRole('combobox', { name, exact: true })

test.describe('Conversations: filtering on what the call said', () => {
  test('resolution, message, booked, transferred and unanswered reach the list, both exports and the bulk actions alike, and a change starts over from the first page', async ({ authenticatedPage: page }) => {
    const { searchRequests, exportRequests, actionRequests } = await mockConversationFiltering(page)
    await page.goto('/conversations?id=test-biz-001')
    await expect(page.locator('.conversation-card').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Next Page' }).first().click()
    await expect.poll(() => searchRequests.at(-1).from).toBe(10)

    await dropdown(page, 'Resolution').click()
    await page.getByRole('option', { name: 'Unresolved' }).click()
    await expect.poll(() => searchRequests.at(-1).resolution).toBe('unresolved')
    expect(searchRequests.at(-1).from).toBe(0)

    await dropdown(page, 'Message').click()
    await page.getByRole('option', { name: 'Incomplete message' }).click()
    await expect.poll(() => searchRequests.at(-1).message).toBe('incomplete')

    await dropdown(page, 'Booking').click()
    await page.getByRole('option', { name: 'Not booked' }).click()
    await expect.poll(() => searchRequests.at(-1).booked).toBe(false)

    await page.getByRole('button', { name: 'Transferred', exact: true }).click()
    await expect.poll(() => searchRequests.at(-1).transferred).toBe(true)

    await page.getByRole('button', { name: 'Unanswered questions' }).click()
    await expect.poll(() => searchRequests.at(-1).hasUnanswered).toBe(true)
    expect(searchRequests.at(-1).from).toBe(0)

    const filters = { resolution: 'unresolved', message: 'incomplete', booked: false, transferred: true, hasUnanswered: true }
    expect(searchRequests.at(-1)).toMatchObject(filters)

    await page.getByRole('button', { name: 'TSV' }).click()
    await expect.poll(() => exportRequests.tsv.length).toBeGreaterThan(0)
    expect(exportRequests.tsv.at(-1)).toMatchObject(filters)

    await page.getByRole('button', { name: 'JSON' }).click()
    await expect.poll(() => exportRequests.json.length).toBeGreaterThan(0)
    expect(exportRequests.json.at(-1)).toMatchObject(filters)

    await page.getByRole('button', { name: 'Archive All' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => actionRequests.archive.length).toBeGreaterThan(0)
    expect(actionRequests.archive.at(-1)).toMatchObject(filters)

    await page.getByRole('button', { name: 'Delete All' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect.poll(() => actionRequests.delete.length).toBeGreaterThan(0)
    expect(actionRequests.delete.at(-1)).toMatchObject(filters)

    // StarChat answers 400 to the version-1 `outcome` filter: no call site sends it any more
    for (const body of [...searchRequests, ...exportRequests.tsv, ...exportRequests.json, ...actionRequests.archive, ...actionRequests.delete]) {
      expect(body).not.toHaveProperty('outcome')
    }
  })

  test('booked offers both answers, booked and not booked, and clearing it sends none', async ({ authenticatedPage: page }) => {
    const { searchRequests } = await mockConversationFiltering(page)
    await page.goto('/conversations?id=test-biz-001')
    await expect(page.locator('.conversation-card').first()).toBeVisible({ timeout: 15000 })
    expect(searchRequests.at(-1)).not.toHaveProperty('booked')

    await dropdown(page, 'Booking').click()
    await page.getByRole('option', { name: 'Booked', exact: true }).click()
    await expect.poll(() => searchRequests.at(-1).booked).toBe(true)

    await dropdown(page, 'Booking').click()
    await page.getByRole('option', { name: 'Not booked' }).click()
    await expect.poll(() => searchRequests.at(-1).booked).toBe(false)

    await page.locator('.filter-row').filter({ hasText: 'Booking' }).locator('.p-select-clear-icon').click()
    await expect.poll(() => 'booked' in searchRequests.at(-1)).toBe(false)
  })

  test('the poll carries the filters set on the list', async ({ clockedPage: page }) => {
    const { searchRequests } = await mockConversationFiltering(page)
    await page.goto('/conversations?id=test-biz-001')
    await expect(page.locator('.conversation-card').first()).toBeVisible({ timeout: 15000 })

    await dropdown(page, 'Resolution').click()
    await page.getByRole('option', { name: 'Handed over' }).click()
    await expect.poll(() => searchRequests.at(-1).resolution).toBe('handed_over')
    await page.getByRole('button', { name: 'Transferred', exact: true }).click()
    await expect.poll(() => searchRequests.at(-1).transferred).toBe(true)

    const before = searchRequests.length
    await page.clock.fastForward(11000)
    await expect.poll(() => searchRequests.length).toBeGreaterThan(before)
    expect(searchRequests.at(-1)).toMatchObject({ resolution: 'handed_over', transferred: true })
  })

  test('the resolution and message filters are marked as the assistant\'s own assessment, booked and transferred are not', async ({ authenticatedPage: page }) => {
    await mockConversationFiltering(page)
    await page.goto('/conversations?id=test-biz-001')
    await expect(page.locator('.conversation-card').first()).toBeVisible({ timeout: 15000 })

    const row = (label) => page.locator('.filter-row').filter({ has: page.locator('.filter-label', { hasText: label }) })
    await expect(row('Resolution').getByText('Assessed by the assistant')).toBeVisible()
    await expect(row('Message').getByText('Assessed by the assistant')).toBeVisible()
    await expect(row('Booking').getByText('Assessed by the assistant')).toHaveCount(0)
    await expect(row('Transfer').getByText('Assessed by the assistant')).toHaveCount(0)

    await dropdown(page, 'Resolution').click()
    await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['Resolved', 'Unresolved', 'Handed over', 'Spoke but never said what they wanted', 'Spam or wrong number'])
    await page.keyboard.press('Escape')
    await dropdown(page, 'Message').click()
    await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['Complete message', 'Incomplete message', 'Unintelligible message', 'No message'])
  })
})
