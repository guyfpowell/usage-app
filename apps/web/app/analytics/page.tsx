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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Usage trends and performance metrics</p>
      </div>

      {/* Stat card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 inline-flex flex-col min-w-48">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Overall Avg TTFT
        </p>
        <p className="text-4xl font-bold mt-2 text-gray-900">
          {overall?.avgTtftSeconds != null
            ? `${overall.avgTtftSeconds.toFixed(2)}s`
            : '—'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Time to first token</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly usage table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Weekly Usage</h2>
            <select
              value={weeklyFilter}
              onChange={e => setWeeklyFilter(e.target.value as WeeklyFilter)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-1.5"
            >
              <option value="all">All users</option>
              <option value="internal">Internal only</option>
              <option value="external">External only</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week starting
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg TTFT (s)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weekly?.length ? (
                  weekly.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-900">
                        {new Date(row.week).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{row.count}</td>
                      <td className="px-5 py-3 text-right text-gray-400">
                        {row.count === 0 || row.avgTtftSeconds == null ? 'n/a' : row.avgTtftSeconds.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feedback by route */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Feedback by Tool Route</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tool Route
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    With Feedback
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byRoute?.length ? (
                  byRoute.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-700">{row.toolRoute}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{row.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-5 py-8 text-center text-gray-400">
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
