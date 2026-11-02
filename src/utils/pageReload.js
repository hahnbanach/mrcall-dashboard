/**
 * Whether the page is already leaving, and how to leave it on purpose.
 *
 * A chunk whose download the browser cancels because the page is going away fails like a missing chunk. WebKit
 * reports it: when the locale reload of main.js left the page, the sign-in page's vendor chunk, still downloading,
 * failed, and the router reloaded the page a second time (plan docs/execution-plans/2026-10-23-dashboard-load.md, M3).
 * A failure while the page is leaving is therefore no reason to reload.
 */
let leaving = false
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { leaving = true })
  window.addEventListener('beforeunload', () => { leaving = true })
  // back from the bfcache: the page is in use again
  window.addEventListener('pageshow', () => { leaving = false })
}

export const isLeaving = () => leaving

/** Loads the page again, or `url` if given, and marks the page as leaving first. */
export function reloadPage (url) {
  leaving = true
  if (url) window.location.assign(url)
  else window.location.reload()
}
