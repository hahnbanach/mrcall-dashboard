// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, OUTCOMES, rome } = require('../fixtures/insights')
const { mockClassifications, mockConversations, conversation, CALL_ID } = require('../fixtures/classifications')

/**
 * U19r6 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md, the brief's amendment of 2026-10-30,
 * rule 5 (U19c M4 and m16): an author withdraws its own proposal or fact report while it waits; a gesture's undo
 * withdraws its proposals and reverts its applied signals, and the bar says only what StarChat's answer lists; a fact
 * report has the same undo; "My proposals" says a withdrawn one and offers the withdrawal; and m10, "My proposals" shown
 * whatever the range.
 *
 * StarChat's side is being built beside this (field names to be aligned): `POST insights/feedback/{id}/withdraw`, the
 * status `withdrawn`, and the undo's `items` each with its `status` (tests/e2e/fixtures/classifications.js).
 * Seen failing on c0a4e35, each case, before its repair.
 */
const open = (page) => page.goto(`/conversations?id=${BUSINESS_ID}&conversation=${CALL_ID}`)
const opened = (page) => page.locator('.opened-card')
const chip = (page, name) => opened(page).getByRole('button', { name })
const bar = (page) => page.locator('.undo-bar-region')

async function propose (page) {
  await chip(page, /^Category: Book an appointment$/).first().click()
  await page.getByRole('listbox').getByRole('option', { name: 'Prices and quotes', exact: true }).click()
  await expect(chip(page, /^Category: Book an appointment, Proposal sent/)).toBeVisible()
}

test.describe('rule 5: an author withdraws its own proposal', () => {
  test('the undo of a proposal withdraws it, and the bar says so, not "change undone"', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await propose(page)
    await bar(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'gesture-revert').length).toBe(1)
    await expect(bar(page)).toContainText('Proposal withdrawn.')
    await expect(bar(page)).not.toContainText('Change undone.')
    await expect(chip(page, /^Category: Book an appointment$/).first()).toBeVisible()
    await expect(chip(page, /Proposal sent/)).toHaveCount(0)
  })

  test('an undo whose answer lists nothing says that nothing was undone', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    await mockClassifications(page)
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await propose(page)
    await page.route('**/customer/insights/feedback/gestures/*/revert', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gestureId: 'g', reverted: [], items: [], calls: [] }) }))
    await bar(page).getByRole('button', { name: 'Undo' }).click()
    await expect(bar(page)).toContainText('Nothing was undone: it had already been decided.')
    await expect(chip(page, /^Category: Book an appointment, Proposal sent/)).toBeVisible()
  })

  test('the chip offers its author the withdrawal of a proposal still waiting, and its history says it', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await propose(page)
    await bar(page).getByRole('button', { name: 'Close' }).click()
    await chip(page, /^Category: Book an appointment, Proposal sent/).click()
    await page.getByRole('listbox').getByRole('option', { name: 'Withdraw my proposal' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'withdraw').length).toBe(1)
    await expect(chip(page, /Proposal sent/)).toHaveCount(0)
    await chip(page, /^Category: Book an appointment$/).first().click()
    await expect(page.getByRole('listbox').getByRole('option', { name: 'Withdraw my proposal' })).toHaveCount(0)
    await page.getByRole('listbox').getByRole('option', { name: 'History' }).click()
    await expect(opened(page).getByRole('list', { name: 'History of Category' })).toContainText('Withdrawn')
  })

  test('a fact report has the same undo, and its author withdraws it from where it is said', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await chip(page, 'Report an error on a fact').click()
    await page.getByRole('listbox').getByRole('option', { name: 'Booking: Booked' }).click()
    await expect(opened(page).getByText('Reported to MrCall: Booking')).toBeVisible()
    await bar(page).getByRole('button', { name: 'Undo' }).click()
    await expect(bar(page)).toContainText('Proposal withdrawn.')
    await expect(opened(page).getByText('Reported to MrCall: Booking')).toHaveCount(0)
    // reported again, then withdrawn from beside its note
    await chip(page, 'Report an error on a fact').click()
    await page.getByRole('listbox').getByRole('option', { name: 'Booking: Booked' }).click()
    await opened(page).getByRole('button', { name: 'Withdraw the report: Booking' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'withdraw').length).toBe(1)
    await expect(opened(page).getByText('Reported to MrCall: Booking')).toHaveCount(0)
  })
})

const at = Date.UTC(2026, 9, 25, 9, 0)
const mineSignal = (over) => ({
  businessId: BUSINESS_ID, conversationId: 'CON-p1', callStart: at, subject: 'request', requestId: 301, field: 'category', signal: 'wrong_value',
  valueFrom: 'prices', valueTo: 'opening_hours', source: 'person', status: 'proposed', actorRole: 'owner', actorName: 'Mario Rossi',
  byMe: true, createdAt: at, requestText: 'How much is a whitening?', businessName: 'Test Restaurant', ...over,
})

test.describe('rule 5, m10: "My proposals"', () => {
  test('says a withdrawn proposal, and offers the withdrawal of one still waiting', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    const mine = {
      total: 1, asOf: 1,
      groups: [{ category: 'opening_hours', businessId: BUSINESS_ID, businessName: 'Test Restaurant', calls: 2, items: 2,
        signals: [mineSignal({ feedbackId: 31 }), mineSignal({ feedbackId: 32, status: 'withdrawn', requestText: 'Do you have parking?' })] }],
      items: [],
    }
    const { sent } = await mockClassifications(page, { queue: () => mine })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const section = page.getByRole('region', { name: 'My proposals' })
    await expect(section.getByRole('listitem').filter({ hasText: 'Do you have parking?' })).toContainText('Withdrawn', { timeout: 15000 })
    expect(sent.find((s) => s.path === 'feedback').query.status).toContain('withdrawn')
    const waiting = section.getByRole('listitem').filter({ hasText: 'How much is a whitening?' })
    await waiting.getByRole('button', { name: 'Withdraw' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'withdraw').length).toBe(1)
    expect(sent.find((s) => s.path === 'withdraw').id).toBe(31)
  })

  test('is shown on Panoramica even when the range has no call', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/dashboard*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalCalls: 0, avgCallDurationMs: 0, totalCallDurationMs: 0, uniqueCallers: 0 }) }))
    await mockInsights(page, { outcomes: { ...OUTCOMES, totalCalls: 0, lastCallAt: rome(2026, 3, 21) } })
    await mockClassifications(page, { queue: () => ({ total: 1, asOf: 1, groups: [{ category: 'opening_hours', businessId: BUSINESS_ID, calls: 1, items: 1, signals: [mineSignal({ feedbackId: 41 })] }], items: [] }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByRole('status').filter({ hasText: 'No calls in the last 30 days.' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('region', { name: 'My proposals' }).getByText('How much is a whitening?')).toBeVisible()
  })
})
