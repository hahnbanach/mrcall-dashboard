import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import Dropdown from 'primevue/select'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import SkillCard from '@/components/widgets/skills/SkillCard.vue'

/** One configured instance, drawn on its own.
  *
  * The card decides nothing: every edit leaves as an event and the configurator applies it. What is
  * asserted here is that it leaves, that it leaves once, and that a card which may not be edited
  * emits nothing at all.
  */

const messages = {
  en: {
    widgets: {
      agentSkills: {
        entryOn: 'On', entryOff: 'Off', entryEnabledHint: 'Runs this skill',
        skillUnavailable: 'This skill is not installed',
        duplicateSkill: 'Duplicate', removeSkill: 'Remove',
        labelClash: 'Another instance carries this name',
        unknownWidget: 'No widget draws {widget}',
        templateSyntaxTitle: 'Templates', templateSyntaxHelp: 'Use %%var%%',
        oauthConnect: 'Authorise', oauthDisconnect: 'Disconnect', oauthStopUsing: 'Stop using',
        oauthReuse: 'Use', oauthReusePlaceholder: 'Choose an account',
        calendarChosen: 'A calendar is chosen', calendarNotChosen: 'No calendar yet'
      }
    }
  }
}

const i18n = createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })
const global = {
  plugins: [i18n, PrimeVue],
  components: { Button, Dropdown, InputText, Tag, ToggleSwitch }
}

/** The authorisations as the card asks about them: nothing held, nothing connected. */
function noGrants (overrides = {}) {
  return {
    isOAuthConnected: () => false,
    grantFor: () => null,
    grantNameFor: () => '',
    grantOptions: () => [],
    grantAccountLabel: g => (g ? g.email : ''),
    ownsGrant: () => false,
    calendarOptions: () => [],
    calendarSummary: () => '',
    ...overrides
  }
}

const skill = {
  name: 'calendar_availability',
  descriptionI18n: { en: 'Offers free slots' },
  configSchema: {
    fields: [
      { key: 'enabled', type: 'boolean' },
      { key: 'label', type: 'string', labels: { en: { label: 'Name' } } },
      { key: 'durationMinutes', type: 'number', default: 30, labels: { en: { label: 'Duration' } } }
    ]
  }
}

const entry = { skill: 'calendar_availability', instanceId: 'calendar_availability_1', params: { enabled: 'true', durationMinutes: '45' } }

function card (props = {}) {
  return mount(SkillCard, {
    global,
    props: { entry, skill, phase: 'during', open: true, title: 'Availability', grants: noGrants(), ...props }
  })
}

describe('the strip that names an instance', () => {
  it('states on or off, whether it is open or shut, because a card that says nothing is how one stays off unnoticed', () => {
    expect(card({ open: false }).text()).toContain('On')
    expect(card({ open: false, entry: { ...entry, params: { enabled: 'false' } } }).text()).toContain('Off')
  })

  it('draws no setting while it is shut', () => {
    const shut = card({ open: false })
    expect(shut.text()).not.toContain('Duration')
    expect(shut.findAll('input').length).toBe(1) // the switch, and nothing else
  })

  it('asks for the instance to be removed or duplicated, and does not do either itself', () => {
    const open = card()
    const buttons = open.findAllComponents(Button)
    buttons.at(-2).trigger('click')
    buttons.at(-1).trigger('click')
    expect(open.emitted('duplicate')).toHaveLength(1)
    expect(open.emitted('remove')).toHaveLength(1)
    expect(open.emitted('update:field')).toBeUndefined()
  })

  it('reports the switch as a write of `enabled`, in the string a business variable stores', async () => {
    const open = card({ entry: { ...entry, params: { enabled: 'false' } } })
    await open.findComponent(ToggleSwitch).vm.$emit('update:modelValue', true)
    expect(open.emitted('update:field')[0][0]).toEqual({ key: 'enabled', value: 'true' })
  })
})

describe('the settings inside it', () => {
  it('draws the name first and reports it trimmed, so a trailing space never makes two names differ', async () => {
    const open = card()
    await open.findComponent(InputText).vm.$emit('update:modelValue', '  Sala   2 ')
    expect(open.emitted('update:field')[0][0]).toEqual({ key: 'label', value: 'Sala 2' })
  })

  it('draws a field through the widget its manifest declares', () => {
    expect(card().text()).toContain('Duration')
  })

  /* Nothing rather than a text box: a field drawn by the wrong widget looks like it works, and
   * writes a value that is wrong in a way nobody sees until a call goes badly. */
  it('says a field is undrawable rather than drawing it wrongly', () => {
    const open = card({
      skill: { ...skill, configSchema: { fields: [{ key: 'colour', widget: 'colour_picker' }] } }
    })
    expect(open.text()).toContain('No widget draws colour_picker')
    expect(open.findAll('input').length).toBe(1)
  })

  it('emits nothing at all when the card may not be edited', async () => {
    const open = card({ disabled: true })
    await open.findComponent(InputText).vm.$emit('update:modelValue', 'Sala 2')
    await open.findComponent(ToggleSwitch).vm.$emit('update:modelValue', false)
    expect(open.emitted('update:field')).toBeUndefined()
  })

  it('warns on the field when another instance carries the same name', () => {
    expect(card({ labelClash: true }).text()).toContain('Another instance carries this name')
  })
})

describe('an authorisation', () => {
  const oauthSkill = {
    ...skill,
    configSchema: { fields: [...skill.configSchema.fields, { key: 'calendarId', type: 'oauth', provider: 'google', scopes: ['calendar'] }] }
  }

  it('offers the button while nothing is connected, and asks for the flow the page owns', () => {
    const open = card({ skill: oauthSkill })
    const connect = open.findAllComponents(Button).find(b => b.text() === 'Authorise')
    connect.trigger('click')
    expect(open.emitted('oauth-connect')[0][0].key).toBe('calendarId')
  })

  /* A skill the platform cannot authorise does not offer a button that cannot work. */
  it('says what is wrong instead, when the deployment cannot obtain the scopes', () => {
    const open = card({
      skill: { ...oauthSkill, diagnostics: [{ severity: 'error', detail: 'scope not granted to this client' }] }
    })
    expect(open.text()).toContain('scope not granted to this client')
    expect(open.findAllComponents(Button).find(b => b.text() === 'Authorise')).toBeUndefined()
  })

  /* The render path that died on a real screen: the list of authorisations draws one label per
   * option, and the label function reached for something the composable had never been given. A
   * card with no grants never touches it, which is why every test here passed while the page
   * threw before drawing anything. */
  it('draws one label per authorisation offered, which is where the names are read', () => {
    const grants = noGrants({
      isOAuthConnected: () => true,
      grantFor: () => ({ grantName: 'calendar_availability_1', email: 'sala1@example.com' }),
      ownsGrant: () => true,
      grantOptions: () => ([
        { grantName: 'calendar_availability_1', email: 'sala1@example.com' },
        { grantName: 'calendar_availability_2', email: 'sala2@example.com' }
      ]),
      grantNameFor: () => 'calendar_availability_1'
    })
    const open = card({ skill: oauthSkill, grants })
    const reuse = open.findComponent(Dropdown)
    expect(reuse.props('options')).toHaveLength(2)
    expect(reuse.props('modelValue')).toBe('calendar_availability_1')
    expect(open.text()).toContain('sala1@example.com')
  })

  it('offers to stop using one this instance borrowed, which is not the same act as revoking it', () => {
    const grants = noGrants({
      isOAuthConnected: () => true,
      grantFor: () => ({ grantName: 'calendar_availability_2', email: 'somebody@example.com' }),
      ownsGrant: () => false
    })
    const open = card({ skill: oauthSkill, grants })
    expect(open.text()).toContain('Stop using')
    expect(open.text()).toContain('somebody@example.com')
  })
})

describe('an instance whose skill is gone', () => {
  it('stays on the screen, says so, and draws none of its settings', () => {
    const orphan = card({ skill: null })
    expect(orphan.text()).toContain('This skill is not installed')
    expect(orphan.text()).not.toContain('Duration')
    expect(orphan.classes()).toContain('entry-orphaned')
  })
})
