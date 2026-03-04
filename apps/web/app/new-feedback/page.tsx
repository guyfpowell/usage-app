'use client'

import { useState } from 'react'
import { marked } from 'marked'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRecords, patchRecord, getClassifications, getEpics, getCustomerFeedbackIssues, type UsageRecord } from '@/lib/api'

const NEW_FEEDBACK_FILTERS = {
  type: 'external' as const,
  hasFeedback: true,
  feedbackValue: 'negative',
  classification: 'To be classified',
  pageSize: 200,
}

// ── Single record full-page view ──────────────────────────────────────────────

function RecordView({
  record,
  index,
  total,
  onBack,
  onPrev,
  onNext,
  onSaved,
}: {
  record: UsageRecord
  index: number
  total: number
  onBack: () => void
  onPrev: () => void
  onNext: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [classification, setClassification] = useState(record.classification)
  const [notes, setNotes] = useState(record.groupText ?? '')
  const [epicKey, setEpicKey] = useState(record.epicKey ?? '')
  const [linkedIssueKey, setLinkedIssueKey] = useState(record.linkedIssueKey ?? '')
  const [saved, setSaved] = useState(false)

  const { data: classifications } = useQuery({
    queryKey: ['classifications'],
    queryFn: getClassifications,
  })

  const { data: epics } = useQuery({
    queryKey: ['epics'],
    queryFn: getEpics,
  })

  const { data: linkedIssues } = useQuery({
    queryKey: ['customer-feedback-issues'],
    queryFn: getCustomerFeedbackIssues,
  })

  const patch = useMutation({
    mutationFn: () => patchRecord(record.id, { classification, groupText: notes, epicKey: epicKey || undefined, linkedIssueKey: linkedIssueKey || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] })
      qc.invalidateQueries({ queryKey: ['new-feedback-count'] })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onSaved()
      }, 600)
    },
  })

  const traceUrl = record.traceId
    ? `https://adb-81631168259822.2.azuredatabricks.net/ml/experiments/1719330147765432/traces?o=81631168259822&selectedEvaluationId=${record.traceId}`
    : null

  const requestHtml = marked.parse(record.requestContent) as string
  const responseHtml = marked.parse(record.responseContent) as string

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to list
          </button>
          <span className="text-gray-600">|</span>
          <div className="text-sm text-gray-400">
            Record <span className="text-white font-medium">{index + 1}</span> of <span className="text-white font-medium">{total}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            {new Date(record.requestTime).toLocaleString()} · <span className="font-mono">{record.toolRoute}</span>
            {traceUrl && (
              <a href={traceUrl} target="_blank" rel="noreferrer" className="ml-2 text-violet-400 hover:text-violet-300">View trace →</a>
            )}
          </div>
          <button
            onClick={onPrev}
            disabled={index === 0}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={onNext}
            disabled={index === total - 1}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Meta strip */}
      <div className="flex items-center gap-6 px-6 py-2 bg-gray-900 border-b border-gray-800 shrink-0 text-xs text-gray-400">
        <span>User: <span className="text-gray-200 font-mono">{record.userId}</span></span>
        <span>Feedback: <span className={`font-medium ${record.feedbackValue ? 'text-red-400' : 'text-gray-500'}`}>{record.feedbackValue ?? '—'}</span></span>
        <span>Rationale: <span className="text-gray-200 italic">{record.rationale ?? '—'}</span></span>
      </div>

      {/* Content: request + response */}
      <div className="flex flex-1 overflow-hidden divide-x divide-gray-800">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-2 bg-gray-900/50 shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wider">Request</div>
          <div
            className="flex-1 overflow-y-auto px-6 py-4 prose prose-sm prose-invert max-w-none
              prose-headings:text-gray-200 prose-p:text-gray-300 prose-code:text-gray-300
              prose-code:bg-gray-800 prose-pre:bg-gray-800"
            dangerouslySetInnerHTML={{ __html: requestHtml }}
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-2 bg-gray-900/50 shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wider">Response</div>
          <div
            className="flex-1 overflow-y-auto px-6 py-4 prose prose-sm prose-invert max-w-none
              prose-headings:text-gray-200 prose-p:text-gray-300 prose-code:text-gray-300
              prose-code:bg-gray-800 prose-pre:bg-gray-800"
            dangerouslySetInnerHTML={{ __html: responseHtml }}
          />
        </div>
      </div>

      {/* Classification footer */}
      <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-6 py-4">
        {/* Row 2: Epic + Linked Issue */}
        <div className="flex items-end gap-4 max-w-5xl mb-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Epic</label>
            <select
              value={epicKey}
              onChange={e => setEpicKey(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2 min-w-[240px]"
            >
              <option value="">— No epic —</option>
              {epics?.map(e => (
                <option key={e.key} value={e.key}>{e.key}: {e.summary}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Linked Issue</label>
            <select
              value={linkedIssueKey}
              onChange={e => setLinkedIssueKey(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2 min-w-[280px]"
            >
              <option value="">— No linked issue —</option>
              {linkedIssues?.map(i => (
                <option key={i.key} value={i.key}>{i.key}: {i.summary}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-end gap-4 max-w-5xl">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Classification</label>
            <select
              value={classification}
              onChange={e => setClassification(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2 min-w-[220px]"
            >
              <option value="To be classified">To be classified</option>
              {classifications?.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
            />
          </div>
          <button
            onClick={() => patch.mutate()}
            disabled={patch.isPending}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors shrink-0 ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
            }`}
          >
            {saved ? '✓ Saved' : patch.isPending ? 'Saving…' : index < total - 1 ? 'Save & Next →' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────

export default function NewFeedbackPage() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['records', NEW_FEEDBACK_FILTERS],
    queryFn: () => getRecords(NEW_FEEDBACK_FILTERS),
  })

  const records = data?.records ?? []

  function handleSaved() {
    // Refetch and stay on same index (it'll be removed from list, so next record slides in)
    qc.invalidateQueries({ queryKey: ['records', NEW_FEEDBACK_FILTERS] })
    if (selectedIndex !== null && selectedIndex >= records.length - 1) {
      setSelectedIndex(Math.max(0, records.length - 2))
    }
  }

  // Single record view
  if (selectedIndex !== null && records.length > 0) {
    const record = records[selectedIndex]
    if (!record) {
      setSelectedIndex(null)
      return null
    }
    return (
      <RecordView
        record={record}
        index={selectedIndex}
        total={records.length}
        onBack={() => setSelectedIndex(null)}
        onPrev={() => setSelectedIndex(i => Math.max(0, (i ?? 0) - 1))}
        onNext={() => setSelectedIndex(i => Math.min(records.length - 1, (i ?? 0) + 1))}
        onSaved={handleSaved}
      />
    )
  }

  // List view
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">
          External records with feedback that need classifying.
          {!isLoading && <span className="font-medium text-gray-700"> {records.length} remaining.</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-400">Loading…</p>
        </div>
      ) : isError ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-red-500">Failed to load records</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold text-lg">All caught up!</p>
          <p className="text-gray-400 text-sm mt-1">No unclassified external feedback records.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {records.map((record, i) => (
              <li key={record.id}>
                <button
                  onClick={() => setSelectedIndex(i)}
                  className="w-full text-left px-5 py-4 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {record.userId}
                        {record.rationale && (
                          <span className="text-gray-400 font-normal"> — {record.rationale}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{record.toolRoute}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {record.feedbackValue && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{record.feedbackValue}</span>
                      )}
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(record.requestTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
