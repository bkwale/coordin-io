/**
 * Resilience utilities for the services layer.
 *
 * Circuit breaker: after FAILURE_THRESHOLD failures within FAILURE_WINDOW_MS,
 * skip Supabase for RECOVERY_MS. Prevents cascading slowness during outages.
 *
 * Query timeout: wraps every Supabase query with an AbortController so a
 * hanging connection doesn't block the request indefinitely.
 */

// ── Circuit Breaker ───────────────────────────────────────

const FAILURE_THRESHOLD = 3
const FAILURE_WINDOW_MS = 30_000 // 30 seconds
const RECOVERY_MS = 60_000 // 60 seconds

let failureCount = 0
let firstFailureTime = 0
let circuitOpenedAt = 0
let _circuitOpen = false

/**
 * Returns true if the circuit is open (Supabase should be skipped).
 * Automatically closes the circuit after RECOVERY_MS.
 */
export function isCircuitOpen(): boolean {
  if (!_circuitOpen) return false

  // Check if recovery period has elapsed
  if (Date.now() - circuitOpenedAt > RECOVERY_MS) {
    _circuitOpen = false
    failureCount = 0
    firstFailureTime = 0
    return false
  }

  return true
}

/** Record a failed Supabase query. Opens the circuit after threshold. */
export function recordFailure(): void {
  const now = Date.now()

  // If first failure in this window, or window has expired — reset counter
  if (failureCount === 0 || now - firstFailureTime > FAILURE_WINDOW_MS) {
    failureCount = 1
    firstFailureTime = now
  } else {
    failureCount++
  }

  if (failureCount >= FAILURE_THRESHOLD) {
    _circuitOpen = true
    circuitOpenedAt = now
  }
}

/** Record a successful Supabase query. Resets the failure counter. */
export function recordSuccess(): void {
  failureCount = 0
  firstFailureTime = 0
  // Don't close circuit here — let the recovery timer handle it
  // so a single success during a flaky period doesn't re-enable all traffic
}

/** Reset circuit breaker state — useful for testing. */
export function resetCircuitBreaker(): void {
  failureCount = 0
  firstFailureTime = 0
  circuitOpenedAt = 0
  _circuitOpen = false
}

// ── Query Timeout ─────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5_000

/**
 * Create an AbortController that auto-aborts after `ms` milliseconds.
 * Pass the `.signal` to Supabase queries via `.abortSignal(signal)`.
 *
 * Usage:
 *   const { signal, clear } = queryTimeout()
 *   const { data, error } = await supabase
 *     .from('projects')
 *     .select('id, name')
 *     .abortSignal(signal)
 *   clear() // cancel the timer if query resolved before timeout
 */
export function queryTimeout(ms = DEFAULT_TIMEOUT_MS): {
  signal: AbortSignal
  clear: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}
