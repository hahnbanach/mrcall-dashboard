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
  // the second attempt is the reload's; then nothing more may come
  await expect.poll(() => asked, { timeout: 15000 }).toBe(2)
  await page.waitForTimeout(3000)
  // one reload, never a second: the first failure reloads, the second is left to fail
  expect(documents).toBe(2)
  expect(asked).toBe(2)
  // and the page says so, with a way to try again, rather than staying blank (M6: the app mounts without waiting for
  // the router; before, a first page that never loaded left the page empty)
  await expect(page.locator('.app-first-page-failed')).toContainText('This page could not be loaded.')
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
})

// M3: each locale is a chunk loaded before the app mounts. A failure reloads the page once, with a marker of its own
// (`locale-reload:`), cleared only when the locale loads.
const LOCALE_CHUNK = /\/js\/locale-en-US(\.[0-9a-f]+)?\.js(\?.*)?$/

test('a locale whose chunk fails once is loaded again, and the page is in that language', async ({ page }) => {
  await page.route('**/googleapis.com/**', (route) => route.abort())
  await page.route('**/googletagmanager.com/**', (route) => route.abort())
  let asked = 0
  await page.route(LOCALE_CHUNK, (route) => {
    asked += 1
    return asked === 1 ? route.abort() : route.continue()
  })
  await page.goto('/signin')
  await expect(page.locator('#email')).toHaveAttribute('placeholder', 'Enter your email', { timeout: 15000 })
  expect(asked).toBe(2)
})

test('a locale that keeps failing still lets the page mount, after one reload', async ({ page }) => {
  await page.route('**/googleapis.com/**', (route) => route.abort())
  await page.route('**/googletagmanager.com/**', (route) => route.abort())
  let asked = 0
  await page.route(LOCALE_CHUNK, (route) => { asked += 1; return route.abort() })
  let documents = 0
  page.on('request', (r) => { if (r.resourceType() === 'document' && r.url().endsWith('/signin')) documents += 1 })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('/signin')
  // mounted, with the keys in place of the messages: a page that can be used, not a blank one
  await expect(page.locator('#email')).toBeVisible({ timeout: 15000 })
  expect(documents).toBe(2)
  expect(asked).toBe(2)
  expect(errors.some((e) => e.includes('The interface language could not be loaded'))).toBe(true)
})

// A tel: or mailto: link hands the address to another application and leaves the page in place. Chromium fires
// `beforeunload` for it anyway; recovery must still work after one (the M1-M5 review found it disabled for the rest of
// the page's life). WebKit fires nothing for such a link, so this checks Chromium's case where it occurs.
test('a chunk failure after a tel: link still reloads its target', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'only Chromium fires beforeunload for a tel: link')
  await page.route('**/googleapis.com/**', (route) => route.abort())
  await page.route('**/googletagmanager.com/**', (route) => route.abort())
  await page.goto('/signin')
  await expect(page.locator('#email')).toBeVisible({ timeout: 15000 })
  await page.evaluate(() => { window.location.href = 'tel:+390000000000' })
  await page.waitForTimeout(500)
  let asked = 0
  await page.route(/\/js\/legal(\.[0-9a-f]+)?\.js(\?.*)?$/, (route) => {
    asked += 1
    return asked === 1 ? route.abort() : route.continue()
  })
  // the push itself rejects with the chunk error whatever onError does; the reload is what is checked
  await page.evaluate(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/privacypolicy').catch(() => {}) })
  await expect(page).toHaveURL(/\/privacypolicy/, { timeout: 15000 })
  await expect.poll(() => asked, { timeout: 15000 }).toBe(2)
})
