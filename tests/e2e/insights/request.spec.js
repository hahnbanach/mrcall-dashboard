// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')
const { mockInsights, BUSINESS_ID, rome, job, estimateJob, REPORT, OUTCOMES } = require('../fixtures/insights')

/**
 * U15 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the request dialog (a report for a
 * period, a regeneration, a recompute, "Prepare now"): the overlap choices, a hidden estimate, a confirmation naming
 * the business's credit and no amount, progress and its end; each refusal with its own copy and offers; a refused
 * estimate estimated again; the coverage banner on Overview; a FREE business's owner offered the plan.
 */
const refused = (code, extra = {}) => ({ status: 409, body: { code, message: code, ...extra } })

async function openRequest (page) {
  await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
  await page.getByRole('button', { name: 'Request a report' }).click({ timeout: 15000 })
  const dialog = page.getByRole('dialog', { name: 'Request a report' })
  await expect(dialog).toBeVisible()
  return dialog
}

// the dialog's text holds no amount: no euro, no number of credits, no tokens
async function expectNoAmount (dialog) {
  const text = await dialog.innerText()
  expect(text).not.toMatch(/€|EUR|\d+\s*credits?\b|tokens?/i)
}

test.describe('requesting a report', () => {
  test('a period, a hidden estimate, a confirmation without amount, one job for a double click, progress and the report opened', async ({ authenticatedPage: page }) => {
    let polls = 0
    const asked = await mockInsights(page, {
      job: (id) => {
        if (id === 'est-1') return estimateJob()
        polls += 1
        return polls < 2 ? job({ jobId: 'job-new', status: 'running', phase: 'working' })
          : job({ jobId: 'job-new', status: 'done', phase: 'finished', counts: { requests: 1 }, result: { reports: [{ periodStart: REPORT.periodStart, periodEnd: REPORT.periodEnd, requestId: 'job-req-1' }] } })
      },
    })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Last 30 days' }).click()
    await expect(dialog.getByText(/^From .* to .* \(30 days\)$/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    // the overlap was read for the period's days, then the estimate asked, never shown
    expect(asked.overlap).toHaveLength(1)
    await expect(dialog.getByText('This processing uses the credit of the business Test Restaurant. Do you want to continue?')).toBeVisible({ timeout: 15000 })
    expect(asked.estimate[0].body).toMatchObject({ businessId: BUSINESS_ID, kind: 'report' })
    expect(asked.estimate[0].body.to - asked.estimate[0].body.from).toBeGreaterThanOrEqual(30 * 24 * 3600 * 1000 - 3600 * 1000)
    await expect(dialog.getByText('If calls use the credit in the meantime, the processing may leave a small debt.')).toBeVisible()
    await expectNoAmount(dialog)
    // an owner is not offered MrCall's cost
    await expect(dialog.getByText('At MrCall\'s cost: the business uses no credit')).toHaveCount(0)

    // Seen failing (2026-10-24) with the button's guard removed: two jobs created, under one key
    await dialog.getByRole('button', { name: 'Confirm' }).dblclick()
    await expect(dialog.getByText('The report is ready.')).toBeVisible({ timeout: 15000 })
    expect(asked.create).toHaveLength(1)
    expect(asked.create[0].body).toMatchObject({ businessId: BUSINESS_ID, estimateJobId: 'est-1' })
    expect(asked.create[0].body.maxCredits).toBeUndefined()
    expect(asked.create[0].body.idempotencyKey).toBeTruthy()
    await expect(dialog.getByRole('link', { name: 'Open the report' })).toHaveAttribute('href', `/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
  })

  test('days already in a past report and in the cycle in progress are read again only once acknowledged', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, {
      overlap: { cycle: { from: rome(2026, 10, 21), to: rome(2026, 10, 24) }, past: [{ periodStart: rome(2026, 10, 14), periodEnd: rome(2026, 10, 21), type: 'automatic' }] },
    })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Last 7 days' }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText('These days will be read again by the next automatic report and will use the credit again.')).toBeVisible()
    await expect(dialog.getByText('These days are already partly in the automatic report Oct 14, 2026 – Oct 20, 2026. A new report reads them again and uses the credit again.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await dialog.getByLabel('I understand: read them again anyway').check()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    await expect.poll(() => asked.create.length).toBe(1)
    // the estimate is asked for exactly what the job asks (StarChat refuses the estimate of unacknowledged days, and a
    // job whose estimate's arguments differ): seen failing on 9999149, where only the job carried the acknowledgement
    expect(asked.estimate[asked.estimate.length - 1].body.acknowledgeOverlap).toBe(true)
    expect(asked.create[0].body.acknowledgeOverlap).toBe(true)
    await expect(dialog.getByText('In preparation…').or(dialog.getByText('Queued: it will start shortly.'))).toBeVisible()
  })

  test('the same days as a ready report are refused, and offered as a regeneration', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, {
      overlap: { identical: { periodStart: REPORT.periodStart, periodEnd: REPORT.periodEnd, requestId: 'job-req-1', type: 'requested' }, past: [] },
    })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText('A report for these days already exists.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Regenerate that report' }).click()
    await expect(page.getByRole('dialog', { name: 'Regenerate the report' })).toBeVisible()
    await expect.poll(() => asked.estimate.length).toBe(1)
    expect(asked.estimate[0].body.regenerates).toEqual([{ periodStart: REPORT.periodStart, periodEnd: REPORT.periodEnd, requestId: 'job-req-1' }])
  })

  test('not enough credit: its copy, a shorter period and a top-up, and nothing created', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, { job: () => estimateJob({ estimate: { fits: false, reason: 'no_credit', calls: 900 } }) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Last 90 days' }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText('Not enough credit for this processing.')).toBeVisible({ timeout: 15000 })
    await expect(dialog.getByRole('link', { name: 'Top up' })).toHaveAttribute('href', `/plan?id=${BUSINESS_ID}`)
    await expect(dialog.getByRole('link', { name: 'Turn on automatic top-up' })).toHaveCount(0)
    await expectNoAmount(dialog)
    await dialog.getByRole('button', { name: 'Try a shorter period' }).click()
    await expect(dialog.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(asked.create).toHaveLength(0)
  })

  test('the reserve for calls: its copy and a top-up, no shorter period, and automatic top-up offered only without one', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { job: () => estimateJob({ estimate: { fits: false, reason: 'reserve', calls: 10, topUpEffective: false } }) })
    let dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText('The business\'s credit is at the level we keep for calls. Top up the credit or turn on automatic top-up to use this feature.')).toBeVisible({ timeout: 15000 })
    await expect(dialog.getByRole('button', { name: 'Try a shorter period' })).toHaveCount(0)
    await expect(dialog.getByRole('link', { name: 'Top up' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Turn on automatic top-up' })).toBeVisible()

    // the same refusal for a business whose automatic top-up is on: no offer to turn it on
    await mockInsights(page, { job: () => estimateJob({ estimate: { fits: false, reason: 'reserve', calls: 10, topUpEffective: true } }) })
    dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText(/level we keep for calls/)).toBeVisible({ timeout: 15000 })
    await expect(dialog.getByRole('link', { name: 'Top up' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Turn on automatic top-up' })).toHaveCount(0)
  })

  test('another job open: who started it and when, and the way to it', async ({ authenticatedPage: page }) => {
    await mockInsights(page, {
      createJob: () => refused('job_open', { jobId: 'job-other' }),
      job: (id) => (id === 'job-other' ? job({ jobId: 'job-other', status: 'running', requestedBy: 'admin-uid-12345', requesterRole: 'admin', createdAt: rome(2026, 10, 24) + 8 * 3600 * 1000 }) : estimateJob()),
    })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    // WebKit (the tablet and phone projects) joins date and time with "at"
    await expect(dialog.getByText(/^There is already a processing in progress for this business, started by MrCall on Oct 24, 2026,? (at )?8:00\sAM\.$/)).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'See the processing' })).toHaveAttribute('href', `/analytics?id=${BUSINESS_ID}&tab=jobs`)
  })

  for (const code of ['estimate_stale', 'estimate_used', 'estimate_mismatch']) {
    test(`an estimate refused as ${code} is estimated again, unseen, and the job then created`, async ({ authenticatedPage: page }) => {
      const asked = await mockInsights(page, {
        createJob: (body, n) => (n === 1 ? refused(code) : { status: 202, body: job({ jobId: 'job-new', status: 'done', phase: 'finished', counts: { requests: 1 } }) }),
      })
      const dialog = await openRequest(page)
      await dialog.getByRole('button', { name: 'Continue' }).click()
      await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
      // estimated again: back at the confirmation, nothing said about the refusal
      await expect.poll(() => asked.estimate.length).toBe(2)
      await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
      await expect(dialog.getByText('The report is ready.')).toBeVisible()
      expect(asked.create).toHaveLength(2)
      expect(asked.create[1].body.idempotencyKey).not.toBe(asked.create[0].body.idempotencyKey)
    })
  }

  test('a period without calls says so and creates nothing', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, { job: () => estimateJob({ estimate: { fits: true, calls: 0, requests: 0 } }) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    // the brief's words for a period with no call (amendment of 2026-10-26, rule 5), from a server that answers it fits
    await expect(dialog.getByText('No calls in this period.')).toBeVisible({ timeout: 15000 })
    expect(asked.create).toHaveLength(0)
  })

  test('the job cancelled while it runs says so', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, { job: (id) => (id === 'est-1' ? estimateJob() : job({ jobId: 'job-new', status: 'running', phase: 'working' })) })
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByRole('button', { name: 'Confirm' }).click({ timeout: 15000 })
    await expect(dialog.getByText('Cancel: the report will not be written and no credit will be used.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel the processing' }).click()
    await expect(dialog.getByText('Processing cancelled.')).toBeVisible()
    expect(asked.cancel).toHaveLength(1)
  })
})

test.describe('"Prepare now"', () => {
  test('a job refused because the automatic report is being prepared says so', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, {
      createJob: () => ({ status: 202, body: job({ jobId: 'job-new', status: 'refused', phase: 'finished', error: 'automatic_pending', mode: 'automatic_now' }) }),
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await page.getByRole('button', { name: 'Prepare now' }).click({ timeout: 15000 })
    const dialog = page.getByRole('dialog', { name: 'Prepare the automatic report now' })
    await expect(dialog.getByText('The automatic report in progress covers Oct 21, 2026 to yesterday: we prepare it now for this whole period, and the next one will start from today.')).toBeVisible({ timeout: 15000 })
    expect(asked.estimate[0].body).toEqual(expect.objectContaining({ businessId: BUSINESS_ID, kind: 'automatic_now' }))
    expect(asked.estimate[0].body.from).toBeUndefined()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(dialog.getByText('The automatic report for this period is in preparation: it will be ready after the next nightly processing.')).toBeVisible()
  })
})

test.describe('a FREE business\'s owner', () => {
  test('is offered the plan, never a request that would be refused', async ({ page }) => {
    const { setupAuthPage } = require('../fixtures/auth')
    const { mockUser } = require('../fixtures/mock-data')
    await setupAuthPage(page, mockUser, 'owner')
    await mockInsights(page, { outcomes: OUTCOMES })
    await page.route('**/crm/business?*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ ...mockBusiness, subscriptionStatus: 'FREE' }]) }))
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByText('Available with a paid plan.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: 'See the plans' })).toHaveAttribute('href', `/plan?id=${BUSINESS_ID}`)
    await expect(page.getByRole('button', { name: 'Request a report' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Regenerate the report/ })).toHaveCount(0)
    await page.getByRole('link', { name: 'Overview' }).click()
    await expect(page.getByText(/do not have the automatic analysis yet/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analyse them now' })).toHaveCount(0)
  })
})

test.describe('the coverage banner on Overview', () => {
  test('names the calls without analysis and what no analysis changes, and offers to analyse the page\'s period', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByText('20 calls managed in this period do not have the automatic analysis yet, so outcomes, topics and quality do not count them.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/A new analysis does not change the calls without a conversation/)).toBeVisible()
    await page.getByRole('button', { name: 'Analyse them now' }).click()
    await expect(page.getByRole('dialog', { name: 'Analyse the calls of the period' })).toBeVisible()
    await expect.poll(() => asked.estimate.length).toBe(1)
    expect(asked.estimate[0].body).toMatchObject({ businessId: BUSINESS_ID, kind: 'recompute' })
    // the callers who never spoke, with the way to the greeting
    await page.keyboard.press('Escape')
    await expect(page.getByText('In 12 calls the caller hung up without saying anything. It often depends on the greeting: check that it is short and clear.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Check the greeting' })).toHaveAttribute('href', `/businessconfiguration?id=${BUSINESS_ID}&section=__CONVERSATION__`)
  })

  test('is not shown when the calls without analysis are fewer than a tenth of the managed ones', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { outcomes: { ...OUTCOMES, recomputable: 12, callsManaged: 130 } })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(page.getByText(/In 12 calls the caller hung up/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/do not have the automatic analysis yet/)).toHaveCount(0)
  })
})

test.describe('an admin\'s request', () => {
  test('may put the work at MrCall\'s cost, said in the confirmation', async ({ adminPage: page }) => {
    const asked = await mockInsights(page)
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByLabel('At MrCall\'s cost: the business uses no credit').check({ timeout: 15000 })
    await expect(dialog.getByText('This processing is at MrCall\'s cost: the business\'s credit is not used. Do you want to continue?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirm' }).click()
    await expect.poll(() => asked.create.length).toBe(1)
    expect(asked.create[0].body.platformPays).toBe(true)
    // the estimate the job is created from was asked at MrCall's cost too: seen failing on 9999149 (estimate_mismatch)
    expect(asked.estimate[asked.estimate.length - 1].body.platformPays).toBe(true)
    await expect(dialog.getByText('In preparation…').or(dialog.getByText('Queued: it will start shortly.'))).toBeVisible()
  })
})

test.describe('a reseller\'s or an admin\'s request on a FREE business', () => {
  // StarChat makes such work MrCall's (InsightsJobs.submit): the confirmation must not say the business pays or may
  // owe, nor offer a choice that is not one. Seen failing on 9999149 (the business's credit named, the debt note shown).
  async function confirmationOnFree (page) {
    const asked = await mockInsights(page)
    await page.route('**/crm/business?*', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ ...mockBusiness, subscriptionStatus: 'FREE' }]) }))
    const dialog = await openRequest(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByText('This processing is at MrCall\'s cost: the business\'s credit is not used. Do you want to continue?')).toBeVisible({ timeout: 15000 })
    await expect(dialog.getByText(/uses the credit of the business/)).toHaveCount(0)
    await expect(dialog.getByText(/small debt/)).toHaveCount(0)
    await expect(dialog.getByLabel('At MrCall\'s cost: the business uses no credit')).toHaveCount(0)
    // nothing asked of StarChat that a reseller may not ask: it sets platformPays itself
    expect(asked.estimate[0].body.platformPays).toBeUndefined()
  }

  test('reseller: the confirmation says MrCall pays, with no debt note and no choice', async ({ resellerPage: page }) => {
    await confirmationOnFree(page)
  })

  test('admin: the confirmation says MrCall pays, with no debt note and no choice', async ({ adminPage: page }) => {
    await confirmationOnFree(page)
  })
})
