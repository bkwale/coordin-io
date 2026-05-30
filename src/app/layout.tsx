'use client'

import { useState } from 'react'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { CommandPalette } from '@/components/CommandPalette'
import { cn } from '@/lib/utils'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <html lang="en">
      <head>
        <title>Coordin.io — Project Control for the Built Environment</title>
        <meta name="description" content="RIBA stage tracking, risk detection and executive dashboards for multidisciplinary practices." />
      </head>
      <body className="bg-surface-50 text-ink-900 bg-grain">
        <div className="flex min-h-screen">
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
          <CommandPalette />
          <main className={cn(
            'flex-1 ml-0 transition-[margin-left] duration-200',
            sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'
          )}>
            <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
