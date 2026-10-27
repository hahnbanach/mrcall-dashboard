import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { webcrypto } from 'node:crypto'
import axios from 'axios'
import BusinessSkillConnection from '@/components/BusinessSkillConnection.vue'
import { GoogleAuthFlow } from '@/utils/OAuth'
import { sheetsConnectionTargets } from '@/utils/BusinessSkillConnection'
import { beginSheetsConnection, confirmSheetsConnection } from '@/utils/SheetsConnection'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
const catalogue = [{ name: 'skill_google_sheets_write', configSchema: { phases: ['final'], fields: [
  { key: 'auth', type: 'oauth', provider: 'google_sheets', storage: 'oauth_provider',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], default: '' }
] } }]
const changes = [{ kind: 'skill_instance', business_id: 'business', phase: 'final', skill: 'skill_google_sheets_write',
  action: 'create', operation_id: 'op', params: { enabled: 'true', spreadsheetId: 'sheet' } }]
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto) })
it('retains verified intent when a ready chat mounts before its catalogue arrives', async () => {
  const target = sheetsConnectionTargets(catalogue, changes, 'business')[0]
  const url = new URL(await beginSheetsConnection('owner', 'business', 'session', target))
  const state = url.searchParams.get('state')
  const { context } = await GoogleAuthFlow.consumeWithContext(state)
  confirmSheetsConnection(context, state)
  let release
  axios.get.mockReturnValue(new Promise(resolve => { release = resolve }))
  const wrapper = mount(BusinessSkillConnection, {
    props: { businessId: 'business', sessionId: 'session', changes, ready: true },
    global: { plugins: [createStore({ state: { user: { uid: 'owner', accessToken: 'fake' } } })],
      mocks: { $t: key => key }, stubs: { Button: true } }
  })
  await flushPromises()
  expect(wrapper.emitted('sheets-connected')).toBeUndefined()
  expect(sessionStorage.getItem('mrcall.sheetsConnectionIntent.v1')).not.toBeNull()
  release({ data: catalogue })
  await flushPromises()
  expect(wrapper.emitted('sheets-connected')).toEqual([[{ ownerUid: 'owner', businessId: 'business', sessionId: 'session' }]])
  await wrapper.setProps({ ready: false })
  await wrapper.setProps({ ready: true })
  expect(wrapper.emitted('sheets-connected')).toHaveLength(1)
  wrapper.unmount()
})
