import { describe, it, expect } from 'vitest'
import {
  LABEL_FIELD_KEY, valueOf, labelOf, hintOf, placeholderOf, isEnabled, oauthFields,
  labelFieldOf, visibleInPhase, visibleHere, retiredAndEmpty, configurableFields,
  hasTemplateFields, descriptionOf, errorDiagnostics, argumentsOf, requiredArguments
} from '@/components/widgets/skills/manifestFields'

/** The rules a manifest states about its own fields, read without mounting anything.
  *
  * Each of these decided something on screen while it was a method of a 1585-line component, which
  * is why none of them had a test: to ask what a field's label is you had to build a component with
  * a store, a toast and an i18n instance.
  */

const skill = {
  name: 'calendar_availability',
  descriptionI18n: { en: '[Skill: calendar_availability] Offers free slots', it: 'Offre gli orari' },
  diagnostics: [
    { severity: 'error', detail: 'scope not granted to this client' },
    { severity: 'warning', detail: 'a title is missing' }
  ],
  configSchema: {
    fields: [
      { key: 'enabled', type: 'boolean' },
      { key: LABEL_FIELD_KEY, type: 'string', labels: { en: { label: 'Name', hint: 'How you call it' } } },
      { key: 'calendarId', type: 'oauth', provider: 'google' },
      { key: 'durationMinutes', type: 'number', default: 30, labels: { '*': { label: 'Duration' } } },
      { key: 'promptSlots', type: 'textarea' },
      { key: 'inject', type: 'boolean', default: 'true' },
      { key: 'firstInteraction', type: 'boolean', visibleWhen: { inject: 'true' } },
      { key: 'variables', type: 'json', deprecated: true },
      { key: 'onlyFinal', type: 'string', phases: ['final'] }
    ]
  }
}

const entry = { skill: 'calendar_availability', instanceId: 'calendar_availability_1', params: { enabled: 'true' } }

describe('what an instance carries', () => {
  it('reads params before the entry, which is the order the runtime reads them', () => {
    expect(valueOf({ params: { inject: 'false' }, inject: 'true' }, 'inject')).toBe('false')
    expect(valueOf({ params: {}, inject: 'true' }, 'inject')).toBe('true')
    expect(valueOf({ params: {} }, 'inject')).toBe('')
  })

  it('is on only for the string a business variable stores', () => {
    expect(isEnabled({ params: { enabled: 'true' } })).toBe(true)
    expect(isEnabled({ params: { enabled: ' TRUE ' } })).toBe(true)
    expect(isEnabled({ params: { enabled: '1' } })).toBe(false)
    expect(isEnabled({ params: {} })).toBe(false)
  })
})

describe('what a field is called', () => {
  it('prefers the language being read, then `*`, then English, then the key', () => {
    expect(labelOf({ key: 'x', labels: { it: { label: 'Nome' }, en: { label: 'Name' } } }, 'it')).toBe('Nome')
    expect(labelOf({ key: 'x', labels: { '*': { label: 'Duration' }, en: { label: 'Never read' } } }, 'it')).toBe('Duration')
    expect(labelOf({ key: 'durationMinutes' }, 'it')).toBe('durationMinutes')
    expect(hintOf({ key: 'x' }, 'en')).toBe('')
  })

  /* A placeholder is an example of a VALUE, and the only example the schema carries is the
   * default: a hint in the box would be the same paragraph twice on one screen. */
  it('offers the default as the example inside an empty box, and nothing when there is none', () => {
    expect(placeholderOf({ default: 30 })).toBe('30')
    expect(placeholderOf({ default: 0 })).toBe('0')
    expect(placeholderOf({})).toBe('')
    expect(placeholderOf({ default: null })).toBe('')
  })
})

describe('which fields the card draws', () => {
  it('leaves out the two drawn by hand and the authorisation', () => {
    const keys = configurableFields(skill, entry, 'during').map(f => f.key)
    expect(keys).not.toContain('enabled')
    expect(keys).not.toContain(LABEL_FIELD_KEY)
    expect(keys).not.toContain('calendarId')
  })

  it('leaves out a field this phase has no use for', () => {
    expect(configurableFields(skill, entry, 'during').map(f => f.key)).not.toContain('onlyFinal')
    expect(configurableFields(skill, entry, 'final').map(f => f.key)).toContain('onlyFinal')
    expect(visibleInPhase({ key: 'x' }, 'during')).toBe(true)
  })

  /* `firstInteraction` asks whether a fragment also goes into the welcome message, which cannot
   * happen for a fragment `inject` keeps out of the prompt: the contract declares the condition and
   * the runtime applies the same rule. Against the sibling's DEFAULT when nothing was written. */
  it('applies visibleWhen against the sibling, defaults included', () => {
    expect(visibleHere(skill, entry, skill.configSchema.fields.find(f => f.key === 'firstInteraction'))).toBe(true)
    const off = { params: { inject: 'false' } }
    expect(visibleHere(skill, off, skill.configSchema.fields.find(f => f.key === 'firstInteraction'))).toBe(false)
  })

  /* Version 1 declared a skill's arguments inside its configuration and version 2 declares them in
   * the manifest. Hidden when EMPTY and not always: a configuration carrying a value has to be able
   * to show it and clear it. */
  it('hides a retired field nobody filled, and shows one somebody did', () => {
    const retired = skill.configSchema.fields.find(f => f.key === 'variables')
    expect(retiredAndEmpty({ params: {} }, retired)).toBe(true)
    expect(retiredAndEmpty({ params: { variables: '[]' } }, retired)).toBe(true)
    expect(retiredAndEmpty({ params: { variables: '[{"name":"x"}]' } }, retired)).toBe(false)
    expect(configurableFields(skill, { params: { variables: '[{"name":"x"}]' } }, 'during')
      .map(f => f.key)).toContain('variables')
  })

  it('says once per card, not once per field, that templates can be written here', () => {
    expect(hasTemplateFields(skill, entry, 'during')).toBe(true)
    expect(hasTemplateFields({ configSchema: { fields: [{ key: 'a', type: 'string' }] } }, entry, 'during')).toBe(false)
  })
})

describe('what the catalogue says about the skill itself', () => {
  it('separates the authorisation field from the rest, and finds the name field', () => {
    expect(oauthFields(skill).map(f => f.key)).toEqual(['calendarId'])
    expect(labelFieldOf(skill).key).toBe(LABEL_FIELD_KEY)
    expect(labelFieldOf(null)).toBeNull()
  })

  it('strips the marker the description carries for the prompt, in the language read', () => {
    expect(descriptionOf(skill, 'en')).toBe('Offers free slots')
    expect(descriptionOf(skill, 'it')).toBe('Offre gli orari')
    expect(descriptionOf(null, 'en')).toBe('')
  })

  /* The button is not offered at all when a skill carries an error, so a warning counted as one
   * would take away a button that works. */
  it('counts only the errors, because a warning does not stop an authorisation', () => {
    expect(errorDiagnostics(skill).map(d => d.detail)).toEqual(['scope not granted to this client'])
    expect(errorDiagnostics(null)).toEqual([])
  })
})

describe('a skill the catalogue no longer lists', () => {
  it('answers nothing rather than throwing, because the configuration still names it', () => {
    expect(configurableFields(null, entry, 'during')).toEqual([])
    expect(oauthFields(null)).toEqual([])
    expect(hasTemplateFields(null, entry, 'during')).toBe(false)
  })
})


/** What THIS instance must be given, which is not what the skill declares in the abstract.
  *
  * The catalogue materialises the arguments against no configuration at all — it answers for the
  * skill — so an argument that is mandatory only in one mode arrives `required: false`. Printed as
  * it comes, a card tells somebody the identifier of the appointment to cancel is optional for a
  * call the platform refuses without it.
  */
describe('what an instance really requires', () => {
  const deleteSkill = {
    name: 'skill_calendar_event_delete',
    parameters: [
      { name: 'eventId', type: 'string', required: false, description: 'the appointment' },
      { name: 'confirmation', type: 'string', required: false, description: 'what the caller said' }
    ],
    manifest: {
      arguments: {
        required: [],
        properties: {
          eventId: { 'x-required-when': { target: 'event' } },
          confirmation: { 'x-required-when': { requireConfirmation: 'true' } }
        }
      }
    }
  }

  it('asks for the identifier where the instance cancels one named appointment', () => {
    const entry = { params: { target: 'event', requireConfirmation: 'false' } }
    expect(requiredArguments(deleteSkill, entry)).toEqual(['eventId'])
    expect(argumentsOf(deleteSkill, entry).find(a => a.name === 'eventId').required).toBe(true)
  })

  it('does not, where it cancels everything the caller has', () => {
    const entry = { params: { target: 'all_of_caller', requireConfirmation: 'true' } }
    expect(requiredArguments(deleteSkill, entry)).toEqual(['confirmation'])
  })

  it('keeps what the manifest requires outright, whatever the instance says', () => {
    const create = {
      parameters: [{ name: 'date', required: true, description: 'the day' }],
      manifest: { arguments: { required: ['date'], properties: { date: {} } } }
    }
    expect(requiredArguments(create, { params: {} })).toEqual(['date'])
  })

  it('reads the string form as "that property is set"', () => {
    const skill = {
      parameters: [{ name: 'key', required: false, description: 'the key' }],
      manifest: { arguments: { properties: { key: { 'x-required-when': 'filename' } } } }
    }
    expect(requiredArguments(skill, { params: { filename: 'listings.json' } })).toEqual(['key'])
    expect(requiredArguments(skill, { params: {} })).toEqual([])
  })

  it('answers nothing for a skill the catalogue no longer lists', () => {
    expect(argumentsOf(null, { params: {} })).toEqual([])
    expect(requiredArguments(null, { params: {} })).toEqual([])
  })
})
