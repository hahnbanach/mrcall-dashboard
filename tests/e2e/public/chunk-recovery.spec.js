// @ts-check
const { test, expect } = require('@playwright/test')
const { SigninPage } = require('../pages/signin.page')

/**
 * Plan docs/execution-plans/2026-10-23-dashboard-load.md, M2: every page is loaded on demand, so a page's code can be
 * missing when it is asked for: a tab opened before a deploy asks for a chunk the deploy replaced, or the network
 * drops one request. The router then reloads the page it was going to, once, and that load fetches the chunk again.
 *
 * The sign-in page's chunk (webpackChunkName "sign") is refused once: the page must still show its form, after one
 * refused request and a second one that succeeds. Seen failing on the base commit c02054f, where the sign-in page is in
 * the main bundle and no chunk is ever asked for.
 */
test('a page whose chunk fails to load once is loaded again and shown', async ({ page }) => {
  await page.route('**/googleapis.com/**', (route) => route.abort())
  await page.route('**/google-analytics.com/**', (route) => route.abort())
  await page.route('**/googletagmanager.com/**', (route) => route.abort())

  let asked = 0
  await page.route(/\/js\/sign(\.[0-9a-f]+)?\.js(\?.*)?$/, (route) => {
    asked += 1
    return asked === 1 ? route.abort() : route.continue()
  })

  await new SigninPage(page).goto()
  await new SigninPage(page).expectFormVisible()
  expect(asked, 'the sign-in chunk refused once, then fetched again').toBe(2)
  // the marker that stops a reload loop is cleared once the page is shown
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('chunk-reload:')))).toEqual([])
})

test('a chunk that keeps failing is not reloaded in a loop', async ({ page }) => {
  await page.route('**/googleapis.com/**', (route) => route.abort())
  await page.route('**/google-analytics.com/**', (route) => route.abort())
  await page.route('**/googletagmanager.com/**', (route) => route.abort())

  let asked = 0
  await page.route(/\/js\/sign(\.[0-9a-f]+)?\.js(\?.*)?$/, (route) => {
    asked += 1
    return route.abort()
  })
  let documents = 0
  // the app's own page loads only: Google Tag Manager adds an iframe document of its own
  page.on('request', (r) => { if (r.resourceType() === 'document' && r.url().endsWith('/signin')) documents += 1 })

  await page.goto('/signin')
  await page.waitForTimeout(4000)
  // one reload, never a second: the first failure reloads, the second is left to fail
  expect(documents).toBe(2)
  expect(asked).toBe(2)
})
