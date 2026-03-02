import { describe, it, expect } from 'vitest'
import { parseIsoWeek, parseDateRange } from './records'

describe('parseIsoWeek()', () => {
  it('throws on invalid format', () => {
    expect(() => parseIsoWeek('2024-05')).toThrow()
    expect(() => parseIsoWeek('not-a-week')).toThrow()
    expect(() => parseIsoWeek('')).toThrow()
  })

  it('returns a Monday-to-Monday range for a known week', () => {
    // 2024-W01 starts on Monday 2024-01-01
    const { start, end } = parseIsoWeek('2024-W01')
    expect(start).toEqual(new Date('2024-01-01T00:00:00Z'))
    expect(end).toEqual(new Date('2024-01-08T00:00:00Z'))
  })

  it('range spans exactly 7 days', () => {
    const { start, end } = parseIsoWeek('2024-W10')
    const diff = end.getTime() - start.getTime()
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('start is always a Monday (day-of-week = 1)', () => {
    for (const week of ['2024-W01', '2024-W10', '2024-W52', '2025-W01']) {
      const { start } = parseIsoWeek(week)
      expect(start.getUTCDay()).toBe(1) // Monday
    }
  })

  it('consecutive weeks are contiguous', () => {
    const { end: endW5 } = parseIsoWeek('2024-W05')
    const { start: startW6 } = parseIsoWeek('2024-W06')
    expect(endW5.getTime()).toBe(startW6.getTime())
  })

  it('parses single-digit week numbers', () => {
    const { start } = parseIsoWeek('2024-W5')
    const { start: start2 } = parseIsoWeek('2024-W05')
    expect(start.getTime()).toBe(start2.getTime())
  })

  it('a requestTime on Monday is inside the week, Sunday before is not', () => {
    const { start, end } = parseIsoWeek('2024-W10')
    const monday = new Date(start) // exactly start — inclusive
    const sunday = new Date(start)
    sunday.setUTCDate(start.getUTCDate() - 1) // one day before

    expect(monday >= start && monday < end).toBe(true)
    expect(sunday >= start && sunday < end).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseDateRange
// ---------------------------------------------------------------------------
describe('parseDateRange()', () => {
  it('returns empty object when both args are undefined', () => {
    expect(parseDateRange()).toEqual({})
  })

  it('sets gte when only dateFrom is provided', () => {
    const { gte, lt } = parseDateRange('2024-01-15')
    expect(gte).toEqual(new Date('2024-01-15T00:00:00Z'))
    expect(lt).toBeUndefined()
  })

  it('sets lt to start of day after dateTo (inclusive end)', () => {
    const { gte, lt } = parseDateRange(undefined, '2024-01-21')
    expect(gte).toBeUndefined()
    expect(lt).toEqual(new Date('2024-01-22T00:00:00Z'))
  })

  it('sets both gte and lt for a full range', () => {
    const { gte, lt } = parseDateRange('2024-01-15', '2024-01-21')
    expect(gte).toEqual(new Date('2024-01-15T00:00:00Z'))
    expect(lt).toEqual(new Date('2024-01-22T00:00:00Z'))
  })

  it('a record on dateFrom is inside the range', () => {
    const { gte, lt } = parseDateRange('2024-01-15', '2024-01-21')
    const on = new Date('2024-01-15T10:30:00Z')
    expect(on >= gte! && on < lt!).toBe(true)
  })

  it('a record on dateTo (end of day) is inside the range', () => {
    const { gte, lt } = parseDateRange('2024-01-15', '2024-01-21')
    const endOfTo = new Date('2024-01-21T23:59:59Z')
    expect(endOfTo >= gte! && endOfTo < lt!).toBe(true)
  })

  it('a record one day after dateTo is outside the range', () => {
    const { gte, lt } = parseDateRange('2024-01-15', '2024-01-21')
    const after = new Date('2024-01-22T00:00:00Z')
    expect(after >= gte! && after < lt!).toBe(false)
  })
})
