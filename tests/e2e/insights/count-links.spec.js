// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockResellerUser } = require('../fixtures/mock-data')
const { mockInsights, BUSINESS_ID, REPORT } = require('../fixtures/insights')
const { mockClassifications, mockConversations } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 6 and 8 (StarChat's brief, decision 9: "every count
 * opens its calls", for every role that sees the count): on a business's Panoramica and in the report detail each
 * count is a link to the conversations list filtered to the same calls in the same window (`Classifications.countLink`,
 * the one filter table). On a page over several businesses the counts stay numbers (the conversation search lists one
 * business's calls: the brief's gap table). The report detail's calls open for every role, and the requests corrected
 * after it was written are said.
 *
 * Seen failing, 2026-10-27, before the links existed: every case but "a page over several businesses", which passed on
 * the old code by construction and was then seen failing by perturbation (the scope page given the link builder).
 *
 * Since brief docs/briefs/2026-10-31-analytics-ux.md (O2) a count on an analytics page opens its calls over the page,
 * in the counted-calls panel, instead of linking away: these cases assert the search the panel sends (the same body the
 * conversations list sends for the count's link, pinned by count-list-body.spec.js), its leftOut query, and that the
 * address does not change. Seen failing, 2026-11-01, on the link-only CountLink (no button named for the count).
 */
const TOPICS = { period: { from: 0, to: 0 }, previousPeriod: { from: 0, to: 0 }, callsWithTopics: 90, previousCallsWithTopics: 80, topics: [{ topic: 'Bookings', calls: 40, previousCalls: 30 }] }
const QUALITY = {
  period: { from: 0, to: 0 }, extractions: { ok: 100 }, callsWithChecks: 100, checks: { caller_repeated: 7 },
  callsWithUnansweredRecorded: 100, callsWithUnanswered: 9, gaps: { missing_info: 6, needs_integration: 3 }, callsWithSkillErrors: 0,
}

// Opens a count by its accessible name and returns the search its panel sent: the body, and `__leftOut` when the query
// asked for it (mockConversations records it beside the body). The panel is closed again and the address unchanged.
async function panelSearch (page, searches, name, within = page) {
  const before = page.url()
  const count = within.getByRole('button', { name, exact: true })
  await expect(count).toBeVisible({ timeout: 15000 })
  const n = searches.filter((s) => !s.id).length
  await count.click()
  const panel = page.locator('.counted-calls-panel')
  await expect(panel).toBeVisible()
  await expect.poll(() => searches.filter((s) => !s.id).length).toBeGreaterThan(n)
  const body = searches.filter((s) => !s.id).pop()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  expect(page.url()).toBe(before)
  return body
}

test.describe('every count opens its calls', () => {
  test('on a business\'s Panoramica, each count opens exactly its calls in the page\'s window, over the page', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { quality: QUALITY })
    await page.route('**/customer/analytics/topics*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TOPICS) }))
    const searches = await mockConversations(page, [])
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const resolved = await panelSearch(page, searches, 'Open the 50 calls: Resolved in the call')
    expect(resolved).toMatchObject({ businessId: BUSINESS_ID, counted: true, outcomeLine: 'resolved' })
    expect(resolved.timestampGte).toBeGreaterThan(0)
    expect(resolved.timestampLte).toBeGreaterThan(resolved.timestampGte)
    expect(resolved).not.toHaveProperty('archived')
    const inWindow = { businessId: BUSINESS_ID, counted: true, timestampGte: resolved.timestampGte, timestampLte: resolved.timestampLte }
    expect(await panelSearch(page, searches, 'Open the 20 calls: Request passed to the business with a complete message')).toMatchObject({ ...inWindow, outcomeLine: 'forwarded_complete' })
    expect(await panelSearch(page, searches, 'Open the 7 calls: Spoke but never said what they wanted')).toMatchObject({ ...inWindow, resolution: 'caller_left' })
    expect(await panelSearch(page, searches, 'Open the 10 calls: Incomplete message')).toMatchObject({ ...inWindow, message: 'incomplete' })
    expect(await panelSearch(page, searches, 'Open the 30 calls: Booking')).toMatchObject({ ...inWindow, booked: true })
    expect(await panelSearch(page, searches, 'Open the 10 calls: Transfer')).toMatchObject({ ...inWindow, transferred: true })
    expect(await panelSearch(page, searches, 'Open the 12 calls: The caller hung up without speaking')).toMatchObject({ ...inWindow, noConversation: 'caller_silent' })
    expect(await panelSearch(page, searches, 'Open the 40 calls: Bookings')).toMatchObject({ ...inWindow, topic: 'Bookings' })
    expect(await panelSearch(page, searches, 'Open the 6 calls: Missing information')).toMatchObject({ ...inWindow, gap: 'missing_info' })
    expect(await panelSearch(page, searches, 'Open the 7 calls: The caller had to repeat themselves')).toMatchObject({ ...inWindow, check: 'caller_repeated' })
    expect(await panelSearch(page, searches, 'Open the 9 calls: Unanswered questions')).toMatchObject({ ...inWindow, hasUnanswered: true })
    // the panel's own link goes to the same list in the conversations page, which sends the same filter
    await page.getByRole('button', { name: 'Open the 6 calls: Missing information', exact: true }).click()
    await page.locator('.counted-calls-panel').getByRole('link', { name: 'Open in Conversations' }).click()
    await expect(page).toHaveURL(/\/conversations\?/)
    await expect.poll(() => searches.filter((s) => !s.id).pop()).toMatchObject({ ...inWindow, gap: 'missing_info' })
  })

  test('a page over several businesses keeps its counts as numbers', async ({ page }) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    await mockInsights(page, { quality: QUALITY, role: 'reseller' })
    await page.goto('/analytics')
    await expect(page.locator('.outcome-line').filter({ hasText: 'Resolved in the call' })).toContainText('50', { timeout: 15000 })
    await expect(page.getByRole('link', { name: /^Open the \d+ calls?:/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Open the \d+ calls?:/ })).toHaveCount(0)
  })

  test('in the report detail, its counts open their calls over the report\'s days, for every role, and corrections since are said', async ({ page }) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    const report = {
      ...REPORT,
      correctedAfterReport: [901],
      content: { ...REPORT.content, gaps: REPORT.content.gaps.map((g, i) => (i === 0 ? { ...g, requests: [901, 902] } : g)) },
    }
    await mockInsights(page, { report, role: 'reseller' })
    await mockClassifications(page, { role: 'reseller' })
    const searches = await mockConversations(page, [])
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    // a report's counts are frozen: their lists ask how many calls they leave out for the reader (StarChat dc4d7f7f6)
    const window = { businessId: BUSINESS_ID, counted: true, timestampGte: REPORT.periodStart, timestampLte: REPORT.periodEnd - 1, __leftOut: true }
    expect(await panelSearch(page, searches, 'Open the 50 calls: Resolved in the call')).toMatchObject({ ...window, outcomeLine: 'resolved' })
    expect(await panelSearch(page, searches, 'Open the 31 calls: Booking')).toMatchObject({ ...window, booked: true })
    expect(await panelSearch(page, searches, 'Open the 70 calls: Bookings')).toMatchObject({ ...window, topicLabels: ['booking', 'table for four'] })
    // a gap group's count, the analytics' over the report's days, names how many calls it opens
    const group = page.locator('.report-gap-group').filter({ hasText: 'Missing information' })
    expect(await panelSearch(page, searches, 'Open the 6 calls: Missing information', group)).toMatchObject({ ...window, gap: 'missing_info' })
    // and so does the quality table's count of the same reason, the same list
    const quality = page.getByRole('region', { name: 'Questions without an answer, compared with the period before' })
    expect(await panelSearch(page, searches, 'Open the 6 calls: Missing information', quality)).toMatchObject({ ...window, gap: 'missing_info' })
    // the calls to call back and a gap's examples open for a reseller too, over the page
    await expect(page.getByRole('region', { name: 'Calls to call back' }).getByRole('button')).toHaveCount(2)
    await expect(page.getByText('1 request of this report was corrected after it was written.')).toBeVisible()
    await expect(page.locator('.report-gap').filter({ hasText: 'Is there parking near the restaurant?' }).getByText('Corrected after the report')).toBeVisible()
    await expect(page.locator('.report-gap').filter({ hasText: 'Can I book online?' }).getByText('Corrected after the report')).toHaveCount(0)
  })
})
