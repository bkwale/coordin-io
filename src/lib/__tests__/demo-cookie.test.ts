import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/** Security: the demo pass is issued and signed by the server; the browser can't mint or extend one. */
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { profile: { findFirst: (...a: unknown[]) => findFirst(...a) } } }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: new Error('no session') }) } }),
}))
import { signDemoStart, readDemoStart } from '@/lib/demo-cookie'

const SECRET = 'x'.repeat(48)
const now = 1_793_800_000_000

describe('demo cookie signing', () => {
  it('round-trips a signed start time', async () => {
    const v = await signDemoStart(now, SECRET)
    expect(v).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/)
    expect(await readDemoStart(v, SECRET, now + 1000)).toBe(now)
  })
  it('rejects a forged signature', async () => {
    const v = await signDemoStart(now, SECRET)
    expect(await readDemoStart(v.slice(0, -2) + 'AA', SECRET, now)).toBeNaN()
  })
  it('rejects a tampered start time (extending the demo)', async () => {
    const [, sig] = (await signDemoStart(now, SECRET)).split('.')
    expect(await readDemoStart(`${now + 3_600_000}.${sig}`, SECRET, now + 3_600_000)).toBeNaN()
  })
  it('rejects an unsigned value once a secret is configured', async () => {
    expect(await readDemoStart(String(now), SECRET, now)).toBeNaN()
  })
  it('rejects a cookie signed with a different secret', async () => {
    expect(await readDemoStart(await signDemoStart(now, 'y'.repeat(48)), SECRET, now)).toBeNaN()
  })
  it('rejects future timestamps and junk', async () => {
    expect(await readDemoStart(await signDemoStart(now + 3_600_000, SECRET), SECRET, now)).toBeNaN()
    for (const junk of ['', 'abc', '123', `${now}.a.b`, '-1', `${now}abc`]) expect(await readDemoStart(junk, SECRET, now)).toBeNaN()
  })
  it('without a secret (rollout), accepts the legacy unsigned value — demo is read-only anyway', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await readDemoStart(String(now), null, now)).toBe(now)
    expect(await signDemoStart(now, null)).toBe(String(now))
  })
})

describe('with a secret set, a forged demo cookie gets no demo identity', () => {
  beforeEach(() => { process.env.DEMO_COOKIE_SECRET = SECRET; findFirst.mockReset() })
  afterEach(() => { delete process.env.DEMO_COOKIE_SECRET })
  it('withAuth GET with an unsigned cookie falls through to normal auth → 401', async () => {
    const { withAuth } = await import('@/lib/with-auth')
    const handler = vi.fn()
    const res = await withAuth(handler)(new NextRequest('http://localhost/api/me', { headers: { cookie: `coordin_demo_start=${Date.now()}` } }))
    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
    expect(findFirst).not.toHaveBeenCalled()
  })
  it('withAuth GET with a properly signed cookie gets the demo identity', async () => {
    findFirst.mockResolvedValue({ id: 'demo_owner', organisationId: 'demo_org_sterling_2026', orgPermission: 'OWNER', status: 'ACTIVE' })
    const { withAuth } = await import('@/lib/with-auth')
    const handler = vi.fn(async () => new Response('{}', { status: 200 }))
    const res = await withAuth(handler as any)(new NextRequest('http://localhost/api/me', { headers: { cookie: `coordin_demo_start=${await signDemoStart(Date.now(), SECRET)}` } }))
    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
  })
})
