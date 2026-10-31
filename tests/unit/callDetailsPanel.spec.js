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

/** StarChat's call insights, version 2 (`details.resolution`, `message`, `booked`, `transferred`,
  * `topics`, `unanswered`, `checks`): the dashboard's one value table (`insightRows` in
  * `src/utils/CallInsights.js`) says what each dimension shows and which are the assistant's own
  * assessment, marked as such wherever they are shown, including here. A call with none of them
  * draws exactly as it did before the feature (the cases above), which is why this block tests each
  * kind on its own. */
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

  const withInsights = (insights) => ({ ...call, details: { ...call.details, ...insights } })
  const factRow = (panel, label) => panel.findAll('.insight-fact').find(r => r.find('dt').text() === label)

  it('shows a judged resolution and message by their labels, each marked as the assistant\'s own assessment', () => {
    const panel = draw(withInsights({ resolution: 'unresolved', message: 'incomplete', booked: false, transferred: true }))
    const resolution = factRow(panel, 'Resolution')
    expect(resolution.find('dd').text()).toContain('Unresolved')
    expect(resolution.find('.insight-assessed-tag').text()).toBe('Assessed by the assistant')
    const message = factRow(panel, 'Message')
    expect(message.find('dd').text()).toContain('Incomplete message')
    expect(message.find('.insight-assessed-tag').text()).toBe('Assessed by the assistant')
  })

  it('shows nothing for a resolution and a message that are absent', () => {
    const panel = draw(withInsights({ booked: true, transferred: true }))
    expect(factRow(panel, 'Resolution')).toBeUndefined()
    expect(factRow(panel, 'Message')).toBeUndefined()
    expect(panel.text()).not.toContain('Assessed by the assistant')
  })

  it('shows booked true as Booked and booked false as Not booked, recorded facts with no marking', () => {
    const booked = factRow(draw(withInsights({ booked: true })), 'Booking')
    expect(booked.find('dd').text()).toBe('Booked')
    expect(booked.find('.insight-assessed-tag').exists()).toBe(false)
    const notBooked = factRow(draw(withInsights({ booked: false })), 'Booking')
    expect(notBooked.find('dd').text()).toBe('Not booked')
    expect(notBooked.find('.insight-assessed-tag').exists()).toBe(false)
  })

  it('shows nothing for a booked that is absent', () => {
    const panel = draw(withInsights({ resolution: 'resolved' }))
    expect(factRow(panel, 'Booking')).toBeUndefined()
    expect(factRow(panel, 'Resolution')).toBeDefined()
  })

  it('shows transferred true as Transferred, a recorded fact with no marking', () => {
    const transferred = factRow(draw(withInsights({ booked: false, transferred: true })), 'Transfer')
    expect(transferred.find('dd').text()).toBe('Transferred')
    expect(transferred.find('.insight-assessed-tag').exists()).toBe(false)
  })

  it('shows transferred absent on a version-2 call as Not known, never as a no', () => {
    const transferred = factRow(draw(withInsights({ booked: true })), 'Transfer')
    expect(transferred.find('dd').text()).toBe('Not known')
    expect(transferred.text()).not.toMatch(/not transferred|^no$/i)
  })

  it('shows none of the four for a call without version-2 insights, and still draws what it has', () => {
    const panel = draw(withInsights({ outcome: 'unresolved', topics: ['billing'] }))
    expect(panel.findAll('.insight-fact')).toHaveLength(0)
    expect(panel.text()).not.toContain('Unresolved')
    expect(panel.text()).not.toContain('Not known')
    expect(panel.findAll('.insight-topic-tag').map(t => t.text())).toEqual(['billing'])
    expect(draw().find('.call-insights-box').exists()).toBe(false)
  })

  it('shows a transfer the carrier reported after the call ended, on the same open panel', async () => {
    const panel = draw(withInsights({ booked: false, resolution: 'handed_over' }))
    expect(factRow(panel, 'Transfer').find('dd').text()).toBe('Not known')
    await panel.setProps({ conversation: withInsights({ booked: false, resolution: 'handed_over', transferred: true }) })
    expect(factRow(panel, 'Transfer').find('dd').text()).toBe('Transferred')
  })

  it('shows a German caller\'s call with its labels in the viewer\'s language and its text as received, never translated', () => {
    const german = withInsights({
      resolution: 'resolved',
      message: 'complete',
      booked: false,
      summary: 'Der Anrufer fragt nach den Öffnungszeiten am Sonntag.',
      topics: ['Öffnungszeiten', 'Terminabsage'],
      unanswered: [{ question: 'Haben Sie sonntags geöffnet?', gap: 'missing_info', suggestion: 'Nennen Sie dem Assistenten Ihre Sonntagszeiten.' }]
    })
    const panel = draw(german)
    expect(factRow(panel, 'Resolution').find('dd').text()).toContain('Resolved')
    expect(factRow(panel, 'Message').find('dd').text()).toContain('Complete message')
    expect(panel.text()).toContain('Der Anrufer fragt nach den Öffnungszeiten am Sonntag.')
    expect(panel.findAll('.insight-topic-tag').map(t => t.text())).toEqual(['Öffnungszeiten', 'Terminabsage'])
    expect(panel.text()).toContain('Haben Sie sonntags geöffnet?')
    expect(panel.text()).toContain('Nennen Sie dem Assistenten Ihre Sonntagszeiten.')
    expect(panel.text()).toContain('Missing information')
  })
})

/** `details.unkept` (StarChat M13, GPT-Live calls): what the assistant told the caller it had done
  * and the record does not show done. Each entry is the action in the viewer's language and the
  * words as said, tagged as the assistant's reading; the check line that states the same fact is
  * hidden while entries show, and shows as before otherwise. */
describe('CallDetailsPanel: told to the caller and not recorded as done', () => {
  beforeEach(() => vi.restoreAllMocks())

  const unkept = [
    { action: 'book', said: 'I have booked you for Monday at 10.' },
    { action: 'transfer', said: 'I am putting you through to the doctor.' }
  ]
  const checks = { caller_repeated: false, caller_unsatisfied: false, promise_not_kept_in_call: true }
  const withUnkept = (extra) => ({ ...call, details: { ...call.details, ...extra } })
  const entries = (panel) => panel.findAll('.insight-unkept-entry')

  it('shows each entry with its action in the viewer\'s language, the words quoted and the assessed tag', () => {
    const panel = draw(withUnkept({ unkept, checks }))
    expect(panel.find('.call-insights-box').exists()).toBe(true)
    expect(panel.text()).toContain('Told to the caller, not recorded as done')
    const rows = entries(panel)
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Booking')
    expect(rows[0].text()).toContain('\u201cI have booked you for Monday at 10.\u201d')
    expect(rows[0].find('.insight-assessed-tag').text()).toBe('Assessed by the assistant')
    expect(rows[1].text()).toContain('Transfer')
    expect(rows[1].find('.insight-assessed-tag').exists()).toBe(true)
    expect(panel.text()).not.toContain('components.callInsights')
  })

  it('shows the entries above the unanswered questions', () => {
    const panel = draw(withUnkept({
      unkept,
      unanswered: [{ question: 'Do you open on Sundays?', gap: 'missing_info' }]
    }))
    const html = panel.html()
    expect(html.indexOf('insight-unkept')).toBeGreaterThan(-1)
    expect(html.indexOf('insight-unkept')).toBeLessThan(html.indexOf('insight-unanswered'))
  })

  it('hides the promise_not_kept_in_call check line while entries show, and keeps the other checks', () => {
    const panel = draw(withUnkept({ unkept, checks: { ...checks, caller_repeated: true } }))
    const list = panel.find('.insight-checks')
    expect(list.text()).toContain('The caller had to repeat themselves')
    expect(panel.text()).not.toContain('A promise made in the call was not kept')
  })

  it('shows no checks block when the hidden line was the only one that fired', () => {
    const panel = draw(withUnkept({ unkept, checks }))
    expect(panel.find('.insight-checks').exists()).toBe(false)
  })

  it('shows the check line once on the same call without unkept', () => {
    const panel = draw(withUnkept({ unkept: [], checks }))
    expect(panel.text().split('A promise made in the call was not kept')).toHaveLength(2)
    expect(entries(panel)).toHaveLength(0)
    expect(panel.text()).not.toContain('not recorded as done')
    const absent = draw(withUnkept({ checks }))
    expect(absent.text().split('A promise made in the call was not kept')).toHaveLength(2)
  })

  it('names an action the dashboard does not know by the neutral label, never by its key', () => {
    const panel = draw(withUnkept({ unkept: [{ action: 'refund', said: 'Refunded.' }] }))
    const text = entries(panel)[0].text()
    expect(text).toContain('Another action')
    expect(text).toContain('Refunded.')
    expect(text).not.toContain('refund')
  })

  it('shows nothing for an empty or malformed list, and no insights box where nothing else is carried', () => {
    for (const bad of [[], 'book', { action: 'book' }, [null, { action: 'book' }]]) {
      const panel = draw(withUnkept({ unkept: bad }))
      expect(entries(panel)).toHaveLength(0)
      expect(panel.find('.call-insights-box').exists()).toBe(false)
      expect(panel.text()).not.toContain('not recorded as done')
    }
  })

  it('draws the words as text, never as markup', () => {
    const panel = draw(withUnkept({ unkept: [{ action: 'cancel', said: 'Done, <b>cancelled</b>.' }] }))
    expect(panel.text()).toContain('Done, <b>cancelled</b>.')
    expect(panel.find('.insight-unkept-said b').exists()).toBe(false)
  })
})

/**
 * The judgements as chips are a page's choice (brief docs/briefs/2026-10-27-classification-feedback.md, scope 1 and 11):
 * the conversations page asks for them, and carries the undo bar and the reader's ownership they need. A panel drawn
 * elsewhere (the restaurant call dialog, which admins and resellers reach) reads no judgements: for a non-owner such a
 * read is a recorded opening nobody asked for (R2 review, finding 5). Seen failing on dec211e, which drew the chips in
 * every panel.
 */
describe('CallDetailsPanel: the judgements only where a page asks for them', () => {
  it('draws no judgement chip, and so reads nothing, unless asked', () => {
    const judged = { ...call, details: { ...call.details, resolution: 'resolved', message: 'none', booked: true } }
    expect(draw(judged).findComponent({ name: 'CallJudgements' }).exists()).toBe(false)
    expect(draw(judged, { withJudgements: true, readOnly: true }).findComponent({ name: 'CallJudgements' }).exists()).toBe(true)
  })
})
