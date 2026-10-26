import { describe, it, expect } from 'vitest'
import agentSkills from '@/utils/AgentSkills'
import { placeholderOf } from '@/components/widgets/skills/manifestFields'

/** A field's default for one phase (`phaseDefault`, StarChat 3c8372685).
  *
  * A manifest property keeps `default` and may add `phaseDefault: {during, final, prefetch}`; the
  * catalogue forwards it on the same fields and spelt as `default` is (a JSON-encoded property as a
  * string). When an instance is added to a phase the screen copies the phase's own value when the
  * key for that phase is there, NOTHING when that value is `null`, else `default`
  * (docs/briefs/2026-10-26-skill-default-references.md in StarChat, decision 1 and amendment point 3;
  * the same rule as `SkillManifest.defaultFor`). The fields below are the forwarded rows of
  * calendar event create and Sheets write as StarChat 58eade3e9 declares them.
  *
  * Seen failing on 2026-10-26 before the fix: a during Sheets instance got the end-of-call column
  * mapping (`public:CALLER_NAME`, unresolved during the call), a during calendar instance got the
  * end-of-call `date`, and a final calendar instance got the during `title` with `%%FULL_NAME%%`;
  * the placeholder showed `default` in every phase. The fallback case passes on that code by
  * construction (it copied `default` always); it was seen failing with the fix perturbed to drop
  * `default` whenever a field has any `phaseDefault`.
  */

const duringColumns = '[{"column":"Contact","value":"%%FULL_NAME%%"},{"column":"Reason","value":"%%reason%%"}]'
const finalColumns = '[{"column":"Contact","value":"%%public:CALLER_NAME%%"},{"column":"Reason","value":"%%public:EXTRACTED:CALL_REASON%%"}]'

const sheets = {
  name: 'google_sheets_write',
  configSchema: {
    phases: ['during', 'final'],
    instances: { max: null, maxPerPhase: null },
    fields: [
      { key: 'enabled', type: 'boolean', default: 'true' },
      { key: 'SKILL_GSHEETS_WRITE_COLUMNS', type: 'json', default: finalColumns,
        phaseDefault: { during: duringColumns, final: finalColumns } },
      { key: 'variables', type: 'list', phases: ['during'],
        default: '[["reason","Motivo della chiamata, in una frase","false"],["FULL_NAME","Nome e cognome del chiamante, se li ha detti","false"]]' }
    ]
  }
}

const eventCreate = {
  name: 'calendar_event_create',
  configSchema: {
    phases: ['during', 'final'],
    instances: { max: null, maxPerPhase: null },
    fields: [
      { key: 'title', type: 'string', default: 'Appuntamento: %%FULL_NAME%% -',
        phaseDefault: { final: 'Appuntamento: %%public:CALLER_NAME%% -' } },
      { key: 'date', type: 'string', phases: ['final'], default: '%%public:EXTRACTED:BOOKING_DATE%%',
        phaseDefault: { during: null, final: '%%public:EXTRACTED:BOOKING_DATE%%' } },
      { key: 'variables', type: 'list', phases: ['during'],
        default: '[["FULL_NAME","Nome e cognome della persona per cui è l\'appuntamento","true"]]' }
    ]
  }
}

const empty = { prefetch: [], during: [], final: [] }
const added = (skill, phase) => agentSkills.addSkillToPhase(empty, skill, phase)[phase][0].params

describe('a new instance takes the default of the phase it is added to', () => {
  it('copies the phase\'s own value when the field gives that phase one', () => {
    expect(added(sheets, 'during').SKILL_GSHEETS_WRITE_COLUMNS).toBe(duringColumns)
    expect(added(sheets, 'final').SKILL_GSHEETS_WRITE_COLUMNS).toBe(finalColumns)
    expect(added(eventCreate, 'final').title).toBe('Appuntamento: %%public:CALLER_NAME%% -')
  })

  it('copies nothing for a phase given null, not even `default`', () => {
    const params = added(eventCreate, 'during')
    expect(params).not.toHaveProperty('date')
    expect(added(eventCreate, 'final').date).toBe('%%public:EXTRACTED:BOOKING_DATE%%')
  })

  it('falls back to `default` when the field has no phaseDefault or none for this phase', () => {
    expect(added(eventCreate, 'during').title).toBe('Appuntamento: %%FULL_NAME%% -')
    expect(added(sheets, 'during').enabled).toBe('true')
  })

  it('carries the declared rows, FULL_NAME and reason, into the instance as the form reads them', () => {
    const rows = JSON.parse(added(eventCreate, 'during').variables)
    expect(rows).toEqual([['FULL_NAME', 'Nome e cognome della persona per cui è l\'appuntamento', 'true']])
    expect(JSON.parse(added(sheets, 'during').variables).map(r => [r[0], r[2]]))
      .toEqual([['reason', 'false'], ['FULL_NAME', 'false']])
  })
})

describe('the example inside an empty box is the default of the card\'s phase', () => {
  const field = name => eventCreate.configSchema.fields.find(f => f.key === name)

  it('shows the phase\'s own value, nothing for a null phase, and `default` otherwise', () => {
    expect(placeholderOf(field('title'), 'final')).toBe('Appuntamento: %%public:CALLER_NAME%% -')
    expect(placeholderOf(field('title'), 'during')).toBe('Appuntamento: %%FULL_NAME%% -')
    expect(placeholderOf(field('date'), 'during')).toBe('')
    expect(placeholderOf(field('date'), 'final')).toBe('%%public:EXTRACTED:BOOKING_DATE%%')
  })
})
