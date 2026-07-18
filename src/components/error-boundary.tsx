'use client'

import React from 'react'

// ── Props ───────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

// ── Component ───────────────────────────────────────────────

/**
 * React error boundary for client components.
 *
 * Wraps children and catches render-time errors, showing a
 * clean recovery card or a custom fallback.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        })
      }

      // Default fallback card
      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-5 w-5 text-red-600"
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

            <h3 className="text-sm font-semibold text-red-800">
              Something went wrong
            </h3>
            <p className="mt-1 text-sm text-red-600">
              {this.state.error.message || 'An unexpected error occurred while rendering this section.'}
            </p>

            <button
              onClick={this.handleReset}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Try again
            </button>

            <p className="mt-3 text-xs text-red-400">
              If this keeps happening, please report it to your administrator.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
