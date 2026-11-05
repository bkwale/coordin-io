'use client'

import { useEffect, useState } from 'react'
import { reportClientError } from '@/lib/client/report-client-error'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error page — Next.js App Router convention.
 *
 * Catches unhandled errors in route segments and shows a
 * clean recovery UI. In development the error is also logged
 * to the browser console.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [ref, setRef] = useState<string | null>(null)
  useEffect(() => {
    // Every crash is reported; the user gets a reference they can quote to support
    reportClientError(error).then(setRef)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorPage]', {
        timestamp: new Date().toISOString(),
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      })
    }
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-7 w-7 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-ink-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          An unexpected error occurred. You can try again, or head back to the
          dashboard.
        </p>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-ink-200 bg-white px-5 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </a>
        </div>

        {/* Reference the user can quote — we already have the details */}
        {(ref || error.digest) && (
          <p className="mt-6 text-xs text-ink-400">
            Error reference: <span className="font-mono">{ref ?? error.digest}</span>
            {ref && <span className="block mt-1">We’ve been notified. If you contact support, quote this reference.</span>}
          </p>
        )}
      </div>
    </div>
  )
}
