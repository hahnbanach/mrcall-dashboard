// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights } = require('../fixtures/insights')

/**
 * The CTO, 2026-11-01: the Quality section and "Calls without a conversation" were hard to read, each number at the far
 * right of its label with no line leading the eye back to it and no column header. Both are now ruled tables: every
 * value sits under its column's header (same right edge), every row but the last is ruled, and the share is a column
 * of its own rather than an "of N calls" repeated in each line. On a phone each value carries its column's name.
 *
 * Seen failing, 2026-11-01, before the tables: no column header in either section, no rule between rows.
 */
const QUALITY = {
  period: { from: 0, to: 0 }, extractions: { ok: 100, failed: 2 }, callsWithChecks: 100, checks: { caller_repeated: 7 },
  callsWithUnansweredRecorded: 200, callsWithUnanswered: 30, gaps: { missing_info: 6, out_of_scope: 28, assistant_error: 2 }, callsWithSkillErrors: 3,
}
const qualitySection = (page) => page.locator('.call-insights-section').filter({ has: page.getByRole('heading', { name: 'Quality', exact: true }) })

/** The right edges of a column's header and of each of its cells, and whether each row is ruled. */
const layout = (table, column) => table.evaluate((el, col) => {
  const head = [...el.querySelectorAll('thead th')][col]
  const rows = [...el.querySelectorAll('tbody tr')].filter((tr) => tr.children.length > 1)
  return {
    head: { right: Math.round(head.getBoundingClientRect().right), text: head.textContent.trim() },
    cells: rows.map((tr) => Math.round(tr.children[col].getBoundingClientRect().right)),
    ruled: rows.slice(0, -1).map((tr) => parseFloat(getComputedStyle(tr.children[0]).borderBottomWidth)),
  }
}, column)

test.describe('quality and calls without a conversation read as tables', () => {
  test('admin: each count, base and share under its header, rows ruled, shares computed', async ({ adminPage: page }, testInfo) => {
    await mockInsights(page, { role: 'admin', quality: QUALITY })
    await page.goto('/analytics-admin')
    const table = qualitySection(page).locator('table.quality-table')
    await expect(table).toBeVisible({ timeout: 15000 })

    const outOfScope = table.locator('tr[data-signal="out_of_scope"]')
    await expect(outOfScope.locator('.quality-count')).toHaveText('28')
    await expect(outOfScope.locator('.quality-base')).toHaveText('200')
    await expect(outOfScope.locator('.quality-share-value')).toHaveText('14%')
    // the groups are rows of the table, each heading its signals
    await expect(table.locator('.quality-group-row')).toHaveText(['Unanswered questions', 'Checks', 'Technical errors'].map((t) => new RegExp(t, 'i')))
    // no "of N calls" left in any line
    await expect(table).not.toContainText(' of 200 calls')

    if (testInfo.project.name === 'mobile') {
      // phone: the header row is hidden, each value names its column
      for (const cell of await table.locator('tr.quality-row .quality-count').all()) await expect(cell).toHaveAttribute('data-label', 'Calls')
      return
    }
    for (const column of [1, 2]) {
      const { head, cells, ruled } = await layout(table, column)
      expect(cells.length).toBe(10)
      for (const right of cells) expect(Math.abs(right - head.right), `${head.text}: a value off its header`).toBeLessThanOrEqual(1)
      for (const width of ruled) expect(width).toBeGreaterThan(0)
    }
  })

  test('a business\'s page: calls without a conversation, each count under "Calls" on a ruled line', async ({ authenticatedPage: page }, testInfo) => {
    await mockInsights(page)
    await page.goto('/analytics?id=' + require('../fixtures/insights').BUSINESS_ID)
    const table = page.locator('table.no-conversation-table')
    await expect(table).toBeVisible({ timeout: 15000 })
    await expect(table.locator('thead th')).toHaveText(['Reason', 'Calls'])
    if (testInfo.project.name === 'mobile') return
    const { head, cells, ruled } = await layout(table, 1)
    expect(cells.length).toBeGreaterThan(1)
    for (const right of cells) expect(Math.abs(right - head.right)).toBeLessThanOrEqual(1)
    for (const width of ruled) expect(width).toBeGreaterThan(0)
  })
})
