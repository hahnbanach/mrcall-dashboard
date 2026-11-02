// @ts-check
const { test, expect } = require('@playwright/test')
const { interceptFirebaseEndpoints, setupApiMocks, seedFirebaseIndexedDB } = require('../fixtures/auth')
const { mockUser } = require('../fixtures/mock-data')
const { ORIGIN, HOST } = require('../fixtures/origin')
const { SigninPage } = require('../pages/signin.page')

/**
 * Plan docs/execution-plans/2026-10-23-dashboard-load.md, M7: the way from `/`, `/signin` or a password sign-in to the
 * first page. No `user.reload()` (Firebase reloaded the user when it started), a token refresh only when the cached
 * token's `email_verified` claim differs from the user's `emailVerified`, and `/` straight to the first page without
 * the sign-in form ever showing.
 *
 * StarChat refuses a token whose `email_verified` claim is false (the fixture answers 403 as it does), so the
 * confirm-email case fails if the one refresh that is needed is skipped.
 *
 * Written before the change and run on its base (4e1bfcf): cases 1, 2 and 3 pass there (the path was correct, only
 * slow); case 4 fails there (a securetoken call on every start), case 5 fails there (`/` drew the sign-in form first).
 */
async function quiet (page) {
  await page.route('**/googletagmanager.com/**', (route) => route.abort())
}

/** A browser with a persisted session: the user as Firebase's start-up lookup returns it, and the cached token's claim. */
async function withSession (page, { emailVerified = true, tokenEmailVerified = emailVerified, businesses } = {}) {
  const user = { ...mockUser, emailVerified }
  await page.route(`**/${HOST}/__e2e_seed__`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }))
  await page.goto(`${ORIGIN}/__e2e_seed__`)
  await seedFirebaseIndexedDB(page, user, { tokenEmailVerified })
  await page.unroute(`**/${HOST}/__e2e_seed__`)
  await interceptFirebaseEndpoints(page, user, { refreshedEmailVerified: emailVerified })
  await setupApiMocks(page, businesses ? { businesses } : {})
  return watch(page)
}

async function visitor (page, { businesses } = {}) {
  await interceptFirebaseEndpoints(page, mockUser)
  await setupApiMocks(page, businesses ? { businesses } : {})
  return watch(page)
}

function watch (page) {
  const calls = { securetoken: 0, lookup: 0 }
  page.on('request', (r) => {
    if (r.url().includes('securetoken.googleapis.com')) calls.securetoken += 1
    if (r.url().includes('accounts:lookup')) calls.lookup += 1
  })
  return calls
}

/** The GA events sent so far (vue-gtag queues them on dataLayer even with Google's script blocked). */
const gaEvents = (page) => page.evaluate(() => (window.dataLayer || []).filter((a) => a && a[0] === 'event').map((a) => a[1]))

test.describe('the sign-in path', () => {
  test('1. a password sign-in with no redirect lands on the businesses', async ({ page }) => {
    await quiet(page)
    await visitor(page)
    await page.goto('/signin')
    const signin = new SigninPage(page)
    await signin.fillEmail(mockUser.email)
    await signin.fillPassword('a-test-password')
    await signin.submit()
    await expect(page).toHaveURL(/\/businesses/, { timeout: 15000 })
    expect(await gaEvents(page)).toContain('login')
  })

  test('2. a password sign-in for an account with no business lands on onboarding', async ({ page }) => {
    await quiet(page)
    await visitor(page, { businesses: [] })
    await page.goto('/signin')
    const signin = new SigninPage(page)
    await signin.fillEmail(mockUser.email)
    await signin.fillPassword('a-test-password')
    await signin.submit()
    await expect(page).toHaveURL(/\/onboardinglang/, { timeout: 15000 })
  })

  test('3. back from the confirmation email, with a token minted before it, lands on the first page', async ({ page }) => {
    await quiet(page)
    // Firebase's start-up lookup says verified; the cached token still says not: StarChat would refuse it
    const calls = await withSession(page, { emailVerified: true, tokenEmailVerified: false })
    await page.goto('/login?confirm_email=true')
    await expect(page).toHaveURL(/\/businesses/, { timeout: 15000 })
    await expect(page.locator('.business-card').first()).toBeVisible({ timeout: 15000 })
    expect(calls.securetoken, 'the one refresh the claim needs').toBeGreaterThan(0)
    expect(await gaEvents(page)).toContain('verified_email')
  })

  test('4. a token that already carries the claim: no refresh on the way to the first page', async ({ page }) => {
    await quiet(page)
    const calls = await withSession(page)
    await page.goto('/')
    await expect(page).toHaveURL(/\/businesses/, { timeout: 15000 })
    await expect(page.locator('.business-card').first()).toBeVisible({ timeout: 15000 })
    expect(calls.securetoken).toBe(0)
    // Firebase's own lookup at start-up, and no second one from a user.reload()
    expect(calls.lookup).toBeLessThanOrEqual(1)
    // a session resumed is no sign-in: `login` fires on a password or magic-link sign-in only, as it did
    expect(await gaEvents(page)).not.toContain('login')
  })

  test('5. / with a session reaches the first page without the sign-in form ever showing', async ({ page }) => {
    await quiet(page)
    await withSession(page)
    await page.addInitScript(() => {
      window.__formSeen = false
      new MutationObserver(() => {
        const el = document.querySelector('#email')
        if (el && el.getClientRects().length) window.__formSeen = true
      }).observe(document, { childList: true, subtree: true, attributes: true })
    })
    await page.goto('/')
    await expect(page).toHaveURL(/\/businesses/, { timeout: 15000 })
    await expect(page.locator('.business-card').first()).toBeVisible({ timeout: 15000 })
    expect(await page.evaluate(() => window.__formSeen)).toBe(false)
  })
})
