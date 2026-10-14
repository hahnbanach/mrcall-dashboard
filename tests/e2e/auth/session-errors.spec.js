// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')

/**
 * What a page does when a request fails: with no answer at all, and with a 401 that a fresh token
 * does not cure.
 *
 * WHY. Catch blocks read `error.response.status` as if every failure had an answer, so a backend
 * that did not answer (down, unreachable, refused by CORS) threw from inside the catch and the rest
 * of the handler never ran. And each block handled a 401 on its own, beside the Axios interceptor
 * that already owns it: on this page the 401 left the person on a broken page with an error, logged
 * out underneath it. Now the interceptor alone ends the session and sends to sign-in, and a block
 * shows nothing for a session that ended. Seen failing on 2026-10-13 at 60c1522: the aborted load
 * raised "reading 'status'", and the 401 showed the page's error and stayed on the page.
 */

const PAGE = '/businessconfiguration?id=test-biz-001'

/** Records every error message or error toast that appears, even one that is gone a moment later. */
async function recordErrorsShown (page) {
  await page.addInitScript(() => {
    window.__errorsShown = []
    const seen = (node) => {
      if (node.nodeType !== 1) return
      for (const el of [node, ...node.querySelectorAll('.p-message-error, .p-toast-message-error')]) {
        if (el.matches('.p-message-error, .p-toast-message-error')) window.__errorsShown.push(el.textContent.trim())
      }
    }
    new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(seen)))
      .observe(document, { childList: true, subtree: true })
  })
}

/** Errors the page raised, from both channels: WebKit does not always report a rejection as a page error. */
function collectPageErrors (page) {
  const errors = []
  page.on('pageerror', e => errors.push(String(e && e.message)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  return errors
}

test.describe('a request that fails', () => {
  test('a backend that does not answer is reported on the page, not thrown', async ({ authenticatedPage: page }) => {
    const errors = collectPageErrors(page)
    await page.route('**/crm/business*', route => route.abort('failed'))
    await page.route('**/crm/variables*', route => route.abort('failed'))

    await page.goto(PAGE)
    await expect(page.locator('.p-message-error')).toBeVisible({ timeout: 15000 })
    // Give a throw from inside the catch the time to surface before saying there was none.
    await page.waitForTimeout(500)
    // Chromium says "reading 'status'", WebKit "evaluating 'error.response.status'".
    expect(errors.filter(e => /reading 'status'|response\.status/.test(e))).toEqual([])
  })

  test('a 401 that a fresh token does not cure ends the session and says so, with nothing else', async ({ authenticatedPage: page }) => {
    await recordErrorsShown(page)
    // Registered last, so checked first: every StarChat call is refused, while the token refresh works.
    await page.route('**/mrcall/v1/**', route => route.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'unauthorized' })
    }))

    await page.goto(PAGE)
    await expect(page).toHaveURL(/\/signin\?/, { timeout: 15000 })
    const url = new URL(page.url())
    expect(url.searchParams.get('session_expired')).toBeTruthy()
    expect(JSON.parse(url.searchParams.get('redirect') || 'null')).toEqual({
      path: '/businessconfiguration', query: { id: 'test-biz-001' }
    })
    await expect(page.getByText('Session Expired')).toBeVisible()
    // And it stays there: sign-in opening on a user not yet signed out would send the person back.
    await page.waitForTimeout(1500)
    expect(new URL(page.url()).pathname).toBe('/signin')
    expect(await page.evaluate(() => window.__errorsShown)).toEqual([])
  })
})
