import { describe, it, expect } from 'vitest'
import businessVariablesUtils from '@/utils/BusinessVariables'

/** The voices a business is offered follow the engine it is on, and a voice chosen under the other
  * engine is reported rather than kept silently: on test, 2026-09-29, a clinic on Realtime with a
  * GPT-Live voice had every Realtime session refused and never heard the caller.
  *
  * The values are shaped as the TTS_SELECTION definition ships them (decision-tables/variables). */
const live = [['call_parameters.OPENAI_GEN_API.API(live)']]
const notLive = [['!call_parameters.OPENAI_GEN_API.API(live)']]
const variable = {
  name: 'TTS_SELECTION',
  type: 'templated',
  templatedVariable: {
    values: {
      voice37: { label: 'verse (OpenAI)', language: '*' },
      voice50: { label: 'marin (OpenAI)', language: '*' },
      voice55: { label: 'willow (OpenAI Live)', language: 'en', dependsOn: live },
      voice59: { label: 'bossa (OpenAI Live)', language: 'pt_BR', dependsOn: live },
      voice10: { label: 'Giulia (ElevenLabs)', language: 'it', dependsOn: notLive }
    }
  }
}
const business = (api, selection, languageCountry = 'en_US') => ({
  languageCountry,
  variables: { 'call_parameters.OPENAI_GEN_API.API': api, TTS_SELECTION: selection }
})
const offered = (b) => businessVariablesUtils.templatedOptions(b, variable).map(o => o.value).sort()

describe('the voices offered', () => {
  it('under GPT-Live are the ones it has, in the business language, and no ElevenLabs voice', () => {
    expect(offered(business('live'))).toEqual(['voice37', 'voice50', 'voice55'])
    expect(offered(business('live', undefined, 'pt_BR'))).toEqual(['voice37', 'voice50', 'voice59'])
  })

  it('under Realtime leave out every GPT-Live-only voice', () => {
    expect(offered(business('realtime', undefined, 'it_IT'))).toEqual(['voice10', 'voice37', 'voice50'])
    expect(offered(business('realtime'))).toEqual(['voice37', 'voice50'])
  })
})

describe('a voice chosen under the other engine', () => {
  it('is reported by name once the engine no longer has it', () => {
    expect(businessVariablesUtils.unavailableTemplatedValue(business('realtime', 'voice55'), variable))
      .toEqual({ value: 'voice55', label: 'willow (OpenAI Live)' })
  })

  it('is not reported while it is offered, nor when nothing is chosen', () => {
    expect(businessVariablesUtils.unavailableTemplatedValue(business('live', 'voice55'), variable)).toBeUndefined()
    expect(businessVariablesUtils.unavailableTemplatedValue(business('realtime', 'voice50'), variable)).toBeUndefined()
    expect(businessVariablesUtils.unavailableTemplatedValue(business('realtime', ''), variable)).toBeUndefined()
  })
})
