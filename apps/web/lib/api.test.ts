import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getRecords,
  patchRecord,
  getWeeklyAnalytics,
  getOverallAnalytics,
  getFeedbackByRoute,
  getClassifications,
  createJiraIssues,
} from './api'

// Helper: capture the URL that fetch was called with
function mockFetch(body: unknown, ok = true, status = 200) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

function calledUrl(spy: ReturnType<typeof vi.fn>): string {
  return spy.mock.calls[0][0] as string
}

function calledInit(spy: ReturnType<typeof vi.fn>): RequestInit {
  return spy.mock.calls[0][1] as RequestInit
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

// ---------------------------------------------------------------------------
// getRecords — filter → query string mapping
// ---------------------------------------------------------------------------
describe('getRecords()', () => {
  it('sends no params when called with empty filters', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({})
    expect(calledUrl(spy)).toBe('http://localhost:3001/records?')
  })

  it('sends type=internal', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ type: 'internal' })
    expect(calledUrl(spy)).toContain('type=internal')
  })

  it('sends type=external', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ type: 'external' })
    expect(calledUrl(spy)).toContain('type=external')
  })

  it('omits type when not provided (all users)', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({})
    expect(calledUrl(spy)).not.toContain('type=')
  })

  it('sends hasFeedback=true', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ hasFeedback: true })
    expect(calledUrl(spy)).toContain('hasFeedback=true')
  })

  it('sends hasFeedback=false', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ hasFeedback: false })
    expect(calledUrl(spy)).toContain('hasFeedback=false')
  })

  it('omits hasFeedback when undefined', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({})
    expect(calledUrl(spy)).not.toContain('hasFeedback')
  })

  it('sends toolRoute param', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ toolRoute: '/ask' })
    expect(calledUrl(spy)).toContain('toolRoute=%2Fask')
  })

  it('sends week param', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ week: '2024-W10' })
    expect(calledUrl(spy)).toContain('week=2024-W10')
  })

  it('sends page and pageSize', async () => {
    const spy = mockFetch({ total: 0, page: 2, pageSize: 25, records: [] })
    await getRecords({ page: 2, pageSize: 25 })
    expect(calledUrl(spy)).toContain('page=2')
    expect(calledUrl(spy)).toContain('pageSize=25')
  })

  it('sends dateFrom param', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ dateFrom: '2024-01-01' })
    expect(calledUrl(spy)).toContain('dateFrom=2024-01-01')
  })

  it('sends dateTo param', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ dateTo: '2024-01-07' })
    expect(calledUrl(spy)).toContain('dateTo=2024-01-07')
  })

  it('sends both dateFrom and dateTo for a custom range', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ dateFrom: '2024-01-01', dateTo: '2024-01-07' })
    const url = calledUrl(spy)
    expect(url).toContain('dateFrom=2024-01-01')
    expect(url).toContain('dateTo=2024-01-07')
  })

  it('omits dateFrom and dateTo when not provided', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({})
    expect(calledUrl(spy)).not.toContain('dateFrom')
    expect(calledUrl(spy)).not.toContain('dateTo')
  })

  it('sends all filters together', async () => {
    const spy = mockFetch({ total: 0, page: 1, pageSize: 50, records: [] })
    await getRecords({ type: 'internal', hasFeedback: true, toolRoute: '/ask', dateFrom: '2024-01-01', page: 1, pageSize: 50 })
    const url = calledUrl(spy)
    expect(url).toContain('type=internal')
    expect(url).toContain('hasFeedback=true')
    expect(url).toContain('toolRoute=')
    expect(url).toContain('dateFrom=2024-01-01')
  })

  it('throws when response is not ok', async () => {
    mockFetch('Not Found', false, 404)
    await expect(getRecords({})).rejects.toThrow('404')
  })
})

// ---------------------------------------------------------------------------
// patchRecord
// ---------------------------------------------------------------------------
describe('patchRecord()', () => {
  it('sends PATCH to /records/:id with JSON body', async () => {
    const spy = mockFetch({ id: 1 })
    await patchRecord(1, { classification: 'Bug' })
    expect(calledUrl(spy)).toBe('http://localhost:3001/records/1')
    expect(calledInit(spy).method).toBe('PATCH')
    expect(JSON.parse(calledInit(spy).body as string)).toEqual({ classification: 'Bug' })
  })

  it('throws on non-ok response', async () => {
    mockFetch('Not Found', false, 404)
    await expect(patchRecord(99, {})).rejects.toThrow('404')
  })
})

// ---------------------------------------------------------------------------
// getWeeklyAnalytics — type filter
// ---------------------------------------------------------------------------
describe('getWeeklyAnalytics()', () => {
  it('sends no type param when called without argument', async () => {
    const spy = mockFetch([])
    await getWeeklyAnalytics()
    expect(calledUrl(spy)).toBe('http://localhost:3001/analytics/weekly')
  })

  it('sends ?type=internal', async () => {
    const spy = mockFetch([])
    await getWeeklyAnalytics('internal')
    expect(calledUrl(spy)).toBe('http://localhost:3001/analytics/weekly?type=internal')
  })

  it('sends ?type=external', async () => {
    const spy = mockFetch([])
    await getWeeklyAnalytics('external')
    expect(calledUrl(spy)).toBe('http://localhost:3001/analytics/weekly?type=external')
  })
})

// ---------------------------------------------------------------------------
// getOverallAnalytics / getFeedbackByRoute / getClassifications
// ---------------------------------------------------------------------------
describe('getOverallAnalytics()', () => {
  it('calls the correct endpoint', async () => {
    const spy = mockFetch({ avgTtftSeconds: 1.23 })
    await getOverallAnalytics()
    expect(calledUrl(spy)).toBe('http://localhost:3001/analytics/overall')
  })
})

describe('getFeedbackByRoute()', () => {
  it('calls the correct endpoint', async () => {
    const spy = mockFetch([])
    await getFeedbackByRoute()
    expect(calledUrl(spy)).toBe('http://localhost:3001/analytics/feedback-by-route')
  })
})

describe('getClassifications()', () => {
  it('calls the correct endpoint', async () => {
    const spy = mockFetch([])
    await getClassifications()
    expect(calledUrl(spy)).toBe('http://localhost:3001/classifications')
  })
})

// ---------------------------------------------------------------------------
// createJiraIssues
// ---------------------------------------------------------------------------
describe('createJiraIssues()', () => {
  it('sends POST with ids array', async () => {
    const spy = mockFetch({ created: 2, issues: [] })
    await createJiraIssues([1, 2])
    expect(calledUrl(spy)).toBe('http://localhost:3001/jira/create')
    expect(calledInit(spy).method).toBe('POST')
    expect(JSON.parse(calledInit(spy).body as string)).toEqual({ ids: [1, 2] })
  })
})
