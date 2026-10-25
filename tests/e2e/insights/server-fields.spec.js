// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, estimateJob, REPORT } = require('../fixtures/insights')

/**
 * The dashboard's part of U13c (StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md; StarChat
 * 3b0e6907d): the fields the dashboard steps found missing, now served, and the two notes of the U17b review.
 * - who asked, by role (`requesterRole`), never by an id;
 * - "Assistenti da rivedere": the change of "Non risolte" against the period before, and MrCall's configuration
 *   suggestions for an admin;
 * - "Attiva la ricarica automatica" from the estimate's `topUpEffective`;
 * - the hidden examples of a category, restored by an admin;
 * - a report's version on its own page;
 * - an admin refused for credit can put the work at MrCall's cost; a job over its cap says why.
 * Each case was seen failing on 59eae9f, before this work.
 */
// A cell is read by its text: on a phone each row is a card and the cell's accessible name also carries its column's
// label (the card's `::before`), which a screen reader reads, and which an exact name would not match.
const assistants = (page) => page.getByRole('table', { name: 'Assistants to review' })
const jobsTable = (page) => page.getByRole('table', { name: 'Processing' })

test.describe('who asked, by the role StarChat recorded', () => {
  test('Processing: you, the owner by the business\'s contact, the reseller, MrCall, and a dash for an unknown one', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    const row = (text) => jobsTable(page).getByRole('row').filter({ hasText: text })
    await expect(row('Automatic report prepared now').getByText('MrCall', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(row('Sep 1, 2026 – Sep 7, 2026').getByText('The reseller', { exact: true })).toBeVisible()
    await expect(row('Aug 1, 2026 – Aug 7, 2026').getByText('Mario Rossi (owner)', { exact: true })).toBeVisible()
    await expect(row('Jul 1, 2026 – Jul 7, 2026').getByText('—', { exact: true })).toBeVisible()
    await expect(row('Analysis of the calls').getByText('You', { exact: true })).toBeVisible()
    await expect(page.getByText(/uid/)).toHaveCount(0)
    await expect(page.getByText('MrCall or the reseller')).toHaveCount(0)
  })

  test('the history: an automatic report is "Automatic" from its role, a requested one is whoever asked', async ({ adminPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    const table = page.getByRole('table', { name: 'All reports' })
    // an admin reading the owner's request: the owner, named by the business's contact
    await expect(table.getByRole('row').filter({ hasText: 'Oct 1, 2026 – Oct 7, 2026' }).getByText('Mario Rossi (owner)', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(table.getByRole('row').filter({ hasText: 'Oct 14, 2026 – Oct 20, 2026' }).getByText('Automatic', { exact: true }).last()).toBeVisible()
    await expect(table.getByRole('row').filter({ hasText: 'Sep 9, 2026 – Sep 15, 2026' }).getByText('The reseller', { exact: true })).toBeVisible()
  })
})

test.describe('Assistants to review: the change and MrCall\'s suggestions', () => {
  test('admin: "Unresolved" against the period before in points, a dash without a base before, and the suggestions count', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const table = assistants(page)
    const row = (name) => table.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) })
    // 29 of 60 (48%) now, 20 of 50 (40%) before: 8 points more
    await expect(row('Studio 1').getByText('+8 points', { exact: true })).toBeVisible({ timeout: 15000 })
    // no request in the period before: no change to say
    await expect(row('Studio 2').getByText('–', { exact: true }).first()).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'MrCall suggestions' })).toBeVisible()
    await expect(row('Studio 4').getByText('4', { exact: true })).toBeVisible()
  })

  test('reseller: no column of MrCall\'s suggestions', async ({ resellerPage: page }) => {
    await mockInsights(page)
    await page.goto('/analytics')
    await expect(assistants(page).getByRole('columnheader', { name: /^Unresolved/ })).toBeVisible({ timeout: 15000 })
    await expect(assistants(page).getByRole('columnheader', { name: 'MrCall suggestions' })).toHaveCount(0)
    await expect(assistants(page).getByRole('columnheader', { name: 'Change' })).toBeVisible()
  })
})

test.describe('the reserve for calls: automatic top-up offered from StarChat\'s topUpEffective', () => {
  async function refusedForReserve (page, topUpEffective) {
    await mockInsights(page, { job: () => estimateJob({ estimate: { fits: false, reason: 'reserve', calls: 9, ...(topUpEffective === undefined ? {} : { topUpEffective }) } }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Request a report' })
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText(/level we keep for calls/)).toBeVisible({ timeout: 15000 })
    return dialog
  }

  test('offered when the top-up is not effective', async ({ authenticatedPage: page }) => {
    const dialog = await refusedForReserve(page, false)
    await expect(dialog.getByRole('link', { name: 'Turn on automatic top-up' })).toBeVisible()
  })

  test('not offered when it is effective, nor when StarChat does not say', async ({ authenticatedPage: page }) => {
    let dialog = await refusedForReserve(page, true)
    await expect(dialog.getByRole('link', { name: 'Top up' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Turn on automatic top-up' })).toHaveCount(0)
    dialog = await refusedForReserve(page, undefined)
    await expect(dialog.getByRole('link', { name: 'Turn on automatic top-up' })).toHaveCount(0)
  })
})

test.describe('an admin refused for credit', () => {
  for (const reason of ['reserve', 'no_credit']) {
    test(`${reason}: puts the work at MrCall's cost from the refusal, estimated again at MrCall's cost`, async ({ adminPage: page }) => {
      const asked = await mockInsights(page, {
        job: () => (asked.estimate.length >= 2 ? estimateJob() : estimateJob({ estimate: { fits: false, reason, calls: 9, topUpEffective: false } })),
      })
      await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
      await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
      const dialog = page.getByRole('dialog', { name: 'Request a report' })
      await dialog.getByRole('button', { name: 'Continue' }).click()
      await dialog.getByRole('button', { name: 'Run it at MrCall\'s cost' }).click({ timeout: 15000 })
      await expect(dialog.getByText('This processing is at MrCall\'s cost: the business\'s credit is not used. Do you want to continue?')).toBeVisible({ timeout: 15000 })
      expect(asked.estimate[asked.estimate.length - 1].body.platformPays).toBe(true)
      await dialog.getByRole('button', { name: 'Confirm' }).click()
      await expect.poll(() => asked.create.length).toBe(1)
      expect(asked.create[0].body.platformPays).toBe(true)
    })
  }

  test('an owner refused for credit is not offered MrCall\'s cost', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { job: () => estimateJob({ estimate: { fits: false, reason: 'no_credit', calls: 9 } }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Request a report' })
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText('Not enough credit for this processing.')).toBeVisible({ timeout: 15000 })
    await expect(dialog.getByRole('button', { name: 'Run it at MrCall\'s cost' })).toHaveCount(0)
  })
})

test.describe('a job over its cap', () => {
  test('says why it did not run', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    const row = jobsTable(page).getByRole('row').filter({ hasText: 'Sep 1, 2026 – Sep 7, 2026' })
    await expect(row.getByText('Not run', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(row.getByText('Larger than its estimate allowed')).toBeVisible()
  })

  // the dialog says the same reason as Processing, not "not enough credit" (the review of cf9a1c3)
  test('the dialog of a job refused over its cap says the same reason as Processing', async ({ authenticatedPage: page }) => {
    const { job } = require('../fixtures/insights')
    await mockInsights(page, { createJob: () => ({ status: 202, body: job({ jobId: 'job-new', status: 'refused', phase: 'finished', error: 'over_ceiling' }) }) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Request a report' })
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    await expect(dialog.getByText('Larger than its estimate allowed')).toBeVisible()
    await expect(dialog.getByText('Not enough credit for this processing.')).toHaveCount(0)
  })
})

test.describe('the hidden examples of a category', () => {
  test('admin: shown with "Show archived", each restored once however often it is clicked', async ({ adminPage: page }) => {
    const asked = await mockInsights(page)
    let release
    const held = new Promise((resolve) => { release = resolve })
    await page.route('**/customer/insights/integrations/*/examples/restore', async (route) => {
      asked.restore.push({ url: route.request().url(), body: route.request().postDataJSON() })
      await held
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"restored":1}' })
    })
    await page.goto('/analytics-admin')
    const table = page.getByRole('table', { name: 'Callers\' requests' })
    await expect(table.getByRole('row').filter({ hasText: 'Online booking' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Can I pay online?')).toHaveCount(0)
    await page.getByLabel('Show archived').check()
    const booking = table.getByRole('row').filter({ hasText: 'Online booking' }).first()
    await expect(booking.getByText('Can I pay online?')).toBeVisible()
    await expect(booking.getByText(/Hidden on Oct 12, 2026: Not relevant/)).toBeVisible()
    const restore = booking.getByRole('button', { name: 'Restore the example “Can I pay online?”' })
    await restore.click()
    await restore.click({ force: true }).catch(() => {})
    release()
    await expect.poll(() => asked.restore.length).toBe(1)
    expect(asked.restore[0].url).toMatch(/\/integrations\/online_booking\/examples\/restore$/)
    expect(asked.restore[0].body).toEqual({ text: 'Can I pay online?' })
  })
})

test.describe('a report\'s version', () => {
  test('is on its own page, as in the history', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    await expect(page.getByRole('heading', { name: 'Calls report, Oct 1, 2026 – Oct 7, 2026' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Version 2', { exact: true })).toBeVisible()
  })
})
