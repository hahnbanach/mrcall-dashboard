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
