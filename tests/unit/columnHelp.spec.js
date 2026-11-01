import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import enUS from '@/i18n/locales/en-US.json'
import ColumnHelp from '@/components/analytics/ColumnHelp.vue'

/**
 * Plan docs/execution-plans/2026-10-31-analytics-ux.md, step A4 (brief O4): how a column is counted, on its header.
 * The button is named for its column and described by the text (so a screen reader reads it), the tooltip shows on
 * hover and on focus and hides on Escape, and its click does not reach the header cell (which may sort). Every column
 * the brief lists has its text in en-US (the locale check carries it to the other eleven).
 * Seen failing, 2026-11-01, before ColumnHelp.vue and the `help` keys existed.
 */
const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })

function draw () {
  const host = document.createElement('div')
  document.body.appendChild(host)
  let sorted = 0
  const wrapper = mount({
    components: { ColumnHelp },
    template: '<table><thead><tr><th @click="sort"><ColumnHelp column="Checks" text="calls where a check fired, over the calls checked" /></th></tr></thead></table>',
    methods: { sort () { sorted += 1 } }
  }, { global: { plugins: [i18n] }, attachTo: host })
  return { wrapper, sorted: () => sorted }
}

const bubble = () => document.body.querySelector('.column-help-bubble')

describe('ColumnHelp', () => {
  it('is named for its column and described by its text', () => {
    const { wrapper } = draw()
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('How this column is counted: Checks')
    // on the body, so that it is not part of the header cell's own text
    const described = document.getElementById(button.attributes('aria-describedby'))
    expect(described.textContent).toBe('calls where a check fired, over the calls checked')
    expect(wrapper.get('th').text()).not.toContain('calls where a check fired')
    wrapper.unmount()
  })

  it('shows on focus and on hover, hides on Escape and on blur', async () => {
    const { wrapper } = draw()
    const button = wrapper.get('button')
    expect(bubble()).toBeNull()
    await button.trigger('focus')
    expect(bubble().textContent).toBe('calls where a check fired, over the calls checked')
    await button.trigger('keydown', { key: 'Escape' })
    expect(bubble()).toBeNull()
    await button.trigger('mouseenter')
    expect(bubble()).not.toBeNull()
    await button.trigger('mouseleave')
    expect(bubble()).toBeNull()
    wrapper.unmount()
  })

  it('a click on it never reaches the header cell that sorts', async () => {
    const { wrapper, sorted } = draw()
    await wrapper.get('button').trigger('click')
    expect(sorted()).toBe(0)
    expect(bubble()).not.toBeNull()
    wrapper.unmount()
  })
})

describe('one help at a time', () => {
  it('opening one closes the one already open (a click does not focus a button on WebKit, so no blur closes it)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount({
      components: { ColumnHelp },
      template: '<div><ColumnHelp column="Calls" text="calls text" /><ColumnHelp column="Checks" text="checks text" /></div>'
    }, { global: { plugins: [i18n] }, attachTo: host })
    const [calls, checks] = wrapper.findAll('button')
    await calls.trigger('click')
    await checks.trigger('focus')
    const shown = [...document.body.querySelectorAll('.column-help-bubble')].map((b) => b.textContent)
    expect(shown).toEqual(['checks text'])
    wrapper.unmount()
  })
})

describe('the help of every column the brief lists', () => {
  const help = enUS.components.callInsights.help
  const legend = enUS.components.callInsights.assistants.legend
  it('has its text', () => {
    const listed = {
      assistants: ['calls', 'asks', 'health'],
      requests: ['calls', 'businesses', 'trend', 'freshness', 'nextAction'],
      breakdown: ['totalCalls', 'callPercentage'],
      topics: ['previousCalls'],
      reports: ['revision', 'status', 'calls'],
      jobs: ['progress'],
    }
    for (const [section, keys] of Object.entries(listed)) {
      for (const k of keys) expect(help[section] && help[section][k], `help.${section}.${k}`).toBeTruthy()
    }
    // the assistants' share columns, the change and the suggestions keep the legend's own texts as their help
    for (const k of ['notSolved', 'callerSilent', 'notAnswered', 'callerLeft', 'unanswered', 'checks', 'skillErrors', 'extractionIssues', 'change', 'configSuggestions']) {
      expect(legend[k], `assistants.legend.${k}`).toBeTruthy()
    }
    expect(help.label).toContain('{column}')
    expect(help.title).toBeTruthy()
  })
})
