import { describe, it, expect, beforeEach } from 'vitest'
import { col, parseRow, parseRequestTime, type CsvRow } from './ingest'
import { _setCache } from '../lib/domains'

describe('parseRequestTime()', () => {
  it('parses ISO 8601 string', () => {
    expect(parseRequestTime('2024-02-01T10:00:00Z')).toEqual(new Date('2024-02-01T10:00:00Z'))
  })

  it('parses DD/MM/YYYY HH:MM', () => {
    expect(parseRequestTime('24/02/2026 16:33')).toEqual(new Date('2026-02-24T16:33'))
  })

  it('parses DD/MM/YYYY HH:MM:SS (seconds truncated for dedup consistency)', () => {
    expect(parseRequestTime('24/02/2026 16:33:45')).toEqual(new Date('2026-02-24T16:33:00'))
  })

  it('parses single-digit day and month', () => {
    expect(parseRequestTime('1/3/2026 09:05')).toEqual(new Date('2026-03-01T09:05'))
  })

  it('returns null for an invalid date string', () => {
    expect(parseRequestTime('not-a-date')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseRequestTime('')).toBeNull()
  })
})

describe('col()', () => {
  it('returns the first matching non-empty value', () => {
    const row: CsvRow = { userId: 'u1', user_id: 'u2' }
    expect(col(row, 'userId', 'user_id')).toBe('u1')
  })

  it('falls back to the next name when first is missing', () => {
    const row: CsvRow = { user_id: 'u2' }
    expect(col(row, 'userId', 'user_id')).toBe('u2')
  })

  it('skips empty string values and falls through', () => {
    const row: CsvRow = { userId: '', user_id: 'u2' }
    expect(col(row, 'userId', 'user_id')).toBe('u2')
  })

  it('returns undefined when none of the names exist', () => {
    expect(col({}, 'userId', 'user_id')).toBeUndefined()
  })
})

describe('parseRow()', () => {
  beforeEach(() => {
    _setCache(['pei.group', 'peimedia.com'])
  })

  const baseRow: CsvRow = {
    userId: 'alice@pei.group',
    requestTime: '2024-02-01T10:00:00Z',
    requestContent: 'Hello',
    responseContent: 'World',
    toolRoute: '/ask',
    ttftSeconds: '1.5',
    feedbackValue: '',
    rationale: '',
    traceId: 'abc123',
  }

  it('parses a valid row correctly', () => {
    const result = parseRow(baseRow)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('alice@pei.group')
    expect(result!.requestTime).toEqual(new Date('2024-02-01T10:00:00Z'))
    expect(result!.requestContent).toBe('Hello')
    expect(result!.responseContent).toBe('World')
    expect(result!.toolRoute).toBe('/ask')
    expect(result!.ttftSeconds).toBe(1.5)
    expect(result!.traceId).toBe('abc123')
  })

  it('marks internal users correctly', () => {
    const result = parseRow(baseRow)
    expect(result!.isInternal).toBe(true)
  })

  it('marks external users correctly', () => {
    const result = parseRow({ ...baseRow, userId: 'bob@gmail.com' })
    expect(result!.isInternal).toBe(false)
  })

  it('sets hasFeedback=true when feedbackValue is present', () => {
    const result = parseRow({ ...baseRow, feedbackValue: 'positive' })
    expect(result!.hasFeedback).toBe(true)
    expect(result!.feedbackValue).toBe('positive')
  })

  it('sets hasFeedback=true when rationale is present', () => {
    const result = parseRow({ ...baseRow, rationale: 'some reason' })
    expect(result!.hasFeedback).toBe(true)
  })

  it('sets hasFeedback=false when both feedbackValue and rationale are empty', () => {
    const result = parseRow(baseRow)
    expect(result!.hasFeedback).toBe(false)
  })

  it('returns null when userId is missing', () => {
    const { userId: _, ...row } = baseRow
    expect(parseRow(row)).toBeNull()
  })

  it('returns null when requestTime is missing', () => {
    const { requestTime: _, ...row } = baseRow
    expect(parseRow(row)).toBeNull()
  })

  it('returns null when requestTime is invalid', () => {
    expect(parseRow({ ...baseRow, requestTime: 'not-a-date' })).toBeNull()
  })

  it('accepts snake_case column names as aliases', () => {
    const snakeRow: CsvRow = {
      user_id: 'carol@peimedia.com',
      request_time: '2024-03-01T08:00:00Z',
      request_content: 'Hi',
      response_content: 'Bye',
      tool_route: '/route',
      ttft_seconds: '0.8',
    }
    const result = parseRow(snakeRow)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('carol@peimedia.com')
    expect(result!.isInternal).toBe(true)
    expect(result!.ttftSeconds).toBe(0.8)
  })

  it('handles missing optional fields gracefully', () => {
    const minimal: CsvRow = {
      userId: 'x@external.com',
      requestTime: '2024-01-01T00:00:00Z',
    }
    const result = parseRow(minimal)
    expect(result).not.toBeNull()
    expect(result!.requestContent).toBe('')
    expect(result!.responseContent).toBe('')
    expect(result!.toolRoute).toBe('')
    expect(result!.ttftSeconds).toBeNull()
    expect(result!.traceId).toBeNull()
  })

  it('parses DD/MM/YYYY HH:MM requestTime format', () => {
    const result = parseRow({ ...baseRow, requestTime: '24/02/2026 16:33' })
    expect(result).not.toBeNull()
    expect(result!.requestTime).toEqual(new Date('2026-02-24T16:33'))
  })

  it('parses DD/MM/YYYY HH:MM:SS requestTime format (seconds truncated)', () => {
    const result = parseRow({ ...baseRow, requestTime: '24/02/2026 16:33:45' })
    expect(result).not.toBeNull()
    expect(result!.requestTime).toEqual(new Date('2026-02-24T16:33:00'))
  })

  it('deduplication: last row wins for same userId+requestTime key', () => {
    const row1 = parseRow({ ...baseRow, responseContent: 'First' })
    const row2 = parseRow({ ...baseRow, responseContent: 'Second' })
    // Simulate the dedup map behaviour used in the ingest handler
    const dedupMap = new Map<string, NonNullable<typeof row1>>()
    for (const row of [row1!, row2!]) {
      dedupMap.set(`${row.userId}|${row.requestTime.toISOString()}`, row)
    }
    expect(dedupMap.size).toBe(1)
    expect([...dedupMap.values()][0].responseContent).toBe('Second')
  })
})
