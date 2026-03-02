'use client'

import { useState, useRef } from 'react'
import { uploadCsv } from '@/lib/api'

export default function UploadPage() {
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Upload CSV</h1>

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
        className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors select-none ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
      >
        <p className="text-gray-500 text-sm">
          {loading ? 'Uploading…' : 'Drag & drop a CSV file here, or click to select'}
        </p>
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

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-medium text-green-800">Upload complete</p>
          <p className="text-green-700 mt-1 text-sm">
            {result.inserted} inserted · {result.updated} updated
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
