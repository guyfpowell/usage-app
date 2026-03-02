'use client'

import { useState } from 'react'
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

// Inline text edit — saves on blur if value changed
function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <input
      key={value}
      defaultValue={value}
      onBlur={e => { if (e.target.value !== value) onSave(e.target.value) }}
      className="border rounded px-1 py-0.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  )
}

export default function RecordsPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<RecordFilters>({ page: 1, pageSize: 50 })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

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
          className="cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="cursor-pointer"
        />
      ),
      size: 40,
    },
    {
      accessorKey: 'userId',
      header: 'User',
      cell: ({ row }) => (
        <span className="text-xs font-mono" title={row.original.userId}>
          {row.original.userId.length > 28 ? row.original.userId.slice(0, 28) + '…' : row.original.userId}
        </span>
      ),
    },
    {
      accessorKey: 'requestTime',
      header: 'Time',
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {new Date(row.original.requestTime).toLocaleString()}
        </span>
      ),
    },
    { accessorKey: 'toolRoute', header: 'Route' },
    {
      accessorKey: 'isInternal',
      header: 'Int.',
      cell: ({ row }) => (
        <span className={row.original.isInternal ? 'text-blue-600' : 'text-gray-400'}>
          {row.original.isInternal ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      accessorKey: 'hasFeedback',
      header: 'FB',
      cell: ({ row }) => (
        <span className={row.original.hasFeedback ? 'text-green-600' : 'text-gray-400'}>
          {row.original.hasFeedback ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      accessorKey: 'rationale',
      header: 'Rationale',
      cell: ({ row }) => (
        <span className="text-xs text-gray-700 max-w-xs block truncate" title={row.original.rationale ?? ''}>
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
          className="border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
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
      cell: ({ row }) => (
        <p className="text-xs text-gray-700 whitespace-pre-wrap max-w-sm break-words">
          {row.original.requestContent}
        </p>
      ),
    },
    {
      accessorKey: 'responseContent',
      header: 'Response',
      cell: ({ row }) => (
        <p className="text-xs text-gray-700 whitespace-pre-wrap max-w-sm break-words">
          {row.original.responseContent}
        </p>
      ),
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
            className="text-blue-600 underline text-sm"
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Records</h1>
        {selectedIds.length > 0 && (
          <button
            onClick={() => createJira.mutate(selectedIds)}
            disabled={createJira.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {createJira.isPending ? 'Creating…' : `Create Jira (${selectedIds.length})`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filters.type ?? ''}
          onChange={e =>
            setFilter('type', (e.target.value as RecordFilters['type']) || undefined)
          }
          className="border rounded px-2 py-1 text-sm bg-white"
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
          className="border rounded px-2 py-1 text-sm bg-white"
        >
          <option value="">All feedback</option>
          <option value="true">Has feedback</option>
          <option value="false">No feedback</option>
        </select>

        <input
          placeholder="Tool route"
          value={filters.toolRoute ?? ''}
          onChange={e => setFilter('toolRoute', e.target.value || undefined)}
          className="border rounded px-2 py-1 text-sm w-40"
        />

        <input
          placeholder="Week (2024-W05)"
          value={filters.week ?? ''}
          onChange={e => setFilter('week', e.target.value || undefined)}
          className="border rounded px-2 py-1 text-sm w-36"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-gray-400 py-8 text-center">Loading…</p>
      ) : isError ? (
        <p className="text-red-500 py-8 text-center">Failed to load records</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(h => (
                      <th
                        key={h.id}
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
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
                    <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">
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
                        <td key={cell.id} className="px-3 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>{data?.total ?? 0} total</span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setFilters(f => ({ ...f, page: currentPage - 1 }))}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-100"
              >
                Prev
              </button>
              <span>
                {currentPage} / {totalPages || 1}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setFilters(f => ({ ...f, page: currentPage + 1 }))}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
