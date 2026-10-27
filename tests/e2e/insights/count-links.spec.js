// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockResellerUser } = require('../fixtures/mock-data')
const { mockInsights, BUSINESS_ID, REPORT } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

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
 */
const TOPICS = { period: { from: 0, to: 0 }, previousPeriod: { from: 0, to: 0 }, callsWithTopics: 90, previousCallsWithTopics: 80, topics: [{ topic: 'Bookings', calls: 40, previousCalls: 30 }] }
const QUALITY = {
  period: { from: 0, to: 0 }, extractions: { ok: 100 }, callsWithChecks: 100, checks: { caller_repeated: 7 },
  callsWithUnansweredRecorded: 100, callsWithUnanswered: 9, gaps: { missing_info: 6, needs_integration: 3 }, callsWithSkillErrors: 0,
}

function params (href) {
  const q = new URL(href, 'http://x').searchParams
  const out = {}
  for (const [k, v] of q.entries()) out[k] = out[k] === undefined ? v : [].concat(out[k], v)
  return out
}

async function linkParams (page, name) {
  const link = page.getByRole('link', { name })
  await expect(link).toBeVisible({ timeout: 15000 })
  expect(new URL(await link.getAttribute('href'), 'http://x').pathname).toBe('/conversations')
  return params(await link.getAttribute('href'))
}

test.describe('every count opens its calls', () => {
  test('on a business\'s Panoramica, each count links to exactly its calls in the page\'s window', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { quality: QUALITY })
    await page.route('**/customer/analytics/topics*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TOPICS) }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const resolved = await linkParams(page, 'Open the 50 calls: Resolved in the call')
    expect(resolved).toMatchObject({ id: BUSINESS_ID, counted: 'true', outcomeLine: 'resolved' })
    expect(Number(resolved.from)).toBeGreaterThan(0)
    expect(Number(resolved.to)).toBeGreaterThan(Number(resolved.from))
    expect(await linkParams(page, 'Open the 20 calls: Request passed to the business with a complete message')).toMatchObject({ outcomeLine: 'forwarded_complete' })
    expect(await linkParams(page, 'Open the 7 calls: Spoke but never said what they wanted')).toMatchObject({ resolution: 'caller_left' })
    expect(await linkParams(page, 'Open the 10 calls: Incomplete message')).toMatchObject({ message: 'incomplete' })
    expect(await linkParams(page, 'Open the 30 calls: Booking')).toMatchObject({ booked: 'true' })
    expect(await linkParams(page, 'Open the 10 calls: Transfer')).toMatchObject({ transferred: 'true' })
    expect(await linkParams(page, 'Open the 12 calls: The caller hung up without speaking')).toMatchObject({ noConversation: 'caller_silent' })
    expect(await linkParams(page, 'Open the 40 calls: Bookings')).toMatchObject({ topic: 'Bookings' })
    expect(await linkParams(page, 'Open the 6 calls: Missing information')).toMatchObject({ gap: 'missing_info' })
    expect(await linkParams(page, 'Open the 7 calls: The caller had to repeat themselves')).toMatchObject({ check: 'caller_repeated' })
    expect(await linkParams(page, 'Open the 9 calls: Unanswered questions')).toMatchObject({ unanswered: 'true' })
    // the link's list reads the same filter back: following it sends it
    const searches = []
    await page.route('**/customer/conversation/search*', (route) => {
      searches.push(route.request().postDataJSON())
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalHits: 0, hitsCount: 0, maxScore: 0, hits: [] }) })
    })
    await page.getByRole('link', { name: 'Open the 6 calls: Missing information' }).click()
    await expect.poll(() => searches.filter((s) => !s.id).length).toBeGreaterThan(0)
    expect(searches.filter((s) => !s.id).pop()).toMatchObject({ businessId: BUSINESS_ID, gap: 'missing_info', counted: true, timestampGte: Number(resolved.from), timestampLte: Number(resolved.to) })
  })

  test('a page over several businesses keeps its counts as numbers', async ({ page }) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    await mockInsights(page, { quality: QUALITY, role: 'reseller' })
    await page.goto('/analytics')
    await expect(page.locator('.outcome-line').filter({ hasText: 'Resolved in the call' })).toContainText('50', { timeout: 15000 })
    await expect(page.getByRole('link', { name: /^Open the \d+ calls?:/ })).toHaveCount(0)
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
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    const window = { from: String(REPORT.periodStart), to: String(REPORT.periodEnd - 1) }
    expect(await linkParams(page, 'Open the 50 calls: Resolved in the call')).toMatchObject({ ...window, counted: 'true', outcomeLine: 'resolved' })
    expect(await linkParams(page, 'Open the 31 calls: Booking')).toMatchObject({ ...window, booked: 'true' })
    expect(await linkParams(page, 'Open the 70 calls: Bookings')).toMatchObject({ ...window, topicLabel: ['booking', 'table for four'] })
    expect(await linkParams(page, 'Open the calls: Missing information')).toMatchObject({ ...window, gap: 'missing_info' })
    // the calls to call back and a gap's examples are links for a reseller too
    await expect(page.getByRole('region', { name: 'Calls to call back' }).getByRole('link')).toHaveCount(2)
    await expect(page.getByText('1 request of this report was corrected after it was written.')).toBeVisible()
    await expect(page.locator('.report-gap').filter({ hasText: 'Is there parking near the restaurant?' }).getByText('Corrected after the report')).toBeVisible()
    await expect(page.locator('.report-gap').filter({ hasText: 'Can I book online?' }).getByText('Corrected after the report')).toHaveCount(0)
  })
})
