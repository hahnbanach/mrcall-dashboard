// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockBusiness } = require('../fixtures/mock-data')

/**
 * Call insights on the analytics page (brief `docs/briefs/2026-10-20-call-insights.md`, plan
 * `docs/execution-plans/2026-10-20-call-insights.md`, D4, D11): "How the calls went", "Quality" and "Call
 * reports" on the owner's business page (`/analytics?id=<business>`), and the reseller's scope page
 * (`/analytics` with no business). Mocked at the real StarChat paths (StarChat's own
 * conversation-analytics API reference, §7-11); `setupApiMocks` in `tests/e2e/fixtures/auth.js`
 * already answers the four routes with a shape-correct, empty default, so a test only overrides
 * what it reads.
 */
const BUSINESS_ID = mockBusiness.businessId

function section (page, title) {
  return page.locator('.call-insights-section').filter({ hasText: title })
}

const dimension = (page, title) => section(page, 'How the calls went').locator('.insight-dimension').filter({ hasText: title })

const emptyDimension = { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] }

test.describe('Analytics: how the calls went (owner, business page)', () => {
  test('empty coverage: no call has a resolution or a message yet, nothing booked, nothing transferred', async ({ authenticatedPage: page }) => {
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(section(page, 'How the calls went').getByText('Shares over the 0 calls in which the caller asked for something.')).toBeVisible({ timeout: 15000 })
    await expect(dimension(page, 'Message').getByText('0 of 0 calls were assessed.')).toBeVisible()
    const what = section(page, 'How the calls went')
    await expect(what.getByText('0 of 0 calls with a booking record were booked.')).toBeVisible()
    await expect(what.getByText('0 calls transferred, as reported by the carriers.')).toBeVisible()
  })

  test('partial coverage: resolution and message series and totals marked as the assistant\'s, booked beside the calls it counts on, transferred as a count', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/outcomes*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        granularity: 'daily',
        period: { from: 1699000000000, to: 1700000000000 },
        totalCalls: 20,
        resolution: {
          callsWithValue: 12,
          totals: { resolved: 5, unresolved: 7 },
          previousTotals: { resolved: 4, unresolved: 6 },
          buckets: [{ timestamp: 1700000000000, counts: { resolved: 5, unresolved: 7 } }],
        },
        message: {
          callsWithValue: 9,
          totals: { complete: 6, none: 3 },
          previousTotals: { complete: 3 },
          buckets: [{ timestamp: 1700000000000, counts: { complete: 6, none: 3 } }],
        },
        callsWithBooked: 14,
        booked: 6,
        transferred: 2,
      }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    // the outcome lines are StarChat's `outcome` (tests/e2e/insights/admin.spec.js); this answer predates it
    await expect(dimension(page, 'Message').getByText('9 of 20 calls were assessed.')).toBeVisible({ timeout: 15000 })

    const complete = dimension(page, 'Message').locator('li').filter({ hasText: /^\s*Complete message/ })
    await expect(complete).toContainText('6')
    await expect(complete.getByText('Assessed by the assistant')).toBeVisible()
    await expect(dimension(page, 'Message').locator('li').filter({ hasText: 'No message' }).getByText('Assessed by the assistant')).toBeVisible()
    await expect(dimension(page, 'Message').locator('canvas')).toHaveCount(1)

    const what = section(page, 'How the calls went')
    await expect(what.getByText('6 of 14 calls with a booking record were booked.')).toBeVisible()
    await expect(what.getByText('2 calls transferred, as reported by the carriers.')).toBeVisible()
    // booked and transferred are recorded facts, not assessments
    await expect(what.locator('.insight-facts').getByText('Assessed by the assistant')).toHaveCount(0)
    // transferred is a count, never a share of the calls
    await expect(what.locator('.insight-transferred')).not.toContainText('%')
    await expect(what.locator('.insight-transferred')).not.toContainText('of 20')
  })

  test('owner: the section says it is updating while the new answer is pending, then shows only the new numbers', async ({ authenticatedPage: page }) => {
    const answer = (resolved) => ({
      granularity: 'daily', period: { from: 1, to: 2 }, totalCalls: 20,
      resolution: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
      message: { callsWithValue: resolved, totals: { complete: resolved }, previousTotals: {}, buckets: [] },
      callsWithBooked: 0, booked: 0, transferred: 0,
    })
    let changed = false
    let release
    const gate = new Promise((resolve) => { release = resolve })
    await page.route('**/customer/analytics/outcomes*', async (route) => {
      if (changed) await gate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(changed ? 9 : 5)) })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const what = section(page, 'How the calls went')
    const resolved = dimension(page, 'Message').locator('li').filter({ hasText: /^\s*Complete message/ }).locator('.legend-count')
    await expect(resolved).toHaveText('5', { timeout: 15000 })
    await expect(what).not.toHaveAttribute('aria-busy', 'true')

    changed = true
    await page.getByRole('button', { name: '90 days' }).click()
    await expect(what).toHaveAttribute('aria-busy', 'true')
    await expect(what.getByText('Updating')).toBeVisible()
    await expect(page.getByRole('progressbar').first()).toBeVisible()
    await expect(resolved).toHaveText('5')

    release()
    await expect(resolved).toHaveText('9')
    await expect(what).not.toHaveAttribute('aria-busy', 'true')
    await expect(what.getByText('Updating')).toHaveCount(0)
    await expect(what.locator('.legend-count').filter({ hasText: /^5$/ })).toHaveCount(0)
  })

  test('owner: an earlier period\'s answer arriving after a later one does not replace it', async ({ authenticatedPage: page }) => {
    const answer = (resolved) => ({
      granularity: 'daily', period: { from: 1, to: 2 }, totalCalls: 20,
      resolution: { callsWithValue: 0, totals: {}, previousTotals: {}, buckets: [] },
      message: { callsWithValue: resolved, totals: { complete: resolved }, previousTotals: {}, buckets: [] },
      callsWithBooked: 0, booked: 0, transferred: 0,
    })
    // phase 0: the first period; 1: the 90 days, held until released; 2: the 7 days, answered at once
    let phase = 0
    let release
    const gate = new Promise((resolve) => { release = resolve })
    await page.route('**/customer/analytics/outcomes*', async (route) => {
      const asked = phase
      if (asked === 1) await gate
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(asked === 0 ? 5 : asked === 1 ? 9 : 3)) })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const what = section(page, 'How the calls went')
    const resolved = dimension(page, 'Message').locator('li').filter({ hasText: /^\s*Complete message/ }).locator('.legend-count')
    await expect(resolved).toHaveText('5', { timeout: 15000 })

    phase = 1
    await page.getByRole('button', { name: '90 days' }).click()
    await expect(what).toHaveAttribute('aria-busy', 'true')
    phase = 2
    await page.getByRole('button', { name: '7 days' }).click()
    await expect(resolved).toHaveText('3')
    await expect(what).not.toHaveAttribute('aria-busy', 'true')

    release()
    // the held answer has been delivered once the route handler returns; give the page a moment to (wrongly) apply it
    await page.waitForTimeout(500)
    await expect(resolved).toHaveText('3')
    await expect(what).not.toHaveAttribute('aria-busy', 'true')
  })

  test('a 404 from quality hides the section, with no toast', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/quality*', (route) => route.fulfill({
      status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'not for you' }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(section(page, 'How the calls went')).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'Quality')).toHaveCount(0)
    await expect(page.locator('.p-toast-message')).toHaveCount(0)
  })

  test('a 503 from reports shows a short note, not a failure', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/insights/reports*', (route) => route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'not ready' }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(section(page, 'Automatic reports').getByText('Not available yet.')).toBeVisible({ timeout: 15000 })
  })
})


// The business page asks outcomes for the same granularity and browser time zone the existing
// sections already do (tests/e2e/auth/analytics.spec.js:43-61).
test.describe('Analytics time zone: outcomes (owner, business page)', () => {
  test.use({ timezoneId: 'Asia/Tokyo' })

  test('the outcomes request carries the browser time zone and a granularity', async ({ authenticatedPage: page }) => {
    const seen = []
    await page.route('**/customer/analytics/outcomes*', (route) => {
      const url = new URL(route.request().url())
      seen.push({ granularity: url.searchParams.get('granularity'), timezone: url.searchParams.get('timezone') })
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalCalls: 0, resolution: emptyDimension, message: emptyDimension, callsWithBooked: 0, booked: 0, transferred: 0 }),
      })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect.poll(() => seen.length).toBeGreaterThan(0)
    expect(seen[0].timezone).toBe('Asia/Tokyo')
    expect(seen[0].granularity).toBeTruthy()
  })
})

test.describe('Analytics: the reseller\'s scope page', () => {
  test('opening /analytics directly, in a fresh context, shows the scope page: the owner selector and the whole-scope sections', async ({ resellerPage: page }) => {
    await page.goto('/analytics')
    await expect(page.locator('.owner-selector')).toBeVisible({ timeout: 15000 })
    await expect(section(page, 'How the calls went')).toBeVisible()
    await expect(section(page, 'Quality')).toBeVisible()
    await expect(section(page, 'Assistants to review')).toBeVisible()
    await expect(section(page, 'Callers\' requests')).toBeVisible()
    // the scope page has no business, so no Report and Processing tabs
    await expect(page.getByRole('navigation', { name: 'Statistics sections' })).toHaveCount(0)
  })

  test('an assistants row opens that business: its sections appear', async ({ resellerPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sort: 'not_solved',
        businesses: [{
          businessId: BUSINESS_ID, totalCalls: 10, callsWithResolution: 8, resolution: { unresolved: 3 },
          callsWithChecks: 8, checks: {}, callsWithUnansweredRecorded: 8, callsWithUnanswered: 1,
          gaps: {}, callsWithSkillErrors: 0, extractionsNotOk: 0, extractionsRun: 8,
        }],
      }),
    }))
    await page.goto('/analytics')
    await expect(section(page, 'Assistants to review').getByText(BUSINESS_ID)).toBeVisible({ timeout: 15000 })
    await section(page, 'Assistants to review').getByRole('button', { name: BUSINESS_ID }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]id=${BUSINESS_ID}(&|$)`))
    await expect(page.getByRole('navigation', { name: 'Statistics sections' })).toBeVisible({ timeout: 15000 })
  })
})

/**
 * Brief outcome 9 (amendment of 2026-10-21, StarChat intent 12): the outcomes section says how the
 * calls went, the calls without a conversation sit under it outside every rate, the resolution
 * share is over the calls where the caller asked something, extraction problems leave `not_managed`
 * out, and a topics section reads StarChat's topics route for one business only. The answers are
 * StarChat's analytics guide's own examples (§7, §8, §11).
 */
const outcomesWithNoConversation = {
  granularity: 'daily',
  period: { from: 1706140800000, to: 1706745600000 },
  totalCalls: 120,
  resolution: {
    callsWithValue: 96,
    totals: { resolved: 60, unresolved: 14, handed_over: 9, caller_left: 8, spam_wrong_number: 5 },
    previousTotals: { resolved: 52, unresolved: 17 },
    buckets: [{ timestamp: 1706140800000, counts: { resolved: 7, unresolved: 2, caller_left: 1 } }],
  },
  message: emptyDimension,
  callsWithBooked: 96,
  booked: 20,
  transferred: 7,
  noConversation: { caller_silent: 31, no_credit: 4, talk_and_hangup: 2, not_answered: 1 },
  callsAnswered: 127,
}

// The failure colours of this page: its status error and danger tokens, red, and the orange
// `caller_left` carried before outcome 9.
const FAILURE_COLOURS = ['rgb(239, 68, 68)', 'rgb(220, 38, 38)', 'rgb(249, 115, 22)', 'rgb(255, 0, 0)']

test.describe('Analytics: how the calls went (outcome 9, owner, business page)', () => {
  test('the section is titled for how the calls went, and lists each call without a conversation under its own neutral label, outside every rate', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/outcomes*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(outcomesWithNoConversation),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const how = section(page, 'How the calls went')
    await expect(how.getByRole('heading', { name: 'How the calls went' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'What calls said' })).toHaveCount(0)

    const none = how.locator('.no-conversation')
    await expect(none.getByRole('heading', { name: 'Calls without a conversation' })).toBeVisible()
    await expect(none.getByText('These calls are left out of these statistics.')).toBeVisible()
    const reasons = [
      ['The caller hung up without speaking', '31'],
      ['Refused for lack of credit', '4'],
      ['Message played, then hung up', '2'],
      ['Not answered by the assistant', '1'],
    ]
    for (const [label, count] of reasons) {
      const row = none.locator('li').filter({ hasText: label })
      await expect(row).toHaveCount(1)
      await expect(row.locator('.no-conversation-count')).toHaveText(count)
    }
    // never a rate, never a failure colour
    await expect(none).not.toContainText('%')
    for (const row of await none.locator('li').all()) {
      const colours = await row.evaluate((el) => [el, ...el.querySelectorAll('*')].map((e) => getComputedStyle(e).color))
      for (const colour of colours) expect(FAILURE_COLOURS).not.toContain(colour)
    }
  })

  // the four outcome lines and their base are tests/e2e/insights/admin.spec.js (U16b); what stays outside them is here
  test('caller_left and spam_wrong_number are counted beside the outcome, never in it, each in its own neutral colour', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/outcomes*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(outcomesWithNoConversation),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const resolution = section(page, 'How the calls went').locator('.outcome-block')
    await expect(resolution.locator('.outside-share')).toBeVisible({ timeout: 15000 })
    const outside = resolution.locator('.outside-share')
    await expect(outside.getByRole('heading', { name: 'Not in the share' })).toBeVisible()
    const callerLeft = outside.locator('li').filter({ hasText: 'Spoke but never said what they wanted' })
    const spam = outside.locator('li').filter({ hasText: 'Spam or wrong number' })
    await expect(callerLeft.locator('.legend-count')).toHaveText('8')
    await expect(spam.locator('.legend-count')).toHaveText('5')
    await expect(outside).not.toContainText('%')
    await expect(page.getByText('Caller left', { exact: true })).toHaveCount(0)

    const swatch = (row) => row.locator('.legend-swatch').evaluate((el) => getComputedStyle(el).backgroundColor)
    const callerLeftColour = await swatch(callerLeft)
    const spamColour = await swatch(spam)
    // neutral greys, the page's own tokens (@mrcall_grey_text2, @mrcall_light_grey_1), and not the same one
    expect(callerLeftColour).toBe('rgb(108, 117, 125)')
    expect(spamColour).toBe('rgb(215, 220, 226)')
    expect(FAILURE_COLOURS).not.toContain(callerLeftColour)
    expect(FAILURE_COLOURS).not.toContain(spamColour)
  })

  test('extraction problems count http_error and failed only, over the extractions that ran: not_managed is no problem', async ({ authenticatedPage: page }) => {
    await page.route('**/customer/analytics/quality*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        period: { from: 1706140800000, to: 1706745600000 },
        extractions: { ok: 110, http_error: 2, failed: 1, not_managed: 7 },
        callsWithChecks: 108, checks: {}, callsWithUnansweredRecorded: 108, callsWithUnanswered: 14, gaps: {},
        callsWithSkillErrors: 3,
      }),
    }))
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const extraction = section(page, 'Quality').locator('.quality-group').filter({ hasText: 'Extraction issues' })
    await expect(extraction.locator('.quality-row')).toHaveText('3 of 113 calls', { timeout: 15000 })
  })
})

const topicsAnswer = {
  period: { from: 1706140800000, to: 1706745600000 },
  previousPeriod: { from: 1705536000000, to: 1706140799999 },
  reportPeriodStart: 1705276800000,
  callsWithTopics: 88,
  previousCallsWithTopics: 74,
  topics: [
    { topic: 'Orari di apertura', calls: 31, previousCalls: 28 },
    // model-written text: shown as received, never as markup
    { topic: '<b>costo</b> pulizia', calls: 4, previousCalls: 0 },
  ],
}

test.describe('Analytics: what the calls were about (outcome 9)', () => {
  test('one business: each topic with its calls and the previous period\'s, beside the calls with topics', async ({ authenticatedPage: page }) => {
    const bodies = []
    await page.route('**/customer/analytics/topics*', (route) => {
      bodies.push(route.request().postDataJSON())
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(topicsAnswer) })
    })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const topics = section(page, 'What the calls were about')
    await expect(topics.getByText('88 calls with a topic, 74 in the previous period.')).toBeVisible({ timeout: 15000 })

    const hours = topics.getByRole('row', { name: /Orari di apertura/ })
    await expect(hours.getByRole('cell').nth(1)).toHaveText('31')
    await expect(hours.getByRole('cell').nth(2)).toHaveText('28')
    await expect(topics.getByText('<b>costo</b> pulizia')).toBeVisible()
    await expect(topics.locator('b')).toHaveCount(0)
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) expect(body.businessId).toBe(BUSINESS_ID)
  })

  test('the reseller\'s scope page, several businesses: says to choose one, and never asks the topics route', async ({ resellerPage: page }) => {
    let topicsCalls = 0
    await page.route('**/customer/analytics/topics*', (route) => {
      topicsCalls += 1
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(topicsAnswer) })
    })
    await page.goto('/analytics')
    const topics = section(page, 'What the calls were about')
    await expect(topics.getByText('Choose one business to see what its calls were about.')).toBeVisible({ timeout: 15000 })
    // every other section of the scope page has had its answer
    await expect(section(page, 'How the calls went').getByText('0 of 0 calls were assessed.').first()).toBeVisible()
    await expect(section(page, 'Assistants to review')).toBeVisible()
    await page.waitForTimeout(500)
    expect(topicsCalls).toBe(0)
    await expect(topics.getByRole('table')).toHaveCount(0)
  })
})

/**
 * Brief outcome 10 (amendment of 2026-10-22, StarChat intent 13, M16): every item says who, every list stays
 * light, every filter can be undone where it is set. Fictional businesses only.
 */
const resellerAssistants = {
  sort: 'not_solved',
  businesses: [{
    businessId: BUSINESS_ID, businessName: 'Studio Demo', totalCalls: 10, callsWithResolution: 8, resolution: { unresolved: 3 },
    callsWithChecks: 8, checks: {}, callsWithUnansweredRecorded: 8, callsWithUnanswered: 1,
    gaps: {}, callsWithSkillErrors: 0, extractionsNotOk: 0, extractionsRun: 8,
  }],
}

test.describe('Analytics: the reseller\'s page says who (outcome 10)', () => {
  test('the assistants table shows each business by name, and the business page\'s filter bar undoes the choice where it shows it', async ({ resellerPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(resellerAssistants),
    }))
    await page.goto('/analytics')
    const assistants = section(page, 'Assistants to review')
    await expect(assistants.getByRole('button', { name: 'Studio Demo' })).toBeVisible({ timeout: 15000 })
    await assistants.getByRole('button', { name: 'Studio Demo' }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]id=${BUSINESS_ID}(&|$)`))
    await expect(section(page, 'Quality')).toBeVisible({ timeout: 15000 })

    const bar = page.getByRole('region', { name: 'Active filters' })
    // the business page reads the business's own record, whose company name (the fixture's) wins over a table's
    await expect(bar.getByText('Test Restaurant')).toBeVisible()
    await section(page, 'Quality').scrollIntoViewIfNeeded()
    await expect(bar).toBeInViewport()
    await bar.getByRole('button', { name: 'Clear the business filter' }).click()
    await expect(page).not.toHaveURL(/[?&]id=/)
    await expect(section(page, 'Assistants to review')).toBeVisible()
  })

  test('an owner chosen in the selector shows in the bar and is cleared from it', async ({ resellerPage: page }) => {
    await page.route('**/reseller/managed-owners*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ ownerId: 'owner-9', ownerDisplayName: 'Demo Owner', ownerEmail: 'demo-owner@example.com' }]),
    }))
    const bodies = []
    await page.route('**/customer/analytics/outcomes*', (route) => {
      bodies.push(route.request().postDataJSON())
      route.fallback()
    })
    await page.goto('/analytics')
    await expect(page.locator('.owner-selector')).toBeVisible({ timeout: 15000 })
    await page.locator('.owner-selector').getByRole('combobox').click()
    await page.getByRole('option', { name: /Demo Owner/ }).click()
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByText('Demo Owner')).toBeVisible()
    await expect.poll(() => bodies.some((b) => b.ownerId === 'owner-9')).toBe(true)

    const before = bodies.length
    await bar.getByRole('button', { name: 'Clear the owner filter' }).click()
    await expect(bar.getByRole('button', { name: 'Clear the owner filter' })).toHaveCount(0)
    await expect.poll(() => bodies.length).toBeGreaterThan(before)
    expect(bodies[bodies.length - 1].ownerId).toBeUndefined()
    await expect(page.locator('.owner-selector')).not.toContainText('Demo Owner')
  })

})

test.describe('Analytics: the owner\'s business page names its business (outcome 10)', () => {
  test('the filter bar shows the business by name, with no control to leave it, and the period', async ({ authenticatedPage: page }) => {
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    const bar = page.getByRole('region', { name: 'Active filters' })
    await expect(bar.getByText('Test Restaurant')).toBeVisible({ timeout: 15000 })
    await expect(bar.getByText('Last 30 days')).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Clear the business filter' })).toHaveCount(0)
  })
})

test.describe('Analytics: the first load asks each section once (outcome 10, every list stays light)', () => {
  test('owner, business page: one outcomes request and one dashboard request, not one per watcher', async ({ authenticatedPage: page }) => {
    const counts = { outcomes: 0, dashboard: 0 }
    await page.route('**/customer/analytics/outcomes*', (route) => { counts.outcomes += 1; route.fallback() })
    await page.route('**/customer/analytics/dashboard*', (route) => { counts.dashboard += 1; route.fallback() })
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expect(section(page, 'How the calls went')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)
    expect(counts).toEqual({ outcomes: 1, dashboard: 1 })
  })
})

test.describe('Analytics: the UX review of outcome 10, its findings pinned', () => {
  test('the page is never wider than the screen: every wide block scrolls inside itself', async ({ resellerPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(resellerAssistants),
    }))
    await page.goto('/analytics')
    await expect(section(page, 'Assistants to review').getByText('Studio Demo')).toBeVisible({ timeout: 15000 })
    const widths = await page.locator('#app-central-content').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    expect(widths.scroll).toBeLessThanOrEqual(widths.client)
  })

  test('the reseller\'s scope page, full of sections, does not also say there is no data', async ({ resellerPage: page }) => {
    await page.route('**/customer/analytics/assistants*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(resellerAssistants),
    }))
    await page.goto('/analytics')
    await expect(section(page, 'Assistants to review').getByText('Studio Demo')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(500)
    await expect(page.getByText('No data available')).toHaveCount(0)
  })

})
