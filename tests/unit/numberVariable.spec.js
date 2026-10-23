import { describe, it, expect } from 'vitest'
import businessVariablesUtils from '@/utils/BusinessVariables'

/**
 * The generic number field of the business settings: the bounds a variable's definition declares in
 * `constraints`, and what a cleared field holds. StarChat reads every number variable with
 * toInt/toLong/toDouble, so a cleared field that left as "null" broke the call that read it; an
 * empty value is what StarChat replaces with the variable's default.
 */

const cadence = (constraints) => ({ name: 'CALL_INSIGHTS_REPORT_CADENCE', type: 'number', constraints })

describe('the bounds of a number field', () => {
  it('takes min, max and whole numbers from the definition', () => {
    expect(businessVariablesUtils.numberFieldBounds(cadence({ integer: true, min: 0, max: 366 })))
      .toEqual({ min: 0, max: 366, maxFractionDigits: 0 })
  })

  it('takes only the bounds the definition declares', () => {
    expect(businessVariablesUtils.numberFieldBounds(cadence({ min: 0 }))).toEqual({ min: 0 })
    expect(businessVariablesUtils.numberFieldBounds(cadence({ integer: false, max: 1 }))).toEqual({ max: 1 })
  })

  it('is today\'s unbounded field when the definition has no constraints', () => {
    expect(businessVariablesUtils.numberFieldBounds(cadence(undefined))).toEqual({})
    expect(businessVariablesUtils.numberFieldBounds(cadence(null))).toEqual({})
    expect(businessVariablesUtils.numberFieldBounds({ name: 'MAX_CALL_DURATION_SEC', type: 'number' })).toEqual({})
  })

  it('ignores what is not a bound rather than passing it to the field', () => {
    expect(businessVariablesUtils.numberFieldBounds(cadence({ min: '0', max: 'many', integer: 'yes' }))).toEqual({})
    expect(businessVariablesUtils.numberFieldBounds(cadence('not an object'))).toEqual({})
  })

  it('reads constraints sent as a JSON string', () => {
    expect(businessVariablesUtils.numberFieldBounds(cadence('{"integer":true,"min":0,"max":366}')))
      .toEqual({ min: 0, max: 366, maxFractionDigits: 0 })
  })
})

describe('a cleared number field', () => {
  it('holds an empty value, never null', () => {
    expect(businessVariablesUtils.numberFieldValue(null)).toBe('')
    expect(businessVariablesUtils.numberFieldValue(undefined)).toBe('')
  })

  it('keeps a number as typed, zero included', () => {
    expect(businessVariablesUtils.numberFieldValue(7)).toBe(7)
    expect(businessVariablesUtils.numberFieldValue(0)).toBe(0)
  })

  it('reaches the server as "", and a number as its digits', () => {
    const business = { variables: {
      CALL_INSIGHTS_REPORT_CADENCE: businessVariablesUtils.numberFieldValue(null),
      MAX_CALL_DURATION_SEC: businessVariablesUtils.numberFieldValue(120)
    } }
    expect(businessVariablesUtils.businessVariablesToSerializable(business).variables)
      .toEqual({ CALL_INSIGHTS_REPORT_CADENCE: '', MAX_CALL_DURATION_SEC: '120' })
  })
})

describe('what a number field shows', () => {
  it('a stored number as that number', () => {
    expect(businessVariablesUtils.numberFieldModel('7')).toBe(7)
    expect(businessVariablesUtils.numberFieldModel('0')).toBe(0)
    expect(businessVariablesUtils.numberFieldModel('0.5')).toBe(0.5)
    expect(businessVariablesUtils.numberFieldModel(12)).toBe(12)
  })

  it('an empty, absent or unreadable value as an empty field, not as 0', () => {
    expect(businessVariablesUtils.numberFieldModel('')).toBeNull()
    expect(businessVariablesUtils.numberFieldModel(undefined)).toBeNull()
    expect(businessVariablesUtils.numberFieldModel(null)).toBeNull()
    expect(businessVariablesUtils.numberFieldModel('null')).toBeNull()
    expect(businessVariablesUtils.numberFieldModel('  ')).toBeNull()
  })
})
