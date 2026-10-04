import { describe, it, expect } from 'vitest'
import { isAdmitted } from '@/firebase/admission'

/** The guard and Signin decide with this one predicate: if Signin sent back a user the guard turns
  * away, the two would hand that user to each other. */
describe('isAdmitted', () => {
  const password = [{ providerId: 'password' }]
  it('admits a verified user and a Google user', () => {
    expect(isAdmitted({ isAnonymous: false, emailVerified: true, providerData: password })).toBe(true)
    expect(isAdmitted({ isAnonymous: false, emailVerified: false, providerData: [{ providerId: 'google.com' }] })).toBe(true)
  })
  it('turns away no user, an anonymous one and an unverified email', () => {
    expect(isAdmitted(null)).toBe(false)
    expect(isAdmitted({ isAnonymous: true, emailVerified: true, providerData: password })).toBe(false)
    expect(isAdmitted({ isAnonymous: false, emailVerified: false, providerData: password })).toBe(false)
    expect(isAdmitted({ isAnonymous: false, emailVerified: false })).toBe(false)
  })
})
