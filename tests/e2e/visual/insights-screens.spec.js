// @ts-check
/**
 * The screens of StarChat's docs/briefs/2026-10-24-insights-reports-ux.md, every state, as PNGs for the adversarial
 * review of the user experience (U19 of its plan): owner, reseller and admin, at a desktop and a phone width. Not a
 * visual regression: each test asserts the state is on screen, then saves it.
 *
 *   UX_SCREENS_DIR=/some/dir npx playwright test tests/e2e/visual/insights-screens.spec.js --project=desktop
 *
 * Without UX_SCREENS_DIR the files go to tests/screenshots/insights (ignored by git). The pages scroll inside
 * `#app-central-content`, so each shot is taken in a viewport tall enough to hold the page.
 */
const path = require('path')
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockUser, mockBusiness } = require('../fixtures/mock-data')
const ins = require('../fixtures/insights')

const DIR = process.env.UX_SCREENS_DIR || path.join('tests', 'screenshots', 'insights')
const B = ins.BUSINESS_ID
const SIZES = { desktop: { width: 1440, height: 4200 }, mobile: { width: 375, height: 5200 } }

// A dialog is centred in the viewport, so it is shot at a real screen's height.
const SCREEN = { desktop: { width: 1440, height: 900 }, mobile: { width: 375, height: 812 } }

async function shoot (page, name, size = 'desktop') {
  await page.setViewportSize((name.includes('dialog') ? SCREEN : SIZES)[size])
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DIR, `${name}-${size}.png`) })
}

async function both (page, name, ready) {
  for (const size of ['desktop', 'mobile']) {
    await page.setViewportSize((name.includes('dialog') ? SCREEN : SIZES)[size])
    if (ready) await ready()
    await shoot(page, name, size)
  }
}

const held = () => new Promise(() => {})

test.describe('insights screens: owner', () => {
  test('overview: coverage banner, silent callers, four outcome lines', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page)
    await page.goto(`/analytics?id=${B}`)
    await expect(page.getByText(/do not have the automatic analysis yet/)).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-overview')
  })

  test('report tab: schedule, recent, history page 1, sorted, filtered, filtered empty', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page)
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByText('1–10 of 25')).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-reports')
    await page.getByRole('navigation', { name: 'Pages of All reports' }).getByRole('button', { name: 'Page 3' }).click()
    await expect(page.getByText('21–25 of 25')).toBeVisible()
    await shoot(page, 'owner-reports-page3')
    await page.getByRole('table', { name: 'All reports' }).getByRole('button', { name: 'Calls' }).click()
    await shoot(page, 'owner-reports-sorted-calls')
    await page.getByRole('combobox', { name: 'Type' }).click()
    await page.getByRole('option', { name: 'On request' }).click()
    await expect(page.getByText('1–1 of 1')).toBeVisible()
    await shoot(page, 'owner-reports-filtered')
  })

  test('report tab: no report yet with reports off; filtered to nothing', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page, { reports: (url) => (new URL(url).searchParams.get('status') ? ins.reportsPage(url, { rows: [] }) : ins.reportsPage(url, { rows: [], schedule: { cadenceDays: 0 } })) })
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByText('No reports yet.')).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-reports-off-empty')
  })

  test('report tab: skipped for credit; a period being retried', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page, { reports: (url) => ins.reportsPage(url, { schedule: { cadenceDays: 30, nextAutomatic: { from: ins.rome(2026, 9, 24), to: ins.rome(2026, 10, 24), retry: false }, skippedForCredit: { since: ins.rome(2026, 10, 20), reason: 'reserve' } } }) })
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByText(/is postponed/)).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-reports-skipped')
  })

  test('report tab: loading and error', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page)
    await page.route('**/customer/insights/reports*', async () => { await held() })
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1500)
    await shoot(page, 'owner-reports-loading')
    await page.unroute('**/customer/insights/reports*')
    await page.route('**/customer/insights/reports*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByText('This section could not be loaded.').first()).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-reports-error')
    await page.unroute('**/customer/insights/reports*')
    await page.route('**/customer/insights/reports*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByText('Not available yet.').first()).toBeVisible({ timeout: 15000 })
    await shoot(page, 'owner-reports-unavailable')
  })

  test('report detail', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page)
    await page.goto(`/analytics/report?id=${B}&start=${ins.REPORT.periodStart}&requestId=job-req-1`)
    await expect(page.getByText(/Based on 120 of the 130 calls/)).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-report-detail')
  })

  test('request dialog: period, overlap, preparing, confirm, running, done', async ({ authenticatedPage: page }) => {
    let polls = 0
    await ins.mockInsights(page, {
      overlap: { cycle: { from: ins.rome(2026, 10, 21), to: ins.rome(2026, 10, 24) }, past: [{ periodStart: ins.rome(2026, 10, 14), periodEnd: ins.rome(2026, 10, 21), type: 'automatic' }] },
      job: (id) => {
        if (id === 'est-1') return ins.estimateJob()
        polls += 1
        return polls < 400 ? ins.job({ jobId: 'job-new', status: 'running', phase: 'working' }) : ins.job({ jobId: 'job-new', status: 'done', phase: 'finished' })
      },
    })
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Request a report' })
    await both(page, 'dialog-1-period')
    await dialog.getByRole('button', { name: 'Choose the days' }).click()
    await shoot(page, 'dialog-1b-custom-days')
    await dialog.getByRole('button', { name: 'Last 7 days' }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText(/will be read again by the next automatic report/)).toBeVisible()
    await both(page, 'dialog-2-overlap')
    await dialog.getByLabel('I understand: read them again anyway').check()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeVisible({ timeout: 15000 })
    await both(page, 'dialog-3-confirm')
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(dialog.getByText('In preparation…')).toBeVisible({ timeout: 15000 })
    await both(page, 'dialog-4-running')
  })

  test('request dialog: preparing (the hidden estimate)', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page, { job: () => ins.estimateJob({ status: 'running', phase: 'estimating', estimate: undefined }) })
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('We are preparing the request…')).toBeVisible()
    await both(page, 'dialog-2b-preparing')
  })

  test('request dialog: done with the report to open', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page, { createJob: () => ({ status: 202, body: ins.job({ jobId: 'job-new', status: 'done', phase: 'finished', counts: { requests: 1 }, result: { reports: [{ periodStart: ins.REPORT.periodStart, periodEnd: ins.REPORT.periodEnd, requestId: 'job-req-1' }] } }) }) })
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    await expect(dialog.getByText('The report is ready.')).toBeVisible()
    await both(page, 'dialog-5-done')
  })

  const refusals = [
    ['no-credit', { job: () => ins.estimateJob({ estimate: { fits: false, reason: 'no_credit', calls: 900 } }) }, 'Not enough credit for this processing.'],
    ['reserve-no-topup', { job: () => ins.estimateJob({ estimate: { fits: false, reason: 'reserve', calls: 9 } }) }, 'Turn on automatic top-up'],
    ['reserve-topup-on', { job: () => ins.estimateJob({ estimate: { fits: false, reason: 'reserve', calls: 9 } }), topUpStatus: { status: 'ACTIVE' } }, 'Top up'],
    ['job-open', { createJob: () => ({ status: 409, body: { code: 'job_open', message: 'x', jobId: 'job-other' } }), job: (id) => (id === 'job-other' ? ins.job({ jobId: 'job-other', status: 'running' }) : ins.estimateJob()) }, 'There is already a processing'],
    ['no-calls', { job: () => ins.estimateJob({ estimate: { fits: true, calls: 0, requests: 0 } }) }, 'No calls to analyse in this period.'],
    ['failed', { createJob: () => ({ status: 500, body: {} }) }, 'The request could not be completed.'],
  ]
  for (const [name, options, text] of refusals) {
    test(`request dialog refused: ${name}`, async ({ authenticatedPage: page }) => {
      await ins.mockInsights(page, options)
      await page.goto(`/analytics?id=${B}&tab=reports`)
      await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Continue' }).click()
      // the refusals of the estimate come before a confirmation, those of the job after it
      const confirm = dialog.getByRole('button', { name: 'Confirm' })
      if (['job-open', 'failed'].includes(name)) await confirm.click({ timeout: 15000 })
      await expect(dialog.getByText(text).first()).toBeVisible({ timeout: 15000 })
      await both(page, `dialog-refused-${name}`)
    })
  }

  test('prepare now: refused while the automatic report is being prepared', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page, { createJob: () => ({ status: 202, body: ins.job({ jobId: 'job-new', status: 'refused', phase: 'finished', error: 'automatic_pending', mode: 'automatic_now' }) }) })
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await page.getByRole('button', { name: 'Prepare now' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog')
    await shoot(page, 'dialog-anticipate-confirm')
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    await expect(dialog.getByText(/is in preparation: it will be ready after the next nightly processing/)).toBeVisible()
    await both(page, 'dialog-anticipate-pending')
  })

  test('processing tab: running, done, refused; empty', async ({ authenticatedPage: page }) => {
    await ins.mockInsights(page)
    await page.goto(`/analytics?id=${B}&tab=jobs`)
    await expect(page.getByText('12 of 40 calls')).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-jobs')
    await ins.mockInsights(page, { jobs: { total: 0, items: [] } })
    await page.goto(`/analytics?id=${B}&tab=jobs`)
    await expect(page.getByText('Nothing has been processed for this business yet.')).toBeVisible({ timeout: 15000 })
    await shoot(page, 'owner-jobs-empty')
  })

  test('a FREE business: the plan offered', async ({ page }) => {
    await setupAuthPage(page, mockUser, 'owner')
    await ins.mockInsights(page)
    await page.route('**/crm/business?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...mockBusiness, subscriptionStatus: 'FREE' }]) }))
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByText('Available with a paid plan.')).toBeVisible({ timeout: 15000 })
    await both(page, 'owner-free-reports')
  })
})

test.describe('insights screens: admin and reseller', () => {
  test('admin page: assistants, callers\' requests, configuration suggestions', async ({ adminPage: page }) => {
    await ins.mockInsights(page)
    await page.route('**/customer/insights/config-suggestions*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 2, asOf: 1, items: [{ businessId: 'biz-1', name: 'Studio 1', periodEnd: ins.rome(2026, 10, 21), suggestions: ['Shorten the greeting.'] }, { businessId: 'biz-2', periodEnd: ins.rome(2026, 10, 14), suggestions: ['Turn on multilingual.'] }] }) }))
    await page.goto('/analytics-admin')
    await expect(page.getByText('1–10 of 23')).toBeVisible({ timeout: 15000 })
    await both(page, 'admin-page')
    const table = page.getByRole('table', { name: 'Callers\' requests' })
    await table.getByRole('row').filter({ hasText: 'Online booking' }).getByRole('button', { name: 'Who asked' }).click()
    await expect(page.getByRole('table', { name: 'Businesses that asked for Online booking' })).toBeVisible()
    await both(page, 'admin-requests-expanded')
    await table.getByRole('button', { name: 'Archive Online booking' }).click()
    await shoot(page, 'admin-requests-archive-dialog')
    await page.keyboard.press('Escape')
    await page.getByLabel('Show archived').check()
    await shoot(page, 'admin-requests-show-archived')
  })

  test('admin page: requests empty, error; assistants searched to nothing', async ({ adminPage: page }) => {
    await ins.mockInsights(page, { categories: { total: 0, asOf: 1, from: ins.rome(2026, 9, 24), to: ins.rome(2026, 10, 24), items: [] } })
    await page.goto('/analytics-admin')
    await expect(page.getByText('No requests in this period.')).toBeVisible({ timeout: 15000 })
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ businesses: [], total: 0, from: 0, size: 10 }) }))
    await page.getByRole('searchbox', { name: 'Search a business by name' }).fill('Nessuno')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText('No business named “Nessuno” in this period.')).toBeVisible()
    await shoot(page, 'admin-empty-states')
    await page.route('**/customer/insights/integrations*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
    await page.goto('/analytics-admin')
    await expect(page.getByText('This section could not be loaded.').first()).toBeVisible({ timeout: 15000 })
    await shoot(page, 'admin-requests-error')
  })

  test('admin: a business\'s report tab with delete and re-run', async ({ adminPage: page }) => {
    await ins.mockInsights(page)
    await page.goto(`/analytics?id=${B}&tab=reports`)
    await expect(page.getByText('1–10 of 25')).toBeVisible({ timeout: 15000 })
    await both(page, 'admin-reports')
    await page.getByRole('button', { name: /^Delete the report Oct 1, 2026/ }).click()
    await shoot(page, 'admin-delete-dialog')
  })

  test('reseller scope page', async ({ resellerPage: page }) => {
    await ins.mockInsights(page)
    await page.goto('/analytics')
    await expect(page.getByText('1–10 of 23')).toBeVisible({ timeout: 15000 })
    await both(page, 'reseller-scope')
  })
})
