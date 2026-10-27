// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockResellerUser } = require('../fixtures/mock-data')
const { mockInsights, BUSINESS_ID } = require('../fixtures/insights')
const { mockClassifications, judged } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 9 and its amendment item 3 (StarChat's brief, decision
 * 9 "Queues"; `GET insights/feedback` as a76ff0ffb answers it: groups by category and business, ordered by the calls each
 * moves, paged over groups): an admin's "Correzioni da rivedere" (proposals, orphans, "to review", fact reports), each
 * applied or rejected, one by one or for the selected, an orphan re-attached to a request of its call; and "Le mie
 * proposte" with their state, for an owner on its business's page and a reseller on its scope page.
 *
 * Seen failing, 2026-10-27, before FeedbackQueue.vue and MyProposals.vue existed: every case.
 */
const at = Date.UTC(2026, 9, 25, 9, 0)
const signal = (over) => ({
  businessId: 'biz-2', conversationId: 'CON-p1', callStart: at, subject: 'request', requestId: 301, field: 'category', signal: 'wrong_value',
  valueFrom: 'prices', valueTo: 'opening_hours', source: 'person', status: 'proposed', actorRole: 'owner', actorName: 'Mario Rossi',
  byMe: false, createdAt: at, requestText: 'How much is a whitening?', businessName: 'Studio Bianchi', ...over,
})
const QUEUE = {
  total: 2, asOf: 1761300000000,
  groups: [
    { category: 'opening_hours', businessId: 'biz-2', businessName: 'Studio Bianchi', calls: 3, items: 2,
      signals: [signal({ feedbackId: 11 }), signal({ feedbackId: 12, conversationId: 'CON-p2', requestId: 302, field: 'outcome', signal: 'wrong', valueFrom: 'met', valueTo: undefined, source: 'llm', actorRole: undefined, actorName: 'MrCall', requestText: 'Are you open on Saturday?' })] },
    { businessId: 'biz-3', businessName: 'Studio Verdi', calls: 1, items: 2,
      signals: [
        signal({ feedbackId: 13, businessId: 'biz-3', conversationId: 'CON-v1', subject: 'call', requestId: undefined, field: 'booked', signal: 'fact_wrong', valueFrom: 'true', valueTo: undefined, requestText: undefined, businessName: 'Studio Verdi' }),
        signal({ feedbackId: 14, businessId: 'biz-3', conversationId: 'CON-v2', requestId: 401, field: 'outcome', valueFrom: 'met', valueTo: 'taken', status: 'orphaned', requestText: undefined, businessName: 'Studio Verdi' }),
      ] },
  ],
}

const queueSection = (page) => page.getByRole('region', { name: 'Corrections to review' })

test.describe('the queues of corrections', () => {
  test('an admin reviews the corrections grouped by category and business, and applies or rejects each', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    const { sent } = await mockClassifications(page, { role: 'admin', queue: (url) => (url.searchParams.get('mine') ? { total: 0, asOf: 1, groups: [], items: [] } : QUEUE) })
    await page.goto('/analytics-admin')
    const section = queueSection(page)
    await expect(section.getByRole('heading', { name: 'Opening hours · Studio Bianchi · 3 calls' })).toBeVisible({ timeout: 15000 })
    const asked = sent.find((s) => s.path === 'feedback' && s.method === 'GET' && !s.query.mine)
    expect(asked.query).toMatchObject({ from: '0', size: '10' })
    expect(asked.query.status).toBeUndefined()
    const first = section.getByRole('listitem').filter({ hasText: 'How much is a whitening?' })
    await expect(first).toContainText('Category: Prices and quotes → Opening hours')
    await expect(first).toContainText('Mario Rossi')
    await first.getByRole('button', { name: 'Apply' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'decide').length).toBe(1)
    expect(sent.find((s) => s.path === 'decide')).toMatchObject({ id: 11, move: 'apply' })
    const second = section.getByRole('listitem').filter({ hasText: 'Are you open on Saturday?' })
    await expect(second).toContainText('Request outcome: Met by the assistant is wrong, to review')
    await expect(second).toContainText('MrCall')
    await second.getByRole('button', { name: 'Reject' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'decide').length).toBe(2)
    expect(sent.filter((s) => s.path === 'decide')[1]).toMatchObject({ id: 12, move: 'reject' })
    // a fact reported wrong is closed as handled
    const fact = section.getByRole('listitem').filter({ hasText: 'Booking reported wrong' })
    await fact.getByRole('button', { name: 'Mark as handled' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'decide').length).toBe(3)
    expect(sent.filter((s) => s.path === 'decide')[2]).toMatchObject({ id: 13, move: 'apply' })
    // each signal links to its call
    await expect(first.getByRole('link', { name: 'Open the call' })).toHaveAttribute('href', '/conversations?id=biz-2&conversation=CON-p1')
  })

  test('an admin applies the selected corrections, one call each, and reads what happened', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    const { sent } = await mockClassifications(page, { role: 'admin', queue: (url) => (url.searchParams.get('mine') ? { total: 0, asOf: 1, groups: [], items: [] } : QUEUE) })
    await page.goto('/analytics-admin')
    const section = queueSection(page)
    await expect(section.getByRole('heading', { name: 'Opening hours · Studio Bianchi · 3 calls' })).toBeVisible({ timeout: 15000 })
    await section.getByRole('checkbox', { name: 'Select: How much is a whitening?' }).check()
    await section.getByRole('checkbox', { name: 'Select: Are you open on Saturday?' }).check()
    await section.getByRole('button', { name: 'Apply the selected (2)' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'decide').length).toBe(2)
    expect(sent.filter((s) => s.path === 'decide').map((s) => [s.id, s.move])).toEqual([[11, 'apply'], [12, 'apply']])
    await expect(section.getByText('2 applied.')).toBeVisible()
  })

  test('an orphaned correction is re-attached to a request of its call', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    const { sent } = await mockClassifications(page, {
      role: 'admin',
      queue: (url) => (url.searchParams.get('mine') ? { total: 0, asOf: 1, groups: [], items: [] } : QUEUE),
      calls: { 'CON-v2': judged({ conversationId: 'CON-v2', businessId: 'biz-3' }) },
    })
    await page.goto('/analytics-admin')
    const orphan = queueSection(page).getByRole('listitem').filter({ hasText: 'Request no longer found' })
    await expect(orphan).toBeVisible({ timeout: 15000 })
    await orphan.getByRole('button', { name: 'Re-attach' }).click()
    await orphan.getByLabel('Request of the call').selectOption({ label: 'Asks how much a whitening costs' })
    await orphan.getByRole('button', { name: 'Re-attach here' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'decide').length).toBe(1)
    expect(sent.find((s) => s.path === 'decide')).toMatchObject({ id: 14, move: 'apply', body: { requestId: 102 } })
  })

  test('an owner reads its own proposals and their state on its business\'s page', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    const mine = {
      total: 1, asOf: 1,
      groups: [{ category: 'opening_hours', businessId: BUSINESS_ID, businessName: 'Test Restaurant', calls: 2, items: 2,
        signals: [
          signal({ feedbackId: 21, businessId: BUSINESS_ID, byMe: true }),
          signal({ feedbackId: 22, businessId: BUSINESS_ID, byMe: true, status: 'rejected', requestText: 'Do you have parking?' }),
          // the owner's own correction of an outcome, applied at once: not a proposal (P10 review, finding 3)
          signal({ feedbackId: 23, businessId: BUSINESS_ID, byMe: true, field: 'outcome', valueFrom: 'met', valueTo: 'taken', status: 'applied', requestText: 'Is the parking free?' }),
        ] }],
      items: [],
    }
    const { sent } = await mockClassifications(page, { queue: () => mine })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const section = page.getByRole('region', { name: 'My proposals' })
    await expect(section.getByRole('listitem').filter({ hasText: 'How much is a whitening?' })).toContainText('Proposal sent', { timeout: 15000 })
    await expect(section.getByRole('listitem').filter({ hasText: 'Do you have parking?' })).toContainText('Rejected')
    await expect(section.getByText('Is the parking free?')).toHaveCount(0)
    expect(sent.find((s) => s.path === 'feedback').query).toMatchObject({ mine: 'true', businessId: BUSINESS_ID, status: 'proposed,applied,rejected,closed' })
    // no decisions for an owner
    await expect(section.getByRole('button', { name: 'Apply' })).toHaveCount(0)
  })

  test('a reseller reads its proposals on its scope page; without the route the section is absent', async ({ page }) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    await mockInsights(page, { role: 'reseller' })
    await mockClassifications(page, { role: 'reseller', queue: () => ({ total: 0, asOf: 1, groups: [], items: [] }) })
    await page.goto('/analytics')
    await expect(page.getByRole('region', { name: 'My proposals' }).getByText('No proposal yet.')).toBeVisible({ timeout: 15000 })
    await page.route('**/customer/insights/feedback*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '"Not found"' }))
    await page.reload()
    await expect(page.getByRole('heading', { name: 'How the calls went' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('region', { name: 'My proposals' })).toHaveCount(0)
  })
})
