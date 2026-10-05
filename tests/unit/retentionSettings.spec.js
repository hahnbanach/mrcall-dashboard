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
  * nothing: it shows the defaults, sends the three terms (null for the default, -1 for never), and
  * says what the server refused. The real en-US catalogue is used, so a key the page asks for and
  * the catalogue lacks shows up as the raw key. */

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })

function described (set = {}, defaults = {}) {
  const d = { archiveAfterDays: -1, deleteAfterDays: -1, trashDeleteAfterDays: -1, ...defaults }
  const s = { archiveAfterDays: null, deleteAfterDays: null, trashDeleteAfterDays: null, ...set }
  const pick = k => (s[k] === null ? d[k] : s[k])
  return {
    businessId: 'b',
    effective: { archiveAfterDays: pick('archiveAfterDays'), deleteAfterDays: pick('deleteAfterDays'),
      trashDeleteAfterDays: pick('trashDeleteAfterDays') },
    set: s,
    defaults: d,
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

  it('shows the default of each term, never, and nothing about classes or minimums', async () => {
    vi.spyOn(RetentionApi, 'get').mockResolvedValue(described())
    const page = draw()
    await flushPromises()
    const text = page.text()
    expect(text).toContain('Default (Never)')
    expect(text).toContain('In force: Never')
    expect(text).not.toMatch(/class|minimum/i)
    expect(text).not.toContain('components.retention')
  })

  it('does not save a custom term the owner left empty', async () => {
    vi.spyOn(RetentionApi, 'get').mockResolvedValue(described())
    const put = vi.spyOn(RetentionApi, 'put')
    const page = draw()
    await flushPromises()
    await page.findAll('.retention-term')[1].findAll('button').find(b => b.text() === 'Custom').trigger('click')
    await flushPromises()
    const save = page.findAll('button').find(b => b.text().includes('Save'))
    expect(save.attributes('disabled')).toBeDefined()
    await save.trigger('click')
    expect(put).not.toHaveBeenCalled()
  })

  it('sends null for a term left to the default, -1 for never, and the days of a custom term', async () => {
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
