// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockResellerUser } = require('../fixtures/mock-data')
const { mockInsights } = require('../fixtures/insights')
const { mockClassifications, mockConversations, conversation, judged, CALL_ID, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-11-09-caller-checks-correction.md (StarChat 9.34.131, its step K13): a call's checks
 * `caller_repeated` and `caller_unsatisfied` corrected from the call view as resolution and message are. A chip for each
 * check the call recorded (`checks.<name>.model` non-null), its menu without "wrong", the fired-checks list leaving out
 * the checks that have a chip, nothing before the read, the assistant's words and the call's subject when the details
 * carry them, and a queue's line on a check in words.
 *
 * Seen failing on c855a16 (the source before this change, with these fixtures): all eight cases on desktop.
 */
const REPEATED = 'The caller had to repeat themselves'
const UNSATISFIED = 'The caller seemed unsatisfied'
const PROMISE = 'A promise made in the call was not kept'
const checks = (over = {}) => ({
  caller_repeated: { model: 'true', value: 'true', corrected: false },
  caller_unsatisfied: { model: null, value: null, corrected: false },
  ...over,
})
const withChecks = (over = {}) => conversation({
  details: {
    ...conversation().details,
    checks: { caller_repeated: true, caller_unsatisfied: false, promise_not_kept_in_call: true },
    ...over,
  },
})
const open = (page) => page.goto(`/conversations?id=${BUSINESS_ID}&conversation=${CALL_ID}`)
const opened = (page) => page.locator('.opened-card')
const chip = (page, name) => opened(page).getByRole('button', { name })
const fired = (page) => opened(page).locator('.insight-checks')
const bar = (page) => page.locator('.undo-bar-region')
const feedbackOn = (sent, field) => sent.filter((s) => s.path === 'feedback' && s.method === 'POST' && s.body.field === field)

test.describe('a call\'s checks corrected from the call view', () => {
  test('one chip for the check the call recorded, corrected to No and undone', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [withChecks()])
    const { sent } = await mockClassifications(page, { calls: { [CALL_ID]: judged({ checks: checks() }) } })
    await open(page)
    await expect(chip(page, new RegExp('^' + REPEATED + ': Yes$'))).toBeVisible({ timeout: 15000 })
    await expect(chip(page, new RegExp(UNSATISFIED))).toHaveCount(0)
    await expect(chip(page, new RegExp(PROMISE))).toHaveCount(0)
    // the fired list leaves out the check that has its chip, and keeps the promise
    await expect(fired(page)).toContainText(PROMISE)
    await expect(fired(page)).not.toContainText(REPEATED)

    await chip(page, new RegExp('^' + REPEATED + ': Yes$')).click()
    const menu = page.getByRole('listbox')
    await expect(menu.getByRole('option', { name: 'Yes', exact: true })).toBeVisible()
    await expect(menu.getByRole('option', { name: 'It is correct' })).toBeVisible()
    await expect(menu.getByRole('option', { name: 'History' })).toBeVisible()
    await expect(menu.getByRole('option', { name: /It is wrong/ })).toHaveCount(0)
    await menu.getByRole('option', { name: 'No', exact: true }).click()

    await expect.poll(() => feedbackOn(sent, 'caller_repeated').length).toBe(1)
    const { gestureId, ...body } = feedbackOn(sent, 'caller_repeated')[0].body
    expect(typeof gestureId).toBe('string')
    expect(body).toEqual({ subject: 'call', conversationId: CALL_ID, field: 'caller_repeated', signal: 'wrong_value', valueFrom: 'true', valueTo: 'false' })
    await expect(chip(page, new RegExp('^' + REPEATED + ': No, Corrected'))).toBeVisible()

    await bar(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'gesture-revert').length).toBe(1)
    await expect(chip(page, new RegExp('^' + REPEATED + ': Yes$'))).toBeVisible()
    expect(feedbackOn(sent, 'caller_unsatisfied')).toEqual([])
    expect(feedbackOn(sent, 'promise_not_kept_in_call')).toEqual([])
  })

  test('a check the model answered "false" has its chip too, and a stale value takes the current one', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [withChecks({ checks: { caller_repeated: false, caller_unsatisfied: false } })])
    const { sent } = await mockClassifications(page, {
      calls: { [CALL_ID]: judged({ checks: checks({ caller_repeated: { model: 'false', value: 'false', corrected: false }, caller_unsatisfied: { model: 'false', value: 'false', corrected: false } }) }) },
      staleOnce: { field: 'caller_unsatisfied', value: 'true' },
    })
    await open(page)
    await expect(chip(page, new RegExp('^' + REPEATED + ': No$'))).toBeVisible({ timeout: 15000 })
    await chip(page, new RegExp('^' + UNSATISFIED + ': No$')).click()
    await page.getByRole('listbox').getByRole('option', { name: 'Yes', exact: true }).click()
    await expect.poll(() => feedbackOn(sent, 'caller_unsatisfied').length).toBe(1)
    // another person had set it to Yes: the refusal's current value is taken
    await expect(opened(page).getByRole('alert')).toBeVisible()
    await expect(chip(page, new RegExp('^' + UNSATISFIED + ': Yes'))).toBeVisible()
  })

  test('an answer without checks draws the panel as before: the fired list whole, no check chip', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [withChecks({ checkCauses: { caller_repeated: 'Could you say the number again?' } })])
    const { sent } = await mockClassifications(page)
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await expect.poll(() => sent.filter((s) => s.path === 'classifications').length).toBeGreaterThan(0)
    await expect(fired(page)).toContainText(REPEATED)
    await expect(fired(page)).toContainText(PROMISE)
    await expect(chip(page, new RegExp(REPEATED))).toHaveCount(0)
    // the assistant's words stand under the fired line while the check has no chip
    await expect(fired(page).locator('.insight-check-cause')).toContainText('Could you say the number again?')
  })

  test('the assistant\'s words and the call\'s subject show when the details carry them, and nothing otherwise', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [withChecks({ checkCauses: { caller_repeated: 'Could you say the number again?' }, subject: 'A cleaning next week' })])
    await mockClassifications(page, { calls: { [CALL_ID]: judged({ checks: checks() }) } })
    await open(page)
    await expect(chip(page, new RegExp('^' + REPEATED + ': Yes$'))).toBeVisible({ timeout: 15000 })
    const cause = opened(page).locator('.judgement-cause')
    await expect(cause).toContainText("In the assistant's words")
    await expect(cause.locator('q')).toHaveText('Could you say the number again?')
    await expect(opened(page).locator('.insight-subject')).toContainText('Subject')
    await expect(opened(page).locator('.insight-subject')).toContainText('A cleaning next week')
    await expect(opened(page).locator('.insight-check-cause')).toHaveCount(0)
  })

  test('without the cause and the subject, neither line is drawn', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [withChecks()])
    await mockClassifications(page, { calls: { [CALL_ID]: judged({ checks: checks() }) } })
    await open(page)
    await expect(chip(page, new RegExp('^' + REPEATED + ': Yes$'))).toBeVisible({ timeout: 15000 })
    await expect(opened(page).locator('.judgement-cause, .insight-check-cause, .insight-subject')).toHaveCount(0)
  })
})

test('a reader who does not own the call sees the fired list before the read, and the chip after it', async ({ page }) => {
  await setupAuthPage(page, mockResellerUser, 'reseller')
  const reduced = { id: 'CON-r1', businessId: BUSINESS_ID, startTimestamp: Date.UTC(2026, 9, 20, 9, 30), contactNumber: '+39****001', details: { resolution: 'resolved', message: 'none', checks: {} } }
  // StarChat sends `details.checks` to a non-owner only for a call opened by its id
  const full = conversation({ id: 'CON-r1', owner: 'test-uid-12345', details: { callerName: 'Rita', summary: 'Asked about prices.', resolution: 'resolved', message: 'none', checks: { caller_repeated: true } } })
  await mockConversations(page, [reduced], { byId: [full] })
  const { sent } = await mockClassifications(page, { role: 'reseller', calls: { 'CON-r1': judged({ conversationId: 'CON-r1', checks: checks() }) } })
  await page.goto(`/conversations?id=${BUSINESS_ID}&conversation=CON-r1`)
  await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
  await expect(fired(page)).toContainText(REPEATED)
  await expect(chip(page, new RegExp(REPEATED))).toHaveCount(0)
  expect(sent.filter((s) => s.path === 'classifications')).toEqual([])
  // opening a chip reads the judgements (the recorded opening); the check's chip then replaces its line
  await chip(page, /^Resolution: Resolved/).click()
  await expect.poll(() => sent.filter((s) => s.path === 'classifications').length).toBe(1)
  await page.keyboard.press('Escape')
  await expect(chip(page, new RegExp('^' + REPEATED + ': Yes$'))).toBeVisible()
  await expect(opened(page).locator('.insight-checks-wrapper')).toHaveCount(0)
})

for (const [locale, line] of [['en-US', REPEATED + ': Yes → No'], ['it-IT', 'Il chiamante ha dovuto ripetersi: Sì → No']]) {
  // an agent's correction (a delegated token, an MCP tool) is only ever a proposal, and it is listed as one
  test(`a proposal on a check reads in words in the reader's proposals (${locale})`, async ({ authenticatedPage: page }) => {
    if (locale !== 'en-US') await page.addInitScript((l) => localStorage.setItem('mrcall-user-locale', l), locale)
    await mockInsights(page)
    const at = Date.UTC(2026, 10, 9, 9, 0)
    const mine = {
      total: 1, asOf: 1,
      groups: [{ businessId: BUSINESS_ID, businessName: 'Test Restaurant', calls: 1, items: 1,
        signals: [{
          feedbackId: 31, businessId: BUSINESS_ID, conversationId: CALL_ID, callStart: at, subject: 'call', field: 'caller_repeated',
          signal: 'wrong_value', valueFrom: 'true', valueTo: 'false', source: 'agent', status: 'proposed', actorRole: 'owner',
          actorName: 'Mario Rossi', byMe: true, createdAt: at, businessName: 'Test Restaurant',
        }] }],
      items: [],
    }
    await mockClassifications(page, { queue: () => mine })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const section = page.locator('section, [role="region"]').filter({ hasText: line })
    await expect(section.first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('caller_repeated')).toHaveCount(0)
  })
}
