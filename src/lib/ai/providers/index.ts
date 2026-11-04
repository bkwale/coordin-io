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
      max_tokens: req.maxTokens ?? 4000,
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
      max_tokens: req.maxTokens ?? 4000,
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
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in model output')
  return JSON.parse(body.slice(start, end + 1))
}
