/**
 * StarChat authorises a Firebase token only when its `email_verified` claim is true, and refuses otherwise with a 403
 * that the 401 interceptor never retries. Someone back from the confirmation email holds the token minted before they
 * verified: Firebase's start-up reload updates `user.emailVerified`, not the token. The token is refreshed then, and
 * only then: when its claim, read locally, differs from `user.emailVerified`, or cannot be read (what was done before,
 * on every start). A failed refresh is reported and the way goes on, as it did when the forced refresh failed (plan
 * docs/execution-plans/2026-10-23-dashboard-load.md, M7).
 */
export async function matchTokenToUser (user) {
  let claim
  try {
    claim = (await user.getIdTokenResult()).claims.email_verified
  } catch {
    // an unreadable token: refreshed below, as every start did before
    claim = undefined
  }
  if (claim === user.emailVerified) return false
  try {
    await user.getIdToken(true)
  } catch (error) {
    console.error('The token could not be refreshed:', error)
  }
  return true
}

/**
 * The signed-in user, once Firebase knows whether there is one (plan docs/execution-plans/2026-10-23-dashboard-load.md,
 * M6). The router's guard used to register an `onAuthStateChanged` listener on every navigation to a protected page and
 * never remove it. The SDK's own `authStateReady()` resolves once the persisted user (or its absence) is known; it is
 * asked once, and the current user is read at each call, so a sign-in after start is seen. The user's token is matched to
 * it once (`matchTokenToUser`) before the user is returned.
 */
export function userWhenReady (auth) {
  let ready = null
  const matched = new WeakMap()   // one claim check per user object: per start, and again after a new sign-in
  return async () => {
    if (!ready) ready = auth.authStateReady()
    await ready
    const user = auth.currentUser
    if (user) {
      if (!matched.has(user)) matched.set(user, matchTokenToUser(user))
      await matched.get(user)
    }
    return user
  }
}
