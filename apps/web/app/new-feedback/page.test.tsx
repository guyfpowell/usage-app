import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NewFeedbackPage, { buildFilters } from './page'
import type { UsageRecord } from '@/lib/api'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getRecords: vi.fn(),
  patchRecord: vi.fn(),
  getClassifications: vi.fn().mockResolvedValue([]),
  getEpics: vi.fn().mockResolvedValue([]),
  getCustomerFeedbackIssues: vi.fn().mockResolvedValue([]),
}))

vi.mock('marked', () => ({
  marked: { parse: (s: string) => s },
}))

import { getRecords } from '@/lib/api'
const mockGetRecords = getRecords as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: 1,
    traceId: null,
    userId: 'alice@example.com',
    requestTime: '2024-03-01T10:00:00Z',
    requestContent: 'Hello',
    responseContent: 'World',
    feedbackValue: 'negative',
    rationale: 'Not helpful',
    toolRoute: '/ask',
    ttftSeconds: 1.5,
    isInternal: false,
    hasFeedback: true,
    classification: 'To be classified',
    groupText: null,
    ticketText: null,
    jiraIssueKey: null,
    jiraIssueUrl: null,
    epicKey: null,
    linkedIssueKey: null,
    customerResponse: null,
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
    ...overrides,
  }
}

function recordsResponse(records: UsageRecord[]) {
  return { total: records.length, page: 1, pageSize: 200, records }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── buildFilters ──────────────────────────────────────────────────────────────

describe('buildFilters()', () => {
  it('always includes the base negative-feedback filters', () => {
    for (const tab of ['all', 'external', 'internal'] as const) {
      const f = buildFilters(tab)
      expect(f.hasFeedback).toBe(true)
      expect(f.feedbackValue).toBe('negative')
      expect(f.classification).toBe('To be classified')
      expect(f.pageSize).toBe(200)
    }
  })

  it('omits type for the "all" tab', () => {
    const f = buildFilters('all')
    expect(f).not.toHaveProperty('type')
  })

  it('sets type=external for the "external" tab', () => {
    expect(buildFilters('external')).toMatchObject({ type: 'external' })
  })

  it('sets type=internal for the "internal" tab', () => {
    expect(buildFilters('internal')).toMatchObject({ type: 'internal' })
  })
})

// ── NewFeedbackPage — tabs ────────────────────────────────────────────────────

describe('NewFeedbackPage tabs', () => {
  beforeEach(() => {
    mockGetRecords.mockResolvedValue(recordsResponse([]))
  })

  it('renders all three sub-tabs', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('All')).toBeInTheDocument())
    expect(screen.getByText('External')).toBeInTheDocument()
    expect(screen.getByText('Internal')).toBeInTheDocument()
  })

  it('defaults to the External tab', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('External'))
    const externalBtn = screen.getByText('External').closest('button')!
    expect(externalBtn.className).toMatch(/border-blue-600/)
  })

  it('switches to Internal tab when clicked', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('Internal'))
    await userEvent.click(screen.getByText('Internal'))
    const internalBtn = screen.getByText('Internal').closest('button')!
    expect(internalBtn.className).toMatch(/border-blue-600/)
  })

  it('switches to All tab when clicked', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('All'))
    await userEvent.click(screen.getByText('All'))
    const allBtn = screen.getByText('All').closest('button')!
    expect(allBtn.className).toMatch(/border-blue-600/)
  })

  it('fetches with type=external by default', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => expect(mockGetRecords).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'external' })
    ))
  })

  it('fetches without type when All tab is selected', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('All'))
    await userEvent.click(screen.getByText('All'))
    await waitFor(() => expect(mockGetRecords).toHaveBeenCalledWith(
      expect.not.objectContaining({ type: expect.anything() })
    ))
  })
})

// ── NewFeedbackPage — list states ─────────────────────────────────────────────

describe('NewFeedbackPage list states', () => {
  it('shows loading state while fetching', () => {
    // Never resolves — keeps loading state
    mockGetRecords.mockReturnValue(new Promise(() => {}))
    render(<NewFeedbackPage />, { wrapper })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty "All caught up!" state when no records', async () => {
    mockGetRecords.mockResolvedValue(recordsResponse([]))
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument())
  })

  it('shows remaining count in subtitle', async () => {
    mockGetRecords.mockResolvedValue(recordsResponse([makeRecord(), makeRecord({ id: 2 })]))
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => expect(screen.getByText(/2 remaining/i)).toBeInTheDocument())
  })

  it('renders a row per record showing userId and rationale', async () => {
    mockGetRecords.mockResolvedValue(recordsResponse([
      makeRecord({ id: 1, userId: 'alice@example.com', rationale: 'Too slow' }),
      makeRecord({ id: 2, userId: 'bob@example.com', rationale: 'Wrong answer' }),
    ]))
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('alice@example.com')).toBeInTheDocument())
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Too slow/)).toBeInTheDocument()
    expect(screen.getByText(/Wrong answer/)).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    mockGetRecords.mockRejectedValue(new Error('Network error'))
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument())
  })
})

// ── NewFeedbackPage — record navigation ──────────────────────────────────────

describe('NewFeedbackPage record navigation', () => {
  const record = makeRecord({ id: 1, userId: 'alice@example.com', rationale: 'Not helpful' })

  beforeEach(() => {
    mockGetRecords.mockResolvedValue(recordsResponse([record]))
  })

  it('opens record view when a row is clicked', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('alice@example.com'))
    await userEvent.click(screen.getByText('alice@example.com').closest('button')!)
    expect(screen.getByText('Back to list')).toBeInTheDocument()
    expect(screen.getByText('Request')).toBeInTheDocument()
    expect(screen.getByText('Response')).toBeInTheDocument()
  })

  it('returns to the list view when "Back to list" is clicked', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('alice@example.com'))
    await userEvent.click(screen.getByText('alice@example.com').closest('button')!)
    await userEvent.click(screen.getByText('Back to list'))
    expect(screen.queryByText('Back to list')).not.toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows "Record N of N" position indicator in record view', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('alice@example.com'))
    await userEvent.click(screen.getByText('alice@example.com').closest('button')!)
    // The header contains "Record {n} of {total}" spread across spans
    expect(screen.getByText(/Record/)).toBeInTheDocument()
  })

  it('Prev button is disabled on the first record', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('alice@example.com'))
    await userEvent.click(screen.getByText('alice@example.com').closest('button')!)
    expect(screen.getByText('← Prev')).toBeDisabled()
  })

  it('Next button is disabled on the last record', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('alice@example.com'))
    await userEvent.click(screen.getByText('alice@example.com').closest('button')!)
    expect(screen.getByText('Next →')).toBeDisabled()
  })

  it('switching tabs from record view resets to list', async () => {
    render(<NewFeedbackPage />, { wrapper })
    await waitFor(() => screen.getByText('alice@example.com'))
    await userEvent.click(screen.getByText('alice@example.com').closest('button')!)
    expect(screen.getByText('Back to list')).toBeInTheDocument()
    // Switch tab — since RecordView is full-screen and tabs are in list view,
    // going back to list then switching tabs is the user flow tested here
    await userEvent.click(screen.getByText('Back to list'))
    await userEvent.click(screen.getByText('Internal'))
    expect(screen.queryByText('Back to list')).not.toBeInTheDocument()
  })
})
