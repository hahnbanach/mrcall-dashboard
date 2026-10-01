import { describe, it, expect } from 'vitest'
import agentSkills from '@/utils/AgentSkills'

/** Whether a business takes bookings, which the plan page reads to keep the booking feature selected.
  *
  * It used to read START_BOOKING_PROCESS, the switch of the legacy booking, which no longer exists:
  * a business that books through the calendar skills was offered a plan without booking.
  */
describe('takesBookings', () => {
  const create = enabled => JSON.stringify([
    { skill: 'skill_calendar_event_create', instanceId: 'calendar_create_1', params: { enabled } }
  ])

  it('is true with a booking instance switched on in the running loop', () => {
    expect(agentSkills.takesBookings({ SKILL_RUNNINGLOOP_CONFIGURATION: create('true') })).toBe(true)
    expect(agentSkills.takesBookings({ SKILL_RUNNINGLOOP_CONFIGURATION: create(true) })).toBe(true)
  })

  it('is false with the booking instance switched off, or with none', () => {
    expect(agentSkills.takesBookings({ SKILL_RUNNINGLOOP_CONFIGURATION: create('false') })).toBe(false)
    expect(agentSkills.takesBookings({ SKILL_RUNNINGLOOP_CONFIGURATION: '[]' })).toBe(false)
    expect(agentSkills.takesBookings(undefined)).toBe(false)
  })

  it('does not read the switch of the legacy booking', () => {
    expect(agentSkills.takesBookings({ START_BOOKING_PROCESS: 'true' })).toBe(false)
  })

  it('reads only the running loop, where a booking is written', () => {
    expect(agentSkills.takesBookings({ SKILL_PREFETCH_CONFIGURATION: create('true') })).toBe(false)
  })
})
