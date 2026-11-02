/**
 * The signed-in user, once Firebase knows whether there is one (plan docs/execution-plans/2026-10-23-dashboard-load.md,
 * M6). The router's guard used to register an `onAuthStateChanged` listener on every navigation to a protected page and
 * never remove it. The SDK's own `authStateReady()` resolves once the persisted user (or its absence) is known; it is
 * asked once, and the current user is read at each call, so a sign-in after start is seen.
 */
export function userWhenReady (auth) {
  let ready = null
  return () => {
    if (!ready) ready = auth.authStateReady()
    return ready.then(() => auth.currentUser)
  }
}
