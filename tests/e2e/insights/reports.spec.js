// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')
const { mockInsights, BUSINESS_ID, rome, REPORT, historyRows, reportsPage, sortBy } = require('../fixtures/insights')

/**
 * U14 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the Report tab (its own address, the
 * schedule panel, the reports asked recently, the history paged and sorted on the server with true inclusive days in
 * the business's zone, its states and who asked) and the report's own page (its base, the calls left out, the themes,
 * the questions without an answer with "Add the answer", the suggestions, the quality gaps against the period before).
 * Selected by role and accessible name; StarChat answered as its code answers (tests/e2e/fixtures/insights.js).
 */
const history = (page) => page.getByRole('table', { name: 'All reports' })

test.describe('the Report tab (owner)', () => {
  test('has its own address among three tabs, and says how often reports come, the next one and its days', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const tabs = page.getByRole('navigation', { name: 'Statistics sections' })
    await expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page', { timeout: 15000 })
    await tabs.getByRole('link', { name: 'Reports' }).click()
    await expect(page).toHaveURL(/tab=reports/)
    await expect(tabs.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByText('Every 7 days MrCall prepares a report on your business\'s calls. Each report uses the business\'s credit.')).toBeVisible()
    // the next period ends on 28 October at midnight: its last day is the 27th
    await expect(page.getByText('The next one will arrive on Oct 28, 2026 and will cover Oct 21, 2026 to Oct 27, 2026.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open the business settings' })).toHaveAttribute('href', `/businessconfiguration?id=${BUSINESS_ID}&section=__NOTIFICATIONS__`)
  })

  test('pages the history on the server with its total, the same snapshot on every page', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText('1–10 of 25')).toBeVisible({ timeout: 15000 })
    expect(asked.reports[0].url).toContain('size=10')
    expect(asked.reports[0].url).not.toContain('asOf=')
    await page.getByRole('navigation', { name: 'Pages of All reports' }).getByRole('button', { name: 'Page 3' }).click()
    await expect(page.getByText('21–25 of 25')).toBeVisible()
    const last = asked.reports[asked.reports.length - 1].url
    expect(last).toContain('offset=20')
    expect(last).toContain('asOf=1761300000000')
    await expect(page.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page')
  })

  test('each period shows its true days in the business\'s zone, its type, version, state, calls and who asked', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const table = history(page)
    // 1 October 00:00 to 8 October 00:00 in Rome: 1 to 7 October, seven days, never "Oct 8"
    const requested = table.getByRole('row').filter({ hasText: 'Oct 1, 2026 – Oct 7, 2026' })
    await expect(requested).toBeVisible({ timeout: 15000 })
    await expect(requested.getByText('7 days')).toBeVisible()
    await expect(requested.getByText('On request')).toBeVisible()
    await expect(requested.locator('td').nth(2)).toHaveText('2')
    await expect(requested.getByText('120 of 130 managed')).toBeVisible()
    await expect(requested.getByText('You', { exact: true })).toBeVisible()
    await expect(table.getByText('Oct 8, 2026')).toHaveCount(0)
    // failed and postponed periods are listed with their state, never hidden
    for (const state of ['In preparation', 'New attempt tomorrow', 'Postponed', 'Not successful']) {
      await expect(table.getByText(state, { exact: true })).toBeVisible()
    }
    // a report from before 10 October says its calls without the managed ones
    await expect(table.getByText(/^\d+ analysed$/).first()).toBeVisible()
    // no id of an account anywhere
    await expect(table.getByText('test-uid-12345')).toHaveCount(0)
  })

  test('sorts on the server by a header whose aria-sort says the order, and filters by state with the filter undone where it is set', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const table = history(page)
    await expect(table.getByRole('columnheader', { name: 'Period' })).toHaveAttribute('aria-sort', 'descending', { timeout: 15000 })
    await sortBy(page, table, 'Calls')
    await expect(table.getByRole('columnheader', { name: 'Calls' })).toHaveAttribute('aria-sort', 'descending')
    expect(asked.reports[asked.reports.length - 1].url).toContain('sort=calls')
    await sortBy(page, table, 'Calls')
    await expect(table.getByRole('columnheader', { name: 'Calls' })).toHaveAttribute('aria-sort', 'ascending')
    expect(asked.reports[asked.reports.length - 1].url).toContain('direction=asc')
    await expect(table.getByRole('columnheader', { name: 'Period' })).toHaveAttribute('aria-sort', 'none')

    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Not successful' }).click()
    await expect(page.getByText('1–1 of 1')).toBeVisible()
    expect(asked.reports[asked.reports.length - 1].url).toContain('status=written_off')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByText('1–10 of 25')).toBeVisible()
    expect(asked.reports[asked.reports.length - 1].url).not.toContain('status=')
  })

  test('a business whose automatic report is held back for credit is told so, with the days the next one covers', async ({ authenticatedPage: page }) => {
    await mockInsights(page, {
      reports: (url) => reportsPage(url, { schedule: { cadenceDays: 30, nextAutomatic: { from: rome(2026, 9, 24), to: rome(2026, 10, 24), retry: false }, skippedForCredit: { since: rome(2026, 10, 20), reason: 'reserve' } } }),
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByRole('status').filter({ hasText: 'is postponed' })).toHaveText(
      'The report for Sep 24, 2026 – Oct 23, 2026 is postponed: there is not enough credit. After the next top-up we will prepare the report for the last 30 days; the days before stay in the statistics and can be analysed with a report on request.',
      { timeout: 15000 })
  })

  test('with reports off, it says so and still offers a report on request', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { reports: (url) => reportsPage(url, { rows: [], schedule: { cadenceDays: 0 } }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText(/Automatic reports are not active/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Request a report' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Prepare now' })).toHaveCount(0)
    await expect(page.getByText('No reports yet.')).toBeVisible()
  })

  test('an owner sees no delete, and no amount anywhere on the tab', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText('1–10 of 25')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /^Delete the report/ })).toHaveCount(0)
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/€|EUR|\d+\s*credits?\b|tokens?/i)
  })
})

test.describe('the report\'s own page', () => {
  test('an owner pages the history, opens a report, follows "Add the answer" and finds one new pair with the question', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('navigation', { name: 'Pages of All reports' }).getByRole('button', { name: 'Page 2' }).click()
    await expect(page.getByText('11–20 of 25')).toBeVisible({ timeout: 15000 })
    await page.getByRole('navigation', { name: 'Pages of All reports' }).getByRole('button', { name: 'Page 1' }).click()
    await history(page).getByRole('link', { name: 'Oct 1, 2026 – Oct 7, 2026' }).click()
    await expect(page).toHaveURL(new RegExp(`/analytics/report\\?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`))

    await expect(page.getByRole('heading', { name: 'Calls report, Oct 1, 2026 – Oct 7, 2026' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Based on 120 of the 130 calls the assistant managed in the period.')).toBeVisible()
    await expect(page.getByText('Left out: 4 calls in which the caller did not speak, 1 refused for lack of credit.')).toBeVisible()
    // the analytics count 125 calls of these days with insights now, the report read 120
    await expect(page.getByText('Since this report was written, 5 more calls of these days have been analysed: regenerate it to include them.')).toBeVisible()
    await expect(page.getByText('Parking', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Questions left unanswered' }).getByRole('link', { name: /Giulia Verdi/ })).toHaveAttribute('href', `/conversations?id=${BUSINESS_ID}&conversation=CON-1`)
    await expect(page.getByText('Shorten the greeting.')).toHaveCount(0)
    const quality = page.getByRole('table', { name: 'Questions without an answer, compared with the period before' })
    await expect(quality.getByRole('row', { name: /Missing information 6 9/ })).toBeVisible()

    // the knowledge base, its pairs a tuples variable of the __KNOWLEDGE_BASE__ collection
    const pairs = { name: 'KNOWLEDGE_BASE_ANSWER_INSTRUCTIONS', humanName: 'How to answer', class: 'variable', templateName: 'generic_onboarding',
      type: 'tuples', defaultValue: '[]', visible: true, mandatory: false, modifiable: true, admin: false, advanced: true, position: '1', dependsOn: [],
      valuesSelection: [{ type: 'text', title: 'Question' }, { type: 'text', title: 'Answer' }] }
    const business = { ...mockBusiness, variables: { ...mockBusiness.variables, KNOWLEDGE_BASE_ANSWER_INSTRUCTIONS: JSON.stringify([['Opening hours?', 'From 9 to 18']]) } }
    await page.route('**/crm/variables*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ collection: { id: '__KNOWLEDGE_BASE__', humanName: 'Questions & Answers', description: '' }, variables: [[pairs]] }]) }))
    await page.route('**/crm/business?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([business]),
      headers: { 'x-mrcall-role': 'owner', 'access-control-expose-headers': 'x-mrcall-role' } }))

    const add = page.getByRole('link', { name: 'Add the answer' }).first()
    await expect(add).toHaveAttribute('href', /section=__KNOWLEDGE_BASE__&draftQuestion=Is\+there\+parking|section=__KNOWLEDGE_BASE__&draftQuestion=Is%20there%20parking/)
    await add.click()
    await expect(page.locator('.tuple-item')).toHaveCount(2, { timeout: 20000 })
    await expect(page.locator('.tuple-item').first().locator('textarea').first()).toHaveValue('Is there parking near the restaurant?')
    await expect(page.locator('.tuple-item').first().locator('textarea').nth(1)).toHaveValue('')
    await expect(page.getByText('We added the question to your questions and answers: write the answer and save.')).toBeVisible()
    // the question left the address, so a reload does not add it twice
    await expect(page).not.toHaveURL(/draftQuestion/)
  })

  test('a link of before (?report=) opens the report\'s own page', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&report=${REPORT.periodStart}&requestId=job-req-1`)
    await expect(page).toHaveURL(/\/analytics\/report\?/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Calls report, Oct 1, 2026 – Oct 7, 2026' })).toBeVisible()
  })

  test('a report that is not there says so, with the way back', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { report: null })
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=1`)
    await expect(page.getByText('This report does not exist or is no longer available.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: 'Back to the reports' })).toHaveAttribute('href', `/analytics?id=${BUSINESS_ID}&tab=reports`)
  })
})

test.describe('the Report tab (admin)', () => {
  test('deletes one report with a reason, naming it by business, start, end and request id', async ({ adminPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await history(page).getByRole('button', { name: 'Delete the report Oct 1, 2026 – Oct 7, 2026' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Delete the report' })
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled()
    await dialog.getByLabel('Why it is deleted').fill('Test data')
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(dialog).toBeHidden()
    expect(asked.delete).toHaveLength(1)
    const url = new URL(asked.delete[0].url)
    expect(url.pathname).toMatch(new RegExp(`/reports/${REPORT.periodStart}$`))
    expect(Object.fromEntries(url.searchParams)).toEqual({ businessId: BUSINESS_ID, periodEnd: String(REPORT.periodEnd), requestId: 'job-req-1', reason: 'Test data' })
    // MrCall's own configuration suggestions are an admin's
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    await expect(page.getByText('Shorten the greeting.')).toBeVisible({ timeout: 15000 })
  })

  test('re-runs a written-off period as the automatic report', async ({ adminPage: page }) => {
    const rows = historyRows()
    const asked = await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const writtenOff = rows[4]
    await history(page).getByRole('button', { name: /^Try the report .* again$/ }).click({ timeout: 15000 })
    await expect(page.getByRole('dialog', { name: 'Try the automatic report again' })).toBeVisible()
    await expect.poll(() => asked.estimate.length).toBe(1)
    expect(asked.estimate[0].body).toMatchObject({ businessId: BUSINESS_ID, kind: 'report', from: writtenOff.periodStart, to: writtenOff.periodEnd, rerunAutomatic: true })
  })
})

test.describe('the history on a desktop screen', () => {
  // The U17b review found "Regenerate" cut at the table's right edge: on a desktop the admin's history, the widest,
  // fits its card with every action in view, and the page starts under its header, not half a screen down.
  test('fits its card, every action in view, at the top of the page', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 1800 })
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText('1–10 of 25')).toBeVisible({ timeout: 15000 })
    const [scroll, client] = await page.locator('.paged-table-scroll').evaluate((el) => [el.scrollWidth, el.clientWidth])
    expect(scroll).toBeLessThanOrEqual(client)
    await expect(history(page).getByRole('button', { name: 'Delete the report Oct 1, 2026 – Oct 7, 2026' })).toBeInViewport({ ratio: 1 })
    const tabs = await page.getByRole('navigation', { name: 'Statistics sections' }).boundingBox()
    expect(tabs.y).toBeLessThan(300)
  })
})
