// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockClassifications, mockConversations, conversation, judged, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 4 (StarChat's brief, decision 9, "In lists" and
 * "Narrow screens"): the conversations list reads every filter of a count's link from its address and shows each as a
 * chip that undoes it; a selection column (a long-press mode under 600 px) changes the outcome, marks spam or confirms
 * the selected calls in one gesture with one undo, from a bottom bar under 600 px.
 *
 * Seen failing, 2026-10-27, before the address filters and the selection existed in Conversations.vue: every case.
 * The R2 review's cases (a count's list keeping archived calls, the bar on screen, an opened call's chips after a bulk
 * gesture) failed on dec211e.
 */
const calls = [
  conversation({ id: 'CON-a', contactName: 'Anna', details: { callerName: 'Anna', summary: 'A', resolution: 'resolved', message: 'none', booked: false } }),
  conversation({ id: 'CON-b', contactName: 'Bruno', details: { callerName: 'Bruno', summary: 'B', resolution: 'unresolved', message: 'incomplete', booked: false } }),
  conversation({ id: 'CON-c', contactName: 'Carla', details: { callerName: 'Carla', summary: 'C', booked: false } }),
]

const narrow = (page) => page.viewportSize().width < 600

async function select (page, name) {
  if (narrow(page)) {
    // a long press enters the selection mode; then a tap selects
    const card = page.locator('.conversations-list .conversation-card').filter({ hasText: name }).first()
    if (!(await page.getByRole('checkbox', { name: `Select the call of ${name}` }).isVisible())) {
      await card.scrollIntoViewIfNeeded()
      const box = await card.locator('.card-header').boundingBox()
      await page.mouse.move(box.x + 20, box.y + 10)
      await page.mouse.down()
      await page.waitForTimeout(700)
      await page.mouse.up()
    }
  }
  await page.getByRole('checkbox', { name: `Select the call of ${name}` }).check()
}

test.describe('the conversations list: a count\'s filters and corrections in bulk', () => {
  test('a count\'s link: its filters are sent and shown, each undone by its own chip', async ({ authenticatedPage: page }) => {
    const searches = await mockConversations(page, calls)
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}&from=1000&to=2000&counted=true&gap=missing_info&category=prices&requestOutcome=taken`)
    await expect(page.getByRole('button', { name: 'Remove the filter Unanswered question: Missing information' })).toBeVisible({ timeout: 15000 })
    const listed = searches.filter((s) => !s.id).pop()
    expect(listed).toMatchObject({ businessId: BUSINESS_ID, timestampGte: 1000, timestampLte: 2000, counted: true, gap: 'missing_info', requestCategory: 'prices', requestOutcomes: ['taken'] })
    // the analytics count archived calls too: a count's list does not narrow them to the inbox (R2 review, finding 2)
    expect(listed.archived).toBeUndefined()
    expect(listed.deleted).toBeUndefined()
    await expect(page.getByRole('button', { name: 'Remove the filter Calls: as the statistics count them, archived included' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Remove the filter Request outcome: Taken for the business/ })).toBeVisible()
    await page.getByRole('button', { name: 'Remove the filter Unanswered question: Missing information' }).click()
    await expect(page).not.toHaveURL(/gap=/)
    await expect.poll(() => searches.filter((s) => !s.id).pop().gap).toBeUndefined()
    expect(searches.filter((s) => !s.id).pop().requestCategory).toBe('prices')
  })

  test('a report count\'s list says how many of its calls the reader cannot open (StarChat dc4d7f7f6)', async ({ authenticatedPage: page }) => {
    const searches = await mockConversations(page, calls, { leftOut: 3 })
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}&from=1000&to=2000&counted=true&gap=missing_info&leftOut=true`)
    await expect(page.getByText('3 calls not visible with your access')).toBeVisible({ timeout: 15000 })
    expect(searches.filter((s) => !s.id).pop()).toMatchObject({ __leftOut: true, gap: 'missing_info' })
  })

  test('a value the list does not know is not applied, and said', async ({ authenticatedPage: page }) => {
    const searches = await mockConversations(page, calls)
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}&gap=nope`)
    await expect(page.getByText('A filter in the link was not recognised and is not applied.')).toBeVisible({ timeout: 15000 })
    // the note is drawn from the address at once; the list's search follows the reader's role and business
    await expect.poll(() => searches.filter((s) => !s.id).length).toBeGreaterThan(0)
    expect(searches.filter((s) => !s.id).pop().gap).toBeUndefined()
  })

  test('selected calls are marked spam in one gesture, and undone together', async ({ authenticatedPage: page }) => {
    const searches = await mockConversations(page, calls)
    const { sent } = await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}`)
    await expect(page.locator('.conversation-card').filter({ hasText: 'Anna' })).toBeVisible({ timeout: 15000 })
    await select(page, 'Anna')
    await select(page, 'Bruno')
    const bar = page.getByRole('toolbar', { name: 'Selected calls' })
    await expect(bar).toContainText('2 selected')
    // on screen where the person is, not at the end of the page (R2 review, finding 3)
    await expect(bar).toBeInViewport()
    const before = searches.length
    await bar.getByRole('button', { name: 'Mark as spam' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'bulk').length).toBe(1)
    const bulk = sent.find((s) => s.path === 'bulk')
    expect(bulk.body.items).toEqual([
      { subject: 'call', conversationId: 'CON-a', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'spam_wrong_number' },
      { subject: 'call', conversationId: 'CON-b', field: 'resolution', signal: 'wrong_value', valueFrom: 'unresolved', valueTo: 'spam_wrong_number' },
    ])
    // the list is read again after the gesture
    await expect.poll(() => searches.length).toBeGreaterThan(before)
    const undoBar = page.getByRole('status').filter({ hasText: 'Changed' })
    await undoBar.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'gesture-revert').length).toBe(1)
    expect(sent.find((s) => s.path === 'gesture-revert').gestureId).toBe(bulk.body.gestureId)
  })

  test('the selection does not outlive the rows it was made on (P10 review, finding 1)', async ({ authenticatedPage: page }) => {
    await mockConversations(page, calls)
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}`)
    await expect(page.locator('.conversations-list .conversation-card').filter({ hasText: 'Anna' })).toBeVisible({ timeout: 15000 })
    await select(page, 'Anna')
    await expect(page.getByRole('toolbar', { name: 'Selected calls' })).toBeVisible()
    await page.getByText('Archive', { exact: true }).first().click()
    await expect(page.getByRole('toolbar', { name: 'Selected calls' })).toHaveCount(0)
  })

  test('an undo offered on one page is not offered on another (P10 review, finding 4)', async ({ authenticatedPage: page }) => {
    await mockConversations(page, calls)
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}`)
    await expect(page.locator('.conversations-list .conversation-card').filter({ hasText: 'Anna' })).toBeVisible({ timeout: 15000 })
    await select(page, 'Anna')
    await page.getByRole('toolbar', { name: 'Selected calls' }).getByRole('button', { name: 'Mark as spam' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Changed' })).toBeVisible()
    await page.evaluate(() => window.history.pushState({}, '', '/analytics?id=test-biz-001'))
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')))
    await expect(page.getByRole('status').filter({ hasText: 'Changed' })).toHaveCount(0)
  })

  test('after a bulk gesture an opened call\'s chips show the new value (R2 review, finding 1)', async ({ authenticatedPage: page }) => {
    await mockConversations(page, calls)
    const { sent } = await mockClassifications(page, { calls: { 'CON-a': judged({ conversationId: 'CON-a', requests: [] }) } })
    await page.goto(`/conversations?id=${BUSINESS_ID}&conversation=CON-a`)
    const opened = page.locator('.opened-card')
    await expect(opened.getByRole('button', { name: /^Resolution: Resolved/ })).toBeVisible({ timeout: 15000 })
    await select(page, 'Anna')
    const readsBefore = sent.filter((s) => s.path === 'classifications' && s.id === 'CON-a').length
    await page.getByRole('toolbar', { name: 'Selected calls' }).getByRole('button', { name: 'Mark as spam' }).click()
    await expect(opened.getByRole('button', { name: /^Resolution: Spam or wrong number, Corrected/ })).toBeVisible()
    // from the bulk answer's `calls` (StarChat a012b6926), not from a read of the call
    expect(sent.filter((s) => s.path === 'classifications' && s.id === 'CON-a').length).toBe(readsBefore)
  })

  test('"change outcome" offers the values; "confirm" confirms; a call without a judged outcome is left out and said', async ({ authenticatedPage: page }) => {
    await mockConversations(page, calls)
    const { sent } = await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}`)
    await expect(page.locator('.conversation-card').filter({ hasText: 'Carla' })).toBeVisible({ timeout: 15000 })
    await select(page, 'Anna')
    await select(page, 'Carla')
    const bar = page.getByRole('toolbar', { name: 'Selected calls' })
    await bar.getByRole('button', { name: 'Change outcome' }).click()
    await page.getByRole('listbox').getByRole('option', { name: 'Handed over', exact: true }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'bulk').length).toBe(1)
    const bulk = sent.filter((s) => s.path === 'bulk').pop()
    expect(bulk.body.items).toEqual([{ subject: 'call', conversationId: 'CON-a', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'handed_over' }])
    await expect(page.getByText('1 call without a judged outcome was left out.')).toBeVisible()
    await select(page, 'Anna')
    await page.getByRole('toolbar', { name: 'Selected calls' }).getByRole('button', { name: 'Confirm' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'bulk').length).toBe(2)
    expect(sent.filter((s) => s.path === 'bulk').pop().body.items[0]).toMatchObject({ conversationId: 'CON-a', signal: 'right' })
  })

  test('under 600 px the selection is a long-press mode and its actions sit in a bottom bar', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockConversations(page, calls)
    await mockClassifications(page)
    await page.goto(`/conversations?id=${BUSINESS_ID}`)
    await expect(page.locator('.conversation-card').filter({ hasText: 'Anna' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('checkbox', { name: 'Select the call of Anna' })).toBeHidden()
    await select(page, 'Anna')
    const bar = page.getByRole('toolbar', { name: 'Selected calls' })
    const box = await bar.boundingBox()
    expect(Math.round(box.y + box.height)).toBe(812)
  })
})
