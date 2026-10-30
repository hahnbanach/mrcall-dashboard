// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, rome, REPORT, REPORT_ESTIMATE, estimateJob, job, historyRows, reportsPage, SCHEDULE, JOBS_U19, jobsPage } = require('../fixtures/insights')
const { mockConversations, conversation } = require('../fixtures/classifications')

/**
 * U19r6 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the report screens as the brief's
 * amendment of 2026-10-30 repairs them (what the U19c attack found on v2.2.39-test with StarChat 9.34.123). B1, a
 * report requested over an analysed period reaches its confirmation and says what it reads (rule 1); the older
 * report's caption (rule 2); the Report tab reads nothing of Panoramica (rule 6); an empty cycle's row and a next
 * period longer than the cadence (rule 9); a report stored with UTC bounds labelled by its real span (m8); Processing
 * counting calls as Panoramica does (m9); each gap group's count (m4); "Add the answer" from a caller's question (m5);
 * "My proposals" whatever the range (m10).
 *
 * Seen failing on c0a4e35 (the attacked head), each case, before its repair; the fixtures already carried the amended
 * shapes (a report estimate's `calls` 0 with `finalised` and `analysed`, a report at content version 5).
 */
async function openRequest (page) {
  await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
  await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
  const dialog = page.getByRole('dialog', { name: 'Request a report' })
  await expect(dialog).toBeVisible()
  return dialog
}

const reportUrl = (report) => `/analytics/report?id=${BUSINESS_ID}&start=${report.periodStart}&requestId=${report.requestId}`

test.describe('B1: a report over analysed calls is confirmed, saying what it reads', () => {
  test('StarChat\'s report estimate (calls 0, one request) reaches the confirmation with the calls it reads', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, { job: (id) => (id === 'est-1' ? estimateJob({ estimate: { ...REPORT_ESTIMATE, finalised: 253, analysed: 253 } }) : job({ jobId: id, status: 'done', phase: 'finished', counts: { requests: 1 } })) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Last 7 days' }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeVisible({ timeout: 15000 })
    await expect(dialog.getByText('253 analysed calls', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/not analysed yet/)).toHaveCount(0)
    await expect(dialog.getByText('No calls in this period.')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect.poll(() => asked.create.length).toBe(1)
  })

  test('the finalised calls not analysed yet are said as left out', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { job: () => estimateJob({ estimate: { ...REPORT_ESTIMATE, finalised: 260, analysed: 253 } }) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText('253 analysed calls', { exact: true })).toBeVisible({ timeout: 15000 })
    // `finalised` also counts calls the assistant did not manage (no conversation), which are never analysed: the
    // words do not promise they will be (StarChat review of U19r6, m5)
    await expect(dialog.getByText('7 calls of the period are not among them: calls without a conversation, or not analysed.', { exact: true })).toBeVisible()
  })
})

test.describe('rule 2: the caption of the calls a report lists', () => {
  test('a report of content version 4 or lower names its list "Calls to review", with what it holds', async ({ authenticatedPage: page }) => {
    const older = { ...REPORT, content: { ...REPORT.content, version: 4 } }
    await mockInsights(page, { report: older })
    await page.goto(reportUrl(older))
    const region = page.getByRole('region', { name: 'Calls to review' })
    await expect(region).toBeVisible({ timeout: 15000 })
    await expect(region).toContainText('Unresolved, with questions left unanswered or checks that fired.')
    await expect(page.getByRole('region', { name: 'Calls to call back' })).toHaveCount(0)
  })

  test('a report of content version 5 keeps "Calls to call back"', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(reportUrl(REPORT))
    await expect(page.getByRole('region', { name: 'Calls to call back' })).toBeVisible({ timeout: 15000 })
  })
})

test.describe('m4, m5: the questions left without an answer', () => {
  test('each gap group\'s link carries its count', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(reportUrl(REPORT))
    const gaps = page.getByRole('region', { name: 'Questions left unanswered' })
    await expect(gaps.getByRole('link', { name: /Open the calls: Missing information/ })).toHaveText('6 calls', { timeout: 15000 })
    await expect(gaps.getByRole('link', { name: /Open the calls: Needs an integration/ })).toHaveText('3 calls')
  })

  test('"Add the answer" is not offered on a gap that needs an integration', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(reportUrl(REPORT))
    const gaps = page.getByRole('region', { name: 'Questions left unanswered' })
    await expect(gaps.getByText('Can I book online?')).toBeVisible({ timeout: 15000 })
    // missing_info offers it; needs_integration (the integration is the action) and clinical_advice do not
    await expect(gaps.getByRole('button', { name: 'Add the answer' })).toHaveCount(1)
  })

  test('"Add the answer" pre-fills a caller\'s question of the gap\'s example call, not the gap\'s summary', async ({ authenticatedPage: page }) => {
    await page.addInitScript(() => {
      const push = history.pushState
      // @ts-ignore
      window.__pushed = []
      history.pushState = function (...args) {
        // @ts-ignore
        window.__pushed.push(String(args[2]))
        return push.apply(this, args)
      }
    })
    await mockInsights(page)
    const searches = await mockConversations(page, [conversation({ id: 'CON-1', details: { summary: 'Asked about parking.', unanswered: [{ question: 'Where can I park near you?', gap: 'missing_info' }], checks: {}, requests: [] } })])
    await page.goto(reportUrl(REPORT))
    const gaps = page.getByRole('region', { name: 'Questions left unanswered' })
    await gaps.getByRole('button', { name: 'Add the answer' }).click({ timeout: 15000 })
    const drafted = () => page.evaluate(() => /** @type {any} */ (window).__pushed
      .map((u) => new URL(u, location.origin)).filter((u) => u.pathname === '/businessconfiguration').map((u) => u.searchParams.get('draftQuestion')))
    await expect.poll(drafted).toEqual(['Where can I park near you?'])
    // the owner's own call, read by id: no opening is recorded for an owner
    expect(searches.some((b) => b.id === 'CON-1')).toBe(true)
  })
})

test.describe('rule 9, m8: the history says every cycle, by its real days', () => {
  test('a report stored with UTC bounds is labelled with its real start and end, never a day it does not cover', async ({ authenticatedPage: page }) => {
    const rows = [{ periodStart: Date.UTC(2026, 2, 19), periodEnd: Date.UTC(2026, 2, 21), status: 'done', type: 'requested', revision: 0, days: 2, calls: 4, failures: 0, requestId: 'legacy-1', requestedBy: 'admin-uid-12345', requesterRole: 'admin', createdAt: Date.UTC(2026, 2, 22) }]
    await mockInsights(page, { reports: (url) => reportsPage(url, { rows, schedule: SCHEDULE }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const row = page.getByRole('table', { name: 'All reports' }).getByRole('row').filter({ hasText: 'Mar 19, 2026' })
    // Chromium writes "Mar 19, 2026, 1:00 AM", WebKit "Mar 19, 2026 at 1:00 AM"
    await expect(row).toContainText(/Mar 19, 2026(,| at) 1:00 AM – Mar 21, 2026(,| at) 1:00 AM/, { timeout: 15000 })
    await expect(row).toContainText('2 days')
  })
})

test.describe('rule 6: a tab reads only what it shows', () => {
  for (const tab of ['reports', 'jobs']) {
    test(`the ${tab} tab fires none of Panoramica's reads`, async ({ authenticatedPage: page }) => {
      const asked = await mockInsights(page)
      const analytics = []
      page.on('request', (r) => { if (/\/customer\/analytics\//.test(r.url())) analytics.push(r.url()) })
      await page.goto(`/analytics?id=${BUSINESS_ID}&tab=${tab}`)
      await expect(page.getByRole('table', { name: tab === 'reports' ? 'All reports' : 'Processing' })).toBeVisible({ timeout: 15000 })
      await page.waitForTimeout(500)
      expect(analytics).toEqual([])
      expect(asked.outcomes).toHaveLength(0)
      // back on Panoramica, its reads are made
      await page.getByRole('navigation', { name: 'Statistics sections' }).getByRole('link', { name: 'Overview' }).click()
      await expect.poll(() => asked.outcomes.length).toBeGreaterThan(0)
    })
  }
})

test.describe('m9: Processing counts calls as Panoramica does', () => {
  test('a recompute says the calls analysed, and the unfinished sessions apart, outside its progress', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { jobs: (url) => jobsPage(url, JOBS_U19.filter((j) => j.kind !== 'facts')) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    const overland = page.getByRole('table', { name: 'Processing' }).getByRole('row').filter({ hasText: '4 calls analysed' })
    await expect(overland).toContainText('4 calls analysed; 10 unfinished sessions left out', { timeout: 15000 })
    await expect(overland).toContainText('4 of 4 calls')
    await expect(overland).not.toContainText('14 of 14')
  })
})
