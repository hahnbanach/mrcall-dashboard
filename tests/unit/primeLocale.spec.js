import { describe, it, expect } from 'vitest'
import { primeLocale, dateFormat } from '@/utils/PrimeLocale'

/**
 * `src/utils/PrimeLocale.js`: PrimeVue's calendar in the reader's language (U19 m16 of StarChat's plan
 * docs/execution-plans/2026-10-24-insights-reports-ux.md: "Choose Date" and "09/26/2026" on Italian screens).
 */
describe('the date picker in the reader\'s language', () => {
  it('writes a date in the locale\'s order', () => {
    expect(dateFormat('it-IT')).toBe('dd/mm/yy')
    expect(dateFormat('en-US')).toBe('mm/dd/yy')
    expect(dateFormat('de-DE')).toBe('dd.mm.yy')
  })

  it('names the days and months, and its labels, in the locale', () => {
    const l = primeLocale('it-IT', (key) => key)
    expect(l.monthNames[0]).toBe('Gennaio')
    expect(l.dayNames[1]).toBe('Lunedì')
    expect(l.firstDayOfWeek).toBe(1)
    expect(l.chooseDate).toBe('components.datePicker.chooseDate')
  })
})
