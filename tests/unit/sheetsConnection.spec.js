import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { GoogleAuthFlow, assertScopesAllowed, skillOAuthContext } from '@/utils/OAuth'
import { sheetsConnectionTargets } from '@/utils/BusinessSkillConnection'
import { beginSheetsConnection, confirmSheetsConnection, consumeSheetsConnection } from '@/utils/SheetsConnection'

const scope = 'https://www.googleapis.com/auth/spreadsheets'
const calendar = 'https://www.googleapis.com/auth/calendar'
const catalogue = [{ name: 'google_sheets_write', configSchema: { phases: ['final'], fields: [
  { key: 'auth', type: 'oauth', provider: 'google_sheets', storage: 'oauth_provider', scopes: [scope], default: '' }
] } }]
const change = { kind: 'skill_instance', business_id: 'business', phase: 'final', skill: 'google_sheets_write',
  action: 'create', operation_id: 'op', params: { spreadsheetId: 'sheet', enabled: 'true' } }
const targets = () => sheetsConnectionTargets(catalogue, [change], 'business')
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto) })

describe('Sheets OAuth scope and pending target ownership', () => {
  it('uses only the provider write scope and never widens Calendar', () => {
    expect(assertScopesAllowed([scope], 'test', 'google_sheets')).toBe(scope)
    expect(() => assertScopesAllowed([calendar], 'test', 'google_sheets')).toThrow()
    expect(() => assertScopesAllowed([scope], 'test')).toThrow()
    expect(() => assertScopesAllowed([scope, calendar], 'test', 'google_sheets')).toThrow()
  })
  it('recognizes the exact canonical skill alias from the catalogue', () => {
    expect(sheetsConnectionTargets([{ ...catalogue[0], name: 'skill_google_sheets_write' }],
      [{ ...change, skill: 'skill_google_sheets_write' }], 'business')).toHaveLength(1)
  })
  it('preserves exact opaque saved refs and rejects invented refs for new proposals', () => {
    expect(targets()[0].grantName).toBe('')
    expect(sheetsConnectionTargets(catalogue, [{ ...change, params: { auth: 'invented' } }], 'business')).toEqual([])
    const saved = { ...change, action: 'replace', instance_id: 'saved', params: { auth: 'opaque/exact' } }
    expect(sheetsConnectionTargets(catalogue, [saved], 'business')[0]).toMatchObject({ grantName: 'opaque/exact', instanceId: 'saved' })
    expect(sheetsConnectionTargets(catalogue, [{ ...saved, params: {} }], 'business')).toEqual([])
  })
  it('returns once only after verified connect for the same owner, business, session and proposal', async () => {
    const url = new URL(await beginSheetsConnection('owner', 'business', 'session', targets()[0]))
    expect(url.searchParams.get('scope')).toBe(scope)
    expect(url.searchParams.get('include_granted_scopes')).toBeNull()
    const state = url.searchParams.get('state')
    const { context } = await GoogleAuthFlow.consumeWithContext(state)
    confirmSheetsConnection(context, state)
    expect(consumeSheetsConnection('owner', 'business', 'session', targets())).toBe(true)
    expect(consumeSheetsConnection('owner', 'business', 'session', targets())).toBe(false)
  })
  for (const mismatch of ['unverified', 'owner', 'business', 'session', 'target', 'state', 'expired']) {
    it(`does not resume for ${mismatch}`, async () => {
      const url = new URL(await beginSheetsConnection('owner', 'business', 'session', targets()[0]))
      const state = url.searchParams.get('state')
      const { context } = await GoogleAuthFlow.consumeWithContext(state)
      if (mismatch !== 'unverified') confirmSheetsConnection(context, mismatch === 'state' ? 'bad' : state)
      if (mismatch === 'expired') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60 * 1000)
      expect(consumeSheetsConnection(mismatch === 'owner' ? 'other' : 'owner',
        mismatch === 'business' ? 'other' : 'business', mismatch === 'session' ? 'other' : 'session',
        mismatch === 'target' ? [{ ...targets()[0], fingerprint: 'changed' }] : targets())).toBe(false)
      vi.restoreAllMocks()
    })
  }
  it('rejects Sheets callback contexts carrying Calendar scopes', () => {
    expect(() => skillOAuthContext({ target: 'business', provider: 'google_sheets', businessId: 'business',
      ownerUid: 'owner', grantName: '', scopes: [calendar],
      returnUrl: '/businessconfiguration?id=business&skillBusinessConnection=google_sheets' })).toThrow()
  })
})
