import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PrimeVue from 'primevue/config'
import Tag from 'primevue/tag'
import enUS from '@/i18n/locales/en-US.json'
import CallDetailsPanel from '@/components/conversations/CallDetailsPanel.vue'
import ConversationApi from '@/utils/Conversation'

/** The body of a call on the conversations page, drawn from what StarChat returns as `details`.
  *
  * The call is the shape of a production call of 2026-10-04 (name and number replaced): before this
  * component the page showed it as "Unknown contact" with its transcript and nothing else, although
  * the assistant had collected the caller's name, the reason and what to do. The real en-US
  * catalogue is used so that a key the component asks for and the catalogue lacks shows up here as
  * the raw key. */

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })

const call = {
  id: 'CON-1',
  contactNumber: '+41700000000',
  startTimestamp: 1791120976220,
  data: {
    conversation_transcription: [
      { alias: 'Assistant', speaker_type: 'agent', content: 'Good morning, how can I help?' },
      { alias: 'Caller', speaker_type: 'user', content: 'I need to cancel tomorrow at three.' },
      { alias: 'Assistant', speaker_type: 'agent', content: '' }
    ]
  },
  details: {
    callerName: 'Elena Rossi',
    callerNumber: '+41 70 000 00 00',
    summary: 'Cancels tomorrow\'s 15:00 appointment.',
    fields: [
      { name: 'ACTION', label: 'What we have to do', value: 'call back' },
      { name: 'CALL_REASON', label: 'Why the caller called', value: 'cancel the appointment' }
    ],
    whatsappMessage: 'Hello, this is the clinic',
    previousCalls: [{ date: '12/09/2026', summary: 'Booked a check-up' }]
  }
}

function draw (conversation = call, props = {}) {
  return mount(CallDetailsPanel, {
    props: { conversation, businessId: 'b', user: { accessToken: 't' }, ...props },
    global: { plugins: [i18n, PrimeVue], components: { Tag } }
  })
}

describe('CallDetailsPanel', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the summary and every collected field under the business\'s own label', () => {
    const text = draw().text()
    expect(text).toContain('Cancels tomorrow\'s 15:00 appointment.')
    expect(text).toContain('What we have to do')
    expect(text).toContain('call back')
    expect(text).toContain('Why the caller called')
    expect(text).not.toContain('components.conversations')
  })

  it('offers a call back, and a WhatsApp reply carrying the prepared text, to the dialable number', () => {
    const links = draw().findAll('a').map(a => a.attributes('href'))
    expect(links).toContain('tel:+41700000000')
    expect(links).toContain('https://wa.me/41700000000?text=Hello%2C%20this%20is%20the%20clinic')
  })

  it('offers the calendar only where the call carries a link', () => {
    expect(draw().text()).not.toContain('Add to Google Calendar')
    const withLink = { ...call, details: { ...call.details, calendarLink: 'https://calendar.google.com/x' } }
    expect(draw(withLink).findAll('a').map(a => a.attributes('href'))).toContain('https://calendar.google.com/x')
  })

  it('keeps the transcript and the earlier calls closed until asked, and opens them when expanded', async () => {
    const closed = draw()
    expect(closed.text()).not.toContain('I need to cancel tomorrow at three.')
    expect(closed.text()).not.toContain('Booked a check-up')
    const toggle = closed.findAll('button').find(b => b.text().includes('Conversation (2 messages)'))
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(closed.text()).toContain('I need to cancel tomorrow at three.')

    const open = draw(call, { expanded: true })
    expect(open.text()).toContain('I need to cancel tomorrow at three.')
    expect(open.text()).toContain('Booked a check-up')
  })

  it('reads the recording of this one call when it is played, and says so when there is none', async () => {
    const get = vi.spyOn(ConversationApi, 'get').mockResolvedValueOnce({ ...call, audio: 'AAAA' })
    const panel = draw()
    expect(panel.find('audio').exists()).toBe(false)
    await panel.findAll('button').find(b => b.text().includes('Listen to the recording')).trigger('click')
    await flushPromises()
    expect(get).toHaveBeenCalledWith({ accessToken: 't' }, 'b', 'CON-1')
    expect(panel.find('audio source').attributes('src')).toBe('data:audio/mpeg;base64,AAAA')

    vi.spyOn(ConversationApi, 'get').mockResolvedValueOnce({ ...call })
    const silent = draw()
    await silent.findAll('button').find(b => b.text().includes('Listen to the recording')).trigger('click')
    await flushPromises()
    expect(silent.text()).toContain('The recording of this call is not available.')
  })

  it('draws a call from before `details` existed without failing', () => {
    const old = { id: 'CON-0', contactNumber: '+390000000', data: call.data }
    const panel = draw(old)
    expect(panel.findAll('a').map(a => a.attributes('href'))).toContain('tel:+390000000')
  })
})

/** StarChat's call insights (`details.outcome`, `topics`, `unanswered`, `checks`): the dashboard's
  * one outcome rule (`src/utils/CallInsights.js`) says which outcome is a recorded fact and which
  * is the assistant's own assessment, and every place an outcome is shown, including here, marks
  * an assessed one as such. A call with none of the four fields draws exactly as it did before the
  * feature (the cases above), which is why this block tests each kind on its own. */
describe('CallDetailsPanel: what the call said', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows no insights section when the call carries none of the four fields', () => {
    const panel = draw()
    expect(panel.find('.call-insights-box').exists()).toBe(false)
  })

  it('shows the topics as tags', () => {
    const withTopics = { ...call, details: { ...call.details, topics: ['billing', 'cancellation'] } }
    const panel = draw(withTopics)
    expect(panel.find('.call-insights-box').exists()).toBe(true)
    const tags = panel.findAll('.insight-topic-tag').map(t => t.text())
    expect(tags).toEqual(['billing', 'cancellation'])
  })

  it('shows each unanswered question with its reason and suggestion, the question as plain text even when it carries markup', () => {
    const withUnanswered = {
      ...call,
      details: {
        ...call.details,
        unanswered: [{
          question: 'Do you open on <b>Sundays</b>?',
          gap: 'missing_info',
          suggestion: 'Tell the assistant your Sunday hours.'
        }]
      }
    }
    const panel = draw(withUnanswered)
    expect(panel.text()).toContain('Missing information')
    expect(panel.text()).toContain('Do you open on <b>Sundays</b>?')
    expect(panel.text()).toContain('Tell the assistant your Sunday hours.')
    // rendered through {{ }}, never v-html: no real <b> element reaches the DOM
    expect(panel.find('.insight-question-text b').exists()).toBe(false)
  })

  it('shows the checks that fired, and none that did not', () => {
    const withChecks = {
      ...call,
      details: { ...call.details, checks: { caller_repeated: true, caller_unsatisfied: false } }
    }
    const panel = draw(withChecks)
    const text = panel.find('.insight-checks').text()
    expect(text).toContain('The caller had to repeat themselves')
    expect(text).not.toContain('unsatisfied')
    expect(text).not.toContain('promise')
  })

  it('shows a recorded outcome with no marking', () => {
    const booked = { ...call, details: { ...call.details, outcome: 'booked' } }
    const panel = draw(booked)
    expect(panel.find('.insight-outcome').text()).toContain('Booked')
    expect(panel.find('.insight-assessed-tag').exists()).toBe(false)
  })

  it('shows an assessed outcome marked as the assistant\'s own assessment', () => {
    const unresolved = { ...call, details: { ...call.details, outcome: 'unresolved' } }
    const panel = draw(unresolved)
    expect(panel.find('.insight-outcome').text()).toContain('Unresolved')
    expect(panel.find('.insight-assessed-tag').exists()).toBe(true)
    expect(panel.find('.insight-assessed-tag').text()).toBe('Assessed by the assistant')
  })
})
