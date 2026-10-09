import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import ToggleSwitch from 'primevue/toggleswitch'
import AgentSkillsConfigurator from '@/components/widgets/AgentSkillsConfigurator.vue'
import SkillCard from '@/components/widgets/skills/SkillCard.vue'
import agentSkills from '@/utils/AgentSkills'

/** An owner saving a skill keeps what the platform set in a field the owner is not shown.
  *
  * A field the manifest marks `x-audience: platform` is left out of the card for an owner. Leaving it
  * out of the card must not leave it out of the save: the skills card persists through
  * `PUT .../apidomain/agent/skills/configuration/<businessId>`, and StarChat stores each phase
  * variable it receives WHOLE (`SkillConfigurationService.save` writes the variables as sent, it does
  * not merge instance params). So a hidden value that did not travel in the body would be erased on
  * the server, not kept. What is asserted is the real path of the page: the business variables, read
  * into the configurator, an owner's edit through the card, written back into the variables the way
  * `BusinessConfiguration.vue` does, and the body of the PUT.
  *
  * Seen failing first, 2026-10-09: with `updateEntryParam` perturbed to rebuild an instance's params
  * from the edited key alone, the first test failed on the `tables` value of the body. With the
  * configurator handing every card `audience: 'admin'` whatever the role, the second test failed on
  * the owner's audience.
  */
vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const axios = (await import('axios')).default

const SKILL = 'skill_restaurant_booking'
const TABLES = '{"indoor":[{"size":2,"count":8},{"size":4,"count":6,"minParty":3}]}'

const catalogue = [{
  name: SKILL,
  configSchema: {
    phases: ['during'],
    fields: [
      { key: 'enabled', type: 'boolean' },
      { key: 'label', type: 'string', labels: { en: { label: 'Name' } } },
      { key: 'indoorSeats', type: 'number', widget: 'number', labels: { en: { label: 'Indoor seats' } } },
      { key: 'tables', type: 'json', widget: 'json', audience: 'platform', labels: { en: { label: 'Tables' } } }
    ]
  }
}]

/** The business as an admin left it: a booking instance with its tables set. */
function businessVariables () {
  return {
    SKILL_RUNNINGLOOP_CONFIGURATION: JSON.stringify([{
      skill: SKILL,
      instanceId: 'restaurant_booking_1',
      params: { enabled: 'true', indoorSeats: '40', tables: TABLES }
    }])
  }
}

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })

async function configurator (role, variables) {
  const store = createStore({ state: { role, user: { accessToken: 'token' } } })
  const wrapper = mount(AgentSkillsConfigurator, {
    global: {
      plugins: [store, i18n, PrimeVue, ToastService],
      components: { Button, Dropdown, InputText, ProgressSpinner, Tag, Toast, ToggleSwitch }
    },
    props: {
      modelValue: agentSkills.serializeConfig(agentSkills.readPhaseConfig(variables)),
      businessId: 'b-1'
    }
  })
  await flushPromises()
  // Open the phase the instance runs in, then the instance, as a person would.
  await wrapper.findAll('.phase-header')[1].trigger('click')
  await wrapper.findComponent(SkillCard).vm.$emit('toggle')
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  axios.get.mockReset()
  axios.put.mockReset()
  axios.get.mockImplementation(url =>
    Promise.resolve({ data: String(url).includes('/apidomain/agent/skills?') ? catalogue : [] }))
  axios.put.mockResolvedValue({ data: { saved: true, diagnostics: [] } })
})

describe('an owner saving a skill with a field kept for the platform', () => {
  it('sends the stored value of the hidden field unchanged beside the edit', async () => {
    const variables = businessVariables()
    const wrapper = await configurator('owner', variables)

    // The owner changes a field they are shown, through the card, as the widget would report it.
    wrapper.findComponent(SkillCard).vm.$emit('update:field', { key: 'indoorSeats', value: '50' })
    await flushPromises()

    // What the page does with the configurator's value, then what Save does with the variables.
    const emitted = wrapper.emitted('update:modelValue').at(-1)[0]
    agentSkills.writePhaseConfig(variables, emitted)
    await agentSkills.persistConfiguration({ accessToken: 'token' }, 'b-1', variables)

    const body = axios.put.mock.calls[0][1]
    const [instance] = JSON.parse(body.SKILL_RUNNINGLOOP_CONFIGURATION)
    expect(instance.params.indoorSeats).toBe('50')
    expect(instance.params.tables).toBe(TABLES)
  })

  it('draws the hidden field for exactly the people the role says', async () => {
    const owner = await configurator('owner', businessVariables())
    expect(owner.findComponent(SkillCard).props('audience')).toBe('owner')
    expect(owner.text()).toContain('Indoor seats')
    expect(owner.text()).not.toContain('Tables')

    const admin = await configurator('admin', businessVariables())
    expect(admin.findComponent(SkillCard).props('audience')).toBe('admin')
    expect(admin.text()).toContain('Tables')
  })
})
