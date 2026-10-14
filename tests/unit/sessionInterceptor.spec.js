import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The Axios interceptor is the one place that decides a session has ended. A component sees the
 * decision through `isSessionEnded(error)` and shows nothing for it, because the interceptor has
 * already logged out and sent the person to sign in.
 *
 * WHY THESE CASES. Each is a way the decision went wrong, or would have, in the review of this
 * change: requests queued behind a refresh used to start a refresh of their own instead of ending
 * the session; several failing requests would each log out and navigate; a reset of the "already
 * ended" latch on sign-out let a second failure navigate away from sign-in and lose the way back;
 * and a 401 that says nothing about the session (a StarChat call made without a token, Google
 * refusing its own token) must not end it. Seen failing on 2026-10-13 at 60c1522: `isSessionEnded`
 * is not exported.
 */

const STARCHAT = 'https://starchat.example'
const ZYLCH = 'https://zylch.example'

const h = vi.hoisted(() => ({
  auth: { currentUser: null },
  listeners: [],
  dispatch: vi.fn(),
  push: vi.fn(),
  currentRoute: { value: { path: '/businessconfiguration', query: { id: 'b1' }, matched: [{ meta: {} }] } },
  resolve: vi.fn(),
  refresh: vi.fn()
}))

vi.mock('@/firebase/config', () => ({ auth: h.auth }))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.listeners.push(cb); return () => {} } }))
vi.mock('@/store', () => ({ default: { dispatch: h.dispatch } }))
vi.mock('@/router', () => ({ default: { push: h.push, currentRoute: h.currentRoute, resolve: h.resolve } }))

process.env.VUE_APP_STARCHAT_URL = STARCHAT
process.env.VUE_APP_ZYLCH_URL = ZYLCH

const { default: axios, isSessionEnded } = await import('@/firebase/axiosConfig')

/** An adapter answering with `status(config)`: a number for an error, nothing for 200. */
function answer (status) {
  return (config) => {
    const s = status(config)
    if (!s) return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })
    const error = new Error(`status ${s}`)
    error.config = config
    error.response = { status: s, data: {}, headers: {}, config }
    error.isAxiosError = true
    return Promise.reject(error)
  }
}

const withToken = (url, extra = {}) => ({ url, headers: { auth: 'firebase-token' }, ...extra })
const caught = (p) => p.then(() => null, (e) => e)

function signIn () {
  h.auth.currentUser = { getIdToken: h.refresh }
  h.listeners.forEach(cb => cb(h.auth.currentUser))
}

beforeEach(() => {
  h.resolve.mockReset()
  h.dispatch.mockReset()
  h.push.mockReset()
  h.refresh.mockReset().mockResolvedValue('fresh-token')
  signIn()
})

describe('the interceptor ends the session', () => {
  it('once, for concurrent 401s that a fresh token does not cure, and marks every rejection', async () => {
    const adapter = answer(() => 401)
    const errors = await Promise.all([1, 2, 3].map(i =>
      caught(axios.request({ ...withToken(`${STARCHAT}/mrcall/v1/x${i}`), adapter }))))

    expect(errors.every(isSessionEnded)).toBe(true)
    expect(h.dispatch).toHaveBeenCalledTimes(1)
    expect(h.dispatch).toHaveBeenCalledWith('logout')
    expect(h.push).toHaveBeenCalledTimes(1)
    const to = h.push.mock.calls[0][0]
    expect(to.path).toBe('/signin')
    expect(to.query.session_expired).toBeTruthy()
    expect(JSON.parse(to.query.redirect)).toEqual({ path: '/businessconfiguration', query: { id: 'b1' } })
  })

  it('for requests queued behind a refresh that fails', async () => {
    let fail
    h.refresh.mockReturnValue(new Promise((_, reject) => { fail = reject }))
    const adapter = answer(() => 401)
    const pending = [1, 2].map(i => caught(axios.request({ ...withToken(`${STARCHAT}/q${i}`), adapter })))
    await new Promise(r => setTimeout(r, 0))
    fail(new Error('refresh refused'))
    const errors = await Promise.all(pending)

    expect(errors.every(isSessionEnded)).toBe(true)
    expect(h.dispatch).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('for a request that arrives after it ended, without logging out or navigating again', async () => {
    const adapter = answer(() => 401)
    await caught(axios.request({ ...withToken(`${STARCHAT}/first`), adapter }))
    // Signing out sends `null` to the listener; that must not re-arm the latch.
    h.listeners.forEach(cb => cb(null))
    const late = await caught(axios.request({ ...withToken(`${ZYLCH}/api/late`), adapter }))

    expect(isSessionEnded(late)).toBe(true)
    expect(h.dispatch).toHaveBeenCalledTimes(1)
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('again, after somebody signs in again', async () => {
    const adapter = answer(() => 401)
    await caught(axios.request({ ...withToken(`${STARCHAT}/one`), adapter }))
    signIn()
    await caught(axios.request({ ...withToken(`${STARCHAT}/two`), adapter }))

    expect(h.dispatch).toHaveBeenCalledTimes(2)
    expect(h.push).toHaveBeenCalledTimes(2)
  })

  it('after the logout has finished, so sign-in does not open on the old user', async () => {
    const order = []
    h.dispatch.mockImplementation(() => new Promise(resolve => setTimeout(() => { order.push('logout'); resolve() }, 10)))
    h.push.mockImplementation(() => { order.push('push') })
    await caught(axios.request({ ...withToken(`${STARCHAT}/slow-logout`), adapter: answer(() => 401) }))

    expect(order).toEqual(['logout', 'push'])
    h.dispatch.mockReset()
    h.push.mockReset()
  })

  it('back to the deep link in the address bar, when the first navigation has not finished', async () => {
    const start = h.currentRoute.value
    h.currentRoute.value = { path: '/', query: {}, matched: [] }
    h.resolve.mockReturnValue({ path: '/conversations', query: { id: 'b2' }, matched: [{ meta: {} }] })
    await caught(axios.request({ ...withToken(`${STARCHAT}/early`), adapter: answer(() => 401) }))
    h.currentRoute.value = start

    expect(h.resolve).toHaveBeenCalledWith(window.location.pathname + window.location.search)
    expect(JSON.parse(h.push.mock.calls[0][0].query.redirect)).toEqual({ path: '/conversations', query: { id: 'b2' } })
  })

  it('and does nothing when the retry with a fresh token succeeds', async () => {
    const adapter = answer(config => (config.headers.auth === 'fresh-token' ? 0 : 401))
    const response = await axios.request({ ...withToken(`${STARCHAT}/cured`), adapter })

    expect(response.status).toBe(200)
    expect(h.dispatch).not.toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalled()
  })
})

describe('a 401 that says nothing about the session', () => {
  it('from StarChat on a request sent without a token passes through untouched', async () => {
    const error = await caught(axios.request({ url: `${STARCHAT}/mrcall/v1/mrcall0/oauth/google/token`, adapter: answer(() => 401) }))

    expect(error.response.status).toBe(401)
    expect(isSessionEnded(error)).toBe(false)
    expect(h.refresh).not.toHaveBeenCalled()
    expect(h.dispatch).not.toHaveBeenCalled()
  })

  it('from another origin, even with a Bearer token, passes through untouched', async () => {
    const error = await caught(axios.request({
      url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      headers: { Authorization: 'Bearer google-token' },
      adapter: answer(() => 401)
    }))

    expect(isSessionEnded(error)).toBe(false)
    expect(h.refresh).not.toHaveBeenCalled()
    expect(h.dispatch).not.toHaveBeenCalled()
  })
})
