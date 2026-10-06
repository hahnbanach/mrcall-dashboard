import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BALANCE_PATH, COUNT_PATH, parseBalance, fetchCreditBalance, creditsToEuro, creditState
} from '@/utils/CreditBalance'

/** The balance the owner sees, net of debt (Angelo, 2026-10-06: 2 euro of debt reads -2 euro; a 50
  * euro top-up then reads 48). StarChat is faked at the network edge only, the way axios behaves:
  * a non-2xx answer rejects with `error.response.status`.
  *
  * Observed failing, 2026-10-06, against a CreditBalance.js whose fetch rethrew a 404 instead of
  * falling back and whose parse accepted a missing `debt`: "refuses an answer without debt...",
  * "falls back to the count on 404" and "answers null for a count..." failed, 3 of 9. */

const BASE = 'https://starchat.example'
const body = { businessId: 'b', category: 'CALLCREDIT', subcategory: [], subcategoryExclude: ['900-WATERMARK', '400-TEST'] }

function http (routes) {
  const calls = []
  return {
    calls,
    async post (url, data, config) {
      calls.push({ url, data, config })
      const answer = routes[url]
      if (answer === undefined) throw Object.assign(new Error('no route'), { response: { status: 404 } })
      if (answer instanceof Error) throw answer
      return { data: answer }
    }
  }
}

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })

describe('parseBalance', () => {
  it('takes a well-formed answer, net negative in debt', () => {
    expect(parseBalance({ available: 0, debt: 200, net: -200 })).toEqual({ available: 0, debt: 200, net: -200 })
  })
  it('refuses an answer without debt, with a fraction, or with a negative available or debt', () => {
    expect(parseBalance({ available: 5, net: 5 })).toBeNull()
    expect(parseBalance({ available: 1.5, debt: 0, net: 1.5 })).toBeNull()
    expect(parseBalance({ available: -1, debt: 0, net: -1 })).toBeNull()
    expect(parseBalance({ available: 0, debt: -3, net: 3 })).toBeNull()
    expect(parseBalance(42)).toBeNull()
    expect(parseBalance(null)).toBeNull()
  })
})

describe('fetchCreditBalance', () => {
  const headers = { auth: 't' }

  it('asks the balance endpoint with the count body and headers', async () => {
    const h = http({ [BASE + BALANCE_PATH]: { available: 4800, debt: 0, net: 4800 } })
    expect(await fetchCreditBalance(h, BASE, headers, body)).toEqual({ available: 4800, debt: 0, net: 4800 })
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].data).toEqual(body)
    expect(h.calls[0].config.headers).toEqual(headers)
  })

  it('falls back to the count on 404, with no debt', async () => {
    const h = http({ [BASE + COUNT_PATH]: 1234 })
    expect(await fetchCreditBalance(h, BASE, headers, body)).toEqual({ available: 1234, debt: 0, net: 1234 })
    expect(h.calls.map(c => c.url)).toEqual([BASE + BALANCE_PATH, BASE + COUNT_PATH])
  })

  it('does not fall back on any other failure', async () => {
    const h = http({ [BASE + BALANCE_PATH]: httpError(500), [BASE + COUNT_PATH]: 1234 })
    await expect(fetchCreditBalance(h, BASE, headers, body)).rejects.toThrow('HTTP 500')
    expect(h.calls).toHaveLength(1)
  })

  it('answers null for a count that is not a whole non-negative number', async () => {
    const h = http({ [BASE + COUNT_PATH]: 'oops' })
    expect(await fetchCreditBalance(h, BASE, headers, body)).toBeNull()
  })
})

describe('creditsToEuro', () => {
  it('reads -2 euro in debt and 48 after a 50 euro top-up repaid it', () => {
    const nbsp = / /g
    expect(creditsToEuro(-200, 'it-IT').replace(nbsp, ' ')).toBe('-2,00 €')
    expect(creditsToEuro(5000 - 200, 'it-IT').replace(nbsp, ' ')).toBe('48,00 €')
    expect(creditsToEuro(-200, 'en-US')).toBe('-€2.00')
  })
})

describe('creditState', () => {
  it('is debt while owing, empty at zero, ok above, unknown without an answer', () => {
    expect(creditState({ net: -200, debt: 200 })).toBe('debt')
    expect(creditState({ net: 0, debt: 0 })).toBe('empty')
    expect(creditState({ net: 300, debt: 0 })).toBe('ok')
    expect(creditState(null)).toBeNull()
  })
})

describe('the debt wording', () => {
  // jsdom gives import.meta.url an http scheme, so the catalogue is found from the project root.
  const dir = resolve(process.cwd(), 'src/i18n/locales') + '/'
  const locales = readdirSync(dir).filter(f => f.endsWith('.json'))

  it('exists in every locale, with the amount in the notice', () => {
    expect(locales.length).toBeGreaterThanOrEqual(12)
    for (const f of locales) {
      const d = JSON.parse(readFileSync(dir + f, 'utf-8'))
      expect(d.mrcallCredits?.debtNotice, f).toContain('{amount}')
      expect(d.components?.businesses?.health?.inDebt, f).toBeTruthy()
    }
  })
})
