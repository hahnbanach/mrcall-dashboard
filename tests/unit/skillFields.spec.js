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
import ChecklistField from '@/components/widgets/skills/fields/ChecklistField.vue'
import SkillArguments from '@/components/widgets/skills/SkillArguments.vue'

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
      'select', 'list', 'number', 'boolean', 'weekly_hours', 'checklist']
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

// An Italian card titled its options in English, explained none of them, asked for a JSON list of operations and
// explained the collected details in the model's English (StarChat plan skill-form-for-owners, 2026-10-18).
const italian = createI18n({ legacy: false, locale: 'it-IT', messages: { 'it-IT': {} }, missingWarn: false, fallbackWarn: false })
const inItalian = { plugins: [italian, PrimeVue] }

describe('a select field', () => {
  const field = {
    key: 'phoneChanges',
    default: 'details_only',
    options: [
      { value: 'moves_and_details', label: 'Everything', labels: { it: { label: 'Tutto', hint: 'Sposta e aggiorna.' }, en: { label: 'Everything', hint: 'Moves and updates.' } } },
      { value: 'details_only', label: 'Details only', labels: { it: { label: 'Solo i dettagli', hint: 'Aggiorna nome e note.' } } },
      { value: 'legacy', label: 'Legacy' }
    ]
  }

  it('titles each option in the screen language, falling back to the English label', () => {
    const wrapper = mount(SelectField, { props: { field }, global: inItalian })
    const options = wrapper.findComponent({ name: 'Dropdown' }).props('options')
    expect(options.map(o => o.label)).toEqual(['Tutto', 'Solo i dettagli', 'Legacy'])
    expect(options[0].hint).toBe('Sposta e aggiorna.')
  })

  it('explains the option chosen, the default when nothing is stored', async () => {
    const wrapper = mount(SelectField, { props: { field }, global: inItalian })
    expect(wrapper.find('.select-chosen-hint').text()).toBe('Aggiorna nome e note.')
    await wrapper.setProps({ modelValue: 'moves_and_details' })
    expect(wrapper.find('.select-chosen-hint').text()).toBe('Sposta e aggiorna.')
    await wrapper.setProps({ modelValue: 'legacy' })
    expect(wrapper.find('.select-chosen-hint').exists()).toBe(false)
  })
})

describe('a checklist field', () => {
  const field = {
    key: 'operations',
    default: '["availability","create","read","delete","request"]',
    options: [
      { value: 'availability', label: 'Say whether there is room', labels: { it: { label: 'Dire se c\'è posto', hint: 'Risponde sugli orari.' } } },
      { value: 'create', label: 'Book a table', labels: { it: { label: 'Prenotare un tavolo' } } },
      { value: 'update' }
    ]
  }

  it('offers only the titled values, in the screen language', () => {
    const wrapper = mount(ChecklistField, { props: { field, modelValue: '["availability"]' }, global: inItalian })
    expect(wrapper.findAll('.checklist-option').map(o => o.find('span').text())).toEqual(['Dire se c\'è posto', 'Prenotare un tavolo'])
    expect(wrapper.find('.checklist-hint').text()).toBe('Risponde sugli orari.')
  })

  it('writes the JSON text of the values ticked, keeping a stored value it does not offer', async () => {
    const wrapper = mount(ChecklistField, { props: { field, modelValue: '["availability","update"]' }, global: inItalian })
    const boxes = wrapper.findAllComponents({ name: 'Checkbox' })
    expect(boxes.map(b => b.props('modelValue'))).toEqual([true, false])
    boxes[1].vm.$emit('update:modelValue', true)
    expect(lastEmitted(wrapper)).toBe('["availability","create","update"]')
    boxes[0].vm.$emit('update:modelValue', false)
    expect(lastEmitted(wrapper)).toBe('["update"]')
  })

  it('starts from the default when nothing is stored', () => {
    const wrapper = mount(ChecklistField, { props: { field }, global: inItalian })
    expect(wrapper.findAllComponents({ name: 'Checkbox' }).map(b => b.props('modelValue'))).toEqual([true, true])
  })
})

describe('the arguments a card lists', () => {
  it('shows the owner title and explanation, never the model description', () => {
    const parameters = [
      { name: 'covers', description: 'How many people, children included.', required: true,
        title: { it: 'Persone', en: 'People' }, hint: { it: 'Quante persone, bambini compresi.', en: 'How many people.' } },
      { name: 'eta', description: 'The time they now expect.', required: false, title: null, hint: null }
    ]
    const wrapper = mount(SkillArguments, { props: { parameters, phase: 'during' }, global: inItalian })
    const rows = wrapper.findAll('tr')
    expect(rows[0].find('.argument-name').text()).toContain('Persone')
    expect(rows[0].find('.argument-key').text()).toBe('covers')
    expect(rows[0].find('.argument-what').text()).toBe('Quante persone, bambini compresi.')
    expect(rows[1].find('.argument-name').text()).toBe('eta')
    expect(rows[1].find('.argument-what').text()).toBe('')
    expect(wrapper.text()).not.toContain('How many people, children included.')
  })
})
