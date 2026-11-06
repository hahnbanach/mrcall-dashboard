import { describe, it, expect } from 'vitest'
import { shortIds, truncated, CALL_ID_MIN } from '@/utils/CallId'

const CON = 'CON-2270d4a8-1b2c-4d5e-8f90-123456789abc'
const UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

describe('shortIds', () => {
  it('shows 16 characters of a longer id', () => {
    expect(CALL_ID_MIN).toBe(16)
    expect(shortIds([CON]).get(CON)).toBe(16)
  })

  it('shows an id of 16 characters or fewer whole', () => {
    expect(shortIds(['CON-p1']).get('CON-p1')).toBe(6)
    expect(shortIds(['abcdefghijklmnop']).get('abcdefghijklmnop')).toBe(16)
  })

  it('keeps 16 for CON- ids and plain UUIDs side by side', () => {
    const other = 'CON-9f3a1c22-0000-4000-8000-000000000000'
    const lengths = shortIds([CON, other, UUID])
    expect([...lengths.values()]).toEqual([16, 16, 16])
  })

  it('extends ids sharing a long prefix, one past what they share, and leaves an unrelated one at 16', () => {
    const a = 'sanitization-abcd1234-0000-4000-8000-000000000001'
    const b = 'sanitization-abcd1239-0000-4000-8000-000000000002'
    expect(a.slice(0, 20)).toBe(b.slice(0, 20))
    const lengths = shortIds([a, b, CON])
    expect(lengths.get(a)).toBe(21)
    expect(lengths.get(b)).toBe(21)
    expect(lengths.get(CON)).toBe(16)
  })

  it('gives each id of a chain of shared prefixes its own distinguishing length', () => {
    const a = 'prefix-0000000000-aaaa-1'
    const b = 'prefix-0000000000-aaab-2'
    const c = 'prefix-0000000000-b-3'
    const lengths = shortIds([a, b, c])
    // a and b share 21 characters, a and c 18
    expect(lengths.get(a)).toBe(22)
    expect(lengths.get(b)).toBe(22)
    expect(lengths.get(c)).toBe(19)
  })

  it('does not extend an id against its own duplicates', () => {
    const lengths = shortIds([CON, CON, CON])
    expect(lengths.size).toBe(1)
    expect(lengths.get(CON)).toBe(16)
  })

  it('never exceeds the id, even when one id is a prefix of another', () => {
    const short = 'sanitization-abcd'
    const long = 'sanitization-abcd-more'
    const lengths = shortIds([short, long])
    expect(lengths.get(short)).toBe(short.length)
    expect(lengths.get(long)).toBe(short.length + 1)
  })

  it('skips empty and non-string ids', () => {
    const lengths = shortIds(['', null, undefined, 42, CON])
    expect([...lengths.keys()]).toEqual([CON])
    expect(shortIds(undefined).size).toBe(0)
  })
})

describe('truncated', () => {
  it('is true only when the shown length cuts the id', () => {
    expect(truncated(CON, 16)).toBe(true)
    expect(truncated('CON-p1', 6)).toBe(false)
    expect(truncated('CON-p1', 16)).toBe(false)
    // one past the length fits in the ellipsis's room: shown whole
    expect(truncated('abcdefghijklmnopq', 16)).toBe(false)
    expect(truncated('abcdefghijklmnopqr', 16)).toBe(true)
  })
})
