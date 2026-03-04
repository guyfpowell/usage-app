import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UploadPage from './page'

// Mock the api module so no real fetch happens
vi.mock('@/lib/api', () => ({
  uploadCsv: vi.fn(),
  getBatches: vi.fn().mockResolvedValue([]),
  rollbackBatch: vi.fn(),
  syncDatabricks: vi.fn(),
}))

import { uploadCsv } from '@/lib/api'
const mockUploadCsv = uploadCsv as ReturnType<typeof vi.fn>

function csvFile(name = 'data.csv') {
  return new File(['userId,requestTime\nu1,2024-01-01'], name, { type: 'text/csv' })
}

function txtFile() {
  return new File(['hello'], 'data.txt', { type: 'text/plain' })
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UploadPage', () => {
  it('renders the upload area', () => {
    render(<UploadPage />, { wrapper })
    expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument()
  })

  it('rejects non-.csv files and shows an error', async () => {
    render(<UploadPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // applyAccept:false lets the non-csv file reach the component's handler
    // so the extension-validation branch actually executes
    await userEvent.upload(input, txtFile(), { applyAccept: false })
    expect(screen.getByText(/please upload a .csv file/i)).toBeInTheDocument()
    expect(mockUploadCsv).not.toHaveBeenCalled()
  })

  it('calls uploadCsv with the selected file', async () => {
    mockUploadCsv.mockResolvedValueOnce({ inserted: 10, updated: 2 })
    render(<UploadPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, csvFile())
    expect(mockUploadCsv).toHaveBeenCalledWith(expect.objectContaining({ name: 'data.csv' }))
  })

  it('shows inserted and updated counts on success', async () => {
    mockUploadCsv.mockResolvedValueOnce({ inserted: 42, updated: 7 })
    render(<UploadPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, csvFile())
    await waitFor(() => expect(screen.getByText(/sync complete/i)).toBeInTheDocument())
    expect(screen.getByText(/42 inserted/i)).toBeInTheDocument()
    expect(screen.getByText(/7 updated/i)).toBeInTheDocument()
  })

  it('shows an error message when the upload fails', async () => {
    mockUploadCsv.mockRejectedValueOnce(new Error('500: Ingest failed'))
    render(<UploadPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, csvFile())
    await waitFor(() => expect(screen.getByText(/500: Ingest failed/i)).toBeInTheDocument())
  })

  it('does not show result banner before any upload', () => {
    render(<UploadPage />, { wrapper })
    expect(screen.queryByText(/sync complete/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/inserted/i)).not.toBeInTheDocument()
  })

  it('clears a previous error when a new valid upload starts', async () => {
    // First upload: fails
    mockUploadCsv.mockRejectedValueOnce(new Error('Server error'))
    render(<UploadPage />, { wrapper })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, csvFile())
    await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument())

    // Second upload: succeeds
    mockUploadCsv.mockResolvedValueOnce({ inserted: 1, updated: 0 })
    await userEvent.upload(input, csvFile())
    await waitFor(() => expect(screen.getByText(/sync complete/i)).toBeInTheDocument())
    expect(screen.queryByText(/server error/i)).not.toBeInTheDocument()
  })
})
