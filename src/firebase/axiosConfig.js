import axios from 'axios'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './config'
import store from '../store'
import router from '@/router'

/*
 * This interceptor is the one place that decides a session has ended. A component never handles a
 * 401 itself: it asks `isSessionEnded(error)` and, when true, shows nothing and goes nowhere, because
 * the person is already on the way to sign-in. Before, 31 catch blocks logged out and navigated on
 * their own, each to its own page, often beside a failure toast, and most of them read
 * `error.response.status` on errors that have no response.
 *
 * Only a 401 from one of the two backends that take the Firebase token, on a request that carried
 * one, says anything about the session. A StarChat call made without a token (the OAuth consent
 * page, the Google code exchange) and Google refusing its own token (the calendar list) pass through
 * unchanged: refreshing the Firebase token and retrying would turn their 401 into a logout.
 *
 * The AI chat's SSE stream uses fetch and does not come through here (src/utils/Zylch.js).
 */

/** The backends whose requests carry the Firebase token. */
function firebaseBackends () {
  return [process.env.VUE_APP_STARCHAT_URL, process.env.VUE_APP_ZYLCH_URL]
    .filter(Boolean)
    .map(url => { try { return new URL(url).origin } catch { return null } })
    .filter(Boolean)
}

function carriesFirebaseToken (config) {
  if (!config || !config.url) return false
  let origin
  try { origin = new URL(config.url, window.location.href).origin } catch { return false }
  if (!firebaseBackends().includes(origin)) return false
  const headers = config.headers || {}
  const bearer = headers['Authorization'] || headers['authorization']
  return Boolean(headers['auth'] || (typeof bearer === 'string' && bearer.startsWith('Bearer ')))
}

function withToken (config, token) {
  if (config.headers['auth']) {
    config.headers['auth'] = token
  } else {
    config.headers['Authorization'] = 'Bearer ' + token
  }
  return config
}

// The predicate lives in a module with no imports, so a component can ask it without loading this one (./session.js).
export { isSessionEnded } from './session'

/*
 * Whether this session has already been ended. Several requests fail together when a session dies,
 * and only the first may log out and navigate: a second push would leave from /signin, which is
 * public, and lose the way back. The latch is re-armed only by somebody signing in; signing out
 * sends `null` to the listener, and that must not re-arm it.
 */
let ended = false
onAuthStateChanged(auth, (user) => { if (user) ended = false })

/*
 * The page to come back to. Before the first navigation has finished the router's current route is
 * its start location, "/", and a deep link opened with an expired session would be lost: the address
 * bar already holds it.
 */
function returnTarget () {
  const current = router.currentRoute.value
  if (current.matched.length > 0) return current
  return router.resolve(window.location.pathname + window.location.search)
}

async function endSession (error) {
  error.sessionEnded = true
  if (!ended) {
    ended = true
    const target = returnTarget()
    const isPublic = target.matched.some(record => record.meta.public)
    const query = { session_expired: '1' }
    if (!isPublic) query.redirect = JSON.stringify({ path: target.path, query: target.query })
    // Signed out before sign-in opens: it reads the session as it mounts, and a user still there
    // would be sent straight back to the page that has just been refused.
    await store.dispatch('logout')
    router.push({ path: '/signin', query })
  }
  throw error
}

// Requests that met a 401 while the token was being refreshed, retried once it is.
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => (error ? prom.reject(error) : prom.resolve(token)))
  failedQueue = []
}

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status !== 401 || !carriesFirebaseToken(originalRequest)) {
      return Promise.reject(error)
    }
    // A retry was sent with a fresh token, directly or from the queue: this identity is refused.
    if (originalRequest._retry) {
      return endSession(error)
    }
    originalRequest._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then(
        token => axios(withToken(originalRequest, token)),
        () => endSession(error)
      )
    }

    const user = auth.currentUser
    if (!user) {
      return endSession(error)
    }

    isRefreshing = true
    try {
      const newToken = await user.getIdToken(true)
      isRefreshing = false
      processQueue(null, newToken)
      return axios(withToken(originalRequest, newToken))
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError)
      isRefreshing = false
      processQueue(refreshError)
      return endSession(error)
    }
  }
)

export default axios
