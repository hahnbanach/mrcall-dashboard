// @ts-check
const { test, expect } = require('@playwright/test')
const { interceptFirebaseEndpoints, setupApiMocks } = require('../fixtures/auth')
const { mockUser } = require('../fixtures/mock-data')
const { SigninPage } = require('../pages/signin.page')

/**
 * A page that needs a session sends a visitor without one to sign in, and back.
 *
 * WHY. The router used to ask for a session only on routes that said so, and five that call the API
 * with the user's token did not: `/businessconfiguration` had never said so. A deep link to it,
 * opened without a session (an expired one, a new browser, a link pasted into a chat), drew the
 * shell with an empty menu and an empty page instead of the sign-in. Routes now need a session
 * unless they declare themselves public. Seen failing on 2026-10-13 at 60c1522: every route below
 * stayed on its own path.
 */

const NEED_A_SESSION = [
  '/businessconfiguration',
  '/payment',
  '/businessphonenumberverification',
  '/whatsappweb',
  '/outboundcalls'
]

/** A browser with the Firebase and StarChat mocks in place and nobody signed in. */
async function visitor (page) {
  await interceptFirebaseEndpoints(page, mockUser)
  await setupApiMocks(page)
}

function redirectOf (url) {
  const raw = new URL(url).searchParams.get('redirect')
  return raw ? JSON.parse(raw) : null
}

test.describe('a page that needs a session', () => {
  for (const path of NEED_A_SESSION) {
    test(`${path} without a session goes to sign-in and remembers where it was going`, async ({ page }) => {
      await visitor(page)
      await page.goto(`${path}?id=test-biz-001&section=__SKILLS__`)
      await expect(page).toHaveURL(/\/signin\?/, { timeout: 15000 })
      expect(redirectOf(page.url())).toEqual({ path, query: { id: 'test-biz-001', section: '__SKILLS__' } })
    })
  }

  test('signing in from that redirect lands on the link that was asked for', async ({ page }) => {
    await visitor(page)
    await page.goto('/businessconfiguration?id=test-biz-001&section=__SKILLS__')
    await expect(page).toHaveURL(/\/signin\?/, { timeout: 15000 })

    const signin = new SigninPage(page)
    await signin.fillEmail(mockUser.email)
    await signin.fillPassword('a-test-password')
    await signin.submit()

    await expect(page).toHaveURL(/\/businessconfiguration\?/, { timeout: 15000 })
    const url = new URL(page.url())
    expect(url.searchParams.get('id')).toBe('test-biz-001')
    expect(url.searchParams.get('section')).toBe('__SKILLS__')
  })
})
