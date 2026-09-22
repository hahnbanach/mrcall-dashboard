import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeSlotsEditor from '@/components/widgets/TimeSlotsEditor.vue'

// A real i18n instance rather than a mocked `$t`: the component uses `useI18n()`, which asks the
// plugin and throws without one. Its messages are not what these cases are about, so the catalogue
// is empty and a key stands for itself.
const i18nPlugin = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })

/** The weekly grid, through the component a business actually edits.
  *
  * The case that matters is the end of the day: the picker runs 00:00 to 23:59 and the server reads
  * `22:00-00:00` as an entry that ends before it starts, so midnight at the end has to leave here as
  * `24:00` or the hours a business typed are refused.
  */
const i18n = {
  global: {
    plugins: [i18nPlugin],
    stubs: {
      Calendar: { template: '<input />', props: ['modelValue'] },
      Button: { template: '<button><slot /></button>' },
      Fieldset: { template: '<div><slot /></div>' },
      InputNumber: { template: '<input />', props: ['modelValue'] },
      Popover: { template: '<div><slot /></div>' }
    }
  }
}

function editor(model) {
  return mount(TimeSlotsEditor, {
    props: {
      modelValue: model,
      business: { variables: {} },
      variable: { modifiable: true, dependsOn: [] },
      slotDuration: 30
    },
    ...i18n
  })
}

describe('the weekly grid', () => {
  it('keeps what it was given', () => {
    const wrapper = editor({ monday: ['09:00-12:00'] })
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({ monday: ['09:00-12:00'] })
  })

  it('writes the end of the day as 24:00, which midnight cannot say', () => {
    const wrapper = editor({ friday: ['22:00-00:00'] })
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({ friday: ['22:00-24:00'] })
  })

  it('leaves 24:00 alone once it is written that way', () => {
    const wrapper = editor({ friday: ['22:00-24:00'] })
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({ friday: ['22:00-24:00'] })
  })

  it('drops a day with no hours rather than sending an empty list', () => {
    const wrapper = editor({ monday: ['09:00-12:00'], sunday: [] })
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({ monday: ['09:00-12:00'] })
  })
})
