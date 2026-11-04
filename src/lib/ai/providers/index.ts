/**
 * LLM provider adapters. One interface, swappable by env.
 * Primary: Mistral (EU-hosted). Fallback: Claude.
 */

export interface ChatRequest {
  system: string
  user: string
  json?: boolean
  temperature?: number
  maxTokens?: number
}

export interface ChatResult {
  text: string
  model: string
  tokens: number
  provider: 'mistral' | 'claude'
}

async function mistral(req: ChatRequest, model: string): Promise<ChatResult> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set')
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
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
  if (!res.ok) throw new Error(`mistral ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return { text: data.choices?.[0]?.message?.content ?? '', model, tokens: data.usage?.total_tokens ?? 0, provider: 'mistral' }
}

async function claude(req: ChatRequest, model: string): Promise<ChatResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 8192,
      temperature: req.temperature ?? 0.1,
      system: req.system + (req.json ? '\nRespond with a single JSON object and nothing else.' : ''),
      messages: [{ role: 'user', content: req.user }],
    }),
  })
  if (!res.ok) throw new Error(`claude ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = (data.content ?? []).map((c: any) => c.text ?? '').join('')
  return { text, model, tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0), provider: 'claude' }
}

export async function chat(req: ChatRequest): Promise<ChatResult> {
  const primary = process.env.AI_PRIMARY_MODEL || 'mistral-large-latest'
  const fallback = process.env.AI_FALLBACK_MODEL || 'claude-sonnet-4-5'
  try {
    return await mistral(req, primary)
  } catch (e) {
    if (!process.env.ANTHROPIC_API_KEY) throw e
    return await claude(req, fallback)
  }
}

/** Extract the first JSON object from model text (handles ```json fences). */
export function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  if (start === -1) throw new Error('No JSON object in model output')
  const end = body.lastIndexOf('}')
  if (end > start) {
    try { return JSON.parse(body.slice(start, end + 1)) } catch { /* fall through to repair */ }
  }
  // Truncated (max_tokens) or malformed: cut back to the last complete value and close open brackets.
  const repaired = repairTruncatedJson(body.slice(start))
  if (repaired !== null) return repaired
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
