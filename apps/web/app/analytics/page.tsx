'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeeklyAnalytics, getOverallAnalytics, getFeedbackByRoute } from '@/lib/api'

type WeeklyFilter = 'all' | 'internal' | 'external'

export default function AnalyticsPage() {
  const [weeklyFilter, setWeeklyFilter] = useState<WeeklyFilter>('all')

  const { data: weekly } = useQuery({
    queryKey: ['analytics/weekly', weeklyFilter],
    queryFn: () => getWeeklyAnalytics(weeklyFilter === 'all' ? undefined : weeklyFilter),
  })

  const { data: overall } = useQuery({
    queryKey: ['analytics/overall'],
    queryFn: getOverallAnalytics,
  })

  const { data: byRoute } = useQuery({
    queryKey: ['analytics/feedback-by-route'],
    queryFn: getFeedbackByRoute,
  })

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {/* Overall TTFT card */}
      <div className="bg-white border rounded-lg p-6 inline-block min-w-48">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Overall Avg TTFT
        </p>
        <p className="text-3xl font-bold mt-2 text-gray-900">
          {overall?.avgTtftSeconds != null
            ? `${overall.avgTtftSeconds.toFixed(2)}s`
            : '—'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly usage table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Weekly Usage</h2>
            <select
              value={weeklyFilter}
              onChange={e => setWeeklyFilter(e.target.value as WeeklyFilter)}
              className="border rounded px-2 py-1 text-sm bg-white"
            >
              <option value="all">All users</option>
              <option value="internal">Internal only</option>
              <option value="external">External only</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Week starting
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Requests
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Avg TTFT (s)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weekly?.length ? (
                  weekly.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        {new Date(row.week).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2 text-right">{row.count}</td>
                      <td className="px-3 py-2 text-right">
                        {row.avgTtftSeconds != null ? row.avgTtftSeconds.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-400">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feedback by route */}
        <div>
          <h2 className="text-lg font-medium mb-3">Feedback by Tool Route</h2>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Tool Route
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    With Feedback
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byRoute?.length ? (
                  byRoute.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{row.toolRoute}</td>
                      <td className="px-3 py-2 text-right">{row.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-gray-400">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
