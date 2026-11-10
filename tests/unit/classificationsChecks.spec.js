import { describe, it, expect } from 'vitest'
import Classifications from '@/utils/Classifications'

/**
 * A call's two correctable checks, `caller_repeated` and `caller_unsatisfied` (docs/briefs/2026-11-09-caller-checks-correction.md;
 * StarChat 9.34.131, `InsightsFeedback.effectiveJson`): asked like the call's resolution and message, offered without
 * "wrong", and their value written at `checks.<name>.value` on the three paths that carry a value without the call's
 * state (a 409 `stale_value`, a signal's answer, a non-owner's undo).
 *
 * Seen failing on c855a16, before `Classifications.js` learnt the checks: six of the eight cases. The two that passed
 * hold on code already generic: `chipState` reading a check's history, and a call without checks left without them.
 */
const CALL = 'conv-1'

function judged(checks) {
  return {
    conversationId: CALL,
    resolution: { model: 'resolved', value: 'resolved', corrected: false },
    message: { model: null, value: null, corrected: false },
    requests: [],
    facts: {},
    checks,
    history: [],
  }
}

const both = () => ({
  caller_repeated: { model: 'true', value: 'true', corrected: false },
  caller_unsatisfied: { model: 'false', value: 'false', corrected: false },
})

describe('the checks a person corrects', () => {
  it('names the two checks, never promise_not_kept_in_call', () => {
    expect(Classifications.CHECK_FIELDS).toEqual(['caller_repeated', 'caller_unsatisfied'])
    expect(Classifications.isCheck('caller_repeated')).toBe(true)
    expect(Classifications.isCheck('promise_not_kept_in_call')).toBe(false)
    expect(Classifications.isCheck('resolution')).toBe(false)
  })

  it('asks a correction of a check on the call, with the brief\'s body', () => {
    const a = Classifications.ask({ conversationId: CALL, field: 'caller_repeated', signal: 'wrong_value', valueFrom: 'true', valueTo: 'false' })
    expect(a).toEqual({ subject: 'call', conversationId: CALL, field: 'caller_repeated', signal: 'wrong_value', valueFrom: 'true', valueTo: 'false' })
    expect(() => Classifications.ask({ conversationId: CALL, field: 'promise_not_kept_in_call', signal: 'wrong_value', valueFrom: 'true', valueTo: 'false' })).toThrow()
  })

  it('offers "true" and "false", the current one marked, "right" and history, and no "wrong"', () => {
    expect(Classifications.valuesOf('caller_unsatisfied')).toEqual(['true', 'false'])
    const state = Classifications.chipState(both().caller_repeated, [], { field: 'caller_repeated' }, 'owner')
    const entries = Classifications.menuEntries('caller_repeated', state)
    expect(entries.map((e) => e.kind + (e.value ? ':' + e.value : ''))).toEqual(['value:true', 'value:false', 'right', 'history'])
    expect(entries.find((e) => e.value === 'true').current).toBe(true)
    // resolution keeps its "wrong"
    const r = Classifications.menuEntries('resolution', { value: 'resolved' })
    expect(r.some((e) => e.kind === 'wrong')).toBe(true)
  })

  it('reads a check\'s correction in force from the history, beside the other fields\'', () => {
    const history = [{
      feedbackId: 'f1', subject: 'call', conversationId: CALL, field: 'caller_repeated', signal: 'wrong_value',
      valueFrom: 'true', valueTo: 'false', status: 'applied', byMe: true, createdAt: 10, decidedAt: 10,
    }]
    const s = Classifications.chipState({ model: 'true', value: 'false', corrected: true }, history, { field: 'caller_repeated' }, 'owner')
    expect(s).toMatchObject({ value: 'false', model: 'true', kind: 'corrected', canRestore: true })
    expect(s.correction).toMatchObject({ feedbackId: 'f1', from: 'true', to: 'false' })
    // the same history says nothing on the other check
    expect(Classifications.chipState(both().caller_unsatisfied, history, { field: 'caller_unsatisfied' }, 'owner').kind).toBe('model')
  })

  describe('withCurrent writes a check\'s value under checks', () => {
    it('a 409 stale_value whose current names caller_repeated', () => {
      const data = judged(both())
      const next = Classifications.withCurrent(data, [{ conversationId: CALL, field: 'caller_repeated', value: 'false' }])
      expect(next.checks.caller_repeated).toEqual({ model: 'true', value: 'false', corrected: false })
      expect(next.checks.caller_unsatisfied).toEqual(both().caller_unsatisfied)
      // the data read is not changed in place
      expect(data.checks.caller_repeated.value).toBe('true')
      expect(next.caller_repeated).toBeUndefined()
    })

    it('a signal\'s answer without the call\'s state', () => {
      const data = judged(both())
      const ask = Classifications.ask({ conversationId: CALL, field: 'caller_repeated', signal: 'wrong_value', valueFrom: 'true', valueTo: 'false' })
      const next = Classifications.withGesture(data, { gestureId: 'g1', role: 'owner', calls: [], entries: [{ ask, answer: { feedbackId: 'f9', status: 'applied', value: 'false' } }] })
      expect(next.checks.caller_repeated.value).toBe('false')
      expect(Classifications.chipState(next.checks.caller_repeated, next.history, { field: 'caller_repeated' }, 'owner').kind).toBe('corrected')
    })

    it('a non-owner\'s undo, answered with items and without the call\'s state', () => {
      const data = judged({ ...both(), caller_repeated: { model: 'true', value: 'false', corrected: true } })
      const items = [{ conversationId: CALL, field: 'caller_repeated', value: 'true', status: 'reverted', feedbackId: 'f9' }]
      const next = Classifications.withCurrent(data, items)
      expect(next.checks.caller_repeated.value).toBe('true')
    })

    it('leaves a call without checks without checks', () => {
      const data = judged(undefined)
      delete data.checks
      const next = Classifications.withCurrent(data, [{ conversationId: CALL, field: 'caller_repeated', value: 'false' }])
      expect(next.checks).toBeUndefined()
    })
  })
})
