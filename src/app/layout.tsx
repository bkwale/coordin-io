import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Coordin.io — Project Control for the Built Environment',
  description: 'RIBA stage tracking, risk detection and executive dashboards for multidisciplinary practices.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-50 text-ink-900 bg-grain">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-0 lg:ml-72">
            <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
