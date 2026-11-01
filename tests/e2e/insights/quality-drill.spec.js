// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID, UNANSWERED_ASOF } = require('../fixtures/insights')
const { mockClassifications, mockConversations, conversation } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O5 (plan steps A6b, A6c, A7; StarChat 9.34, S2, S3 and S4, here on mocks
 * that answer as StarChat's analytics and conversation guides state, refusals included): a quality count leads to where
 * it happened. On a page over several businesses a count opens the businesses with that signal, highest share first,
 * each opening its calls of the signal and each call the call; a gap reason opens its unanswered questions on every
 * page; on a business's page skill errors and failed extractions open their calls like every other count.
 *
 * Seen failing, 2026-11-01, before the panels: on the admin page the quality counts were plain numbers, no "See the
 * questions" existed, and on a business's page skill errors and extraction issues were plain numbers.
 */
const QUALITY = {
  period: { from: 0, to: 0 }, extractions: { ok: 100, failed: 2 }, callsWithChecks: 100, checks: { caller_repeated: 7 },
  callsWithUnansweredRecorded: 100, callsWithUnanswered: 30, gaps: { missing_info: 6, out_of_scope: 28, assistant_error: 2 }, callsWithSkillErrors: 3,
}
const qualitySection = (page) => page.locator('.call-insights-section').filter({ has: page.getByRole('heading', { name: 'Quality', exact: true }) })
const query = (url) => Object.fromEntries(new URL(url).searchParams)

test.describe('a quality count leads to where it happened', () => {
  test('admin, every business: a reason opens its businesses by share, one business its calls, a call the dialog; back and close return the focus', async ({ adminPage: page }) => {
    const asked = await mockInsights(page, { role: 'admin', quality: QUALITY })
    await mockClassifications(page, { role: 'admin' })
    const docs = [1, 2].map((n) => conversation({ id: `CON-o${n}`, businessId: 'biz-21', owner: 'someone-else', details: { callerName: `Caller ${n}`, summary: `Asked something off topic ${n}.` } }))
    const searches = await mockConversations(page, docs)
    await page.goto('/analytics-admin')

    const count = qualitySection(page).getByRole('button', { name: 'See where it happened: Out of scope (28 calls)' })
    await count.click()
    const panel = page.locator('.signal-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('28 calls in the period')
    const table = panel.getByRole('table', { name: 'Businesses with: Out of scope' })
    // only the seven businesses where it happened, highest share first
    await expect(table.getByRole('row')).toHaveCount(8)
    await expect(table.getByRole('row').nth(1)).toContainText('Studio 21')
    await expect(table.getByRole('row').nth(1)).toContainText('9% (7 of 80)')
    await expect(table.getByRole('row').nth(7)).toContainText('1% (1 of 80)')
    const sent = asked.assistants.filter((a) => query(a.url).present === 'true').pop()
    expect(query(sent.url)).toMatchObject({ sort: 'gap:out_of_scope', present: 'true', direction: 'desc', from: '0' })
    expect(sent.body).not.toHaveProperty('businessId')

    await panel.getByRole('button', { name: 'Open the calls of Studio 21: Out of scope' }).click()
    await expect(panel.getByRole('heading', { name: 'Studio 21' })).toBeVisible()
    const back = panel.getByRole('button', { name: 'All businesses' })
    await expect(back).toBeFocused()
    await expect(panel.getByRole('button', { name: /^Open the call of Caller \d/ })).toHaveCount(2)
    expect(searches.filter((s) => !s.id).pop()).toMatchObject({ businessId: 'biz-21', counted: true, gap: 'out_of_scope', timestampGte: sent.body.timestampGte, timestampLte: sent.body.timestampLte })

    await panel.getByRole('button', { name: /^Open the call of Caller 1,/ }).click()
    const dialog = page.locator('.call-dialog')
    await expect(dialog).toContainText('Asked something off topic 1.', { timeout: 15000 })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(panel).toBeVisible()

    await back.click()
    await expect(panel.getByRole('button', { name: 'Open the calls of Studio 21: Out of scope' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(count).toBeFocused()
  })

  test('admin, every business: a reason opens its unanswered questions with their business and suggestion; the next page keeps the first page\'s asOf; a question opens its call', async ({ adminPage: page }) => {
    const asked = await mockInsights(page, { role: 'admin', quality: QUALITY })
    await mockClassifications(page, { role: 'admin' })
    await mockConversations(page, [], { byId: [conversation({ id: 'CON-q1', businessId: 'biz-6', owner: 'someone-else', details: { summary: 'Asked about cars.' } })] })
    await page.goto('/analytics-admin')

    const show = qualitySection(page).getByRole('button', { name: 'See the unanswered questions: Out of scope' })
    await show.click()
    const panel = page.locator('.questions-panel')
    await expect(panel).toContainText('23 questions in 12 calls')
    const table = panel.getByRole('table', { name: 'Unanswered questions: Out of scope' })
    const first = table.getByRole('row').filter({ hasText: 'Question 1 (out_of_scope)' })
    await expect(first).toContainText('Suggested: Tell the assistant answer 1')
    await expect(table.getByRole('row').filter({ hasText: 'Question 2 (out_of_scope)' })).toContainText('Studio 6')
    // a business without a name is shown by its id
    await expect(first).toContainText('biz-3')
    expect(query(asked.unanswered[0].url)).toMatchObject({ gap: 'out_of_scope', from: '0' })
    expect(asked.unanswered[0].body).not.toHaveProperty('businessId')

    await panel.getByRole('button', { name: 'Next page' }).click()
    await expect(table.getByRole('row').filter({ hasText: 'Question 11 (out_of_scope)' })).toBeVisible()
    expect(query(asked.unanswered[asked.unanswered.length - 1].url)).toMatchObject({ gap: 'out_of_scope', from: '10', asOf: String(UNANSWERED_ASOF) })

    await panel.getByRole('button', { name: 'Previous page' }).click()
    await table.getByRole('button', { name: 'Open the call: Question 2 (out_of_scope)' }).click()
    const dialog = page.locator('.call-dialog')
    await expect(dialog).toContainText('Asked about cars.', { timeout: 15000 })
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(show).toBeFocused()
  })

  test('admin: a refusal of the businesses\' read is said in the panel, with a retry', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin', quality: QUALITY })
    await mockClassifications(page, { role: 'admin' })
    await page.route('**/customer/analytics/assistants*', (route) => (new URL(route.request().url()).searchParams.get('present') === 'true'
      ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'sort must be one of …' }) })
      : route.fallback()))
    await page.goto('/analytics-admin')
    await qualitySection(page).getByRole('button', { name: 'See where it happened: The caller had to repeat themselves (7 calls)' }).click()
    const panel = page.locator('.signal-panel')
    await expect(panel.getByRole('alert')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('reseller scope page: a count opens its businesses over the scope; the questions name their business', async ({ resellerPage: page }) => {
    const asked = await mockInsights(page, { role: 'reseller', quality: QUALITY })
    await mockClassifications(page, { role: 'reseller' })
    await page.goto('/analytics')
    await qualitySection(page).getByRole('button', { name: 'See where it happened: Skill errors (3 calls)' }).click()
    const panel = page.locator('.signal-panel')
    await expect(panel.getByRole('table', { name: 'Businesses with: Skill errors' }).getByRole('row')).toHaveCount(11)
    expect(query(asked.assistants.filter((a) => query(a.url).present === 'true').pop().url)).toMatchObject({ sort: 'skill_errors', present: 'true' })
    await page.keyboard.press('Escape')
    await qualitySection(page).getByRole('button', { name: 'See the unanswered questions: Missing information' }).click()
    await expect(page.locator('.questions-panel').getByRole('columnheader', { name: 'Business' })).toBeVisible()
  })

  test('a business\'s page: skill errors and extraction issues open their calls; the questions are the business\'s, without a business column', async ({ authenticatedPage: page }) => {
    const asked = await mockInsights(page, { quality: QUALITY })
    await mockClassifications(page, {})
    const docs = [1, 2, 3].map((n) => conversation({ id: `CON-s${n}`, owner: 'test-uid-12345', details: { callerName: `Caller ${n}` } }))
    const searches = await mockConversations(page, docs)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const quality = qualitySection(page)

    await quality.getByRole('button', { name: 'Open the 3 calls: Skill errors', exact: true }).click()
    const calls = page.locator('.counted-calls-panel')
    await expect(calls).toContainText('3 calls')
    expect(searches.filter((s) => !s.id).pop()).toMatchObject({ businessId: BUSINESS_ID, counted: true, skillErrors: true })
    await page.keyboard.press('Escape')
    await expect(calls).toHaveCount(0)

    await quality.getByRole('button', { name: 'Open the 2 calls: Extraction issues', exact: true }).click()
    await expect(calls).toBeVisible()
    expect(searches.filter((s) => !s.id).pop()).toMatchObject({ businessId: BUSINESS_ID, counted: true, extractionFailed: true })
    await page.keyboard.press('Escape')

    await quality.getByRole('button', { name: 'See the unanswered questions: Out of scope' }).click()
    const panel = page.locator('.questions-panel')
    await expect(panel).toContainText('23 questions in 12 calls')
    await expect(panel.getByRole('columnheader', { name: 'Business' })).toHaveCount(0)
    expect(asked.unanswered[0].body).toMatchObject({ businessId: BUSINESS_ID })
    // no business-ranking link on one business's page: its counts open its calls
    await expect(quality.getByRole('button', { name: /^See where it happened/ })).toHaveCount(0)
  })
})
