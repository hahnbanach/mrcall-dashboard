// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')

// The analytics page filters by business and owner through the request body that StarChat's
// AnalyticsDateRange decodes. These tests read the bodies the page actually sends, because a
// filter that only changes the inputs and the URL would look right and filter nothing.
//
// Seen failing on 2026-10-03: against the component before the filter existed, all three fail
// (the URL test on "dashboard: expected owner-1, received undefined"); with the inputs present
// but the businessId line removed from buildRequestBody, the first fails the same way.
// Seen failing on 2026-10-04 with the plan line removed from buildRequestBody: the plan test
// reports "expected professional, received undefined".

const ENDPOINTS = ['dashboard', 'timeseries', 'duration-distribution', 'hourly-heatmap', 'callers', 'business-breakdown']

const RESPONSES = {
  dashboard: { totalCalls: 5, avgCallDurationMs: 60000, totalCallDurationMs: 300000, uniqueCallers: 4 },
  timeseries: { buckets: [] },
  'duration-distribution': { distribution: [] },
  'hourly-heatmap': { heatmap: [] },
  callers: { topCallers: [] },
  'business-breakdown': {
    businesses: [
      { businessId: 'biz-a', totalCalls: 3, avgCallDurationMs: 60000, totalCallDurationMs: 180000, uniqueCallers: 2 },
      { businessId: 'biz-b', totalCalls: 2, avgCallDurationMs: 60000, totalCallDurationMs: 120000, uniqueCallers: 2 },
    ],
  },
}

/** Answers the six analytics endpoints and records every body sent to them, in order. */
async function recordAnalytics(page) {
  const requests = []
  // Registered after the fixture's catch-all, so Playwright checks it first.
  await page.route('**/customer/analytics/**', (route) => {
    const url = new URL(route.request().url())
    const endpoint = url.pathname.split('/').pop()
    requests.push({ endpoint, body: route.request().postDataJSON(), query: Object.fromEntries(url.searchParams) })
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESPONSES[endpoint] || {}) })
  })
  // The plan dropdown is filled from the template list.
  await page.route('**/crm/template?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ name: 'professional', humanName: 'Professional' }, { name: 'basic', humanName: 'Basic' }]),
  }))
  return requests
}

/** The requests sent since `from`, keyed by endpoint (the latest one wins). */
function latestSince(requests, from) {
  const byEndpoint = {}
  requests.slice(from).forEach(r => { byEndpoint[r.endpoint] = r.body })
  return byEndpoint
}

test.describe('Analytics filters (Admin Role)', () => {
  test('applying a business ID sends it to every endpoint', async ({ adminPage }) => {
    const requests = await recordAnalytics(adminPage)
    await adminPage.goto('/analytics-admin')
    await expect.poll(() => requests.filter(r => r.endpoint === 'business-breakdown').length).toBeGreaterThan(0)

    const before = requests.length
    await adminPage.getByRole('textbox', { name: 'Business ID' }).fill('  biz-a  ')
    await adminPage.getByRole('button', { name: 'Apply' }).click()

    await expect(adminPage).toHaveURL(/[?&]businessId=biz-a(&|$)/)
    // The breakdown included: StarChat honours businessId there since 9.34.29.
    await expect.poll(() => Object.keys(latestSince(requests, before)).sort()).toEqual([...ENDPOINTS].sort())
    const sent = latestSince(requests, before)
    for (const endpoint of ENDPOINTS) {
      expect(sent[endpoint].businessId, endpoint).toBe('biz-a')
      expect(sent[endpoint].ownerId, endpoint).toBeUndefined()
      expect(sent[endpoint].plan, endpoint).toBeUndefined()
    }
  })

  test('choosing a plan sends it to every endpoint and keeps it in the URL', async ({ adminPage }) => {
    const requests = await recordAnalytics(adminPage)
    await adminPage.goto('/analytics-admin')
    await expect.poll(() => requests.length).toBeGreaterThan(0)

    const before = requests.length
    await adminPage.getByRole('combobox', { name: 'Plan' }).click()
    await adminPage.getByRole('option', { name: 'Professional (professional)' }).click()
    await adminPage.getByRole('button', { name: 'Apply' }).click()

    await expect(adminPage).toHaveURL(/[?&]plan=professional(&|$)/)
    await expect.poll(() => Object.keys(latestSince(requests, before)).length).toBe(ENDPOINTS.length)
    for (const [endpoint, body] of Object.entries(latestSince(requests, before))) {
      expect(body.plan, endpoint).toBe('professional')
    }
  })

  test('an owner ID in the URL filters the first load and fills the input', async ({ adminPage }) => {
    const requests = await recordAnalytics(adminPage)
    await adminPage.goto('/analytics-admin?ownerId=owner-1')

    await expect.poll(() => Object.keys(latestSince(requests, 0)).length).toBe(ENDPOINTS.length)
    for (const r of requests) {
      expect(r.body.ownerId, r.endpoint).toBe('owner-1')
      expect(r.body.businessId, r.endpoint).toBeUndefined()
    }
    await expect(adminPage.getByRole('textbox', { name: 'Owner ID' })).toHaveValue('owner-1')
  })

  test('selecting a breakdown row filters by that business, and clear removes the filter', async ({ adminPage }) => {
    const requests = await recordAnalytics(adminPage)
    await adminPage.goto('/analytics-admin')

    // Any cell selects the row. The row's centre, not the business ID cell, because on mobile
    // the fixed assistance button sits over the bottom-left corner and this is the last row.
    await adminPage.getByRole('row', { name: /biz-b/ }).click()
    await expect(adminPage).toHaveURL(/[?&]businessId=biz-b(&|$)/)
    await expect(adminPage.getByRole('textbox', { name: 'Business ID' })).toHaveValue('biz-b')

    const before = requests.length
    await adminPage.getByRole('button', { name: 'Clear' }).click()
    await expect(adminPage).not.toHaveURL(/businessId=/)
    await expect.poll(() => Object.keys(latestSince(requests, before)).length).toBe(ENDPOINTS.length)
    for (const body of Object.values(latestSince(requests, before))) {
      expect(body.businessId).toBeUndefined()
    }
  })
})

test.describe('Analytics time zone (Admin Role)', () => {
  // A zone whose day boundary differs from UTC, so a page that sent nothing (StarChat then
  // buckets in UTC) or sent a fixed zone would be told apart from one that sends the browser's.
  // Asia/Tokyo and not Asia/Kolkata: Chromium reports the latter as its legacy alias
  // Asia/Calcutta. Seen failing on 2026-10-03 with timezone dropped from the timeseries URL.
  test.use({ timezoneId: 'Asia/Tokyo' })

  test('the time series and the heatmap are cut in the browser time zone', async ({ adminPage }) => {
    const requests = await recordAnalytics(adminPage)
    await adminPage.goto('/analytics-admin')

    await expect.poll(() => requests.filter(r => r.endpoint === 'timeseries').length).toBeGreaterThan(0)
    for (const r of requests.filter(r => r.endpoint === 'timeseries' || r.endpoint === 'hourly-heatmap')) {
      expect(r.query.timezone, r.endpoint).toBe('Asia/Tokyo')
    }
  })
})
