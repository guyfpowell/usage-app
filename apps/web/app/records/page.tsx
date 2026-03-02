'use client'

import React, { useState, useEffect } from 'react'
import { marked } from 'marked'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  getRecords,
  patchRecord,
  createJiraIssues,
  getClassifications,
  type RecordFilters,
  type UsageRecord,
} from '@/lib/api'

// Full-screen markdown modal
function ResponseModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  const html = marked.parse(content) as string

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-5xl flex flex-col shadow-2xl"
        style={{ height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto px-8 py-6 prose prose-sm max-w-none
            prose-headings:font-semibold prose-a:text-blue-600 prose-a:no-underline
            hover:prose-a:underline prose-strong:font-semibold"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

// Inline text edit — saves on blur if value changed
function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <input
      key={value}
      defaultValue={value}
      onBlur={e => { if (e.target.value !== value) onSave(e.target.value) }}
      className="bg-gray-50 border border-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-2 py-1 w-36"
    />
  )
}

type DateMode = 'all' | 'last7' | 'custom'

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function RecordsPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<RecordFilters>({ page: 1, pageSize: 50 })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null)
  const [dateMode, setDateMode] = useState<DateMode>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['records', filters],
    queryFn: () => getRecords(filters),
  })

  const { data: classifications } = useQuery({
    queryKey: ['classifications'],
    queryFn: getClassifications,
  })

  const patch = useMutation({
    mutationFn: ({ id, update }: { id: number; update: Partial<Pick<UsageRecord, 'classification' | 'groupText' | 'ticketText'>> }) =>
      patchRecord(id, update),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
  })

  const createJira = useMutation({
    mutationFn: (ids: number[]) => createJiraIssues(ids),
    onSuccess: () => {
      setRowSelection({})
      qc.invalidateQueries({ queryKey: ['records'] })
    },
  })

  const selectedIds = Object.entries(rowSelection)
    .filter(([, v]) => v)
    .map(([k]) => Number(k))

  const totalPages = Math.ceil((data?.total ?? 0) / (filters.pageSize ?? 50))
  const currentPage = filters.page ?? 1

  const columns: ColumnDef<UsageRecord>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="w-4 h-4 cursor-pointer accent-blue-600"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="w-4 h-4 cursor-pointer accent-blue-600"
        />
      ),
      size: 40,
    },
    {
      accessorKey: 'userId',
      header: 'User',
      cell: ({ row }) => (
        <span className="text-xs font-mono text-gray-600" title={row.original.userId}>
          {row.original.userId.length > 28 ? row.original.userId.slice(0, 28) + '…' : row.original.userId}
        </span>
      ),
    },
    {
      accessorKey: 'requestTime',
      header: 'Time',
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap text-gray-600">
          {new Date(row.original.requestTime).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'toolRoute',
      header: 'Route',
      cell: ({ row }) => (
        <span className="text-xs font-mono text-gray-700">{row.original.toolRoute}</span>
      ),
    },
    {
      accessorKey: 'isInternal',
      header: 'Int.',
      cell: ({ row }) => (
        <span className={`text-xs font-medium ${row.original.isInternal ? 'text-blue-600' : 'text-gray-400'}`}>
          {row.original.isInternal ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      accessorKey: 'hasFeedback',
      header: 'FB',
      cell: ({ row }) => (
        <span className={`text-xs font-medium ${row.original.hasFeedback ? 'text-green-600' : 'text-gray-400'}`}>
          {row.original.hasFeedback ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      accessorKey: 'rationale',
      header: 'Rationale',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 max-w-xs block truncate" title={row.original.rationale ?? ''}>
          {row.original.rationale ?? <span className="text-gray-300">—</span>}
        </span>
      ),
    },
    {
      accessorKey: 'classification',
      header: 'Classification',
      cell: ({ row }) => (
        <select
          value={row.original.classification}
          onChange={e =>
            patch.mutate({ id: row.original.id, update: { classification: e.target.value } })
          }
          className="bg-gray-50 border border-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-2 py-1"
        >
          <option value="To be classified">To be classified</option>
          {classifications?.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      ),
    },
    {
      accessorKey: 'requestContent',
      header: 'Request',
      cell: ({ row }) => {
        const text = row.original.requestContent
        const preview = text.split('\n').slice(0, 8).join('\n')
        return (
          <div className="max-w-xs">
            <p
              className="text-xs text-gray-600 whitespace-pre-wrap break-words"
              style={{ display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
            >{preview}</p>
            {text.length > preview.length && (
              <button onClick={() => setModal({ title: 'Request', content: text })} className="text-xs text-blue-600 hover:underline mt-1">Read more</button>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'responseContent',
      header: 'Response',
      cell: ({ row }) => {
        const text = row.original.responseContent
        const preview = text.split('\n').slice(0, 8).join('\n')
        return (
          <div className="max-w-xs">
            <p
              className="text-xs text-gray-600 whitespace-pre-wrap break-words"
              style={{ display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
            >{preview}</p>
            {text.length > preview.length && (
              <button onClick={() => setModal({ title: 'Response', content: text })} className="text-xs text-blue-600 hover:underline mt-1">Read more</button>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'groupText',
      header: 'Group',
      cell: ({ row }) => (
        <InlineEdit
          value={row.original.groupText ?? ''}
          onSave={v => patch.mutate({ id: row.original.id, update: { groupText: v } })}
        />
      ),
    },
    {
      accessorKey: 'ticketText',
      header: 'Ticket',
      cell: ({ row }) =>
        row.original.jiraIssueUrl ? (
          <a
            href={row.original.jiraIssueUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            {row.original.jiraIssueKey}
          </a>
        ) : (
          <InlineEdit
            value={row.original.ticketText ?? ''}
            onSave={v => patch.mutate({ id: row.original.id, update: { ticketText: v } })}
          />
        ),
    },
  ]

  const table = useReactTable({
    data: data?.records ?? [],
    columns,
    state: { rowSelection },
    getRowId: row => String(row.id),
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    manualPagination: true,
    pageCount: totalPages,
  })

  function setFilter<K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) {
    setFilters(f => ({ ...f, page: 1, [key]: value }))
  }

  function handleDateMode(mode: DateMode) {
    setDateMode(mode)
    if (mode === 'all') {
      setFilters(f => { const { dateFrom: _a, dateTo: _b, ...rest } = f; return { ...rest, page: 1 } })
    } else if (mode === 'last7') {
      const from = new Date()
      from.setDate(from.getDate() - 7)
      setFilters(f => { const { dateTo: _b, ...rest } = f; return { ...rest, page: 1, dateFrom: toDateStr(from) } })
    }
    // 'custom' — filters updated as the user fills in the date inputs
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Records</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total records</p>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={() => createJira.mutate(selectedIds)}
            disabled={createJira.isPending}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors focus:ring-4 focus:ring-blue-300"
          >
            {createJira.isPending ? 'Creating…' : `Create Jira (${selectedIds.length})`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filters.type ?? ''}
            onChange={e =>
              setFilter('type', (e.target.value as RecordFilters['type']) || undefined)
            }
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
          >
            <option value="">All users</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>

          <select
            value={filters.hasFeedback === undefined ? '' : String(filters.hasFeedback)}
            onChange={e =>
              setFilter(
                'hasFeedback',
                e.target.value === '' ? undefined : e.target.value === 'true'
              )
            }
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
          >
            <option value="">All feedback</option>
            <option value="true">Has feedback</option>
            <option value="false">No feedback</option>
          </select>

          <input
            placeholder="Tool route"
            value={filters.toolRoute ?? ''}
            onChange={e => setFilter('toolRoute', e.target.value || undefined)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2 w-40"
          />

          {/* Date range filter */}
          <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['all', 'last7', 'custom'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => handleDateMode(mode)}
                className={`px-3 py-2 transition-colors ${
                  dateMode === mode
                    ? 'bg-blue-700 text-white font-medium'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {mode === 'all' ? 'All' : mode === 'last7' ? 'Last 7 days' : 'Custom'}
              </button>
            ))}
          </div>

          {dateMode === 'custom' && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={e => {
                  setCustomFrom(e.target.value)
                  setFilters(f => ({ ...f, page: 1, dateFrom: e.target.value || undefined }))
                }}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => {
                  setCustomTo(e.target.value)
                  setFilters(f => ({ ...f, page: 1, dateTo: e.target.value || undefined }))
                }}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              />
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-400">Loading…</p>
        </div>
      ) : isError ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-red-500">Failed to load records</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {table.getHeaderGroups().map(hg => (
                    <tr key={hg.id}>
                      {hg.headers.map(h => (
                        <th
                          key={h.id}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr
                        key={row.id}
                        className={row.getIsSelected() ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span className="text-gray-600">Page {currentPage} of {totalPages || 1}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setFilters(f => ({ ...f, page: currentPage - 1 }))}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700 font-medium"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setFilters(f => ({ ...f, page: currentPage + 1 }))}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {modal && (
        <ResponseModal
          title={modal.title}
          content={modal.content}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
