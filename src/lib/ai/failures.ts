/**
 * Turning "the AI broke" into something a person can act on.
 * Every failed run gets: a kind (for the UI and reporting), a plain message (shown to the user),
 * and the technical detail (kept for platform admins only).
 */

export type AIFailureKind = 'unavailable' | 'timeout' | 'rate_limited' | 'config' | 'bad_output' | 'input' | 'stale' | 'unknown'
export type AIProvider = 'mistral' | 'claude'

/** Thrown by the provider adapters so failures can be classified without parsing strings. */
export class AIProviderError extends Error {
  constructor(public provider: AIProvider, public kind: Exclude<AIFailureKind, 'input' | 'stale'>, message: string, public status?: number) {
    super(message)
    this.name = 'AIProviderError'
  }
}

export function providerErrorFromStatus(provider: AIProvider, status: number, body: string): AIProviderError {
  const kind = status === 429 ? 'rate_limited' : status === 401 || status === 403 ? 'config' : status >= 500 || status === 408 ? 'unavailable' : 'bad_output'
  return new AIProviderError(provider, kind, `${provider} ${status}: ${body.slice(0, 300)}`, status)
}

export const AI_FAILURE_MESSAGE: Record<Exclude<AIFailureKind, 'input'>, string> = {
  unavailable: 'The AI service isn’t responding right now, so nothing was read and nothing in your project has changed. Try again in a few minutes, or fill in the details by hand.',
  timeout: 'The AI took too long and was stopped. Nothing in your project has changed. Try again, try a shorter document, or fill in the details by hand.',
  rate_limited: 'The AI service is busy. Wait a minute and try again, or fill in the details by hand.',
  config: 'AI reading isn’t available on this workspace right now. Fill in the details by hand — we’ve been notified.',
  bad_output: 'The AI’s answer couldn’t be used this time. Nothing in your project has changed. Try again, or fill in the details by hand.',
  stale: 'This took too long and was stopped. The AI service may be busy — try again, or fill it in by hand.',
  unknown: 'Something went wrong while reading this. Nothing in your project has changed and we’ve been notified. Try again, or fill in the details by hand.',
}

/** Short label for a pipeline stage line. */
export const AI_FAILURE_LABEL: Record<AIFailureKind, string> = {
  unavailable: 'AI service unavailable',
  timeout: 'AI took too long',
  rate_limited: 'AI service busy',
  config: 'AI not configured',
  bad_output: 'AI answer unusable',
  input: 'could not read the input',
  stale: 'stopped — took too long',
  unknown: 'unexpected error',
}

export interface ClassifiedFailure {
  kind: AIFailureKind
  /** Shown to the user. */
  message: string
  /** Kept for platform admins. */
  detail: string
  retryable: boolean
  /** Whether this goes to error reporting, and how loudly. */
  report: 'error' | 'warning' | null
}

const TECH = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 1000)

export function classifyAIError(err: unknown): ClassifiedFailure {
  const detail = TECH(err)
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''

  let kind: AIFailureKind
  if (err instanceof AIProviderError) kind = err.kind
  else if (name === 'IngestError' || name === 'CrawlError' || / \([a-z_]+\)$/.test(msg) || /required$/.test(msg)) kind = 'input'
  else if (name === 'TimeoutError' || name === 'AbortError' || /did not answer within/.test(msg)) kind = 'timeout'
  else if (/API_KEY not set/.test(msg)) kind = 'config'
  else if (/Model output (failed validation|was not valid JSON)|No JSON object in model output/.test(msg)) kind = 'bad_output'
  else if (/\b(ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN)\b|fetch failed/i.test(msg)) kind = 'unavailable'
  else kind = 'unknown'

  const message = kind === 'input' ? msg : AI_FAILURE_MESSAGE[kind]
  const report: ClassifiedFailure['report'] =
    kind === 'input' ? null
      : kind === 'unavailable' || kind === 'timeout' || kind === 'rate_limited' ? 'warning'
        : 'error'
  return { kind, message, detail, retryable: kind !== 'config' && kind !== 'input', report }
}
