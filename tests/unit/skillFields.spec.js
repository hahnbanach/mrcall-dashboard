import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import { componentFor, fieldComponents, drawnWidgets } from '@/components/widgets/skills/fields'
import TextField from '@/components/widgets/skills/fields/TextField.vue'
import NumberField from '@/components/widgets/skills/fields/NumberField.vue'
import BooleanField from '@/components/widgets/skills/fields/BooleanField.vue'
import SelectField from '@/components/widgets/skills/fields/SelectField.vue'
import KeyValueField from '@/components/widgets/skills/fields/KeyValueField.vue'
import CalendarField from '@/components/widgets/skills/fields/CalendarField.vue'

/** One case per widget, which is what makes adding the next one cheap: a field that stops writing
  * what it should fails here and nowhere else, and nobody has to re-read the card to be sure. */

// PrimeVue as a plugin because these are the real components, not stubs: a widget that renders
// through a stub proves nothing about the props it passes.
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })
const global = { plugins: [i18n, PrimeVue] }

function lastEmitted (wrapper) {
  const emitted = wrapper.emitted('update:modelValue')
  return emitted ? emitted.at(-1)[0] : undefined
}

describe('the registry', () => {
  it('chooses by the widget the manifest declares', () => {
    expect(componentFor({ widget: 'number', type: 'string' })).toBe(NumberField)
  })

  it('falls back to the version 1 type, for a row that carries no manifest', () => {
    expect(componentFor({ type: 'enum' })).toBe(SelectField)
    expect(componentFor({ type: 'tuples' })).toBe(fieldComponents.list)
    expect(componentFor({ type: 'string' })).toBe(TextField)
  })

  it('claims nothing it cannot draw, rather than drawing it wrongly', () => {
    expect(componentFor({ widget: 'colour_picker' })).toBeNull()
    expect(componentFor(null)).toBeNull()
  })

  it('draws every widget the manifests may declare today', () => {
    // The enum of `manifest-2.schema.json`, which is what a skill may ask for at all.
    const declarable = ['text', 'textarea', 'password', 'url', 'json', 'keyvalue',
      'select', 'list', 'number', 'boolean', 'weekly_hours']
    declarable.forEach(widget => {
      expect(drawnWidgets, `no component draws ${widget}`).toContain(widget)
    })
  })
})

describe('a number field', () => {
  it('writes the string the variables hold, not a number', () => {
    const wrapper = mount(NumberField, { props: { field: { key: 'durationMinutes', min: 5 }, modelValue: '15' }, global })
    wrapper.findComponent({ name: 'InputNumber' }).vm.$emit('update:modelValue', 45)
    expect(lastEmitted(wrapper)).toBe('45')
  })
})

describe('a boolean field', () => {
  it('reads and writes the string spelling every reader of these configurations expects', () => {
    const wrapper = mount(BooleanField, { props: { field: { key: 'enabled' }, modelValue: 'true' }, global })
    const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
    expect(toggle.props('modelValue')).toBe(true)
    toggle.vm.$emit('update:modelValue', false)
    expect(lastEmitted(wrapper)).toBe('false')
  })
})

describe('a key and value field', () => {
  it('reads the pairs out of the stored document', () => {
    const wrapper = mount(KeyValueField, {
      props: { field: { key: 'headers' }, modelValue: '{"X-One":"1","X-Two":"2"}' }, global
    })
    expect(wrapper.findAll('.kv-row')).toHaveLength(2)
  })

  it('writes a document back, dropping a pair with no name', () => {
    const wrapper = mount(KeyValueField, { props: { field: { key: 'headers' }, modelValue: '{"X-One":"1"}' }, global })
    wrapper.vm.pairs.push({ key: '', value: 'orphan' })
    wrapper.vm.pairs.push({ key: 'X-Two', value: '2' })
    wrapper.vm.publish()
    expect(JSON.parse(lastEmitted(wrapper))).toEqual({ 'X-One': '1', 'X-Two': '2' })
  })
})

describe('a calendar field', () => {
  it('says which authorisation it is waiting for when there is nothing to choose', () => {
    const wrapper = mount(CalendarField, {
      props: { field: { key: 'calendarId' }, options: [], summary: 'authorise a calendar first' }, global
    })
    expect(wrapper.text()).toContain('authorise a calendar first')
    expect(wrapper.findComponent({ name: 'Dropdown' }).exists()).toBe(false)
  })

  it('offers the calendars of the authorisation, by name', () => {
    const wrapper = mount(CalendarField, {
      props: {
        field: { key: 'calendarId' },
        modelValue: 'abc@group.calendar.google.com',
        options: [{ label: 'HBTEST', value: 'abc@group.calendar.google.com' }]
      },
      global
    })
    expect(wrapper.findComponent({ name: 'Dropdown' }).props('options')).toHaveLength(1)
  })
})
