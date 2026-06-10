'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getDemoStart,
  getRemainingMs,
  isDemoExpired,
  formatTimeRemaining,
  clearDemoTimer,
  DEMO_DURATION_MS,
} from '@/lib/demo-timer'

interface DemoTimerContextValue {
  /** Whether the demo timer is active (user entered demo mode). */
  isActive: boolean
  /** Whether the 10-minute demo has expired. */
  expired: boolean
  /** Remaining time as "M:SS" string, or null if not active. */
  timeRemaining: string | null
  /** Remaining milliseconds, or null. */
  remainingMs: number | null
  /** Reset the demo timer (e.g. after signup). */
  reset: () => void
}

const DemoTimerContext = createContext<DemoTimerContextValue>({
  isActive: false,
  expired: false,
  timeRemaining: null,
  remainingMs: null,
  reset: () => {},
})

export function useDemoTimer() {
  return useContext(DemoTimerContext)
}

export function DemoTimerProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [expired, setExpired] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  const refresh = useCallback(() => {
    const start = getDemoStart()
    if (start === null) {
      setIsActive(false)
      setExpired(false)
      setRemainingMs(null)
      return
    }
    setIsActive(true)
    const remaining = getRemainingMs()
    setRemainingMs(remaining)
    setExpired(isDemoExpired())
  }, [])

  // Initial check + interval
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [refresh])

  // Listen for storage changes (cross-tab support)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === 'coordin_demo_start') refresh()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refresh])

  const reset = useCallback(() => {
    clearDemoTimer()
    setIsActive(false)
    setExpired(false)
    setRemainingMs(null)
  }, [])

  const timeRemaining = remainingMs !== null ? formatTimeRemaining(remainingMs) : null

  return (
    <DemoTimerContext.Provider value={{ isActive, expired, timeRemaining, remainingMs, reset }}>
      {children}
    </DemoTimerContext.Provider>
  )
}
