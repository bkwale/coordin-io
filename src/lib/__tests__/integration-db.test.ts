/**
 * Integration Tests — Real Database
 *
 * These tests connect to the actual Supabase PostgreSQL database and verify
 * that Prisma queries return correct results with real data. Unlike the unit
 * tests that mock Prisma, these prove the ORM layer, FK constraints, and
 * query shapes work end-to-end.
 *
 * Skipped unless INTEGRATION_TEST_DATABASE_URL is set:
 *   INTEGRATION_TEST_DATABASE_URL="postgresql://..." npx vitest run src/lib/__tests__/integration-db.test.ts
 *
 * All test data uses 'test-integ-' prefixed IDs and is cleaned up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const DB_URL = process.env.INTEGRATION_TEST_DATABASE_URL

// Conditional import — only load heavy deps when running
const shouldRun = !!DB_URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any = null

// Test entity IDs — prefixed for easy cleanup
const TEST_ORG_ID = 'test-integ-org-' + Date.now()
const TEST_PROFILE_ID = 'test-integ-profile-' + Date.now()
const TEST_PROFILE_2_ID = 'test-integ-profile2-' + Date.now()
const TEST_PROJECT_ID = 'test-integ-project-' + Date.now()
const TEST_MEMBERSHIP_ID = 'test-integ-membership-' + Date.now()
const TEST_MEMBERSHIP_2_ID = 'test-integ-membership2-' + Date.now()
const TEST_TASK_ID = 'test-integ-task-' + Date.now()
const TEST_TASK_2_ID = 'test-integ-task2-' + Date.now()
const TEST_NOTIFICATION_ID = 'test-integ-notif-' + Date.now()
const TEST_LEAVE_BALANCE_ID = 'test-integ-lb-' + Date.now()
const TEST_INVITATION_ID = 'test-integ-inv-' + Date.now()
const TEST_AUDIT_ID = 'test-integ-audit-' + Date.now()

describe.skipIf(!shouldRun)('Integration: Real Database', () => {
  beforeAll(async () => {
    const { PrismaClient } = await import('../../generated/prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const adapter = new PrismaPg({ connectionString: DB_URL! })
    prisma = new PrismaClient({ adapter })

    // Seed: org → 2 profiles → project → 2 memberships
    await prisma.organisation.create({
      data: {
        id: TEST_ORG_ID,
        name: 'Integration Test Org',
        slug: 'test-integ-' + Date.now(),
        defaultCurrency: 'GBP',
      },
    })

    await prisma.profile.createMany({
      data: [
        {
          id: TEST_PROFILE_ID,
          organisationId: TEST_ORG_ID,
          fullName: 'Test User One',
          email: 'integ-test-1@test.local',
          orgPermission: 'OWNER',
          status: 'ACTIVE',
        },
        {
          id: TEST_PROFILE_2_ID,
          organisationId: TEST_ORG_ID,
          fullName: 'Test User Two',
          email: 'integ-test-2@test.local',
          orgPermission: 'MEMBER',
          status: 'ACTIVE',
        },
      ],
    })

    await prisma.project.create({
      data: {
        id: TEST_PROJECT_ID,
        organisationId: TEST_ORG_ID,
        name: 'Integration Test Project',
        code: 'INTEG-' + Date.now(),
        status: 'ACTIVE',
      },
    })

    await prisma.projectMembership.createMany({
      data: [
        {
          id: TEST_MEMBERSHIP_ID,
          projectId: TEST_PROJECT_ID,
          profileId: TEST_PROFILE_ID,
          projectRole: 'PROJECT_LEAD',
        },
        {
          id: TEST_MEMBERSHIP_2_ID,
          projectId: TEST_PROJECT_ID,
          profileId: TEST_PROFILE_2_ID,
          projectRole: 'TEAM_MEMBER',
        },
      ],
    })
  })

  afterAll(async () => {
    if (!prisma) return
    // Clean up in reverse FK order
    try {
      await prisma.notification.deleteMany({ where: { id: TEST_NOTIFICATION_ID } })
      await prisma.invitation.deleteMany({ where: { id: TEST_INVITATION_ID } })
      await prisma.leaveBalance.deleteMany({ where: { id: TEST_LEAVE_BALANCE_ID } })
      await prisma.auditEvent.deleteMany({ where: { id: TEST_AUDIT_ID } })
      await prisma.task.deleteMany({ where: { projectId: TEST_PROJECT_ID } })
      await prisma.projectMembership.deleteMany({ where: { projectId: TEST_PROJECT_ID } })
      await prisma.project.deleteMany({ where: { id: TEST_PROJECT_ID } })
      await prisma.profile.deleteMany({ where: { organisationId: TEST_ORG_ID } })
      await prisma.organisation.deleteMany({ where: { id: TEST_ORG_ID } })
    } catch (e) {
      console.error('Integration test cleanup error:', e)
    }
    await prisma.$disconnect()
  })

  // ─── Organisation + Profile Queries ───────────────────────

  describe('Organisation & Profile queries', () => {
    it('finds the test org by ID', async () => {
      const org = await prisma.organisation.findUnique({
        where: { id: TEST_ORG_ID },
      })
      expect(org).not.toBeNull()
      expect(org.name).toBe('Integration Test Org')
      expect(org.defaultCurrency).toBe('GBP')
    })

    it('finds profiles by organisationId', async () => {
      const profiles = await prisma.profile.findMany({
        where: { organisationId: TEST_ORG_ID },
        orderBy: { fullName: 'asc' },
      })
      expect(profiles).toHaveLength(2)
      expect(profiles[0].fullName).toBe('Test User One')
      expect(profiles[1].fullName).toBe('Test User Two')
    })

    it('profile includes correct org relation', async () => {
      const profile = await prisma.profile.findUnique({
        where: { id: TEST_PROFILE_ID },
        include: { organisation: true },
      })
      expect(profile.organisation.id).toBe(TEST_ORG_ID)
      expect(profile.organisation.name).toBe('Integration Test Org')
    })

    it('filters profiles by orgPermission', async () => {
      const owners = await prisma.profile.findMany({
        where: { organisationId: TEST_ORG_ID, orgPermission: 'OWNER' },
      })
      expect(owners).toHaveLength(1)
      expect(owners[0].id).toBe(TEST_PROFILE_ID)
    })
  })

  // ─── Project + Membership Queries ─────────────────────────

  describe('Project & Membership queries', () => {
    it('finds project with members included', async () => {
      const project = await prisma.project.findUnique({
        where: { id: TEST_PROJECT_ID },
        include: {
          memberships: {
            include: {
              profile: { select: { id: true, fullName: true } },
            },
          },
        },
      })
      expect(project).not.toBeNull()
      expect(project.memberships).toHaveLength(2)
      const names = project.memberships.map((m: any) => m.profile.fullName).sort()
      expect(names).toEqual(['Test User One', 'Test User Two'])
    })

    it('membership has correct role', async () => {
      const membership = await prisma.projectMembership.findUnique({
        where: { id: TEST_MEMBERSHIP_ID },
      })
      expect(membership.projectRole).toBe('PROJECT_LEAD')
    })

    it('finds membership by composite project+profile lookup', async () => {
      const membership = await prisma.projectMembership.findFirst({
        where: {
          projectId: TEST_PROJECT_ID,
          profileId: TEST_PROFILE_2_ID,
        },
      })
      expect(membership).not.toBeNull()
      expect(membership.projectRole).toBe('TEAM_MEMBER')
    })

    it('cross-org isolation: other orgs cannot see this project', async () => {
      const projects = await prisma.project.findMany({
        where: {
          organisationId: 'non-existent-org-id',
        },
      })
      expect(projects).toHaveLength(0)
    })
  })

  // ─── Task CRUD + Includes ─────────────────────────────────

  describe('Task CRUD with real includes', () => {
    beforeAll(async () => {
      await prisma.task.createMany({
        data: [
          {
            id: TEST_TASK_ID,
            projectId: TEST_PROJECT_ID,
            title: 'Integration test task',
            ownerId: TEST_PROFILE_ID,
            reviewerId: TEST_PROFILE_2_ID,
            status: 'NOT_STARTED',
            priority: 'HIGH',
          },
          {
            id: TEST_TASK_2_ID,
            projectId: TEST_PROJECT_ID,
            title: 'Second test task',
            ownerId: TEST_PROFILE_2_ID,
            status: 'IN_PROGRESS',
            priority: 'MEDIUM',
            dueDate: new Date('2025-12-31'),
          },
        ],
      })
    })

    it('finds tasks with owner + reviewer includes (matches route query shape)', async () => {
      const tasks = await prisma.task.findMany({
        where: { projectId: TEST_PROJECT_ID },
        include: {
          owner: { select: { id: true, fullName: true } },
          reviewer: { select: { id: true, fullName: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      })
      expect(tasks.length).toBeGreaterThanOrEqual(2)
      // HIGH priority sorts first
      const highTask = tasks.find((t: any) => t.id === TEST_TASK_ID)
      expect(highTask.owner.fullName).toBe('Test User One')
      expect(highTask.reviewer.fullName).toBe('Test User Two')
    })

    it('finds tasks filtered by owner (My Work query pattern)', async () => {
      const myTasks = await prisma.task.findMany({
        where: {
          projectId: TEST_PROJECT_ID,
          OR: [
            { ownerId: TEST_PROFILE_2_ID },
            { reviewerId: TEST_PROFILE_2_ID },
          ],
        },
      })
      // Profile 2 owns task 2 and reviews task 1
      expect(myTasks).toHaveLength(2)
    })

    it('updates task status (state transition)', async () => {
      await prisma.task.update({
        where: { id: TEST_TASK_ID },
        data: { status: 'IN_PROGRESS' },
      })
      const updated = await prisma.task.findUnique({
        where: { id: TEST_TASK_ID },
      })
      expect(updated.status).toBe('IN_PROGRESS')
    })

    it('task.updatedAt changes on update', async () => {
      const before = await prisma.task.findUnique({ where: { id: TEST_TASK_ID } })
      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 50))
      await prisma.task.update({
        where: { id: TEST_TASK_ID },
        data: { status: 'READY_FOR_REVIEW' },
      })
      const after = await prisma.task.findUnique({ where: { id: TEST_TASK_ID } })
      expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(
        new Date(before.updatedAt).getTime()
      )
    })
  })

  // ─── Notification Creation ────────────────────────────────

  describe('Notification queries', () => {
    it('creates and retrieves a notification', async () => {
      await prisma.notification.create({
        data: {
          id: TEST_NOTIFICATION_ID,
          profileId: TEST_PROFILE_2_ID,
          type: 'task.assigned',
          title: 'You were assigned: Integration test task',
          linkUrl: `/projects/${TEST_PROJECT_ID}/tasks/${TEST_TASK_ID}`,
        },
      })

      const notifs = await prisma.notification.findMany({
        where: { profileId: TEST_PROFILE_2_ID, readAt: null },
      })
      const ours = notifs.find((n: any) => n.id === TEST_NOTIFICATION_ID)
      expect(ours).not.toBeNull()
      expect(ours.type).toBe('task.assigned')
      expect(ours.linkUrl).toContain(TEST_PROJECT_ID)
    })

    it('marks notification as read', async () => {
      await prisma.notification.update({
        where: { id: TEST_NOTIFICATION_ID },
        data: { readAt: new Date() },
      })
      const updated = await prisma.notification.findUnique({
        where: { id: TEST_NOTIFICATION_ID },
      })
      expect(updated.readAt).not.toBeNull()
    })
  })

  // ─── Leave Balance ────────────────────────────────────────

  describe('Leave balance queries', () => {
    it('creates and queries leave balance', async () => {
      await prisma.leaveBalance.create({
        data: {
          id: TEST_LEAVE_BALANCE_ID,
          profileId: TEST_PROFILE_ID,
          year: 2099, // far future to avoid collision
          allocation: 25,
          used: 5,
          carriedForward: 2,
        },
      })

      const balance = await prisma.leaveBalance.findUnique({
        where: { id: TEST_LEAVE_BALANCE_ID },
      })
      expect(balance.allocation).toBe(25)
      expect(balance.used).toBe(5)
      expect(balance.allocation - balance.used + balance.carriedForward).toBe(22)
    })

    it('unique constraint on profileId+year works', async () => {
      await expect(
        prisma.leaveBalance.create({
          data: {
            profileId: TEST_PROFILE_ID,
            year: 2099,
            allocation: 10,
          },
        })
      ).rejects.toThrow()
    })
  })

  // ─── Invitation ───────────────────────────────────────────

  describe('Invitation queries', () => {
    it('creates invitation with orgPermission', async () => {
      await prisma.invitation.create({
        data: {
          id: TEST_INVITATION_ID,
          organisationId: TEST_ORG_ID,
          email: 'integ-invited@test.local',
          token: 'test-token-' + Date.now(),
          orgPermission: 'HR',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
          createdById: TEST_PROFILE_ID,
          fullName: 'Integration Invited User',
        },
      })

      const inv = await prisma.invitation.findUnique({
        where: { id: TEST_INVITATION_ID },
        include: {
          createdBy: { select: { fullName: true } },
        },
      })
      expect(inv.orgPermission).toBe('HR')
      expect(inv.email).toBe('integ-invited@test.local')
      expect(inv.createdBy.fullName).toBe('Test User One')
    })
  })

  // ─── Audit Event ──────────────────────────────────────────

  describe('Audit event queries', () => {
    it('creates and queries audit events by entity', async () => {
      await prisma.auditEvent.create({
        data: {
          id: TEST_AUDIT_ID,
          organisationId: TEST_ORG_ID,
          actorId: TEST_PROFILE_ID,
          action: 'task.created',
          entityType: 'task',
          entityId: TEST_TASK_ID,
          metadata: { title: 'Integration test task' },
        },
      })

      const events = await prisma.auditEvent.findMany({
        where: {
          entityType: 'task',
          entityId: TEST_TASK_ID,
        },
        include: {
          actor: { select: { fullName: true } },
        },
      })
      const ours = events.find((e: any) => e.id === TEST_AUDIT_ID)
      expect(ours).not.toBeNull()
      expect(ours.actor.fullName).toBe('Test User One')
      expect(ours.metadata).toEqual({ title: 'Integration test task' })
    })
  })

  // ─── FK Constraint Enforcement ────────────────────────────

  describe('FK constraints enforced by database', () => {
    it('rejects task with non-existent projectId', async () => {
      await expect(
        prisma.task.create({
          data: {
            projectId: 'non-existent-project',
            title: 'Should fail',
          },
        })
      ).rejects.toThrow()
    })

    it('rejects project membership with non-existent profileId', async () => {
      await expect(
        prisma.projectMembership.create({
          data: {
            projectId: TEST_PROJECT_ID,
            profileId: 'non-existent-profile',
            projectRole: 'TEAM_MEMBER',
          },
        })
      ).rejects.toThrow()
    })

    it('rejects notification with non-existent profileId', async () => {
      await expect(
        prisma.notification.create({
          data: {
            profileId: 'non-existent-profile',
            type: 'test',
            title: 'Should fail',
          },
        })
      ).rejects.toThrow()
    })
  })
})
