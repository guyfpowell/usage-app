'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadCsv, getBatches, rollbackBatch } from '@/lib/api'

export default function UploadPage() {
  const qc = useQueryClient()
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: batches } = useQuery({
    queryKey: ['batches'],
    queryFn: getBatches,
  })

  const rollback = useMutation({
    mutationFn: rollbackBatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] })
      qc.invalidateQueries({ queryKey: ['records'] })
    },
  })

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await uploadCsv(file)
      setResult(data)
      qc.invalidateQueries({ queryKey: ['batches'] })
      qc.invalidateQueries({ queryKey: ['records'] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload CSV</h1>
        <p className="text-sm text-gray-500">Import usage records from a CSV export</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) void handleFile(file)
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer transition-colors select-none ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-gray-700">
            {loading ? 'Uploading…' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-xs text-gray-400 mt-1">CSV files only</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
        </div>

        {!loading && !result && !error && (
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-4 w-full py-2.5 px-5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 rounded-lg transition-colors"
          >
            Select file
          </button>
        )}
      </div>

      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="font-semibold text-green-800">Upload complete</p>
          </div>
          <p className="text-green-700 text-sm pl-7">
            {result.inserted} inserted · {result.updated} updated
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Upload history */}
      {batches && batches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Upload History</h2>
            <p className="text-xs text-gray-400 mt-0.5">Roll back an upload to undo its inserts and restore updated records</p>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Inserted</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map(batch => (
                <tr key={batch.id} className={batch.isRolledBack ? 'opacity-50' : 'hover:bg-gray-50'}>
                  <td className="px-5 py-3 text-gray-700 font-mono text-xs max-w-[200px] truncate" title={batch.filename}>
                    {batch.filename}
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(batch.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{batch.insertedCount}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{batch.updatedCount}</td>
                  <td className="px-5 py-3 text-right">
                    {batch.isRolledBack ? (
                      <span className="text-xs text-gray-400 italic">Rolled back</span>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`Roll back "${batch.filename}"? This will delete ${batch.insertedCount} inserted records and restore ${batch.updatedCount} updated records.`)) {
                            rollback.mutate(batch.id)
                          }
                        }}
                        disabled={rollback.isPending}
                        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                      >
                        Roll back
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
