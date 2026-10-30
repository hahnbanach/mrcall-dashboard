// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, rome, category, CATEGORIES } = require('../fixtures/insights')

/**
 * U19r2 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md: the minor defects of the U19 attack
 * in "Callers' requests" (brief, "Amendment 2026-10-26", Dashboard, minor defects): examples neither quoted as the
 * caller's words nor repeated as near-duplicates (m9), "Other" after the categories it ties with (m10), a "Who asked"
 * button named by its category and a histogram whose accessible name carries its weeks (m16), an archive that can be
 * undone and an archived row that says who archived it and why (m18). The status, trend and buckets of rule 4 are not
 * touched here: they wait for the classification-feedback design.
 */
const requests = (page) => page.getByRole('table', { name: 'Callers\' requests' })

test.describe('Callers\' requests: the U19 minors', () => {
  test('m10: "Other" comes after a category with the same score; m9: near-duplicate examples once, not as quotes', async ({ adminPage: page }) => {
    await mockInsights(page, {
      role: 'admin',
      categories: { ...CATEGORIES, items: [
        category('other', { label: 'Other', nextAction: 'Review the examples' }),
        category('online_booking', { label: 'Online booking', examples: [
          { text: 'Can I book on the website?', businessId: 'biz-1', name: 'Studio 1', conversationId: 'CON-m1' },
          { text: 'can I book on the website', businessId: 'biz-2', name: 'Studio 2', conversationId: 'CON-m2' },
        ] }),
      ] },
    })
    await page.goto('/analytics-admin')
    const rows = requests(page).locator('tbody > tr').filter({ has: page.locator('.requests-category') })
    await expect(rows.nth(0).locator('.requests-category')).toHaveText('Online booking', { timeout: 15000 })
    await expect(rows.nth(1).locator('.requests-category')).toHaveText('Other')
    const examples = rows.nth(0).locator('.requests-examples > li')
    await expect(examples).toHaveCount(1)
    await expect(examples.locator('q')).toHaveCount(0)
  })

  test('m16: "Who asked" is named by its category, and the histogram says its weeks', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const table = requests(page)
    await expect(table.getByRole('button', { name: 'Who asked: Online booking' })).toBeVisible({ timeout: 15000 })
    await expect(table.getByRole('button', { name: 'Who asked: Prices and rates' })).toBeVisible()
    await expect(table.getByRole('img', { name: 'Businesses per week, from the oldest: Sep 28: 0, Oct 5: 1, Oct 12: 3, Oct 19: 2' })).toBeVisible()
  })

  test('m18: an archive can be undone where it was made, and an archived row says by whom, why and the note', async ({ adminPage: page }) => {
    const asked = await mockInsights(page, {
      role: 'admin',
      categories: { ...CATEGORIES, items: [
        category('online_booking', { label: 'Online booking' }),
        category('prices', { label: 'Prices and rates', dismissal: { reason: 'not_relevant', note: 'Handled by sales', at: rome(2026, 10, 10), by: 'someone-else' } }),
      ] },
    })
    await page.goto('/analytics-admin')
    const table = requests(page)
    await expect(table.getByText('Archived on Oct 10, 2026 by MrCall: Not relevant · Handled by sales')).toBeVisible({ timeout: 15000 })
    await table.getByRole('button', { name: 'Archive Online booking' }).click()
    const dialog = page.getByRole('dialog', { name: 'Archive' })
    await dialog.getByLabel('Done').check()
    await dialog.getByRole('button', { name: 'Archive' }).click()
    const done = page.getByRole('status').filter({ hasText: 'Online booking archived.' })
    await expect(done).toBeVisible()
    await done.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => asked.restore.length).toBe(1)
    expect(asked.restore[0].url).toContain('/integrations/online_booking/restore')
  })
})
