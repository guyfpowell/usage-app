import type { Metadata } from 'next'
import Link from 'next/link'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Usage App',
  description: 'Claude AI usage review tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <Providers>
          <nav className="bg-white border-b px-6 py-3 flex gap-6 text-sm font-medium">
            <span className="text-gray-400 font-semibold mr-2">Usage</span>
            <Link href="/upload" className="hover:text-blue-600 transition-colors">Upload</Link>
            <Link href="/records" className="hover:text-blue-600 transition-colors">Records</Link>
            <Link href="/analytics" className="hover:text-blue-600 transition-colors">Analytics</Link>
          </nav>
          <main className="p-6">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
