import { describe, it, expect, vi, afterEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { GoogleAuthFlow } from '@/utils/OAuth'

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

describe('manual and chat skill OAuth integration', () => {
  it('starts legacy authorization without retaining an abandoned chat context', async () => {
    vi.stubGlobal('crypto', webcrypto)
    localStorage.setItem('oauthSkillContext', '{}')
    localStorage.setItem('oauthProvider', 'google_calendar')
    localStorage.setItem('oauthReturnUrl', '/old-return')
    const { state, codeChallenge } = await GoogleAuthFlow.begin()
    expect(state).not.toMatch(/^skill\./)
    expect(codeChallenge).toBeTruthy()
    expect(localStorage.getItem('oauthSkillContext')).toBeNull()
    expect(localStorage.getItem('oauthProvider')).toBeNull()
    expect(localStorage.getItem('oauthReturnUrl')).toBeNull()
    localStorage.setItem('oauthProvider', 'google_calendar')
    localStorage.setItem('oauthBusinessId', 'business-1')
    localStorage.setItem('oauthGrantName', 'manual-instance-1')
    const result = await GoogleAuthFlow.consumeWithContext(state)
    expect(result.context).toBeNull()
    expect(result.codeVerifier).toBeTruthy()
    expect(localStorage.getItem('oauthGrantName')).toBe('manual-instance-1')
  })
})
