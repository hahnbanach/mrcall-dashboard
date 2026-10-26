// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, JOBS_U19, jobsPage } = require('../fixtures/insights')

/**
 * U19r2 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: Elaborazioni as the amendment of
 * 2026-10-26 repairs it (brief, "Amendment 2026-10-26", Dashboard): a recompute's result in words from its counts and
 * its progress over the calls processed, the ceiling and the calls not finalised named (U19 M10); filters by kind and
 * state, undone where they are set (m15); a link per report that names it (m14); the `facts` job, which StarChat
 * answers to an admin only, named for what it is.
 */
const table = (page) => page.getByRole('table', { name: 'Processing' })

test.describe('Processing, as the U19 attack repaired it', () => {
  test('M10: OVERLAND\'s recompute says what became of its calls, and a stopped one never "200 of 200"', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { jobs: (url) => jobsPage(url, JOBS_U19.filter((j) => j.kind !== 'facts')) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    const rows = table(page).getByRole('row')
    const overland = rows.filter({ hasText: '4 analysed' })
    await expect(overland).toContainText('4 analysed, 10 not finished', { timeout: 15000 })
    await expect(overland).toContainText('14 of 14 calls')
    const stopped = rows.filter({ hasText: 'Stopped: not enough credit' })
    await expect(stopped).toContainText('120 of 200 calls')
    await expect(stopped).toContainText('80 not analysed: limit reached')
    await expect(stopped).not.toContainText('200 of 200')
  })

  test('m14: a regeneration names its reports, and each link names the report it opens', async ({ authenticatedPage: page }) => {
    await mockInsights(page, { jobs: (url) => jobsPage(url, JOBS_U19.filter((j) => j.kind !== 'facts')) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    const regen = table(page).getByRole('row').filter({ hasText: 'Regenerated reports' })
    await expect(regen).toContainText('Oct 1, 2026 – Oct 14, 2026', { timeout: 15000 })
    await expect(regen.getByRole('link', { name: 'Open the report Oct 1, 2026 – Oct 7, 2026' })).toBeVisible()
    await expect(regen.getByRole('link', { name: 'Open the report Oct 8, 2026 – Oct 14, 2026' })).toBeVisible()
  })

  test('m15: filters by kind and by state, asked of the server and undone where they are set', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, { jobs: (url) => jobsPage(url, JOBS_U19.filter((j) => j.kind !== 'facts')) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    await expect(page.getByText('1–3 of 3')).toBeVisible({ timeout: 15000 })
    await page.getByRole('combobox', { name: 'Kind' }).click()
    await expect(page.getByRole('option', { name: 'Updating the calls\' data' })).toHaveCount(0)
    await page.getByRole('option', { name: 'Analysis of the calls' }).click()
    await expect(page.getByText('1–2 of 2')).toBeVisible()
    expect(asked.jobs[asked.jobs.length - 1].url).toContain('kind=recompute')
    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Ready' }).click()
    await expect(page.getByText('1–1 of 1')).toBeVisible()
    expect(asked.jobs[asked.jobs.length - 1].url).toContain('status=done')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByText('1–3 of 3')).toBeVisible()
    expect(asked.jobs[asked.jobs.length - 1].url).not.toMatch(/kind=|status=/)
  })
})

test.describe('Processing, an admin', () => {
  test('the facts job is named for what it is, with what it wrote, and an admin can filter by it', async ({ adminPage: page }) => {
    const asked = await mockInsights(page, { role: 'admin', jobs: (url) => jobsPage(url, JOBS_U19) })
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=jobs`)
    const facts = table(page).getByRole('row').filter({ hasText: 'Updating the calls\' data' })
    await expect(facts).toContainText('30 updated, 70 already up to date', { timeout: 15000 })
    await expect(facts).toContainText('100 calls examined')
    await page.getByRole('combobox', { name: 'Kind' }).click()
    await page.getByRole('option', { name: 'Updating the calls\' data' }).click()
    await expect(page.getByText('1–1 of 1')).toBeVisible()
    expect(asked.jobs[asked.jobs.length - 1].url).toContain('kind=facts')
  })
})
