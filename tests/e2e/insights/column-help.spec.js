// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID } = require('../fixtures/insights')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O4 (plan step A4): each listed column says how it is counted, through
 * a button on its header reached by the keyboard and named for its column, whose tooltip shows on focus; the legend
 * that used to sit under the assistants table is gone (its texts are the tooltips). On a phone, where the header row
 * is not shown, the same texts are listed above the cards, and every table draws its rows as cards with each value
 * under its column's name.
 *
 * Seen failing, 2026-11-01, before ColumnHelp and the phone cards of the DataTables: no button named "How this column
 * is counted: …", and the topics table drawn as a table on a phone.
 */
const TOPICS = { period: { from: 0, to: 0 }, previousPeriod: { from: 0, to: 0 }, callsWithTopics: 90, previousCallsWithTopics: 80, topics: [{ topic: 'Bookings', calls: 40, previousCalls: 30 }] }

test.describe('how each column is counted', () => {
  test('desktop and tablet: the assistants table\'s headers carry their help, reached with Tab, the legend gone', async ({ adminPage: page, browserName }) => {
    test.skip(page.viewportSize().width < 641, 'phones list the help above the cards')
    await mockInsights(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const table = page.getByRole('table', { name: 'Assistants to review' })
    await expect(table.getByRole('row')).toHaveCount(11, { timeout: 15000 })
    for (const column of ['Calls', 'Unresolved (assessed)', 'Checks', 'Skill errors', 'Extraction', 'Change', 'What callers ask']) {
      await expect(table.getByRole('button', { name: `How this column is counted: ${column}`, exact: true })).toHaveCount(1)
    }
    await expect(page.locator('.assistants-legend')).toHaveCount(0)
    // the folded list of the same texts is for phones only
    await expect(page.locator('details.column-help-list').first()).toBeHidden()

    // from the "Calls" sort button, Tab reaches its help, whose tooltip says the base, and Escape hides it. The bubble is
    // drawn for the eye only (aria-hidden): a screen reader reads the same text as the button's description. WebKit's
    // Tab skips buttons unless the system asks it not to, so there the help is focused directly: it is a native button.
    const help = table.getByRole('button', { name: 'How this column is counted: Calls', exact: true })
    if (browserName === 'chromium') {
      await table.getByRole('button', { name: 'Calls', exact: true }).focus()
      await page.keyboard.press('Tab')
    } else {
      await help.focus()
    }
    await expect(help).toBeFocused()
    await expect(help).toHaveAccessibleDescription('The assistant\'s calls finalised in the period.')
    const bubble = page.locator('.column-help-bubble')
    await expect(bubble).toHaveText('The assistant\'s calls finalised in the period.')
    await page.keyboard.press('Escape')
    await expect(bubble).toHaveCount(0)
    // asking does not reorder: the help's click stays out of the sort button
    const order = await table.locator('tbody tr td:first-child').allTextContents()
    await help.click()
    await expect(table.locator('tbody tr td:first-child')).toHaveText(order)

    // the share columns keep the legend's words as their help
    await table.getByRole('button', { name: 'How this column is counted: Checks', exact: true }).focus()
    await expect(bubble).toHaveText('Checks: calls where a check fired, over the calls checked')
  })

  test('phone: the help is listed above the cards, and the topics table draws its rows as cards', async ({ authenticatedPage: page }) => {
    test.skip(page.viewportSize().width >= 641, 'wider screens show the header row')
    await mockInsights(page)
    await page.route('**/customer/analytics/topics*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TOPICS) }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const topics = page.getByRole('region', { name: 'What the calls were about' }).or(page.locator('.call-insights-section').filter({ hasText: 'What the calls were about' }))
    const cell = page.locator('td[data-label="Previous period"]').first()
    await expect(cell).toBeVisible({ timeout: 15000 })
    // the card draws the column's name above the value
    const label = await cell.evaluate((el) => getComputedStyle(el, '::before').content)
    expect(label).toBe('"Previous period"')
    // the header row is kept for assistive technology but not drawn
    const head = await page.locator('th', { hasText: 'Previous period' }).first().evaluate((el) => el.closest('thead').getBoundingClientRect().height)
    expect(head).toBeLessThanOrEqual(1)
    const list = topics.locator('details.column-help-list').first()
    await expect(list).toBeVisible()
    await list.locator('summary').click()
    await expect(list).toContainText('Calls with this topic in the period of the same length just before.')
  })
})
