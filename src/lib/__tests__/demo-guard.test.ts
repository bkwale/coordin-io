import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { NextRequest } from 'next/server'

/**
 * Security: the anonymous public demo (/demo-access, no login) must be READ-ONLY.
 * Before this, anyone could start a demo and send invitation emails, upload files, spend AI budget
 * and edit the demo org — 146 write routes accepted the demo identity.
 */
const findFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { profile: { findFirst: (...a: unknown[]) => findFirst(...a) } } }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: new Error('no session') }) } }),
}))

import { withAuth } from '@/lib/with-auth'
import { withProjectAccess } from '@/lib/with-project-access'
import { withTaskAccess } from '@/lib/with-task-access'
import { withDocumentAccess, withRevisionAccess } from '@/lib/with-document-access'

const demoReq = (method: string) => new NextRequest('http://localhost/api/anything/p1', { method, headers: { cookie: `coordin_demo_start=${Date.now()}` } })
const ctx = { params: Promise.resolve({ id: 'p1', taskId: 't1', documentId: 'd1', revisionId: 'r1' }) }

const gates: Array<[string, (h: any) => any]> = [
  ['withAuth', (h) => withAuth(h)],
  ['withProjectAccess', (h) => withProjectAccess(h)],
  ['withTaskAccess', (h) => withTaskAccess(h)],
  ['withDocumentAccess', (h) => withDocumentAccess(h)],
  ['withRevisionAccess', (h) => withRevisionAccess(h)],
]

describe('anonymous demo is read-only at every auth gate', () => {
  beforeEach(() => { findFirst.mockReset(); findFirst.mockResolvedValue({ id: 'demo_owner', organisationId: 'demo_org_sterling_2026', orgPermission: 'OWNER', status: 'ACTIVE' }) })

  for (const [name, wrap] of gates) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      it(`${name} refuses ${method} from a demo visitor before touching the database`, async () => {
        const handler = vi.fn()
        const res = await wrap(handler)(demoReq(method), ctx)
        expect(res.status).toBe(403)
        expect((await res.json()).code).toBe('DEMO_READ_ONLY')
        expect(handler).not.toHaveBeenCalled()
        expect(findFirst).not.toHaveBeenCalled()
      })
    }
  }

  it('caps demo reads per IP (demo visitors skip the per-user limit)', async () => {
    const { DEMO_READS_PER_MINUTE } = await import('@/lib/demo-guard')
    const handler = vi.fn(async () => new Response('{}', { status: 200 }))
    const req = () => new NextRequest('http://localhost/api/x', { headers: { cookie: `coordin_demo_start=${Date.now()}`, 'x-real-ip': '203.0.113.9' } })
    for (let i = 0; i < DEMO_READS_PER_MINUTE; i++) expect((await withAuth(handler as any)(req(), ctx)).status).toBe(200)
    expect((await withAuth(handler as any)(req(), ctx)).status).toBe(429)
  })
  it('still lets a demo visitor read (GET passes through as the demo identity)', async () => {
    const handler = vi.fn(async (_r: unknown, c: { authUserId: string }) => new Response(JSON.stringify({ who: c.authUserId }), { status: 200 }))
    const res = await withAuth(handler as any)(demoReq('GET'), ctx)
    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
    expect((await res.json()).who).toBe('demo-user')
  })
})

describe('the demo identity can only be granted by the guarded gates', () => {
  // If someone adds a new place that reads the demo cookie, it must also enforce read-only. This test makes them look.
  const ALLOWED = new Set([
    'src/lib/demo-timer.ts', 'src/lib/demo-guard.ts', 'src/lib/supabase/middleware.ts',
    'src/lib/with-auth.ts', 'src/lib/with-project-access.ts', 'src/lib/with-task-access.ts', 'src/lib/with-document-access.ts',
    'src/lib/demo-cookie.ts', 'src/app/api/demo/start/route.ts', 'src/components/DemoTimerProvider.tsx', 'src/components/DemoExpiredOverlay.tsx', 'src/app/demo-access/page.tsx',
  ])
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === '__tests__' || f === 'generated' ? [] : walk(p)
    return /\.(ts|tsx)$/.test(f) ? [p] : []
  })
  it('no other source file reads the demo cookie', () => {
    const root = process.cwd()
    const offenders = walk(join(root, 'src'))
      .filter((p) => /coordin_demo_start|DEMO_COOKIE/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p))
      .filter((p) => !ALLOWED.has(p))
    expect(offenders).toEqual([])
  })
  it('every gate that grants the demo identity refuses writes first', () => {
    for (const f of ['with-auth', 'with-project-access', 'with-task-access', 'with-document-access']) {
      const src = readFileSync(join(process.cwd(), 'src/lib', `${f}.ts`), 'utf8')
      const grants = (src.match(/demoStart < DEMO_DURATION_MS/g) ?? []).length
      const guards = (src.match(/if \(isDemoWrite\(request\)\) return demoWriteRefused\(request\)/g) ?? []).length
      const limits = (src.match(/const demoLimited = await demoReadLimit\(request\)/g) ?? []).length
      expect({ file: f, guards, limits }).toEqual({ file: f, guards: grants, limits: grants })
    }
  })
})
