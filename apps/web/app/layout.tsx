import type { Metadata } from 'next'
import { Providers } from './providers'
import { Sidebar } from './sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ask PEI - Customer Usage',
  description: 'Claude AI usage review tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased">
        <Providers>
          <Sidebar />
          <main className="ml-64 min-h-screen">
            <div className="p-6 max-w-screen-2xl">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  )
}
