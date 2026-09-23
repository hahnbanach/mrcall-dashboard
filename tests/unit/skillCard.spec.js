import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
// The same module the components import: `primevue/select` is a different instance of the
// same component and `findComponent` would not match it.
import Dropdown from 'primevue/dropdown'
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
        calendarChosen: 'A calendar is chosen', calendarNotChosen: 'No calendar yet',
        argumentsTitle: 'What the assistant collects during the call',
        argumentRequired: 'required', argumentOptional: 'optional',
        argumentsTemplateHint: 'Every name above can be used as %%name%% in the text fields of this card.'
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

/** The calendar an instance books on: a choice, never something to type.
  *
  * The authorisation is given for an ACCOUNT, so the calendars it can see are known and have names;
  * what is stored is a Google identifier nobody knows by heart. This is also where the card's own
  * rule shows: which component draws a field is the widget the manifest declares, so a manifest
  * saying `text` for this field puts a box on the screen and no test would notice.
  */
describe('the calendar field', () => {
  const calendarSkill = {
    ...skill,
    configSchema: {
      fields: [
        ...skill.configSchema.fields,
        { key: 'calendarId', type: 'string', widget: 'calendar', labels: { en: { label: 'Calendar' } } }
      ]
    }
  }

  it('offers the calendars of the authorisation by name, rather than a box', async () => {
    const grants = noGrants({
      calendarOptions: () => ([
        { label: 'Sala 1', value: 'sala1@group.calendar.google.com' },
        { label: 'Sala 2', value: 'sala2@group.calendar.google.com' }
      ]),
      calendarSummary: () => 'Choose a calendar'
    })
    const open = card({
      skill: calendarSkill,
      entry: { ...entry, params: { ...entry.params, calendarId: 'sala2@group.calendar.google.com' } },
      grants
    })
    const picker = open.findComponent(Dropdown)
    expect(picker.props('options')).toHaveLength(2)
    expect(picker.props('modelValue')).toBe('sala2@group.calendar.google.com')
  })

  it('says which authorisation it is waiting for when there is nothing to choose from', () => {
    const grants = noGrants({ calendarSummary: () => 'Authorise a calendar first' })
    const open = card({ skill: calendarSkill, grants })
    expect(open.text()).toContain('Authorise a calendar first')
    expect(open.findComponent(Dropdown).exists()).toBe(false)
  })
})

/** The parameters of the function, which the card used to say nothing about.
  *
  * "How does it know which appointment" and "where does the time come from" had no answer on the
  * screen: the answer is that the model passes them, and nothing said the arguments existed.
  */
describe('the function this instance publishes', () => {
  const withArguments = {
    ...skill,
    parameters: [
      { name: 'date', type: 'string', required: true, description: 'The day as YYYY-MM-DD' },
      { name: 'reason', type: 'string', required: false, description: 'What it is for, if said' }
    ],
    // The catalogue row carries both, and the card answers "mandatory?" from the manifest against
    // this instance rather than from the row, which was materialised against no instance at all.
    manifest: { arguments: { required: ['date'], properties: { date: {}, reason: {} } } },
    configSchema: {
      fields: [
        ...skill.configSchema.fields,
        { key: 'variables', type: 'tuples', widget: 'list', labels: { en: { label: 'Arguments this instance adds', hint: 'Collected during the call' } } }
      ]
    }
  }

  it('names each argument, says whether it is required, and says what it is for', () => {
    const open = card({ skill: withArguments })
    const text = open.text()
    expect(text).toContain('date')
    expect(text).toContain('required')
    expect(text).toContain('optional')
    expect(text).toContain('The day as YYYY-MM-DD')
  })

  it('says the names can be used in the text fields of this card', () => {
    expect(card({ skill: withArguments }).text()).toContain('%%name%%')
  })

  /* One declaration, read in one place: the extras are the other half of the arguments, and drawing
   * them among the settings is what made them read as one setting more. */
  it('draws the extras beside them and not among the settings', () => {
    const open = card({ skill: withArguments })
    expect(open.find('.skill-arguments').text()).toContain('Arguments this instance adds')
    expect(open.find('.entry-fields').text()).not.toContain('Arguments this instance adds')
  })

  it('reports a changed extras list as a write of that field', async () => {
    const open = card({ skill: withArguments })
    await open.findComponent({ name: 'SkillArguments' }).vm.$emit('update:extras', '[["AGE","età",true]]')
    expect(open.emitted('update:field')[0][0]).toEqual({ key: 'variables', value: '[["AGE","età",true]]' })
  })

  it('shows nothing of the sort for a skill that publishes no parameters and adds none', () => {
    expect(card().find('.skill-arguments').exists()).toBe(false)
  })

  /* A prefetch instance runs before anybody speaks and a final one after everybody has hung up:
   * no model, nothing collected. Listing the arguments there is how somebody comes to ask why a
   * date they never see is being requested. */
  it('names none of them in a phase where no model runs', () => {
    const prefetch = card({ skill: withArguments, phase: 'prefetch' })
    expect(prefetch.text()).not.toContain('The day as YYYY-MM-DD')
    const final = card({ skill: withArguments, phase: 'final' })
    expect(final.text()).not.toContain('The day as YYYY-MM-DD')
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
