/**
 * Whether the page is already leaving, and how to leave it on purpose.
 *
 * A chunk whose download the browser cancels because the page is going away fails like a missing chunk. WebKit
 * reports it: when the locale reload of main.js left the page, the sign-in page's vendor chunk, still downloading,
 * failed, and the router reloaded the page a second time (plan docs/execution-plans/2026-10-23-dashboard-load.md, M3).
 * A failure while the page is leaving is therefore no reason to reload.
 *
 * Leaving is known from two things only: the app's own `reloadPage`, and `pagehide`, which fires when the document is
 * really being unloaded. Not `beforeunload`: Chromium fires it for a `tel:` or `mailto:` link too, which hands the
 * address to another application and leaves the page where it is, with no `pagehide` or `pageshow` after it, so the
 * flag stayed set and every later chunk failure went unrecovered (the M1-M5 review, reproduced on a production build).
 */
let leaving = false
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { leaving = true })
  // back from the back-forward cache: the page is in use again. Only then: the first load's own pageshow must not
  // clear a reload this page has already asked for.
  window.addEventListener('pageshow', (event) => { if (event.persisted) leaving = false })
}

export const isLeaving = () => leaving

/** Loads the page again, or `url` if given, and marks the page as leaving first. */
export function reloadPage (url) {
  leaving = true
  if (url) window.location.assign(url)
  else window.location.reload()
}
