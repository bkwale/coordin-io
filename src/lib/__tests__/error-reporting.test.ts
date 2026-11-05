import { describe, it, expect, vi, beforeEach } from 'vitest'

const created: any[] = []
let countResult = 0
vi.mock('@/lib/prisma', () => ({
  prisma: {
    errorEvent: {
      create: vi.fn(async ({ data }: any) => { created.push(data); return data }),
      count: vi.fn(async () => countResult),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}))
const alerts: any[] = []
vi.mock('@/lib/email', () => ({ sendErrorAlertEmail: vi.fn(async (p: any) => { alerts.push(p); return { success: true } }) }))
vi.mock('next/server', async (orig) => ({ ...(await orig<any>()), after: () => { throw new Error('outside request') } }))

const { captureError, captureErrorAndWait, alreadyReported, newErrorRef, scrub, fingerprintOf, sentryEnvelope } = await import('@/lib/error-reporting')
const { formatAPIError, ValidationError, AppError } = await import('@/lib/errors')

beforeEach(() => {
  created.length = 0; alerts.length = 0; countResult = 0
  delete process.env.ERROR_ALERT_EMAIL; delete process.env.RESEND_API_KEY; delete process.env.SENTRY_DSN
  vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('error references and scrubbing', () => {
  it('references are short, unambiguous and unique', () => {
    const refs = new Set(Array.from({ length: 500 }, () => newErrorRef()))
    expect(refs.size).toBe(500)
    for (const r of refs) expect(r).toMatch(/^ERR-[A-HJ-NP-Z2-9]{8}$/)
  })

  it('masks emails and long numbers (bank, phone, ID) before anything is stored', () => {
    expect(scrub('Failed for ayo@cwa.ng with account 0123456789 and +234 803 555 1234')).toBe('Failed for [email] with account [number] and +[number]')
  })

  it('the same problem gets the same fingerprint even with different ids and numbers', () => {
    const a = fingerprintOf('api', '/api/projects/cmw3revlp000008l9nbwomrno/tasks', 'Task 123 not found for "abc"')
    const b = fingerprintOf('api', '/api/projects/cmw3revz5000k08l9nno7jr35/tasks', 'Task 987 not found for "xyz"')
    expect(a).toBe(b)
    expect(fingerprintOf('ai', null, 'mistral 503')).not.toBe(fingerprintOf('api', null, 'mistral 503'))
  })
})

describe('captureError', () => {
  it('stores one row with context, never twice for the same error object', async () => {
    const err = new Error('boom for ayo@cwa.ng')
    const ref = await captureErrorAndWait(err, { source: 'api', route: '/api/x', method: 'POST', statusCode: 500, organisationId: 'org-1', profileId: 'p-1' })
    expect(alreadyReported(err)).toBe(ref)
    expect(captureError(err, { source: 'api' })).toBe(ref)
    await captureErrorAndWait(new Error('other'), { source: 'api' })
    expect(created).toHaveLength(2)
    expect(created[0]).toMatchObject({ ref, source: 'api', route: '/api/x', method: 'POST', statusCode: 500, organisationId: 'org-1', profileId: 'p-1', level: 'error' })
    expect(created[0].message).toBe('boom for [email]')
  })

  it('never throws, even when storage fails', async () => {
    const { prisma } = await import('@/lib/prisma') as any
    prisma.errorEvent.create.mockRejectedValueOnce(new Error('db down'))
    await expect(captureErrorAndWait(new Error('x'), { source: 'background' })).resolves.toMatch(/^ERR-/)
  })

  it('emails the alert address only the first time a kind of error is seen in 24 h', async () => {
    process.env.ERROR_ALERT_EMAIL = 'ops@example.com'; process.env.RESEND_API_KEY = 'test'
    countResult = 0
    await captureErrorAndWait(new Error('new kind'), { source: 'api', route: '/api/a' })
    countResult = 3
    await captureErrorAndWait(new Error('new kind'), { source: 'api', route: '/api/a' })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ to: 'ops@example.com', source: 'api', route: '/api/a' })
  })

  it('warnings are stored but never emailed', async () => {
    process.env.ERROR_ALERT_EMAIL = 'ops@example.com'; process.env.RESEND_API_KEY = 'test'
    await captureErrorAndWait(new Error('busy'), { source: 'ai' }, 'warning')
    expect(created[0].level).toBe('warning')
    expect(alerts).toHaveLength(0)
  })

  it('builds a valid Sentry envelope from the DSN', () => {
    const env = sentryEnvelope('https://abc123@o1.ingest.sentry.io/456', { ref: 'ERR-AAAA2222', level: 'error', fingerprint: 'fp', message: 'm', stack: null, release: 'abc1234', ctx: { source: 'api', route: '/r' } } as any)!
    expect(env.url).toBe('https://o1.ingest.sentry.io/api/456/envelope/')
    expect(env.auth).toContain('sentry_key=abc123')
    const [header, item, event] = env.body.split('\n').map((l) => JSON.parse(l))
    expect(header.dsn).toContain('abc123@')
    expect(item.type).toBe('event')
    expect(event).toMatchObject({ level: 'error', fingerprint: ['fp'], tags: { ref: 'ERR-AAAA2222', source: 'api', route: '/r' } })
    expect(sentryEnvelope('not a dsn', {} as any)).toBeNull()
  })
})

describe('formatAPIError', () => {
  it('server errors are reported and carry a reference for the user', async () => {
    const f = formatAPIError(new Error('db exploded'), { route: '/api/tasks', method: 'GET', profileId: 'p1' })
    expect(f.statusCode).toBe(500)
    expect(f.body.ref).toMatch(/^ERR-/)
    expect(f.body.error).toBe('An unexpected error occurred') // internals never leak
    await captureErrorAndWait(new Error('flush'), { source: 'api' })
    expect(created.find((c) => c.ref === f.body.ref)).toMatchObject({ route: '/api/tasks', statusCode: 500, profileId: 'p1' })
  })

  it('user errors (4xx) are not reported and carry no reference', () => {
    const f = formatAPIError(new ValidationError('Name is required'))
    expect(f.statusCode).toBe(400)
    expect(f.body.ref).toBeUndefined()
    expect(created).toHaveLength(0)
  })

  it('a 5xx AppError keeps its message and gains a reference', () => {
    const f = formatAPIError(new AppError('Payment provider unavailable', 'EXTERNAL_SERVICE' as any, 503))
    expect(f.body).toMatchObject({ error: 'Payment provider unavailable' })
    expect(f.body.ref).toMatch(/^ERR-/)
  })
})

describe('apiErrorMessage (what the UI shows)', async () => {
  const { apiErrorMessage } = await import('@/hooks/use-api')
  it('reads the string error the API actually sends, and appends the reference', () => {
    expect(apiErrorMessage({ error: 'Name is required', code: 'VALIDATION_FAILED' }, 400)).toBe('Name is required')
    expect(apiErrorMessage({ error: 'An unexpected error occurred', ref: 'ERR-ABCD2345' }, 500)).toBe('An unexpected error occurred (Reference: ERR-ABCD2345)')
    expect(apiErrorMessage({ error: { message: 'legacy shape' } }, 400)).toBe('legacy shape')
    expect(apiErrorMessage(null, 502)).toBe('Something went wrong on our side')
  })
})
