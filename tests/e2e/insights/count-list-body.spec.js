// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockClassifications, mockConversations, conversation, BUSINESS_ID } = require('../fixtures/classifications')

/**
 * Plan docs/execution-plans/2026-10-31-analytics-ux.md, step A1: the search body a count's list sends, pinned before
 * its composition moves out of Conversations.vue into Classifications.js (so that the counted-calls panel can build the
 * same body from a link). The pins are the bodies today's code sends, recorded as snapshots on 508b014 before the move:
 * one per filter kind a count can carry, on first load; and, on one address, after the range is cleared, after a control
 * is changed and after a chip is removed, since the page composes every request from its live state and a body rebuilt
 * from the address alone would lose those edits. `leftOut` travels in the query, recorded beside the body.
 */
const FROM = Date.UTC(2026, 9, 1)
const TO = Date.UTC(2026, 9, 31) - 1
const ADDRESSES = {
  outcomeLine: { outcomeLine: 'forwarded_complete' },
  resolution: { resolution: 'caller_left' },
  message: { message: 'incomplete' },
  booked: { booked: 'true' },
  transferred: { transferred: 'true' },
  unanswered: { unanswered: 'true' },
  noConversation: { noConversation: 'caller_silent' },
  topic: { topic: 'Bookings' },
  topicLabel: { topicLabel: ['Prices', 'Hours'] },
  gap: { gap: 'out_of_scope' },
  check: { check: 'caller_repeated' },
  category: { category: 'prices', requestOutcome: ['taken', 'neither'] },
  reportCount: { gap: 'missing_info', leftOut: 'true' },
}

function address (filters) {
  const q = new URLSearchParams({ id: BUSINESS_ID, from: String(FROM), to: String(TO), counted: 'true' })
  for (const [k, v] of Object.entries(filters)) for (const x of [].concat(v)) q.append(k, x)
  return '/conversations?' + q.toString()
}

const lists = (searches) => searches.filter((s) => !s.id)

async function lastListBody (searches, before) {
  await expect.poll(() => lists(searches).length, { timeout: 15000 }).toBeGreaterThan(before)
  // let a debounced second request land before reading the last one
  await new Promise((resolve) => setTimeout(resolve, 600))
  return lists(searches).pop()
}

// keys sorted at every level, so the pin compares content and not the order fields were assigned in
const canonical = (v) => (Array.isArray(v) ? v.map(canonical)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v)
const pin = (body) => JSON.stringify(canonical(body), null, 2)

test.describe('a count list\'s search body (pinned before the A1 move)', () => {
  for (const [name, filters] of Object.entries(ADDRESSES)) {
    test(`first load: ${name}`, async ({ authenticatedPage: page }) => {
      await mockClassifications(page, {})
      const searches = await mockConversations(page, [conversation({ id: 'CON-1', owner: 'test-uid-12345' })])
      await page.goto(address(filters))
      expect(pin(await lastListBody(searches, 0))).toMatchSnapshot(`first-load-${name}.json`)
    })
  }

  test('after the range is cleared, a control changed and a chip removed', async ({ authenticatedPage: page }) => {
    await mockClassifications(page, {})
    const searches = await mockConversations(page, [conversation({ id: 'CON-1', owner: 'test-uid-12345' })])
    await page.goto(address({ gap: 'out_of_scope', message: 'incomplete' }))
    expect(pin(await lastListBody(searches, 0))).toMatchSnapshot('edit-0-load.json')

    let n = lists(searches).length
    await page.locator('.filter-control .clear-btn').first().click()
    expect(pin(await lastListBody(searches, n))).toMatchSnapshot('edit-1-range-cleared.json')

    n = lists(searches).length
    await page.getByRole('button', { name: 'Unanswered questions' }).click()
    expect(pin(await lastListBody(searches, n))).toMatchSnapshot('edit-2-control-changed.json')

    n = lists(searches).length
    await page.getByRole('group', { name: /filter/i }).getByRole('button').first().click()
    expect(pin(await lastListBody(searches, n))).toMatchSnapshot('edit-3-chip-removed.json')
  })
})
