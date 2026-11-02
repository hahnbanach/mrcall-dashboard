// @ts-check
const { test: base, expect } = require('@playwright/test')
const { test: authed } = require('../fixtures/auth')

/**
 * Plan docs/execution-plans/2026-10-23-dashboard-load.md, M3: each locale is its own chunk, loaded before the app
 * mounts, and the brief's constraint holds: no untranslated flash. The language the page is in from its very first
 * render is the one it ends in, whether it comes from the browser, from a sign-in or sign-up link's `lang`, or from
 * the custom-token page's `language`. Elsewhere `lang` is not the interface language (Conversations reads it as a date
 * format), so it changes nothing there.
 *
 * Each check records the first value the page ever shows (a MutationObserver from the first byte), not the value
 * after it settles. On the base commit c02054f the custom-token page failed (its switch waited on `await` in
 * `mounted()`, after a first render in English); the `lang` links passed there, the switch landing before the first
 * paint while every locale was in the bundle, and they guard the loader, after which a switch in `mounted()` would
 * wait on a download.
 */
// addInitScript passes one argument: the selector and the attribute travel together
const FIRST_VALUE = ({ selector, attribute }) => {
  window.__first = null
  const read = () => {
    if (window.__first !== null) return
    const el = document.querySelector(selector)
    if (!el) return
    const value = attribute ? el.getAttribute(attribute) : el.textContent.trim()
    if (value) window.__first = value
  }
  new MutationObserver(read).observe(document, { childList: true, subtree: true, attributes: true, characterData: true })
}

async function quiet (page) {
  await page.route('**/googleapis.com/**', (route) => route.abort())
  await page.route('**/google-analytics.com/**', (route) => route.abort())
  await page.route('**/googletagmanager.com/**', (route) => route.abort())
}

async function firstValue (page, url, selector, attribute) {
  await page.addInitScript(FIRST_VALUE, { selector, attribute })
  await page.goto(url)
  await expect.poll(() => page.evaluate(() => window.__first), { timeout: 15000 }).not.toBeNull()
  return page.evaluate(() => window.__first)
}

base.describe('the page is in its language from its first render', () => {
  base.describe('a browser in Italian', () => {
    base.use({ locale: 'it-IT' })
    base('sign-in', async ({ page }) => {
      await quiet(page)
      expect(await firstValue(page, '/signin', '#email', 'placeholder')).toBe('Inserisci la tua email')
    })
  })

  base.describe('a browser in English, with a link that asks for Italian', () => {
    base.use({ locale: 'en-US' })
    base('sign-in with lang', async ({ page }) => {
      await quiet(page)
      expect(await firstValue(page, '/signin?lang=it-IT', '#email', 'placeholder')).toBe('Inserisci la tua email')
    })
    base('sign-up with lang', async ({ page }) => {
      await quiet(page)
      expect(await firstValue(page, '/signup?lang=it-IT', '#email', 'placeholder')).toBe('Inserisci il tuo indirizzo email')
    })
    base('the custom-token page with language', async ({ page }) => {
      await quiet(page)
      expect(await firstValue(page, '/customtokenlogin?language=it', '.main-page-content-section .title'))
        .toBe("Verifica dell'identità e caricamento della pagina richiesta")
    })
  })
})

authed.describe('lang elsewhere is not the interface language', () => {
  authed.use({ locale: 'en-US' })
  authed('conversations with lang stay in the browser language', async ({ authenticatedPage: page }) => {
    await page.goto('/conversations?lang=it-IT')
    // a seeded session: without one the guard would send the page to sign-in, without `lang`, and prove nothing
    await expect(page).toHaveURL(/\/conversations/, { timeout: 15000 })
    // on a phone the menu is folded away: present, not visible
    await expect(page.getByText('My Assistant').first()).toBeAttached({ timeout: 15000 })
    await expect(page.getByText('Il Mio Assistente')).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  })
})
