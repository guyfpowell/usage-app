'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getNewFeedbackCount } from '@/lib/api'

const navItems = [
  {
    href: '/upload',
    label: 'Data',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    href: '/new-feedback',
    label: 'New Feedback',
    countKey: true,
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h6m-8 8l4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  {
    href: '/records',
    label: 'Usage',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/analytics-lab',
    label: 'Analytics Lab',
    badge: 'test',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v6.5L6.5 15A4 4 0 0010.5 21h3a4 4 0 004-4.5L15 9.5V3M9 3h6M9 3H7m8 0h2" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()

  const { data: countData } = useQuery({
    queryKey: ['new-feedback-count'],
    queryFn: getNewFeedbackCount,
    refetchInterval: 60_000,
  })
  const newFeedbackCount = countData?.count ?? 0

  return (
    <aside className="fixed top-0 left-0 z-40 w-64 h-screen" aria-label="Sidebar">
      <div className="flex flex-col h-full px-3 py-5 overflow-y-auto bg-gray-900">
        {/* Brand */}
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Customer Usage</span>
        </div>

        {/* Nav */}
        <ul className="space-y-1 flex-1">
          {navItems.map(item => {
            const active = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-700 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {'countKey' in item && newFeedbackCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold leading-none min-w-[20px] text-center">
                      {newFeedbackCount > 99 ? '99+' : newFeedbackCount}
                    </span>
                  )}
                  {'badge' in item && item.badge && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500 text-white font-medium leading-none">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Footer */}
        <div className="px-2 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">Claude AI Usage Review</p>
        </div>
      </div>
    </aside>
  )
}
