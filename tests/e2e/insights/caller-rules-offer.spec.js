// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockClassifications, mockConversations, conversation, judged, CALL_ID, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * Brief docs/briefs/2026-10-27-classification-feedback.md, scope 3 (StarChat's brief, decision 6, "Caller rules"):
 * marking a call spam offers, once, to treat its number always so and to correct its earlier calls; never for a caller
 * StarChat says is not eligible (anonymous, hidden, web), and never naming the number. "Not spam" on a call a rule
 * judged offers to delete the rule.
 *
 * Written after the offer's code, so seen failing by perturbation of CallJudgements.vue, 2026-10-27: the two calls that
 * make the offers removed, all three cases failed; the eligibility check removed, the second failed (an offer shown for
 * an anonymous caller).
 */
const open = (page) => page.goto(`/conversations?id=${BUSINESS_ID}&conversation=${CALL_ID}`)
const chip = (page, name) => page.locator('.opened-card').getByRole('button', { name })

async function markSpam (page) {
  await chip(page, /^Resolution: Resolved/).click()
  await page.getByRole('listbox').getByRole('option', { name: 'Spam or wrong number', exact: true }).click()
}

test.describe('caller rules from a call marked spam', () => {
  test('marking spam offers to treat the number always so, with its earlier calls, never naming it', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page)
    await open(page)
    await markSpam(page)
    const offer = page.locator('.opened-card').getByText('Always treat this number as spam?')
    await expect(offer).toBeVisible({ timeout: 15000 })
    const earlier = page.getByRole('checkbox', { name: 'Also the 3 earlier calls' })
    await expect(earlier).toBeChecked()
    await expect(page.locator('.judgement-offer').getByText(/333/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Treat as spam' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'caller-rules' && s.method === 'POST').length).toBe(1)
    const post = sent.find((s) => s.path === 'caller-rules' && s.method === 'POST')
    expect(post.query).toEqual({ businessId: BUSINESS_ID })
    expect(post.body).toEqual({ conversationId: CALL_ID, applyToEarlier: true })
    await expect(page.getByText('From now on this number is treated as spam, and 3 earlier calls were corrected.')).toBeVisible()
  })

  test('no offer for a caller who cannot have a rule (anonymous, hidden, web)', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const { sent } = await mockClassifications(page, { ruleCall: { conversationId: CALL_ID, eligible: false, reason: 'anonymous' } })
    await open(page)
    await markSpam(page)
    await expect(chip(page, /^Resolution: Spam or wrong number, Corrected/)).toBeVisible({ timeout: 15000 })
    await expect.poll(() => sent.filter((s) => s.path === 'caller-rules').length).toBe(1)
    await expect(page.getByText('Always treat this number as spam?')).toHaveCount(0)
  })

  test('"not spam" on a call a rule judged offers to delete the rule', async ({ authenticatedPage: page }) => {
    await mockConversations(page, [conversation()])
    const call = judged({
      resolution: { model: 'resolved', value: 'spam_wrong_number', corrected: true, previous: ['resolved'] },
      history: [{ feedbackId: 60, subject: 'call', field: 'resolution', signal: 'wrong_value', valueFrom: 'resolved', valueTo: 'spam_wrong_number', source: 'rule', status: 'applied', actorRole: 'owner', byMe: false, createdAt: Date.UTC(2026, 9, 20, 10) }],
    })
    const { sent } = await mockClassifications(page, { calls: { [CALL_ID]: call }, ruleCall: { conversationId: CALL_ID, eligible: true, caller: '+393330000001', ruleExists: true, earlierCalls: 0 } })
    await open(page)
    await chip(page, /^Resolution: Spam or wrong number/).click()
    await page.getByRole('listbox').getByRole('option', { name: 'Resolved', exact: true }).click()
    await expect(page.getByText('This call was judged spam by a rule on its number. Delete the rule?')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Delete the rule' }).click()
    await expect.poll(() => sent.filter((s) => s.path === 'caller-rules' && s.method === 'DELETE').length).toBe(1)
    const del = sent.find((s) => s.path === 'caller-rules' && s.method === 'DELETE')
    expect(del.query).toEqual({ businessId: BUSINESS_ID, caller: '+393330000001' })
    await expect(page.getByText('The rule is deleted; the calls it marked are counted again.')).toBeVisible()
  })
})
