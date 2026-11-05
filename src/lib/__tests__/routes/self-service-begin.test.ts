import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockRequest } from '../helpers/test-utils'

const ctx = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) })
  const prisma: any = { onboardingSelfServiceToken: m(), onboardingTask: m(), profile: m(), onboardingAssignment: m() }
  return { prisma, start: vi.fn().mockResolvedValue(undefined), win: vi.fn() }
})
vi.mock('@/lib/prisma-modules', () => ({ modulesPrisma: ctx.prisma }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(null), RateLimitPresets: { auth: {} } }))
vi.mock('@/lib/onboarding/window-service', () => ({
  startWindowOnActivation: (...a: unknown[]) => ctx.start(...a),
  windowForLink: (...a: unknown[]) => ctx.win(...a),
}))
import { POST as BEGIN } from '@/app/api/onboarding/self-service/begin/route'
import { GET as VERIFY } from '@/app/api/onboarding/self-service/verify/route'

const P = ctx.prisma
const token = 'b'.repeat(64)
const tok = (over: Record<string, unknown> = {}) => ({
  id: 't1', assignmentId: 'as-1', usedAt: null, revokedAt: null, completedAt: null, expiresAt: new Date(Date.now() + 5 * 864e5),
  profileId: 'emp-1', profile: { id: 'emp-1', fullName: 'Ada', email: 'a@x', startDate: null, jobTitle: null, avatarUrl: null },
  organisation: { id: 'org-1', name: 'CWA' }, ...over,
})

describe('invitation link: opening vs Begin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.win.mockResolvedValue({ started: false, days: 7, startAt: null, dueAt: null, dueLabel: null, daysRemaining: null })
  })

  it('opening the link (GET) changes nothing — scanners can\'t start the clock', async () => {
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue(tok())
    const res = await VERIFY(createMockRequest({ method: 'GET', url: `http://localhost/api/onboarding/self-service/verify?token=${token}` }))
    expect(res.status).toBe(200)
    expect(ctx.start).not.toHaveBeenCalled()
    expect(P.onboardingSelfServiceToken.update).not.toHaveBeenCalled()
    expect(P.onboardingSelfServiceToken.updateMany).not.toHaveBeenCalled()
    expect((await res.json()).data.window).toMatchObject({ started: false, days: 7 })
  })

  it('Begin (POST) marks the link used and starts the window', async () => {
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue(tok())
    ctx.win.mockResolvedValue({ started: true, days: 7, dueLabel: '12 November', daysRemaining: 7 })
    const res = await BEGIN(createMockRequest({ method: 'POST', url: 'http://localhost/api/onboarding/self-service/begin', body: { token } }))
    expect(res.status).toBe(200)
    expect(P.onboardingSelfServiceToken.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 't1', usedAt: null } })
    expect(ctx.start).toHaveBeenCalledWith('as-1', 't1')
    expect((await res.json()).data.window).toMatchObject({ started: true, dueLabel: '12 November' })
  })

  it('pressing Begin again is harmless', async () => {
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue(tok({ usedAt: new Date() }))
    expect((await BEGIN(createMockRequest({ method: 'POST', url: 'http://localhost/api/onboarding/self-service/begin', body: { token } }))).status).toBe(200)
    expect(P.onboardingSelfServiceToken.updateMany).not.toHaveBeenCalled()
  })

  it('expired, revoked, completed or unknown links are refused', async () => {
    const call = () => BEGIN(createMockRequest({ method: 'POST', url: 'http://localhost/api/onboarding/self-service/begin', body: { token } }))
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue(tok({ expiresAt: new Date(Date.now() - 1000) }))
    expect((await call()).status).toBe(410)
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue(tok({ revokedAt: new Date() }))
    expect((await call()).status).toBe(410)
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue(tok({ completedAt: new Date() }))
    expect((await call()).status).toBe(410)
    P.onboardingSelfServiceToken.findUnique.mockResolvedValue(null)
    expect((await call()).status).toBe(404)
    expect((await BEGIN(createMockRequest({ method: 'POST', url: 'http://localhost/api/onboarding/self-service/begin', body: { token: 'short' } }))).status).toBe(400)
    expect(ctx.start).not.toHaveBeenCalled()
  })
})
