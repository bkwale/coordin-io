'use client'

import { useState, useCallback, useEffect } from 'react'

/* ── Types ─────────────────────────────────────────────── */

interface ApiError {
  code: string
  message: string
}

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-fetch data from the server */
  refresh: () => Promise<void>
}

interface MutationState<T> {
  loading: boolean
  error: string | null
  /** Execute the mutation */
  mutate: (body?: unknown) => Promise<T | null>
  /** Clear the error state */
  clearError: () => void
}

/* ── useApiFetch ───────────────────────────────────────── */

/**
 * Fetch data from an API endpoint on mount and when URL changes.
 * Uses useEffect for correct lifecycle behaviour (re-mount, URL change,
 * cleanup on unmount to prevent state updates on unmounted components).
 *
 * Returns { data, loading, error, refresh }.
 */
export function useApiFetch<T>(
  url: string,
  options?: { enabled?: boolean },
): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const enabled = options?.enabled ?? true

  const doFetch = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, { signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const apiErr = body.error as ApiError | undefined
        throw new Error(apiErr?.message || `Request failed (${res.status})`)
      }
      const json = await res.json()
      if (!signal?.aborted) {
        setData(json.data)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [url, enabled])

  // Auto-fetch on mount and when url/enabled changes
  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    doFetch(controller.signal)
    return () => controller.abort()
  }, [doFetch, enabled])

  // Manual refresh (no abort — user-triggered)
  const refresh = useCallback(async () => {
    await doFetch()
  }, [doFetch])

  return { data, loading, error, refresh }
}

/* ── useApiMutation ────────────────────────────────────── */

/**
 * Execute a mutation (POST/PATCH/DELETE) against an API endpoint.
 * Returns { mutate, loading, error, clearError }.
 *
 * Usage:
 * ```ts
 * const { mutate, loading } = useApiMutation<Task>('/api/tasks/123', 'PATCH')
 * const result = await mutate({ status: 'IN_PROGRESS' })
 * ```
 */
export function useApiMutation<T = unknown>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): MutationState<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async (body?: unknown): Promise<T | null> => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(url, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          const apiErr = json.error as ApiError | undefined
          throw new Error(apiErr?.message || `Request failed (${res.status})`)
        }

        // DELETE may return 204 (no content)
        if (res.status === 204) return null

        const json = await res.json()
        return json.data as T
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [url, method],
  )

  const clearError = useCallback(() => setError(null), [])

  return { mutate, loading, error, clearError }
}
