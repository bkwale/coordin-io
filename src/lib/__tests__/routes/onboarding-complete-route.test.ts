import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMockProfile,
  createMockRequest,
} from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// vi.hoisted — values available to vi.mock factories (runs before imports)
// ---------------------------------------------------------------------------

const ctx = vi.hoisted(() => {
  const m = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mock-id', ...data })),
    update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'mock-id', ...data })),
    delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'mock-id', ...create })),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  })

  const mockRecordAuditEvent = vi.fn().mockResolvedValue(undefined)

  return {
    prisma: {
      profile: m(),
      project: m(),
      task: m(),
      leaveRequest: m(),
      leaveBalance: m(),
      expenseClaim: m(),
      notification: m(),
      projectMembership: m(),
      policyDocument: m(),
      policyAcknowledgement: m(),
      trainingItem: m(),
      trainingCompletion: m(),
      employeeProfile: m(),
      hRDocument: m(),
      resourceAllocation: m(),
      probationReview: m(),
      timesheetWeek: m(),
      timesheetEntry: m(),
      auditEvent: m(),
      $transaction: vi.fn(),
    },
    profileRef: { current: null as any },
    mockRecordAuditEvent,
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({ prisma: ctx.prisma }))

vi.mock('@/lib/with-auth', () => ({
  withAuth: (handler: any) => {
    return async (req: any) => {
      try {
        return await handler(req, { authUserId: 'auth-1', profile: ctx.profileRef.current })
      } catch (err: any) {
        if (err?.statusCode) {
          const body: Record<string, unknown> = { error: err.message, code: err.code }
          if (err.metadata && Object.keys(err.metadata).length > 0) body.details = err.metadata
          return new Response(JSON.stringify(body), { status: err.statusCode, headers: { 'content-type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }
  },
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: ctx.mockRecordAuditEvent,
  AuditActions: { ONBOARDING_COMPLETED: 'onboarding.completed' },
}))

import { POST } from '@/app/api/onboarding/complete/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = ctx.prisma

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/onboarding/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.profileRef.current = createMockProfile({
      status: 'ONBOARDING',
      employeeProfile: { id: 'ep-1', onboardingComplete: false },
    })
  })

  it('rejects when mandatory policies are incomplete', async () => {
    mockPrisma.policyDocument.count.mockResolvedValue(3)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(1)
    mockPrisma.trainingItem.count.mockResolvedValue(0)
    mockPrisma.trainingCompletion.count.mockResolvedValue(0)

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('not complete')
    expect(json.details.missing).toEqual(
      expect.arrayContaining([
        expect.stringContaining('2 of 3 mandatory policies'),
      ]),
    )
  })

  it('rejects when mandatory training is incomplete', async () => {
    mockPrisma.policyDocument.count.mockResolvedValue(2)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(2)
    mockPrisma.trainingItem.count.mockResolvedValue(5)
    mockPrisma.trainingCompletion.count.mockResolvedValue(3)

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('not complete')
    expect(json.details.missing).toEqual(
      expect.arrayContaining([
        expect.stringContaining('2 of 5 mandatory training'),
      ]),
    )
  })

  it('rejects when both policies and training are incomplete', async () => {
    mockPrisma.policyDocument.count.mockResolvedValue(3)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(1)
    mockPrisma.trainingItem.count.mockResolvedValue(4)
    mockPrisma.trainingCompletion.count.mockResolvedValue(2)

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.details.missing).toHaveLength(2)
  })

  it('succeeds and marks profile ACTIVE when all prerequisites are met', async () => {
    mockPrisma.policyDocument.count.mockResolvedValue(2)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(2)
    mockPrisma.trainingItem.count.mockResolvedValue(3)
    mockPrisma.trainingCompletion.count.mockResolvedValue(3)
    mockPrisma.profile.update.mockResolvedValue({ id: 'profile-1', status: 'ACTIVE' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.status).toBe('ACTIVE')
    expect(json.data.message).toContain('welcome')

    const profileUpdateCall = mockPrisma.profile.update.mock.calls[0][0]
    expect(profileUpdateCall.where.id).toBe('profile-1')
    expect(profileUpdateCall.data.status).toBe('ACTIVE')
  })

  it('updates employeeProfile onboarding flag when employee profile exists', async () => {
    mockPrisma.policyDocument.count.mockResolvedValue(0)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(0)
    mockPrisma.trainingItem.count.mockResolvedValue(0)
    mockPrisma.trainingCompletion.count.mockResolvedValue(0)
    mockPrisma.profile.update.mockResolvedValue({ id: 'profile-1', status: 'ACTIVE' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    await POST(req)

    expect(mockPrisma.employeeProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ep-1' },
        data: expect.objectContaining({ onboardingComplete: true }),
      }),
    )
  })

  it('skips employeeProfile update when employee profile is null', async () => {
    ctx.profileRef.current = createMockProfile({
      status: 'ONBOARDING',
      employeeProfile: null,
    })

    mockPrisma.policyDocument.count.mockResolvedValue(0)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(0)
    mockPrisma.trainingItem.count.mockResolvedValue(0)
    mockPrisma.trainingCompletion.count.mockResolvedValue(0)
    mockPrisma.profile.update.mockResolvedValue({ id: 'profile-1', status: 'ACTIVE' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.employeeProfile.update).not.toHaveBeenCalled()
  })

  it('succeeds when zero mandatory policies and zero training exist', async () => {
    mockPrisma.policyDocument.count.mockResolvedValue(0)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(0)
    mockPrisma.trainingItem.count.mockResolvedValue(0)
    mockPrisma.trainingCompletion.count.mockResolvedValue(0)
    mockPrisma.profile.update.mockResolvedValue({ id: 'profile-1', status: 'ACTIVE' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe('ACTIVE')
  })

  it('calls recordAuditEvent on successful completion', async () => {
    mockPrisma.policyDocument.count.mockResolvedValue(0)
    mockPrisma.policyAcknowledgement.count.mockResolvedValue(0)
    mockPrisma.trainingItem.count.mockResolvedValue(0)
    mockPrisma.trainingCompletion.count.mockResolvedValue(0)
    mockPrisma.profile.update.mockResolvedValue({ id: 'profile-1', status: 'ACTIVE' })

    const req = createMockRequest({
      method: 'POST',
      url: 'http://localhost/api/onboarding/complete',
      body: {},
    })
    await POST(req)

    expect(ctx.mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        actorId: 'profile-1',
        entityType: 'profile',
        entityId: 'profile-1',
      }),
    )
  })
})
