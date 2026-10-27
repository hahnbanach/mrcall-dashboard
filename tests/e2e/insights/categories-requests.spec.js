// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, category, rome } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 5 and 7 (StarChat's brief, decision 13, and decision
 * 9 "In lists"): "Richieste dei chiamanti" on request records: its purpose, the requests the assistant did not fulfil by
 * default with a switch to all, each row's calls and outcome split opening that category's requests (paged, each with
 * its business, its call and its chips), "Da classificare", the share over the businesses with analysed calls, the
 * backlog, the examples linked to their calls; and the requests' list correcting in one gesture. StarChat answered as
 * `CallInsightsReportService.requestCategories` and `.categoryRequests` do at 087eedc34.
 *
 * Seen failing, 2026-10-27, before the view on requests and CategoryRequests.vue existed: every case. The spam case
 * (each request's call resolution, StarChat a012b6926) failed on 2d39e13; the calls left out of it said (a call already
 * spam, one without a resolution) failed on 259ff67.
 */
const WINDOW = { from: rome(2026, 9, 24), to: rome(2026, 10, 24) }
const VIEW = {
  total: 2, asOf: 1761300000000, ...WINDOW, calls: 40, businesses: 4, businessesWithCalls: 4, backlog: { calls: 12 },
  items: [
    category('prices', {
      label: 'Prices and rates', unclassified: false, calls: 14, businesses: 2, share: 0.5,
      outcomes: { taken: 3, neither: 9, met: 2 }, dominantOutcome: 'neither', kind: 'business_info', nextActionKind: 'business_info',
      nextAction: 'Ask the businesses to add their prices',
      examples: [{ text: 'How much is a visit?', businessId: 'biz-2', name: 'Studio Bianchi', conversationId: 'CON-p9' }],
    }),
    category(null, {
      label: undefined, unclassified: true, calls: 5, businesses: 1, share: 0.25, outcomes: { neither: 5 }, dominantOutcome: 'neither',
      nextActionKind: 'none', nextAction: undefined, examples: [],
    }),
  ],
}

const REQUESTS = {
  total: 2, calls: 2, asOf: 1761300000001,
  items: [
    { requestId: 301, conversationId: 'CON-p1', callStart: rome(2026, 10, 20), businessId: 'biz-2', name: 'Studio Bianchi', text: 'How much is a whitening?', outcome: 'taken', outcomeModel: 'taken', category: 'prices', categoryModel: 'prices', corrected: false, resolution: 'forwarded' },
    { requestId: 302, conversationId: 'CON-p2', callStart: rome(2026, 10, 21), businessId: 'biz-3', name: 'Studio Verdi', text: 'Are you open on Saturday?', outcome: 'neither', outcomeModel: 'neither', category: 'prices', categoryModel: 'prices', corrected: false, resolution: 'unresolved' },
  ],
}

const section = (page) => page.getByRole('region', { name: 'Callers\' requests' })

// A request selected as a person does at the page's width: its checkbox, after a long press on a narrow screen.
async function selectRequest (page, list, text) {
  const box = page.getByRole('checkbox', { name: `Select the request: ${text}` })
  if (page.viewportSize().width < 600 && !(await box.isVisible())) {
    const row = list.getByRole('row').filter({ hasText: text })
    await row.scrollIntoViewIfNeeded()
    const cell = await row.locator('td').nth(1).boundingBox()
    await page.mouse.move(cell.x + 10, cell.y + 10)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()
  }
  await box.check()
}

async function open (page, { categories, requestsStatus, requests } = {}) {
  const asked = await mockInsights(page, { role: 'admin', categories: VIEW })
  const { sent } = await mockClassifications(page, {
    role: 'admin',
    categories,
    categoryRequests: () => requests || REQUESTS,
  })
  if (requestsStatus) {
    await page.route('**/customer/insights/categories/*/requests*', (route) => route.fulfill({ status: requestsStatus, contentType: 'application/json', body: '"Unavailable"' }))
  }
  await page.goto('/analytics-admin')
  await expect(section(page).getByText('Prices and rates').first()).toBeVisible({ timeout: 15000 })
  return { asked, sent }
}

test.describe('callers\' requests on request records', () => {
  test('the view says what it counts: purpose, a call in every category of its requests, the backlog, the share over businesses with calls', async ({ adminPage: page }) => {
    const { asked } = await open(page)
    await expect(section(page).getByText('What callers ask and how much of it the assistant handles, by category across all businesses.')).toBeVisible()
    await expect(section(page).getByText('A call with several requests appears in every category of its requests.')).toBeVisible()
    await expect(section(page).getByText('12 calls are still waiting for their analysis and are not counted yet.')).toBeVisible()
    await expect(section(page).getByText('50% of the businesses with analysed calls')).toBeVisible()
    await expect(section(page).getByText('Not classified yet')).toBeVisible()
    // by default the requests the assistant did not fulfil; the switch asks for all
    expect(new URL(asked.categories.pop().url).searchParams.get('all')).toBeNull()
    await section(page).getByRole('checkbox', { name: 'All requests, the ones the assistant handled too' }).check()
    await expect.poll(() => new URL(asked.categories[asked.categories.length - 1].url).searchParams.get('all')).toBe('true')
    // an example opens its call
    await expect(section(page).getByRole('link', { name: 'Open the call: How much is a visit?' })).toHaveAttribute('href', '/conversations?id=biz-2&conversation=CON-p9')
  })

  test('a row\'s calls open its requests, each with its business, its call and its chips', async ({ adminPage: page }) => {
    const { sent } = await open(page)
    await section(page).getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    const list = page.getByRole('table', { name: 'Requests of Prices and rates' })
    await expect(list.getByRole('row').filter({ hasText: 'How much is a whitening?' })).toBeVisible({ timeout: 15000 })
    const asked = sent.filter((s) => s.path === 'category-requests').pop()
    expect(asked.category).toBe('prices')
    expect(asked.query.outcome).toBeUndefined()
    expect(asked.body).toMatchObject({ timestampGte: expect.any(Number), timestampLte: expect.any(Number) })
    const row = list.getByRole('row').filter({ hasText: 'How much is a whitening?' })
    await expect(row).toContainText('Studio Bianchi')
    await expect(row.getByRole('link', { name: 'Open the call: How much is a whitening?' })).toHaveAttribute('href', '/conversations?id=biz-2&conversation=CON-p1')
    await expect(row.getByRole('button', { name: /^Request outcome: Taken for the business/ })).toBeVisible()
    await expect(row.getByRole('button', { name: /^Category: Prices and quotes/ })).toBeVisible()
  })

  test('an outcome of the split opens the requests with that outcome; "Not classified yet" opens its own', async ({ adminPage: page }) => {
    const { sent } = await open(page)
    await section(page).getByRole('button', { name: 'Show the requests of Prices and rates with outcome Not met (9)' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'category-requests').length).toBe(1)
    expect(sent.filter((s) => s.path === 'category-requests').pop()).toMatchObject({ category: 'prices', query: { outcome: 'neither' } })
    await section(page).getByRole('button', { name: 'Show the requests of Not classified yet (5 calls)' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'category-requests').length).toBe(2)
    expect(sent.filter((s) => s.path === 'category-requests').pop().category).toBe('unclassified')
  })

  test('selected requests move to another category in one gesture, and are undone together', async ({ adminPage: page }) => {
    const { sent } = await open(page)
    await section(page).getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    const list = page.getByRole('table', { name: 'Requests of Prices and rates' })
    await expect(list.getByRole('row').filter({ hasText: 'How much is a whitening?' })).toBeVisible({ timeout: 15000 })
    for (const text of ['How much is a whitening?', 'Are you open on Saturday?']) await selectRequest(page, list, text)
    const bar = page.getByRole('toolbar', { name: 'Selected requests' })
    await expect(bar).toContainText('2 selected')
    await expect(bar).toBeInViewport()
    await bar.getByRole('button', { name: 'Move to category' }).click()
    await page.getByRole('listbox').getByRole('option', { name: 'Opening hours', exact: true }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'bulk').length).toBe(1)
    const bulk = sent.find((s) => s.path === 'bulk')
    expect(bulk.body.items).toEqual([
      { subject: 'request', conversationId: 'CON-p1', requestId: 301, field: 'category', signal: 'wrong_value', valueFrom: 'prices', valueTo: 'opening_hours' },
      { subject: 'request', conversationId: 'CON-p2', requestId: 302, field: 'category', signal: 'wrong_value', valueFrom: 'prices', valueTo: 'opening_hours' },
    ])
    await page.getByRole('status').filter({ hasText: 'Changed' }).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'gesture-revert').length).toBe(1)
    expect(sent.find((s) => s.path === 'gesture-revert').gestureId).toBe(bulk.body.gestureId)
  })

  test('selected requests mark their calls as spam, with each call\'s resolution read (StarChat a012b6926)', async ({ adminPage: page }) => {
    const { sent } = await open(page)
    await section(page).getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    const list = page.getByRole('table', { name: 'Requests of Prices and rates' })
    await expect(list.getByRole('row').filter({ hasText: 'How much is a whitening?' })).toBeVisible({ timeout: 15000 })
    for (const text of ['How much is a whitening?', 'Are you open on Saturday?']) await selectRequest(page, list, text)
    await page.getByRole('toolbar', { name: 'Selected requests' }).getByRole('button', { name: 'Mark as spam' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'bulk').length).toBe(1)
    expect(sent.find((s) => s.path === 'bulk').body.items).toEqual([
      { subject: 'call', conversationId: 'CON-p1', field: 'resolution', signal: 'wrong_value', valueFrom: 'forwarded', valueTo: 'spam_wrong_number' },
      { subject: 'call', conversationId: 'CON-p2', field: 'resolution', signal: 'wrong_value', valueFrom: 'unresolved', valueTo: 'spam_wrong_number' },
    ])
  })

  test('a call already spam, or without a resolution, is left out of "Mark as spam", and said', async ({ adminPage: page }) => {
    const requests = { ...REQUESTS, items: [{ ...REQUESTS.items[0], resolution: 'spam_wrong_number' }, { ...REQUESTS.items[1], resolution: undefined }] }
    const { sent } = await open(page, { requests })
    await section(page).getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    const list = page.getByRole('table', { name: 'Requests of Prices and rates' })
    await expect(list.getByRole('row').filter({ hasText: 'How much is a whitening?' })).toBeVisible({ timeout: 15000 })
    for (const text of ['How much is a whitening?', 'Are you open on Saturday?']) await selectRequest(page, list, text)
    await page.getByRole('toolbar', { name: 'Selected requests' }).getByRole('button', { name: 'Mark as spam' }).click()
    await expect(page.getByRole('status').filter({ hasText: '1 call already marked as spam was left out.' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: '1 call without a judged outcome was left out.' })).toBeVisible()
    expect(sent.filter((s) => s.path === 'bulk' || (s.path === 'feedback' && s.method === 'POST'))).toHaveLength(0)
  })

  test('without the category list, no category chip and no "Move to category"', async ({ adminPage: page }) => {
    await open(page, { categories: null })
    await section(page).getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    const list = page.getByRole('table', { name: 'Requests of Prices and rates' })
    await expect(list.getByRole('row').filter({ hasText: 'How much is a whitening?' })).toBeVisible({ timeout: 15000 })
    await expect(list.getByRole('button', { name: /^Category:/ })).toHaveCount(0)
    await selectRequest(page, list, 'How much is a whitening?')
    await expect(page.getByRole('toolbar', { name: 'Selected requests' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Move to category' })).toHaveCount(0)
  })

  test('a requests\' list StarChat cannot serve yet (503) says so, and the view stays', async ({ adminPage: page }) => {
    await open(page, { requestsStatus: 503 })
    await section(page).getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    await expect(section(page).getByText('Not available yet').first()).toBeVisible({ timeout: 15000 })
    await expect(section(page).getByText('Prices and rates').first()).toBeVisible()
  })
})
