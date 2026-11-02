import { describe, it, expect } from 'vitest'
import { userWhenReady } from '@/firebase/authReady'

// The router's guard waits for the SDK's one readiness promise, then reads the current user (plan
// docs/execution-plans/2026-10-23-dashboard-load.md, M6). It used to register an onAuthStateChanged listener on every
// navigation and never remove it.
function fakeAuth () {
  const auth = { currentUser: null, ready: 0, listeners: 0 }
  auth.authStateReady = () => { auth.ready += 1; return Promise.resolve() }
  auth.onAuthStateChanged = () => { auth.listeners += 1; return () => {} }
  return auth
}

describe('userWhenReady', () => {
  it('ten navigations: one readiness promise, no listener', async () => {
    const auth = fakeAuth()
    const ready = userWhenReady(auth)
    for (let i = 0; i < 10; i++) await ready()
    expect(auth.ready).toBe(1)
    expect(auth.listeners).toBe(0)
  })

  it('reads the current user at each call, so a sign-in after start is seen', async () => {
    const auth = fakeAuth()
    const ready = userWhenReady(auth)
    expect(await ready()).toBe(null)
    auth.currentUser = { uid: 'u1' }
    expect(await ready()).toEqual({ uid: 'u1' })
  })
})

import { matchTokenToUser } from '@/firebase/authReady'

function fakeUser ({ emailVerified, claim, unreadable = false }) {
  const user = { emailVerified, refreshes: 0 }
  user.getIdTokenResult = () => unreadable ? Promise.reject(new Error('bad token')) : Promise.resolve({ claims: { email_verified: claim } })
  user.getIdToken = (force) => { if (force) user.refreshes += 1; return Promise.resolve('t') }
  return user
}

// StarChat refuses a token whose email_verified claim is false (M7): refresh only when the claim lags the user.
describe('matchTokenToUser', () => {
  it('refreshes a token minted before the email was confirmed', async () => {
    const user = fakeUser({ emailVerified: true, claim: false })
    expect(await matchTokenToUser(user)).toBe(true)
    expect(user.refreshes).toBe(1)
  })
  it('leaves alone a token whose claim matches', async () => {
    const user = fakeUser({ emailVerified: true, claim: true })
    expect(await matchTokenToUser(user)).toBe(false)
    expect(user.refreshes).toBe(0)
  })
  it('refreshes a token it cannot read, as every start did before', async () => {
    const user = fakeUser({ emailVerified: true, unreadable: true })
    await matchTokenToUser(user)
    expect(user.refreshes).toBe(1)
  })
  it('once per user across navigations', async () => {
    const user = fakeUser({ emailVerified: true, claim: false })
    const auth = { currentUser: user, authStateReady: () => Promise.resolve() }
    const ready = userWhenReady(auth)
    for (let i = 0; i < 5; i++) await ready()
    expect(user.refreshes).toBe(1)
  })
})
