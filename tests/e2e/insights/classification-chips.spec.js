// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockClassifications, mockConversations, conversation, judged, CALL_ID, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 1 and 2 (StarChat's brief, decisions 6, 9 and 12):
 * every judgement of a call is a chip naming its value and state; a tap opens a listbox of the other values and of
 * "right", "wrong", "restore", "history"; a choice applies at once or proposes; one undo bar per gesture, no time
 * limit; after a gesture, an undo or a refusal the chips take the call's state the answer carries, with no read of the
 * call (StarChat a012b6926). The call is opened by its deep link
 * (`?conversation=`), the owner's own.
 *
 * Seen failing, 2026-10-27, before CallJudgements.vue, JudgementChip.vue and UndoBar.vue existed: every case, on the
 * missing chip buttons (the panel drew today's plain rows), except "classifications 404", which passed on the old
 * panel by construction and was then seen failing by perturbation (the panel drawing chips from `details` alone).
 * Later cases, each seen failing on the commit before its code: the fact report (perturbation), focus back on the chip
 * and a confirmation in the history (dec211e), no read after a gesture or an undo and the six facts (2d39e13), the
 * single read after a stale value (0cc7469); an answer without the call's state, a refused read after it and no facts
 * served (259ff67); a fact report without the call's state keeping the fact (b940b29).
 */
const open = (page) => page.goto(`/conversations?id=${BUSINESS_ID}&conversation=${CALL_ID}`)
const opened = (page) => page.locator('.opened-card')
const chip = (page, name) => opened(page).getByRole('button', { name })
const reads = (sent) => sent.filter((s) => s.path === 'classifications').length

async function choose (page, chipName, option) {
  await chip(page, chipName).click()
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click()
}

test.describe('a call\'s judgements as chips', () => {
  test('the resolution is corrected at once, said on its chip, and undone from the bar', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    const before = reads(sent)
    await choose(page, /^Resolution: Resolved/, 'Unresolved')
    await expect.poll(() => sent.filter((s) => s.path === 'feedback' && s.method === 'POST').length).toBe(1)
    const signal = sent.find((s) => s.path === 'feedback' && s.method === 'POST')
    expect(signal.body).toMatchObject({ subject: 'call', conversationId: CALL_ID, field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved' })
    expect(signal.body.gestureId).toMatch(/^[0-9a-f-]{20,}$/)
    await expect(chip(page, /^Resolution: Unresolved, Corrected \(from Resolved to Unresolved, you, /)).toBeVisible()
    // the gesture's answer carries the call's state (StarChat a012b6926): the judgements are not read again
    expect(reads(sent)).toBe(before)
    const bar = page.getByRole('status').filter({ hasText: 'Changed' })
    await expect(bar).toBeVisible()
    // no time limit: still there well past a toast's life
    await page.waitForTimeout(6000)
    await expect(bar).toBeVisible()
    await bar.getByRole('button', { name: 'Undo' }).click()
    expect(sent.find((s) => s.path === 'gesture-revert').gestureId).toBe(signal.body.gestureId)
    await expect(chip(page, /^Resolution: Resolved$/)).toBeVisible()
    // the undo's answer carries the call's state too
    expect(reads(sent)).toBe(before)
  })

  test('an answer without the call\'s state (a reader who may not open the call now) takes the judged value and reads the call again', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page, { partialState: true })
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    const before = reads(sent)
    await choose(page, /^Resolution: Resolved/, 'Unresolved')
    await expect(chip(page, /^Resolution: Unresolved, Corrected \(from Resolved to Unresolved, /)).toBeVisible()
    await expect.poll(() => reads(sent)).toBe(before + 1)
    await expect(chip(page, /^Message: /)).toBeVisible()
    await page.getByRole('status').filter({ hasText: 'Changed' }).getByRole('button', { name: 'Undo' }).click()
    await expect(chip(page, /^Resolution: Resolved$/)).toBeVisible()
    await expect.poll(() => reads(sent)).toBe(before + 2)
  })

  test('when that read is refused (404), the chips stay as the answer left them', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page, { partialState: true, unreadable: true })
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    const before = reads(sent)
    await choose(page, /^Resolution: Resolved/, 'Unresolved')
    await expect.poll(() => reads(sent)).toBe(before + 1)
    await expect(chip(page, /^Resolution: Unresolved, Corrected \(from Resolved to Unresolved, /)).toBeVisible()
    await expect(chip(page, /^Message: /)).toBeVisible()
  })

  test('against a StarChat that serves no facts, no fact is offered for a report', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    await mockClassifications(page, { calls: { [CALL_ID]: judged({ facts: undefined }) } })
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await expect(chip(page, /^Report an error on a fact/)).toHaveCount(0)
  })

  test('each request shows its outcome and its category; an owner\'s category is a proposal, its outcome applies', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    const requests = opened(page).getByRole('list', { name: 'Requests' })
    await expect(requests.getByRole('listitem')).toHaveCount(2, { timeout: 15000 })
    await expect(requests.getByRole('listitem').nth(1)).toContainText('Asks how much a whitening costs')
    await choose(page, /^Request outcome: Not met/, 'Taken for the business')
    await expect(chip(page, /^Request outcome: Taken for the business, Corrected/)).toBeVisible()
    await choose(page, /^Category: Prices and quotes/, 'Opening hours')
    await expect.poll(() => sent.filter((s) => s.path === 'feedback' && s.method === 'POST').length).toBe(2)
    const proposal = sent.filter((s) => s.path === 'feedback' && s.method === 'POST').pop()
    expect(proposal.body).toMatchObject({ subject: 'request', requestId: 102, field: 'category', valueFrom: 'prices', valueTo: 'opening_hours' })
    // the value stays until an admin applies it; the chip says the proposal went
    await expect(chip(page, /^Category: Prices and quotes, Proposal sent/)).toBeVisible()
  })

  test('an admin (not the owner) reads the judgements only when opening one; its category applies at once', async ({ adminPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page, { role: 'admin' })
    await open(page)
    // the chips come from the call's own details: no judgements read, which StarChat would record as an opening
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await expect(chip(page, /^Request outcome: Not met/)).toBeVisible()
    expect(reads(sent)).toBe(0)
    await chip(page, /^Resolution: Resolved/).click()
    await expect(page.getByRole('listbox')).toBeVisible()
    expect(reads(sent)).toBe(1)
    await page.keyboard.press('Escape')
    await choose(page, /^Category: Prices and quotes/, 'Opening hours')
    await expect(chip(page, /^Category: Opening hours, Corrected/)).toBeVisible({ timeout: 15000 })
  })

  test('"wrong, I don\'t know which" is a proposal and changes no value', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await choose(page, /^Message: No message/, 'It is wrong, I don\'t know which')
    await expect.poll(() => sent.filter((s) => s.path === 'feedback').length).toBe(1)
    expect(sent.filter((s) => s.path === 'feedback').pop().body).toMatchObject({ field: 'message', signal: 'wrong', valueFrom: 'none' })
    expect(sent.filter((s) => s.path === 'feedback').pop().body.valueTo).toBeUndefined()
    await expect(chip(page, /^Message: No message, Proposal sent/)).toBeVisible()
  })

  test('"right" confirms the value', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await choose(page, /^Resolution: Resolved/, 'It is correct')
    await expect.poll(() => sent.filter((s) => s.path === 'feedback').length).toBe(1)
    expect(sent.filter((s) => s.path === 'feedback').pop().body).toMatchObject({ field: 'resolution', signal: 'right', valueFrom: 'resolved' })
    await expect(chip(page, /^Resolution: Resolved, Confirmed/)).toBeVisible()
  })

  test('a fact is reported wrong to MrCall, never corrected (StarChat 6d13718c6)', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    // the six facts StarChat reads (a012b6926), each with the value read, null included
    await chip(page, 'Report an error on a fact').click()
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(6)
    await page.getByRole('listbox').getByRole('option', { name: 'Transfer: not known' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'feedback' && s.method === 'POST').length).toBe(1)
    expect(sent.filter((s) => s.path === 'feedback').pop().body).toMatchObject({ subject: 'call', conversationId: CALL_ID, field: 'transferred', signal: 'fact_wrong', valueFrom: null })
    expect(sent.filter((s) => s.path === 'feedback').pop().body.valueTo).toBeUndefined()
    await expect(opened(page).getByText('Reported to MrCall: Transfer')).toBeVisible()
    await chip(page, 'Report an error on a fact').click()
    await page.getByRole('listbox').getByRole('option', { name: 'Booking: Booked' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'feedback' && s.method === 'POST').length).toBe(2)
    expect(sent.filter((s) => s.path === 'feedback').pop().body).toMatchObject({ field: 'booked', signal: 'fact_wrong', valueFrom: 'true' })
  })

  test('a fact report answered without the call\'s state changes no fact, though the read after it is refused (C10, third round)', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page, { partialState: true, unreadable: true })
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    await chip(page, 'Report an error on a fact').click()
    await page.getByRole('listbox').getByRole('option', { name: 'Booking: Booked' }).click()
    await expect.poll(() => reads(sent)).toBe(2)
    await expect(opened(page).getByText('Reported to MrCall: Booking')).toBeVisible()
    await chip(page, 'Report an error on a fact').click()
    await expect(page.getByRole('listbox').getByRole('option', { name: 'Booking: Booked' })).toBeVisible()
  })

  test('the author restores the analysis\'s value, and reads the history', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const call = judged({
      resolution: { model: 'resolved', value: 'unresolved', corrected: true, previous: ['resolved'] },
      history: [
        { feedbackId: 77, subject: 'call', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'unresolved', source: 'person', status: 'applied', actorRole: 'owner', actorName: 'Mario Rossi', byMe: true, createdAt: Date.UTC(2026, 9, 21, 8) },
        { feedbackId: 78, subject: 'call', field: 'resolution', signal: 'right', valueFrom: 'unresolved', valueTo: 'unresolved', source: 'person', status: 'confirmed', actorRole: 'reseller', actorName: 'Partner Srl', byMe: false, createdAt: Date.UTC(2026, 9, 22, 8) },
      ],
    })
    const { sent } = await mockClassifications(page, { calls: { [CALL_ID]: call } })
    await open(page)
    await chip(page, /^Resolution: Unresolved, Corrected/).click()
    await page.getByRole('listbox').getByRole('option', { name: 'History' }).click()
    const history = opened(page).getByRole('list', { name: 'History of Resolution' })
    // a confirmation is listed with its own state, never as a raw key (R2 review, finding 6)
    await expect(history.getByRole('listitem')).toHaveText([/Unresolved confirmed, Partner Srl, .*Confirmed/, /Resolved → Unresolved, Mario Rossi, .*Applied/])
    await choose(page, /^Resolution: Unresolved, Corrected/, 'Restore the analysis\'s value')
    await expect.poll(() => sent.filter((s) => s.path === 'decide').length).toBe(1)
    expect(sent.find((s) => s.path === 'decide')).toMatchObject({ id: 77, move: 'revert' })
    await expect(chip(page, /^Resolution: Resolved$/)).toBeVisible()
  })

  test('a value changed meanwhile is said, and the chip shows the current one and who changed it', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page, { staleOnce: { field: 'resolution', value: 'handed_over' } })
    await open(page)
    await expect(chip(page, /^Resolution: Resolved/)).toBeVisible({ timeout: 15000 })
    const before = reads(sent)
    await choose(page, /^Resolution: Resolved/, 'Unresolved')
    await expect(opened(page).getByRole('alert')).toContainText('This value changed meanwhile')
    // the refusal carries only the current value; the judgements are then read once, for the history the other person
    // wrote (brief, second amendment, item 10)
    await expect(chip(page, /^Resolution: Handed over, Corrected \(from Resolved to Handed over, Partner Srl, /)).toBeVisible()
    expect(reads(sent)).toBe(before + 1)
  })

  test('without the category list, no category chip and never a raw key', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    await mockClassifications(page, { categories: null })
    await open(page)
    await expect(chip(page, /^Request outcome: Met by the assistant/)).toBeVisible({ timeout: 15000 })
    await expect(chip(page, /^Category:/)).toHaveCount(0)
    await expect(opened(page).getByText('online_booking')).toHaveCount(0)
    await expect(opened(page).getByText('prices', { exact: true })).toHaveCount(0)
  })

  test('without the judgements route (404), the panel is today\'s', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    await mockClassifications(page, { classificationsStatus: 404 })
    await open(page)
    await expect(opened(page).locator('.insight-fact').filter({ hasText: 'Resolution' })).toContainText('Resolved', { timeout: 15000 })
    await expect(chip(page, /^Resolution:/)).toHaveCount(0)
  })

  test('the chip works by keyboard: Enter opens, arrows move, Enter chooses, Escape closes', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    const c = chip(page, /^Message: No message/)
    await expect(c).toBeVisible({ timeout: 15000 })
    await c.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(c).toBeFocused()
    await page.keyboard.press('Enter')
    // the current value is the active option; one down is the next value
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect.poll(() => sent.filter((s) => s.path === 'feedback').length).toBe(1)
    expect(sent.filter((s) => s.path === 'feedback').pop().body).toMatchObject({ field: 'message', valueFrom: 'none' })
    // the focus comes back to the chip once the choice is made (R2 review, finding 4)
    await expect(chip(page, /^Message: No message/)).toBeFocused()
  })

  test('under 600 px the listbox opens as a bottom sheet', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockConversations(page, [conversation()])
    await mockClassifications(page)
    await open(page)
    await chip(page, /^Resolution: Resolved/).click()
    const sheet = page.locator('.judgement-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('listbox')).toBeVisible()
    const box = await sheet.boundingBox()
    expect(Math.round(box.y + box.height)).toBe(812)
  })
})
