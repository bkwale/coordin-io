import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * S4.2 — when the model is down, nobody waits for nothing and nobody is left guessing:
 * failures are classified, the user gets a plain message + manual path, repeated outages fail fast,
 * and every failure reaches error reporting.
 */
vi.mock('@/lib/cache', () => ({ getRedis: () => null }))
const captured: Array<{ err: unknown; ctx: any; level: string }> = []
vi.mock('@/lib/error-reporting', () => ({
  captureError: (err: unknown, ctx: any, level = 'error') => { captured.push({ err, ctx, level }); return 'ERR-TEST2345' },
}))
const runs = new Map<string, any>()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    aIRun: {
      update: vi.fn(async ({ where, data }: any) => { const r = { ...(runs.get(where.id) ?? {}), ...data }; runs.set(where.id, r); return r }),
      findUnique: vi.fn(async ({ where }: any) => runs.get(where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => { const r = runs.get(where.id); if (!r || !where.status.in.includes(r.status)) return { count: 0 }; Object.assign(r, data); return { count: 1 } }),
    },
  },
}))

const { classifyAIError, AIProviderError, AI_FAILURE_MESSAGE } = await import('@/lib/ai/failures')
const health = await import('@/lib/ai/providers/health')
const { chat } = await import('@/lib/ai/providers')
const { runAI } = await import('@/lib/ai/pipeline')
const { failIfStale, STALE_MESSAGE } = await import('@/lib/ai/stale-runs')
const { aiAvailability } = await import('@/lib/ai/availability')
const { z } = await import('zod')

const okBody = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { total_tokens: 10 } }), { status: 200 })
const claudeOk = (text: string) => new Response(JSON.stringify({ content: [{ text }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 })

beforeEach(() => {
  captured.length = 0; runs.clear(); health.__resetBreakerForTests()
  process.env.MISTRAL_API_KEY = 'm'; delete process.env.ANTHROPIC_API_KEY
  vi.useFakeTimers({ toFake: ['setTimeout'] })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('classifyAIError', () => {
  it.each([
    [new AIProviderError('mistral', 'unavailable', 'mistral 503'), 'unavailable', 'warning'],
    [new AIProviderError('mistral', 'rate_limited', 'mistral 429'), 'rate_limited', 'warning'],
    [new AIProviderError('claude', 'timeout', 'claude did not answer within 80 s'), 'timeout', 'warning'],
    [new AIProviderError('mistral', 'config', 'mistral 401'), 'config', 'error'],
    [new Error('Model output failed validation: document.number: Required'), 'bad_output', 'error'],
    [new Error('MISTRAL_API_KEY not set'), 'config', 'error'],
    [new Error('The site could not be reached (dns)'), 'input', null],
    [Object.assign(new Error('This PDF has no text layer'), { name: 'IngestError' }), 'input', null],
    [new Error('something odd'), 'unknown', 'error'],
  ])('%s → %s', (err, kind, report) => {
    const f = classifyAIError(err)
    expect(f.kind).toBe(kind)
    expect(f.report).toBe(report)
    expect(f.detail).toContain((err as Error).message)
    if (kind !== 'input') expect(f.message).toBe(AI_FAILURE_MESSAGE[kind as keyof typeof AI_FAILURE_MESSAGE])
  })

  it('user-facing messages say nothing changed and offer the manual path; never leak provider internals', () => {
    for (const k of ['unavailable', 'timeout', 'bad_output', 'unknown'] as const) {
      expect(AI_FAILURE_MESSAGE[k]).toMatch(/by hand/)
      expect(AI_FAILURE_MESSAGE[k]).not.toMatch(/mistral|claude|503|json/i)
    }
    expect(classifyAIError(new Error('MISTRAL_API_KEY not set')).retryable).toBe(false)
  })
})

describe('circuit breaker', () => {
  it('opens after 3 outage failures, reports once, and a success closes it', async () => {
    expect(await health.isProviderOpen('mistral')).toBe(false)
    expect(await health.recordProviderFailure('mistral')).toBe(false)
    expect(await health.recordProviderFailure('mistral')).toBe(false)
    expect(await health.recordProviderFailure('mistral')).toBe(true)
    expect(await health.recordProviderFailure('mistral')).toBe(false) // already open — no second alert
    expect(await health.isProviderOpen('mistral')).toBe(true)
    await health.recordProviderSuccess('mistral')
    expect(await health.isProviderOpen('mistral')).toBe(false)
  })

  it('closes on its own after the open window', async () => {
    const t = Date.now()
    for (let i = 0; i < 3; i++) await health.recordProviderFailure('claude', t)
    expect(await health.isProviderOpen('claude', t + 60_000)).toBe(true)
    expect(await health.isProviderOpen('claude', t + health.OPEN_FOR_S * 1000 + 1)).toBe(false)
  })
})

describe('chat() when the model is down', () => {
  it('retries a fast 503 once, then succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('busy', { status: 503 })).mockResolvedValueOnce(okBody('{"a":1}'))
    vi.stubGlobal('fetch', fetchMock)
    const p = chat({ system: 's', user: 'u', json: true })
    await vi.advanceTimersByTimeAsync(1600)
    await expect(p).resolves.toMatchObject({ text: '{"a":1}', provider: 'mistral' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('without a fallback, throws a typed outage error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 502 })))
    const p = chat({ system: 's', user: 'u' })
    const assertion = expect(p).rejects.toMatchObject({ name: 'AIProviderError', kind: 'unavailable', provider: 'mistral' })
    await vi.advanceTimersByTimeAsync(1600)
    await assertion
  })

  it('network failure counts as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(chat({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('falls back to Claude when configured and Mistral is down', async () => {
    process.env.ANTHROPIC_API_KEY = 'c'
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('mistral') ? new Response('x', { status: 500 }) : claudeOk('{"ok":true}'))))
    await expect(chat({ system: 's', user: 'u' })).resolves.toMatchObject({ provider: 'claude' })
  })

  it('once the breaker is open, fails immediately without calling Mistral and reports the outage once', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('x', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < 3; i++) await expect(chat({ system: 's', user: 'u' })).rejects.toBeTruthy()
    expect(captured.filter((c) => String((c.err as Error).message).includes('marked unavailable'))).toHaveLength(1)
    const calls = fetchMock.mock.calls.length
    await expect(chat({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'unavailable', message: expect.stringMatching(/skipped/) })
    expect(fetchMock.mock.calls.length).toBe(calls)
    expect(await aiAvailability()).toMatchObject({ available: false, reason: 'down' })
  })

  it('a bad request to the primary is our bug, not an outage — no silent fallback, breaker untouched', async () => {
    process.env.ANTHROPIC_API_KEY = 'c'
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(chat({ system: 's', user: 'u' })).rejects.toMatchObject({ kind: 'bad_output' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await health.isProviderOpen('mistral')).toBe(false)
  })
})

describe('runAI failure record', () => {
  const base = { surface: 'PROJECT_SETUP' as const, createdBy: '', inputSummary: '', promptVersion: 'pt-1', schema: z.object({ a: z.number() }), ingest: async () => ({ system: 's', user: 'u', inputForHash: 'x' }) }

  it('model down → run FAILED with a plain message + reference, kind and admin-only detail; reported as a warning', async () => {
    runs.set('r1', { id: 'r1', organisationId: 'org-1', projectId: 'p-1', surface: 'PROJECT_SETUP' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(runAI('r1', base)).rejects.toBeTruthy()
    const r = runs.get('r1')
    expect(r).toMatchObject({ status: 'FAILED', errorKind: 'unavailable' })
    expect(r.error).toBe(`${AI_FAILURE_MESSAGE.unavailable} (Reference: ERR-TEST2345)`)
    expect(r.errorDetail).toMatch(/^\[ERR-TEST2345\] AIProviderError: mistral unreachable/)
    expect(r.stages.find((s: any) => s.name === 'extract')).toMatchObject({ status: 'failed', detail: 'AI service unavailable' })
    const report = captured.find((c) => c.ctx.runId === 'r1')!
    expect(report).toMatchObject({ level: 'warning', ctx: { source: 'ai', organisationId: 'org-1', code: 'AI_UNAVAILABLE' } })
  })

  it('unusable model output → bad_output, reported as an error', async () => {
    runs.set('r2', { id: 'r2', organisationId: 'org-1', surface: 'PROJECT_SETUP' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okBody('{"a":"not a number"}')))
    await expect(runAI('r2', base)).rejects.toBeTruthy()
    expect(runs.get('r2')).toMatchObject({ status: 'FAILED', errorKind: 'bad_output' })
    expect(captured.find((c) => c.ctx.runId === 'r2')?.level).toBe('error')
  })

  it('bad input (scanned PDF etc.) is the user’s to fix: their message, no report, no reference', async () => {
    runs.set('r3', { id: 'r3', surface: 'PROJECT_SETUP' })
    const ingest = async () => { throw new Error('The site could not be reached (dns)') }
    await expect(runAI('r3', { ...base, ingest })).rejects.toBeTruthy()
    expect(runs.get('r3')).toMatchObject({ status: 'FAILED', errorKind: 'input', error: 'The site could not be reached (dns)' })
    expect(captured).toHaveLength(0)
  })
})

describe('stale runs', () => {
  it('closes a run left RUNNING past the time limit with a clear message, reported once', async () => {
    const old = { id: 's1', status: 'RUNNING', createdAt: new Date(Date.now() - 10 * 60_000), error: null }
    runs.set('s1', { ...old })
    const first = await failIfStale(old)
    expect(first).toMatchObject({ status: 'FAILED', error: STALE_MESSAGE })
    expect(runs.get('s1')).toMatchObject({ status: 'FAILED', errorKind: 'stale' })
    await failIfStale(old) // a second poll
    expect(captured.filter((c) => c.ctx.code === 'AI_STALE')).toHaveLength(1)
  })

  it('leaves a fresh run alone', async () => {
    const fresh = { id: 's2', status: 'RUNNING', createdAt: new Date(), error: null }
    expect(await failIfStale(fresh)).toBe(fresh)
  })
})

describe('availability', () => {
  it('not configured → manual path offered', async () => {
    delete process.env.MISTRAL_API_KEY
    expect(await aiAvailability()).toMatchObject({ available: false, reason: 'not_configured', message: expect.stringMatching(/by hand/) })
  })
  it('primary down but fallback up → still available', async () => {
    process.env.ANTHROPIC_API_KEY = 'c'
    for (let i = 0; i < 3; i++) await health.recordProviderFailure('mistral')
    expect((await aiAvailability()).available).toBe(true)
  })
})
