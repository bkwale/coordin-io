/**
 * LLM provider adapters. One interface, swappable by env.
 * Primary: Mistral (EU-hosted). Fallback: Claude.
 */

import { maskPersonalData } from '../pii-mask'

export interface ChatRequest {
  system: string
  user: string
  json?: boolean
  temperature?: number
  maxTokens?: number
  /** The organisation opted in to the non-EU backup model. Off by default: Mistral (EU) only. */
  allowFallback?: boolean
}

export interface ChatResult {
  text: string
  model: string
  tokens: number
  provider: 'mistral' | 'claude'
  /** Personal-data items masked before sending to the backup model. */
  masked?: number
}

/** Per-provider budget. Primary + fallback must finish inside the 300 s function limit so the run is always marked FAILED, never left RUNNING. */
export const PRIMARY_TIMEOUT_MS = 150_000
export const FALLBACK_TIMEOUT_MS = 80_000

import { AIProviderError, providerErrorFromStatus, type AIProvider } from '../failures'
import { isProviderOpen, recordProviderFailure, recordProviderSuccess } from './health'
import { captureError } from '@/lib/error-reporting'

function timeoutError(provider: AIProvider, ms: number) { return new AIProviderError(provider, 'timeout', `${provider} did not answer within ${Math.round(ms / 1000)} s`) }

/** Network-level failures (DNS, reset, refused) count as the provider being down. */
function networkError(provider: AIProvider, e: unknown): unknown {
  if (e instanceof AIProviderError) return e
  if (isTimeout(e)) return e
  if (e instanceof Error && /API_KEY not set/.test(e.message)) return new AIProviderError(provider, 'config', e.message)
  if (e instanceof TypeError || (e instanceof Error && /fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(e.message))) {
    return new AIProviderError(provider, 'unavailable', `${provider} unreachable: ${e instanceof Error ? e.message : String(e)}`)
  }
  return e
}

async function mistral(req: ChatRequest, model: string, timeoutMs = PRIMARY_TIMEOUT_MS): Promise<ChatResult> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set')
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: req.temperature ?? 0.1,
      max_tokens: req.maxTokens ?? 8192,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    }),
  })
  if (!res.ok) throw providerErrorFromStatus('mistral', res.status, await res.text().catch(() => ''))
  const data = await res.json()
  return { text: data.choices?.[0]?.message?.content ?? '', model, tokens: data.usage?.total_tokens ?? 0, provider: 'mistral' }
}

async function claude(req: ChatRequest, model: string, timeoutMs = FALLBACK_TIMEOUT_MS): Promise<ChatResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 8192,
      temperature: req.temperature ?? 0.1,
      system: req.system + (req.json ? '\nRespond with a single JSON object and nothing else.' : ''),
      messages: [{ role: 'user', content: req.user }],
    }),
  })
  if (!res.ok) throw providerErrorFromStatus('claude', res.status, await res.text().catch(() => ''))
  const data = await res.json()
  const text = (data.content ?? []).map((c: any) => c.text ?? '').join('')
  return { text, model, tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0), provider: 'claude' }
}

const OUTAGE = new Set(['unavailable', 'timeout', 'rate_limited'])
/** One quick retry for a fast 429/5xx — most blips clear within a second or two. */
const RETRY_STATUSES = new Set([429, 502, 503, 504])

async function attempt(provider: AIProvider, call: () => Promise<ChatResult>, timeoutMs: number): Promise<ChatResult> {
  const t0 = Date.now()
  const once = async () => {
    try { return await call() } catch (e) { throw isTimeout(e) ? timeoutError(provider, timeoutMs) : networkError(provider, e) }
  }
  try {
    const r = await once()
    void recordProviderSuccess(provider)
    return r
  } catch (e) {
    let err = e
    if (e instanceof AIProviderError && e.status && RETRY_STATUSES.has(e.status) && Date.now() - t0 < 20_000) {
      await new Promise((r) => setTimeout(r, 1500))
      try { const r = await once(); void recordProviderSuccess(provider); return r } catch (e2) { err = e2 }
    }
    if (err instanceof AIProviderError && OUTAGE.has(err.kind)) {
      const tripped = await recordProviderFailure(provider).catch(() => false)
      if (tripped) captureError(new Error(`${provider} marked unavailable after repeated failures: ${err.message}`), { source: 'ai', extra: { provider, kind: err.kind } }, 'error')
    }
    throw err
  }
}

export async function chat(req: ChatRequest): Promise<ChatResult> {
  const primary = process.env.AI_PRIMARY_MODEL || 'mistral-large-latest'
  const fallback = process.env.AI_FALLBACK_MODEL || 'claude-sonnet-4-5'
  const fallbackAvailable = !!process.env.ANTHROPIC_API_KEY && req.allowFallback === true
  let primaryErr: unknown
  if (await isProviderOpen('mistral')) {
    primaryErr = new AIProviderError('mistral', 'unavailable', 'mistral skipped: marked unavailable after repeated failures')
  } else {
    try { return await attempt('mistral', () => mistral(req, primary), PRIMARY_TIMEOUT_MS) } catch (e) { primaryErr = e }
  }
  // Wrong key / bad request on the primary is our bug, not an outage — don't paper over it with the fallback
  if (!fallbackAvailable || (primaryErr instanceof AIProviderError && primaryErr.kind === 'bad_output')) throw primaryErr
  if (await isProviderOpen('claude')) throw primaryErr
  // Leaving the EU: mask personal data first
  const sys = maskPersonalData(req.system), usr = maskPersonalData(req.user)
  const r = await attempt('claude', () => claude({ ...req, system: sys.text, user: usr.text }, fallback), FALLBACK_TIMEOUT_MS)
  return { ...r, masked: sys.masked + usr.masked }
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')

/** Extract the first JSON object from model text (handles ```json fences). */
export function parseJson(text: string): unknown { return parseJsonWithMeta(text).value }

/** Same, but says whether the output had to be repaired (cut short at max_tokens) — callers must warn the user. */
export function parseJsonWithMeta(text: string): { value: unknown; repaired: boolean } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  if (start === -1) throw new Error('No JSON object in model output')
  const end = body.lastIndexOf('}')
  if (end > start) {
    try { return { value: JSON.parse(body.slice(start, end + 1)), repaired: false } } catch { /* fall through to repair */ }
  }
  // Truncated (max_tokens) or malformed: cut back to the last complete value and close open brackets.
  const repaired = repairTruncatedJson(body.slice(start))
  if (repaired !== null) return { value: repaired, repaired: true }
  throw new Error('Model output was not valid JSON and could not be repaired')
}

/** Best-effort repair for model output cut mid-array/object (max_tokens). Cuts back to the last
 *  COMPLETE value boundary — a closing bracket, or a closing quote that ends a value — so a half-written
 *  element is dropped rather than kept with truncated text. Returns null if nothing parses. */
export function repairTruncatedJson(s: string): unknown | null {
  const candidates: number[] = []
  let inStr = false, esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') {
        inStr = false
        const next = s.slice(i + 1).match(/^\s*([,}\]]|$)/)
        if (next) candidates.push(i) // closing quote of a VALUE (not a key)
      }
      continue
    }
    if (c === '"') inStr = true
    else if (c === '}' || c === ']') candidates.push(i)
    else if (/[0-9el]/.test(c) && /^\s*([,}\]]|$)/.test(s.slice(i + 1))) candidates.push(i) // end of number/true/false/null
  }
  for (let k = candidates.length - 1; k >= 0 && k >= candidates.length - 400; k--) {
    const head = s.slice(0, candidates[k] + 1)
    const st: string[] = []; let q = false, e = false
    for (const ch of head) { if (q) { if (e) e = false; else if (ch === '\\') e = true; else if (ch === '"') q = false; continue } if (ch === '"') q = true; else if (ch === '{' || ch === '[') st.push(ch); else if (ch === '}' || ch === ']') st.pop() }
    if (q) continue
    // An unfinished object that is an array element (e.g. a half-written condition) is dropped, not closed.
    if (st.length >= 2 && st[st.length - 1] === '{' && st[st.length - 2] === '[') continue
    const closing = st.reverse().map((b) => (b === '{' ? '}' : ']')).join('')
    try { return JSON.parse(head + closing) } catch { /* earlier candidate */ }
  }
  return null
}
