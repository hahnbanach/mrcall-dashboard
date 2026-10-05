import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import enUS from '@/i18n/locales/en-US.json'
import RetentionSettings from '@/components/widgets/RetentionSettings.vue'
import RetentionApi from '@/utils/Retention'

/** The owner's retention page, over what StarChat answers on /apidomain/retention. The page decides
  * nothing: it shows the class, its minimums and their source, sends the three terms (null for the
  * class's default, -1 for never), and says what the server refused. The real en-US catalogue is
  * used, so a key the page asks for and the catalogue lacks shows up as the raw key. */

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })

function described (set = {}, cls = {}) {
  const retentionClass = {
    name: 'medical', minDeleteAfterDays: 1095, minTrashDeleteAfterDays: 0,
    defaultArchiveAfterDays: 90, defaultDeleteAfterDays: 1095, defaultTrashDeleteAfterDays: 30,
    source: 'Law X, art. 3', decidedBy: 'counsel', ...cls
  }
  const s = { archiveAfterDays: null, deleteAfterDays: null, trashDeleteAfterDays: null, ...set }
  const pick = (k, d) => (s[k] === null ? d : s[k])
  return {
    businessId: 'b',
    effective: {
      archiveAfterDays: pick('archiveAfterDays', retentionClass.defaultArchiveAfterDays),
      deleteAfterDays: pick('deleteAfterDays', retentionClass.defaultDeleteAfterDays),
      trashDeleteAfterDays: pick('trashDeleteAfterDays', retentionClass.defaultTrashDeleteAfterDays)
    },
    set: s,
    retentionClass,
    revision: 'r1'
  }
}

function draw () {
  return mount(RetentionSettings, {
    props: { businessId: 'b', user: { accessToken: 't' } },
    global: { plugins: [i18n, PrimeVue], components: { Button, InputNumber, Message, SelectButton } }
  })
}

describe('RetentionSettings', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the class, the source of its terms and the legal minimum of the deletion', async () => {
    vi.spyOn(RetentionApi, 'get').mockResolvedValue(described())
    const page = draw()
    await flushPromises()
    const text = page.text()
    expect(text).toContain('medical')
    expect(text).toContain('Law X, art. 3')
    expect(text).toContain('Legal minimum of class medical: 1095 days (or never).')
    expect(text).not.toContain('components.retention')
  })

  it('sends null for a term left to the class, -1 for never, and the days of a custom term', async () => {
    vi.spyOn(RetentionApi, 'get').mockResolvedValue(described({ deleteAfterDays: -1, trashDeleteAfterDays: 60 }))
    const put = vi.spyOn(RetentionApi, 'put').mockResolvedValue(described({ deleteAfterDays: -1, trashDeleteAfterDays: 60 }))
    const page = draw()
    await flushPromises()
    await page.findAll('button').find(b => b.text().includes('Save')).trigger('click')
    await flushPromises()
    expect(put).toHaveBeenLastCalledWith({ accessToken: 't' }, 'b',
      { archiveAfterDays: null, deleteAfterDays: -1, trashDeleteAfterDays: 60 }, 'r1')
    expect(page.text()).toContain('Settings saved.')
  })

  it('says which term the server refused and the minimum it has to respect', async () => {
    vi.spyOn(RetentionApi, 'get').mockResolvedValue(described({ deleteAfterDays: 2000 }))
    const refused = new Error('422')
    refused.retention = { code: 'retention.term_below_minimum',
      constraint: { field: 'deleteAfterDays', value: 365, minimum: 1095, retentionClass: 'medical' } }
    vi.spyOn(RetentionApi, 'put').mockRejectedValue(refused)
    const page = draw()
    await flushPromises()
    await page.findAll('button').find(b => b.text().includes('Save')).trigger('click')
    await flushPromises()
    expect(page.text()).toContain('Deletion: the minimum is 1095 days.')
  })

  it('reloads the settings when somebody else changed them, and says so', async () => {
    const get = vi.spyOn(RetentionApi, 'get')
      .mockResolvedValueOnce(described())
      .mockResolvedValueOnce({ ...described({ archiveAfterDays: 10 }), revision: 'r2' })
    const stale = new Error('409')
    stale.retention = { code: 'retention.revision_mismatch', constraint: { currentRevision: 'r2' } }
    vi.spyOn(RetentionApi, 'put').mockRejectedValue(stale)
    const page = draw()
    await flushPromises()
    await page.findAll('button').find(b => b.text().includes('Save')).trigger('click')
    await flushPromises()
    expect(get).toHaveBeenCalledTimes(2)
    expect(page.text()).toContain('The settings changed in the meantime')
  })
})
