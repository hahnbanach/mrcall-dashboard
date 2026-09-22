import { describe, it, expect, vi } from 'vitest'
import { useSkillGrants } from '@/components/widgets/skills/useSkillGrants'

/** The authorisations, asked the questions a card asks them.
  *
  * These are the rules that decide whether a skill is connected, whose authorisation it is and
  * whether taking it back would leave somebody without one — the kind of thing that used to live in
  * the middle of a 1 500-line component and could only be exercised by clicking.
  */

const oauthField = { key: 'SKILL_CALENDAR_AUTH', type: 'oauth', provider: 'google_calendar' }

function grants (entries, { businessId = 'b-1' } = {}) {
  const api = useSkillGrants({
    store: { state: { user: null } },
    businessId: () => businessId,
    fieldsOf: () => [oauthField],
    entriesOf: () => entries,
    setFieldValue: vi.fn(),
    t: (key) => key
  })
  return api
}

const entry = (instanceId, grantName) => ({
  skill: 'skill_calendar_availability',
  instanceId,
  params: grantName ? { [oauthField.key]: grantName } : {}
})

describe('which authorisation an instance acts with', () => {
  it('is the one named on the instance when it names one', () => {
    const api = grants([])
    expect(api.grantNameFor(entry('calendar_availability_1', 'shared_one'), oauthField)).toBe('shared_one')
  })

  it('is its own identifier when it names none, which is how it is given one', () => {
    const api = grants([])
    expect(api.grantNameFor(entry('calendar_availability_1'), oauthField)).toBe('calendar_availability_1')
  })
})

describe('whether it is connected', () => {
  it('is not, when the business holds no authorisation for that provider', () => {
    const api = grants([])
    api.oauthGrants.value = []
    expect(api.isOAuthConnected(oauthField, entry('calendar_availability_1'))).toBe(false)
  })

  it('is, when one is held under the instance own name', () => {
    const api = grants([])
    api.oauthGrants.value = [{ provider: 'google_calendar', businessId: 'b-1', grantName: 'calendar_availability_1' }]
    expect(api.isOAuthConnected(oauthField, entry('calendar_availability_1'))).toBe(true)
  })

  it('is not, when the authorisation belongs to another business', () => {
    const api = grants([])
    api.oauthGrants.value = [{ provider: 'google_calendar', businessId: 'b-2', grantName: 'calendar_availability_1' }]
    expect(api.isOAuthConnected(oauthField, entry('calendar_availability_1'))).toBe(false)
  })

  it('falls back to one given for the whole business, which is how the older ones were given', () => {
    const api = grants([])
    api.oauthGrants.value = [{ provider: 'google_calendar', businessId: 'b-1', grantName: '' }]
    expect(api.isOAuthConnected(oauthField, entry('calendar_availability_2'))).toBe(true)
  })
})

describe('who else is using an authorisation', () => {
  it('finds the instances that name it, so taking it back is a decision with a cost on it', () => {
    const entries = [entry('calendar_availability_1'), entry('calendar_events_read_1', 'calendar_availability_1')]
    const api = grants(entries)
    expect(api.instancesUsing('calendar_availability_1')).toHaveLength(2)
  })

  it('says nobody when the name is empty, rather than everybody', () => {
    const api = grants([entry('calendar_availability_1')])
    expect(api.instancesUsing('')).toHaveLength(0)
  })
})

describe('whose authorisation it is', () => {
  it('belongs to the instance whose identifier names it', () => {
    const api = grants([])
    const owned = { grantName: 'calendar_availability_1' }
    expect(api.ownsGrant(entry('calendar_availability_1'), owned)).toBe(true)
    expect(api.ownsGrant(entry('calendar_availability_2'), owned)).toBe(false)
  })
})
