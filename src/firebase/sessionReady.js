import { auth } from './config'
import { userWhenReady } from './authReady'

/**
 * The app's one way to wait for the signed-in user, its token matched to it: the router's guard and the sign-in page
 * both await it, so a deep link after the confirmation email is covered as well as /signin (plan
 * docs/execution-plans/2026-10-23-dashboard-load.md, M6 and M7). Kept apart from authReady.js, which unit tests import
 * without starting Firebase.
 */
export const readyUser = userWhenReady(auth)
