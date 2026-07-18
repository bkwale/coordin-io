'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { CommandPalette } from '@/components/CommandPalette'
import { DemoTimerProvider } from '@/components/DemoTimerProvider'
import { DemoTimerBanner } from '@/components/DemoTimerBanner'
import { DemoExpiredOverlay } from '@/components/DemoExpiredOverlay'
import { ToastProvider } from '@/components/Toast'
import { cn } from '@/lib/utils'

const MARKETING_ROUTES = ['/', '/welcome', '/faq', '/demo-access', '/use-cases', '/features/brpd', '/features/quotes', '/book-demo', '/login', '/signup', '/forgot-password']
const FULLSCREEN_PREFIXES = ['/activate', '/onboarding']

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMarketing = MARKETING_ROUTES.includes(pathname)
  const isFullscreen = FULLSCREEN_PREFIXES.some(prefix => pathname.startsWith(prefix))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <html lang="en">
      <head>
        <title>Coordin.io — Project Control for the Built Environment</title>
        <meta name="description" content="RIBA stage tracking, risk detection and executive dashboards for multidisciplinary practices." />
      </head>
      <body className={cn(
        'text-ink-900',
        isMarketing ? 'bg-white' : 'bg-surface-50 bg-grain'
      )}>
        <DemoTimerProvider>
          <ToastProvider>
            {isMarketing || isFullscreen ? (
              <div className="min-h-screen">{children}</div>
            ) : (
              <div className="flex min-h-screen">
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
                <CommandPalette />
                <main className={cn(
                  'flex-1 ml-0 transition-[margin-left] duration-200',
                  sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'
                )}>
                  <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto">
                    <DemoTimerBanner />
                    {children}
                  </div>
                </main>
                {/* Full-screen overlay when demo timer expires */}
                <DemoExpiredOverlay />
              </div>
            )}
          </ToastProvider>
        </DemoTimerProvider>
      </body>
    </html>
  )
}
