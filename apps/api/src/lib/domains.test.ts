import { describe, it, expect, beforeEach } from 'vitest'
import { isInternalEmail, _setCache } from './domains'

describe('isInternalEmail', () => {
  beforeEach(() => {
    _setCache(['pei.group', 'peimedia.com'])
  })

  it('returns true for a known internal domain', () => {
    expect(isInternalEmail('alice@pei.group')).toBe(true)
  })

  it('returns true for the second internal domain', () => {
    expect(isInternalEmail('bob@peimedia.com')).toBe(true)
  })

  it('returns false for an external domain', () => {
    expect(isInternalEmail('user@gmail.com')).toBe(false)
  })

  it('is case-insensitive for the domain part', () => {
    expect(isInternalEmail('alice@PEI.GROUP')).toBe(true)
    expect(isInternalEmail('bob@PEIMEDIA.COM')).toBe(true)
  })

  it('returns false when there is no @ symbol', () => {
    expect(isInternalEmail('notanemail')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isInternalEmail('')).toBe(false)
  })

  it('returns false when cache is empty', () => {
    _setCache([])
    expect(isInternalEmail('alice@pei.group')).toBe(false)
  })

  it('reflects cache updates immediately', () => {
    _setCache(['newdomain.io'])
    expect(isInternalEmail('x@newdomain.io')).toBe(true)
    expect(isInternalEmail('x@pei.group')).toBe(false)
  })
})
