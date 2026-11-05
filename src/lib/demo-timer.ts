/**
 * Demo Timer — 10-minute timed trial for unauthenticated visitors.
 *
 * Uses localStorage to persist the timer across page navigations.
 * Also sets a cookie so Next.js middleware can check demo status server-side.
 * Timer starts when user enters demo-access and expires after DEMO_DURATION_MS.
 */

export const DEMO_DURATION_MS = 10 * 60 * 1000 // 10 minutes
const STORAGE_KEY = 'coordin_demo_start'
export const DEMO_COOKIE = 'coordin_demo_start'

/** Start the demo: the server issues a signed HttpOnly cookie; we keep the start time locally for the countdown. */
export async function startDemoTimer(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const res = await fetch('/api/demo/start', { method: 'POST' })
    if (!res.ok) return false
    const { data } = (await res.json()) as { data: { start: number } }
    localStorage.setItem(STORAGE_KEY, String(data.start))
    return true
  } catch { return false }
}

/** Get the timestamp when the demo started. Returns null if not started. */
export function getDemoStart(): number | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(STORAGE_KEY)
  return val ? parseInt(val, 10) : null
}

/** Get remaining milliseconds. Returns null if timer not started. */
export function getRemainingMs(): number | null {
  const start = getDemoStart()
  if (start === null) return null
  const elapsed = Date.now() - start
  return Math.max(0, DEMO_DURATION_MS - elapsed)
}

/** Check if the demo has expired. */
export function isDemoExpired(): boolean {
  const remaining = getRemainingMs()
  return remaining !== null && remaining <= 0
}

/** Clear/reset the demo timer (localStorage + cookie). */
export function clearDemoTimer(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  // HttpOnly cookie — only the server can clear it
  void fetch('/api/demo/start', { method: 'DELETE' }).catch(() => {})
}

/** Format milliseconds as "M:SS" */
export function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
