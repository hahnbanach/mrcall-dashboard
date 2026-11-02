// @ts-check
const { test, expect } = require('@playwright/test')
const { buildFirebaseUserRecord, interceptFirebaseEndpoints, setupApiMocks } = require('../fixtures/auth')
const { mockUser } = require('../fixtures/mock-data')
const { ORIGIN, HOST } = require('../fixtures/origin')

/**
 * Plan docs/execution-plans/2026-10-23-dashboard-load.md, M6, and the brief's constraint: a session persisted by the
 * release live before this work must survive the upgrade. That release called `setPersistence(browserLocalPersistence)`,
 * which kept the user in localStorage; M6 removes the call, and the SDK starts on its list (IndexedDB, then
 * localStorage). It must find the user in localStorage and land the page signed in.
 */
test('a session kept in localStorage, as v2.2.47 leaves it, lands signed in on a protected page', async ({ page }) => {
  await page.route(`**/${HOST}/__e2e_seed__`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }))
  await page.goto(`${ORIGIN}/__e2e_seed__`)
  const record = buildFirebaseUserRecord(mockUser)
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
    // and nothing in IndexedDB: the user is only where the previous release put it
    indexedDB.deleteDatabase('firebaseLocalStorageDb')
  }, { key: record.fbase_key, value: record.value })
  await page.unroute(`**/${HOST}/__e2e_seed__`)
  await interceptFirebaseEndpoints(page, mockUser)
  await setupApiMocks(page, { role: 'owner' })

  await page.goto('/businesses')
  await expect(page).toHaveURL(/\/businesses/, { timeout: 15000 })
  await expect(page.locator('.business-card').first()).toBeVisible({ timeout: 15000 })
})
