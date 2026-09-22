import { describe, it, expect, vi, beforeEach } from 'vitest'
import agentSkills from '@/utils/AgentSkills'

/** Persisting a skill configuration: what is sent, where, and what a refusal is.
  *
  * The ordinary business write drops these variables — the server keeps them only for a write that
  * names the type it owns — so a configuration changed on the card is persisted through here or
  * nowhere, and a page that thought it had saved is the failure this covers.
  */
vi.mock('axios', () => ({ default: { put: vi.fn(), post: vi.fn() } }))
const axios = (await import('axios')).default

const user = { accessToken: 'token' }

beforeEach(() => { axios.put.mockReset() })

describe('persisting what a business is carrying', () => {
  it('sends the three phase variables and nothing else of the business', async () => {
    axios.put.mockResolvedValue({ data: { saved: true, diagnostics: [] } })

    await agentSkills.persistConfiguration(user, 'b-1', {
      SKILL_PREFETCH_CONFIGURATION: '[]',
      SKILL_RUNNINGLOOP_CONFIGURATION: '[{"skill":"x"}]',
      BOOKING_ENABLED: 'true',
      companyName: 'Somebody'
    })

    const [url, body] = axios.put.mock.calls[0]
    expect(url).toContain('/apidomain/agent/skills/configuration/b-1')
    expect(Object.keys(body).sort()).toEqual(['SKILL_PREFETCH_CONFIGURATION', 'SKILL_RUNNINGLOOP_CONFIGURATION'])
  })

  it('writes an object out as the string the variables hold', async () => {
    axios.put.mockResolvedValue({ data: { saved: true, diagnostics: [] } })
    await agentSkills.persistConfiguration(user, 'b-1', { SKILL_FINAL_CONFIGURATION: [{ skill: 'x' }] })
    expect(axios.put.mock.calls[0][1].SKILL_FINAL_CONFIGURATION).toBe('[{"skill":"x"}]')
  })

  it('does nothing, and says nothing went wrong, when there is no configuration', async () => {
    const outcome = await agentSkills.persistConfiguration(user, 'b-1', { BOOKING_ENABLED: 'true' })
    expect(outcome).toBeNull()
    expect(axios.put).not.toHaveBeenCalled()
  })

  it('reads a refusal as a refusal, with what is wrong, not as a failed call', async () => {
    axios.put.mockRejectedValue({
      response: { status: 422, data: { saved: false, diagnostics: [{ severity: 'error', path: '/prefetch/0/hours', code: 'overlap', detail: 'twice' }] } }
    })

    const outcome = await agentSkills.persistConfiguration(user, 'b-1', { SKILL_PREFETCH_CONFIGURATION: '[]' })

    expect(outcome.saved).toBe(false)
    expect(outcome.error).toBeNull()
    // What a person reads is where and what, not the code the machine matched on.
    expect(agentSkills.describeDiagnostics(outcome.diagnostics)).toBe('/prefetch/0/hours: twice')
  })

  it('reads anything else as a failed call, which is a different thing to tell somebody', async () => {
    axios.put.mockRejectedValue({ message: 'Network Error' })
    const outcome = await agentSkills.persistConfiguration(user, 'b-1', { SKILL_PREFETCH_CONFIGURATION: '[]' })
    expect(outcome.saved).toBe(false)
    expect(outcome.error).toBe('Network Error')
  })
})
