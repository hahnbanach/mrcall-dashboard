import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
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
    global: { plugins: [i18n] }
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
